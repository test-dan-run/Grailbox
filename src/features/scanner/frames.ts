import { cosine } from './similarity';

/*
 * Scan angles: picks a few frames of a turnaround video to keep as extra
 * reference photos for an item. Pure functions only, so they run under Jest.
 * videoFrames.ts does the native parts (sampling, cropping, embedding).
 *
 * The limits below are first guesses, to be tuned from the frame-debug files
 * of real videos (see docs/IMPLEMENTATION.md).
 */

/**
 * The least time between sampled frames, in seconds, and the most frames
 * sampled from one video. Reading a frame takes about 0.45 s on a Galaxy
 * S24+, so a 10 s video gives 16 frames, about 0.6 s apart.
 */
export const SAMPLE_INTERVAL = 0.33;
export const MAX_SAMPLES = 16;
/** Consecutive samples per window; the sharpest frame of each window is kept, so at most 8 frames are embedded. */
export const WINDOW_SIZE = 2;
/** Mean brightness (0 to 255) a frame must fall between. */
export const MIN_BRIGHTNESS = 40;
export const MAX_BRIGHTNESS = 225;
/** The largest share of pixels that may be almost black or almost white. */
export const MAX_CLIPPED = 0.4;
/** A frame less sharp than this share of the median sharpness is blurry. */
export const MIN_RELATIVE_SHARPNESS = 0.35;
/** Frames kept per item, on top of the cover photo. */
export const MAX_FRAMES = 5;
/** A frame this unlike both the cover photo and the medoid shows something else. */
export const OFF_ITEM_CUTOFF = 0.5;
/** A frame this like an already chosen photo adds no new angle. */
export const DUPLICATE_SIMILARITY = 0.95;
/** How much sharpness counts against difference when choosing between frames. */
export const SHARPNESS_BONUS = 0.05;

/**
 * `MAX_SAMPLES` or fewer times spread evenly over the video, each in the
 * middle of its slice, so the shaky first and last moments are skipped.
 */
export function sampleTimes(duration: number, interval = SAMPLE_INTERVAL, max = MAX_SAMPLES): number[] {
  if (!(duration > 0)) return [];
  const count = Math.min(max, Math.max(1, Math.floor(duration / interval)));
  return Array.from({ length: count }, (_, k) => ((k + 0.5) * duration) / count);
}

export interface FrameQuality {
  /** Variance of the Laplacian of the brightness: higher is sharper. */
  sharpness: number;
  /** Mean brightness, 0 to 255. */
  brightness: number;
  /** Share of pixels that are almost black or almost white. */
  clipped: number;
}

/**
 * Sharpness and exposure of row-major RGB or RGBA pixels. The Laplacian is a
 * 3 × 3 edge filter, so a blurry frame, with soft edges, gets a low variance.
 */
export function frameQuality(pixels: Uint8Array, width: number, height: number, channels: 3 | 4): FrameQuality {
  const count = width * height;
  const luma = new Float32Array(count);
  let sum = 0;
  let clipped = 0;
  for (let p = 0; p < count; p++) {
    const i = p * channels;
    const y = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    luma[p] = y;
    sum += y;
    if (y < 10 || y > 245) clipped++;
  }
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const lap = luma[p - 1] + luma[p + 1] + luma[p - width] + luma[p + width] - 4 * luma[p];
      // Welford's running variance.
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  return { sharpness: n ? m2 / n : 0, brightness: count ? sum / count : 0, clipped: count ? clipped / count : 0 };
}

export type QualityDrop = 'dark' | 'bright' | 'blurry';

/**
 * The frames worth embedding, in time order. Drops badly exposed frames, keeps
 * the sharpest of each `windowSize` consecutive frames, and then drops frames
 * much blurrier than the rest.
 */
