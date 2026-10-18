/*
 * Scanner phase 2: turns decoded pixels into the input tensor for the DINOv2
 * ViT-S/14 embedding model (scripts/export_dinov2.py). The model takes one
 * 224 × 224 RGB image as float32 NHWC, normalized with the ImageNet mean and
 * std, and returns a 384-value embedding.
 *
 * Pure functions only, so they run under Jest. embedder.ts does the native
 * parts (crop, resize, decode, inference).
 */

export const INPUT_SIZE = 224;
export const EMBEDDING_DIM = 384;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** The largest centered square, so the item is not stretched when resized to the model's square input. */
export function centerSquare(width: number, height: number): CropRect {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

/**
 * Row-major RGB or RGBA bytes → normalized float32 NHWC tensor, alpha dropped.
 * The image must already be INPUT_SIZE × INPUT_SIZE.
 */
export function toInputTensor(pixels: Uint8Array, width: number, height: number, channels: 3 | 4): Float32Array {
  if (width !== INPUT_SIZE || height !== INPUT_SIZE) {
    throw new Error(`Expected ${INPUT_SIZE}×${INPUT_SIZE} pixels, got ${width}×${height}`);
  }
  const count = width * height;
  if (pixels.length < count * channels) {
    throw new Error(`Pixel buffer too short: ${pixels.length} bytes for ${count} pixels × ${channels}`);
  }
  const out = new Float32Array(count * 3);
  for (let p = 0; p < count; p++) {
    const src = p * channels;
    const dst = p * 3;
    for (let c = 0; c < 3; c++) {
      out[dst + c] = (pixels[src + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

/** Scales a vector to unit length, so stored embeddings compare by dot product. */
export function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  const out = new Float32Array(v.length);
  if (!norm) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}
