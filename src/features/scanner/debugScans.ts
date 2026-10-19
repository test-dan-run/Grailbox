import type { PictureRef } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';

import { medoid, type FrameQuality, type FrameSelection, type QualityDrop } from './frames';
import type { CropRect } from './preprocess';
import { cosine, type RankedMatch } from './similarity';

/*
 * Development only: keeps each scanner photo with the crop and scores it got,
 * so matching can be tuned offline on real scans. Pull them with
 * `adb exec-out run-as app.grailbox tar c files/scan-debug | tar x`.
 *
 * Scan angle videos get the same treatment in files/frame-debug: every
 * sampled frame, with its quality, its similarities and what happened to it.
 */

export async function saveDebugScan(
  picture: PictureRef,
  info: { crop?: CropRect; screen: { width: number; height: number }; ranked: RankedMatch[] },
) {
  const dir = new Directory(Paths.document, 'scan-debug');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = new Date().toISOString().replace(/[:.]/g, '-');
  // quality must be 1: expo-camera's Android savePictureAsync does `quality.toInt() * 100`, so anything below 1 saves at 0.
  const saved = new File((await picture.savePictureAsync({ quality: 1 })).uri);
  saved.moveSync(new File(dir, `${name}.jpg`));
  new File(dir, `${name}.json`).write(
    JSON.stringify({ width: picture.width, height: picture.height, ...info }, null, 2),
  );
}

export function saveDebugFrames({
  samples,
  full,
  poor,
  kept,
  vectors,
  cover,
  selection,
  timing,
}: {
  samples: { time: number; file: File; quality: FrameQuality }[];
  /** The first frame before cropping, with the crop it got. */
  full?: { file: File; width: number; height: number; crop: CropRect };
  poor: { index: number; reason: QualityDrop }[];
  /** Indices into `samples` of the frames that were embedded, matching `vectors`. */
  kept: number[];
  vectors: Float32Array[];
  cover: Float32Array;
  /** Indices into `kept`. */
  selection: FrameSelection;
  timing: { readMs: number; decodeMs: number; prepareMs: number; embedMs: number };
}) {
  const dir = new Directory(Paths.document, 'frame-debug', new Date().toISOString().replace(/[:.]/g, '-'));
  dir.create({ intermediates: true, idempotent: true });
  const result = new Map<number, string>(poor.map((d) => [d.index, d.reason]));
  for (const d of selection.dropped) result.set(kept[d.index], d.reason);
  selection.chosen.forEach((k, rank) => result.set(kept[k], `chosen ${rank + 1}`));
  const center = vectors[medoid(vectors)];
  const frames = samples.map((s, i) => {
    const name = `${String(i).padStart(2, '0')}.jpg`;
    s.file.copySync(new File(dir, name));
    const k = kept.indexOf(i);
    return {
      file: name,
      time: Number(s.time.toFixed(3)),
      ...s.quality,
      to_cover: k >= 0 ? Number(cosine(cover, vectors[k]).toFixed(4)) : undefined,
      to_medoid: k >= 0 && center ? Number(cosine(center, vectors[k]).toFixed(4)) : undefined,
      result: result.get(i) ?? 'kept',
    };
  });
  if (full) full.file.copySync(new File(dir, 'full.jpg'));
  const fullFrame = full && { width: full.width, height: full.height, crop: full.crop };
  new File(dir, 'frames.json').write(JSON.stringify({ timing, full: fullFrame, frames }, null, 2));
}
