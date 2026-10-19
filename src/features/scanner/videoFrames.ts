import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from 'expo-video';

import { newId } from '@/lib/id';
import { photoUri, storeFramePhoto } from '@/lib/photos';

import { saveDebugFrames } from './debugScans';
import { embedImage, embedTensor, prepareImage } from './embedder';
import { filterFrames, frameQuality, sampleTimes, selectFrames, type FrameQuality } from './frames';
import { INPUT_SIZE, type CropRect } from './preprocess';

/*
 * Scan angles, native part: reads frames of a turnaround video, keeps the
 * sharp and well exposed ones, embeds them, and stores the few that show the
 * item from the most different angles (frames.ts). The chosen frames become
 * hidden reference photos for the scanner.
 */

/** Stored frames are twice the model's input, so a later model with a larger input can embed them again. */
const FRAME_PX = 2 * INPUT_SIZE;
/** Video frames are decoded this wide. The scanner's crop of a 720 px wide portrait frame is about 450 px. */
const DECODE_WIDTH = 720;
/** Frames decoded at once. Android decodes every requested frame in parallel, at 3.7 MB for each 720 × 1280 frame. */
const BATCH = 6;

export interface PickedFrame {
  path: string;
  vector: Float32Array;
}

export interface ScanAngles {
  /** Stored frames, in the order they were picked. */
  frames: PickedFrame[];
  /** The cover photo's vector, the same one references.ts would compute. */
  cover: PickedFrame;
}

export type PickProgress = { stage: 'reading' | 'comparing'; done: number; total: number };

export class PickCancelled extends Error {
  constructor() {
    super('Picking scan angles was cancelled');
  }
}

interface Sample {
  time: number;
  file: File;
  input: Float32Array;
  quality: FrameQuality;
}

/** Development only: one uncropped frame and its crop, to check that crops match the guides. */
export interface FullFrame {
  file: File;
  width: number;
  height: number;
  crop: CropRect;
}

/**
 * Picks scan angle frames from `video`, a file URI. `cover` is the stored
 * cover photo, and `crop` maps a frame's size to the square to keep. Throws
 * PickCancelled when `cancelled` turns true.
 */
export async function pickScanAngles(
  video: string,
  {
    cover,
    crop,
    onProgress,
    cancelled,
  }: {
    cover: string;
    crop: (width: number, height: number) => CropRect;
    onProgress?: (p: PickProgress) => void;
    cancelled?: () => boolean;
  },
): Promise<ScanAngles> {
  const check = () => {
    if (cancelled?.()) throw new PickCancelled();
  };
  const work = new Directory(Paths.cache, 'scan-angles', newId());
  work.create({ intermediates: true, idempotent: true });
  // Embed the cover photo while the video is read, which doesn't use the model.
  const coverEmbedding = embedImage(photoUri(cover)!);
  coverEmbedding.catch(() => {});
  try {
    const t0 = performance.now();
    const full: { frame?: FullFrame } = {};
    const read = { decodeMs: 0, prepareMs: 0 };
    const samples = await sampleFrames(video, work, crop, full, read, (done, total) => {
      check();
      onProgress?.({ stage: 'reading', done, total });
    });
    const t1 = performance.now();

    const { kept, dropped: poor } = filterFrames(samples.map((s) => s.quality));
    const vectors: Float32Array[] = [];
    for (const i of kept) {
      check();
      onProgress?.({ stage: 'comparing', done: vectors.length, total: kept.length });
      vectors.push(await embedTensor(samples[i].input));
    }
    onProgress?.({ stage: 'comparing', done: kept.length, total: kept.length });
    const coverVector = await coverEmbedding;
    check();
    const t2 = performance.now();

    const selection = selectFrames(
      kept.map((i, k) => ({ vector: vectors[k], sharpness: samples[i].quality.sharpness })),
      { seed: coverVector },
    );
    if (__DEV__) {
      console.log(
        `[Frames] read ${samples.length} frames in ${Math.round(t1 - t0)} ms (decode ${Math.round(read.decodeMs)}, prepare ${Math.round(read.prepareMs)}), embedded ${kept.length} in ${Math.round(t2 - t1)} ms, kept ${selection.chosen.length}`,
      );
      try {
        saveDebugFrames({
          samples,
          full: full.frame,
          poor,
          kept,
          vectors,
          cover: coverVector,
          selection,
          timing: { readMs: t1 - t0, ...read, embedMs: t2 - t1 },
        });
      } catch (e) {
        console.warn('Debug frames not saved', e);
      }
    }
    return {
      frames: selection.chosen.map((k) => ({ path: storeFramePhoto(samples[kept[k]].file), vector: vectors[k] })),
      cover: { path: cover, vector: coverVector },
    };
  } finally {
    try {
      work.delete();
    } catch {
      // Only cache files are left behind.
    }
  }
}

