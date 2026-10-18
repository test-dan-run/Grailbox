import type { TensorflowModelDelegate, TfliteModel } from 'react-native-fast-tflite';

import type { CropRect } from './preprocess';

/*
 * The web preview has no TFLite runtime (react-native-fast-tflite is native
 * only), so photo matching is unavailable there. Same API as embedder.ts.
 */

export const EMBEDDING_MODEL = 'dinov2-vits14-224-fp16';

export type ImageSource = string | object;

const unavailable = () => Promise.reject(new Error('Photo matching needs the iOS or Android app.'));

export function loadEmbeddingModel(_delegates: TensorflowModelDelegate[]): Promise<TfliteModel> {
  return unavailable();
}

export function getEmbeddingModel(): Promise<TfliteModel> {
  return unavailable();
}

export function prepareImage(_source: ImageSource, _crop?: (width: number, height: number) => CropRect): Promise<Float32Array> {
  return unavailable();
}

export function embedImage(_source: ImageSource, _crop?: (width: number, height: number) => CropRect): Promise<Float32Array> {
  return unavailable();
}
