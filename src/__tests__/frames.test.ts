import {
  filterFrames,
  frameQuality,
  medoid,
  sampleTimes,
  selectFrames,
  type FrameCandidate,
  type FrameQuality,
} from '@/features/scanner/frames';

/** A unit-length vector from its components. */
const unit = (...xs: number[]) => {
  const norm = Math.hypot(...xs);
  return new Float32Array(xs.map((x) => x / norm));
};

const candidate = (vector: Float32Array, sharpness = 100): FrameCandidate => ({ vector, sharpness });

/** A width × height RGB image from a brightness function. */
function image(width: number, height: number, value: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out.fill(value(x, y), (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  return out;
}

const q = (sharpness: number, brightness = 128, clipped = 0): FrameQuality => ({ sharpness, brightness, clipped });

describe('sampling times', () => {
  it('spreads up to 16 times over the video, away from both ends', () => {
    const times = sampleTimes(10);
    expect(times).toHaveLength(16);
    expect(times[0]).toBeCloseTo(10 / 32);
    expect(times[15]).toBeCloseTo(10 - 10 / 32);
  });

  it('samples a short video every 0.33 s, and a tiny one once', () => {
    expect(sampleTimes(2)).toHaveLength(6);
    expect(sampleTimes(0.1)).toEqual([0.05]);
    expect(sampleTimes(0)).toEqual([]);
    expect(sampleTimes(NaN)).toEqual([]);
  });
});

describe('frame quality', () => {
  it('scores a flat image as not sharp', () => {
    const flat = frameQuality(image(16, 16, () => 128), 16, 16, 3);
    expect(flat.sharpness).toBe(0);
    expect(flat.brightness).toBeCloseTo(128);
    expect(flat.clipped).toBe(0);
  });

  it('scores hard edges sharper than a soft gradient', () => {
    const edges = frameQuality(image(32, 32, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60), 32, 32, 3);
    const soft = frameQuality(image(32, 32, (x, y) => 60 + Math.round(140 * Math.sin((x + y) / 20) ** 2)), 32, 32, 3);
    expect(edges.sharpness).toBeGreaterThan(soft.sharpness * 10);
  });

  it('counts almost black and almost white pixels', () => {
    const half = frameQuality(image(10, 10, (x) => (x < 5 ? 0 : 255)), 10, 10, 3);
    expect(half.clipped).toBe(1);
    expect(half.brightness).toBeCloseTo(127.5);
  });

  it('reads RGBA pixels', () => {
    const rgba = new Uint8Array(4 * 4 * 4).fill(100);
    expect(frameQuality(rgba, 4, 4, 4).brightness).toBeCloseTo(100);
  });
});

describe('frame filter', () => {
  it('drops badly exposed frames, and keeps the sharpest of each pair', () => {
    const { kept, dropped } = filterFrames([q(50), q(80), q(90, 20), q(70), q(60), q(200, 240), q(75)]);
    // Exposed frames 0, 1, 3, 4, 6 pair up as (0, 1), (3, 4), (6).
    expect(kept).toEqual([1, 3, 6]);
    expect(dropped).toEqual([
      { index: 0, reason: 'blurry' },
      { index: 2, reason: 'dark' },
      { index: 4, reason: 'blurry' },
      { index: 5, reason: 'bright' },
    ]);
  });

  it('treats a mostly clipped frame as dark or bright by its mean', () => {
    const { dropped } = filterFrames([q(100, 60, 0.6), q(100, 200, 0.6)], 1);
    expect(dropped.map((d) => d.reason)).toEqual(['dark', 'bright']);
  });

  it('drops frames much blurrier than the median', () => {
    const { kept, dropped } = filterFrames([q(100), q(110), q(20), q(105)], 1);
    expect(kept).toEqual([0, 1, 3]);
    expect(dropped).toEqual([{ index: 2, reason: 'blurry' }]);
  });

  it('keeps nothing from an empty video', () => {
    expect(filterFrames([])).toEqual({ kept: [], dropped: [] });
  });
});

describe('frame selection', () => {
  // Components: front, side, back, something else.
  const cover = unit(1, 0, 0, 0);
  const nearFront = unit(1, 0.1, 0, 0);
  const side = unit(0.8, 0.6, 0, 0);
  const sideAgain = unit(0.79, 0.61, 0.05, 0);
  const back = unit(0.6, 0.5, 0.62, 0);
  const hand = unit(0, 0, 0.1, 1);
  const turnaround = [nearFront, side, sideAgain, back, hand].map((v) => candidate(v));

  it('finds the most typical frame', () => {
    expect(medoid([side, sideAgain, back, hand])).toBe(1);
    expect(medoid([side])).toBe(0);
    expect(medoid([])).toBe(-1);
  });

  it('picks the angle least like the cover first, and skips near copies and frames of other things', () => {
    expect(selectFrames(turnaround, { seed: cover })).toEqual({
      chosen: [3, 1],
      dropped: [
        { index: 0, reason: 'duplicate' },
        { index: 2, reason: 'duplicate' },
        { index: 4, reason: 'off-item' },
      ],
    });
  });

  it('stops at the frame limit', () => {
    expect(selectFrames(turnaround, { seed: cover, max: 1 })).toEqual({
      chosen: [3],
      dropped: [
        { index: 0, reason: 'duplicate' },
        { index: 1, reason: 'over-limit' },
        { index: 2, reason: 'over-limit' },
        { index: 4, reason: 'off-item' },
      ],
    });
  });

  it('keeps no frames when the item did not turn', () => {
    const still = [unit(1, 0.05, 0, 0), unit(1, 0, 0.05, 0), unit(1, 0.03, 0.03, 0)].map((v) => candidate(v));
    const result = selectFrames(still, { seed: cover });
    expect(result.chosen).toEqual([]);
    expect(result.dropped.every((d) => d.reason === 'duplicate')).toBe(true);
  });

  it('keeps a back view that is unlike the cover but like the other frames', () => {
    const backOnly = unit(0.3, 0.4, 0.87, 0);
    const result = selectFrames([candidate(side), candidate(back), candidate(backOnly)], { seed: cover });
    expect(result.chosen).toContain(2);
    expect(result.dropped.find((d) => d.index === 2)).toBeUndefined();
  });

  it('starts from the medoid without a cover photo', () => {
    expect(selectFrames([candidate(side), candidate(sideAgain), candidate(back)], { max: 1 }).chosen).toEqual([1]);
  });

  it('prefers the sharper of two equally new angles', () => {
    const left = unit(0.6, 0.8, 0, 0);
    const right = unit(0.6, 0, 0.8, 0);
    expect(selectFrames([candidate(left, 50), candidate(right, 100)], { seed: cover, max: 1 }).chosen).toEqual([1]);
    expect(selectFrames([candidate(left, 100), candidate(right, 50)], { seed: cover, max: 1 }).chosen).toEqual([0]);
  });
});