export function filterFrames(
  frames: FrameQuality[],
  windowSize = WINDOW_SIZE,
): { kept: number[]; dropped: { index: number; reason: QualityDrop }[] } {
  const dropped: { index: number; reason: QualityDrop }[] = [];
  const exposed: number[] = [];
  frames.forEach((q, i) => {
    if (q.brightness < MIN_BRIGHTNESS || (q.clipped > MAX_CLIPPED && q.brightness < 128)) dropped.push({ index: i, reason: 'dark' });
    else if (q.brightness > MAX_BRIGHTNESS || q.clipped > MAX_CLIPPED) dropped.push({ index: i, reason: 'bright' });
    else exposed.push(i);
  });

  const sharpest: number[] = [];
  for (let w = 0; w < exposed.length; w += windowSize) {
    const group = exposed.slice(w, w + windowSize);
    const best = group.reduce((a, b) => (frames[b].sharpness > frames[a].sharpness ? b : a));
    sharpest.push(best);
    for (const i of group) if (i !== best) dropped.push({ index: i, reason: 'blurry' });
  }

  const sorted = sharpest.map((i) => frames[i].sharpness).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const kept: number[] = [];
  for (const i of sharpest) {
    if (frames[i].sharpness < MIN_RELATIVE_SHARPNESS * median) dropped.push({ index: i, reason: 'blurry' });
    else kept.push(i);
  }
  return { kept, dropped: dropped.sort((a, b) => a.index - b.index) };
}

/** The vector with the highest mean similarity to the others: the most typical frame. -1 when empty. */
export function medoid(vectors: Float32Array[]): number {
  let best = -1;
  let bestSum = -Infinity;
  for (let i = 0; i < vectors.length; i++) {
    let sum = 0;
    for (let j = 0; j < vectors.length; j++) if (j !== i) sum += cosine(vectors[i], vectors[j]);
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return best;
}

export interface FrameCandidate {
  vector: Float32Array;
  sharpness: number;
}

export type SelectionDrop = 'off-item' | 'duplicate' | 'over-limit';

export interface FrameSelection {
  /** Indices of the chosen frames, in the order they were picked. */
  chosen: number[];
  dropped: { index: number; reason: SelectionDrop }[];
}

/**
 * Picks frames that show the item from angles unlike each other, with greedy
 * farthest point sampling. The cover photo (`seed`) counts as already chosen,
 * so the first frame picked is the one least like the cover. Each later round
 * adds the frame whose closest chosen photo is least like it. A frame that is
 * unlike both the cover and the medoid shows something other than the item.
 */
export function selectFrames(
  candidates: FrameCandidate[],
  {
    seed,
    max = MAX_FRAMES,
    cutoff = OFF_ITEM_CUTOFF,
    duplicate = DUPLICATE_SIMILARITY,
    bonus = SHARPNESS_BONUS,
  }: { seed?: Float32Array; max?: number; cutoff?: number; duplicate?: number; bonus?: number } = {},
): FrameSelection {
  const dropped: FrameSelection['dropped'] = [];
  const center = medoid(candidates.map((c) => c.vector));
  const pool: number[] = [];
  candidates.forEach((c, i) => {
    const toCover = seed ? cosine(seed, c.vector) : -Infinity;
    const toCenter = i === center ? 1 : cosine(candidates[center].vector, c.vector);
    if (Math.max(toCover, toCenter) < cutoff) dropped.push({ index: i, reason: 'off-item' });
    else pool.push(i);
  });

  const chosen: number[] = [];
  const picked: Float32Array[] = seed ? [seed] : [];
  // Without a cover photo, start from the most typical frame.
  if (!seed && pool.includes(center) && max > 0) {
    chosen.push(center);
    picked.push(candidates[center].vector);
    pool.splice(pool.indexOf(center), 1);
  }
  const topSharpness = Math.max(0, ...candidates.map((c) => c.sharpness)) || 1;

  while (chosen.length < max && pool.length > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (let k = pool.length - 1; k >= 0; k--) {
      const i = pool[k];
      const nearest = Math.max(...picked.map((v) => cosine(v, candidates[i].vector)));
      if (nearest >= duplicate) {
        dropped.push({ index: i, reason: 'duplicate' });
        pool.splice(k, 1);
        continue;
      }
      const score = 1 - nearest + (bonus * candidates[i].sharpness) / topSharpness;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    chosen.push(best);
    picked.push(candidates[best].vector);
    pool.splice(pool.indexOf(best), 1);
  }
  for (const i of pool) dropped.push({ index: i, reason: 'over-limit' });
  return { chosen, dropped: dropped.sort((a, b) => a.index - b.index) };
}
