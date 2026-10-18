import {
  centerSquare,
  frameCrop,
  INPUT_SIZE,
  l2Normalize,
  smallestPictureSize,
  toInputTensor,
} from '@/features/scanner/preprocess';

const PIXELS = INPUT_SIZE * INPUT_SIZE;

describe('embedding preprocessing', () => {
  it('crops the largest centered square', () => {
    expect(centerSquare(1080, 810)).toEqual({ originX: 135, originY: 0, width: 810, height: 810 });
    expect(centerSquare(810, 1080)).toEqual({ originX: 0, originY: 135, width: 810, height: 810 });
    expect(centerSquare(256, 256)).toEqual({ originX: 0, originY: 0, width: 256, height: 256 });
    expect(centerSquare(101, 100)).toEqual({ originX: 0, originY: 0, width: 100, height: 100 });
  });

  it('maps the on-screen scan frame to a square of the camera photo', () => {
    // 3:4 photo under a 384 × 832 pt screen: the preview covers the height, 0.208 pt per photo pixel.
    expect(frameCrop(3000, 4000, 384, 832, 272)).toEqual({ originX: 748, originY: 1248, width: 1503, height: 1503 });
    expect(frameCrop(3000, 4000, 384, 832, 272, 1)).toEqual({ originX: 846, originY: 1346, width: 1307, height: 1307 });
    // Never larger than the photo.
    expect(frameCrop(300, 400, 384, 832, 2000)).toEqual({ originX: 0, originY: 50, width: 300, height: 300 });
  });

  it('picks the smallest 4:3 camera size that is large enough', () => {
    const sizes = ['4080x3060', '4000x2252', '1920x1080', '1440x1080', '1280x960', '2048x1536', '640x480'];
    expect(smallestPictureSize(sizes, 1080)).toBe('1440x1080');
    expect(smallestPictureSize(sizes, 1200)).toBe('2048x1536');
    expect(smallestPictureSize(['3060x4080', '1080x1440'], 1080)).toBe('1080x1440');
    // None qualifies, or the list is iOS presets: keep the camera's default.
    expect(smallestPictureSize(['1920x1080', '640x480'], 1080)).toBeUndefined();
    expect(smallestPictureSize(['Photo', 'High', '1920x1080'], 1080)).toBeUndefined();
    // With a 1080 px short side, the S24+ crop is still more than twice the model's input.
    expect(frameCrop(1080, 1440, 384, 832, 272).width).toBeGreaterThan(2 * INPUT_SIZE);
  });

  it('normalizes RGB with the ImageNet mean and std, in NHWC order', () => {
    const rgb = new Uint8Array(PIXELS * 3);
    rgb.set([255, 0, 128], 0);
    rgb.set([10, 20, 30], (PIXELS - 1) * 3);
    const t = toInputTensor(rgb, INPUT_SIZE, INPUT_SIZE, 3);
    expect(t).toHaveLength(PIXELS * 3);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(t[1]).toBeCloseTo((0 - 0.456) / 0.224, 5);
    expect(t[2]).toBeCloseTo((128 / 255 - 0.406) / 0.225, 5);
    expect(t[PIXELS * 3 - 1]).toBeCloseTo((30 / 255 - 0.406) / 0.225, 5);
  });

  it('drops alpha from RGBA', () => {
    const rgba = new Uint8Array(PIXELS * 4).fill(255);
    const rgb = new Uint8Array(PIXELS * 3).fill(255);
    expect(toInputTensor(rgba, INPUT_SIZE, INPUT_SIZE, 4)).toEqual(toInputTensor(rgb, INPUT_SIZE, INPUT_SIZE, 3));
  });

  it('rejects the wrong size or a short buffer', () => {
    expect(() => toInputTensor(new Uint8Array(100 * 100 * 3), 100, 100, 3)).toThrow(/224/);
    expect(() => toInputTensor(new Uint8Array(10), INPUT_SIZE, INPUT_SIZE, 3)).toThrow(/too short/);
  });

  it('scales vectors to unit length', () => {
    const n = l2Normalize(new Float32Array([3, 4]));
    expect(n[0]).toBeCloseTo(0.6);
    expect(n[1]).toBeCloseTo(0.8);
    expect(l2Normalize(new Float32Array([0, 0]))).toEqual(new Float32Array([0, 0]));
  });
});