/** Deletes a video the app recorded or copied into its cache. Videos elsewhere are not the app's to delete. */
export function deleteCachedVideo(uri: string) {
  if (!uri.startsWith(Paths.cache.uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // A missing file is already gone.
  }
}

/**
 * Every sampled frame, cropped and saved to `dir`, with its model input and
 * quality. Adds the time spent decoding video frames and preparing them to `timing`.
 */
async function sampleFrames(
  video: string,
  dir: Directory,
  crop: (width: number, height: number) => CropRect,
  full: { frame?: FullFrame },
  timing: { decodeMs: number; prepareMs: number },
  progress: (done: number, total: number) => void,
): Promise<Sample[]> {
  const player = createVideoPlayer(video);
  try {
    const times = sampleTimes(await loadedDuration(player));
    const out: Sample[] = [];
    for (let b = 0; b < times.length; b += BATCH) {
      progress(b, times.length);
      let t = performance.now();
      const batch = await thumbnails(player, times.slice(b, b + BATCH));
      timing.decodeMs += performance.now() - t;
      t = performance.now();
      for (const thumb of batch) {
        try {
          if (__DEV__ && !full.frame) full.frame = await saveFullFrame(thumb, crop, dir);
          out.push({ time: thumb.requestedTime, ...(await prepareFrame(thumb, crop, dir)) });
        } finally {
          thumb.release();
        }
      }
      timing.prepareMs += performance.now() - t;
    }
    progress(times.length, times.length);
    return out;
  } finally {
    player.release();
  }
}

/** The video's length in seconds, once the player has read it. */
function loadedDuration(player: VideoPlayer): Promise<number> {
  if (player.status === 'readyToPlay' && player.duration > 0) return Promise.resolve(player.duration);
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      subscriptions.forEach((s) => s.remove());
    };
    const subscriptions = [
      player.addListener('sourceLoad', ({ duration }) => {
        done();
        resolve(duration || player.duration);
      }),
      player.addListener('statusChange', ({ status, error }) => {
        if (status !== 'error') return;
        done();
        reject(new Error(error?.message ?? 'Could not open the video'));
      }),
    ];
    const timer = setTimeout(() => {
      done();
      reject(new Error('Could not open the video'));
    }, 10_000);
  });
}

/** Frames at `times`. One frame that fails to decode fails the whole call, so retry one at a time and skip it. */
async function thumbnails(player: VideoPlayer, times: number[]): Promise<VideoThumbnail[]> {
  try {
    return await player.generateThumbnailsAsync(times, { maxWidth: DECODE_WIDTH });
  } catch {
    const out: VideoThumbnail[] = [];
    for (const t of times) {
      try {
        out.push(...(await player.generateThumbnailsAsync(t, { maxWidth: DECODE_WIDTH })));
      } catch (e) {
        console.warn(`Scan angles: no frame at ${t.toFixed(2)} s`, e);
      }
    }
    return out;
  }
}

/**
 * Crops a frame to the square to keep, and saves it as a FRAME_PX JPEG in
 * `dir`. The model input and the quality come from the cropped image in
 * memory, so the JPEG isn't read back.
 */
async function prepareFrame(
  thumb: VideoThumbnail,
  crop: (width: number, height: number) => CropRect,
  dir: Directory,
): Promise<Omit<Sample, 'time'>> {
  const image = await ImageManipulator.manipulate(thumb)
    .crop(crop(thumb.width, thumb.height))
    .resize({ width: FRAME_PX, height: FRAME_PX })
    .renderAsync();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    const name = `${newId()}.jpg`;
    new File(saved.uri).moveSync(new File(dir, name));
    const { input, pixels } = await prepareImage(image);
    return { file: new File(dir, name), input, quality: frameQuality(pixels, INPUT_SIZE, INPUT_SIZE, 3) };
  } finally {
    image.release();
  }
}

async function saveFullFrame(thumb: VideoThumbnail, crop: (width: number, height: number) => CropRect, dir: Directory): Promise<FullFrame> {
  const image = await ImageManipulator.manipulate(thumb).renderAsync();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    const file = new File(dir, 'full.jpg');
    new File(saved.uri).moveSync(file);
    return { file: new File(dir, 'full.jpg'), width: thumb.width, height: thumb.height, crop: crop(thumb.width, thumb.height) };
  } finally {
    image.release();
  }
}
