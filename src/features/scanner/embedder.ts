import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { Platform } from 'react-native';
import { loadTensorflowModel, type TensorflowModelDelegate, type TfliteModel } from 'react-native-fast-tflite';

import modelAsset from '../../../assets/models/dinov2_vits14.tflite';

import { centerSquare, EMBEDDING_DIM, INPUT_SIZE, l2Normalize, toInputTensor } from './preprocess';

/*
 * Scanner phase 2: on-device image embeddings with DINOv2 ViT-S/14 through
 * react-native-fast-tflite. Needs a development build (not Expo Go).
 *
 * The model is loaded once, on the GPU when the device supports it (Android
 * GPU delegate, Core ML on iOS), and on the CPU otherwise.
 *
 * Embeddings from different models cannot be compared. If the model file
 * changes, bump EMBEDDING_MODEL and recompute every stored vector.
 */

export const EMBEDDING_MODEL = 'dinov2-vits14-224-fp16';

const ACCELERATED: TensorflowModelDelegate = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';

let loading: Promise<TfliteModel> | null = null;

async function load(): Promise<TfliteModel> {
  let model: TfliteModel;
  try {
    model = await loadTensorflowModel(modelAsset, [ACCELERATED]);
  } catch (e) {
    console.warn(`Embedding model: ${ACCELERATED} delegate unavailable, using CPU`, e);
    model = await loadTensorflowModel(modelAsset, []);
  }
  const input = model.inputs[0]?.shape.join('×');
  const output = model.outputs[0]?.shape.join('×');
  if (input !== `1×${INPUT_SIZE}×${INPUT_SIZE}×3` || output !== `1×${EMBEDDING_DIM}`) {
    throw new Error(`Unexpected embedding model shape: input ${input}, output ${output}`);
  }
  return model;
}

/** Loads the model on first use. Call early (for example when the scanner opens) to hide the load time. */
export function getEmbeddingModel(): Promise<TfliteModel> {
  loading ??= load().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Center-crops and resizes a photo, then decodes it into the model's input tensor. */
export async function prepareImage(uri: string): Promise<Float32Array> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const image = await ImageManipulator.manipulate(source)
    .crop(centerSquare(source.width, source.height))
    .resize({ width: INPUT_SIZE, height: INPUT_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  source.release();
  image.release();
  const file = new File(saved.uri);
  try {
    const { data, width, height } = decode(new Uint8Array(await file.arrayBuffer()), {
      useTArray: true,
      formatAsRGBA: false,
    });
    return toInputTensor(data, width, height, 3);
  } finally {
    file.delete();
  }
}

/** A unit-length 384-value embedding of the photo at `uri` (a file URI). */
export async function embedImage(uri: string): Promise<Float32Array> {
  const [model, input] = await Promise.all([getEmbeddingModel(), prepareImage(uri)]);
  const [output] = await model.run([input.buffer as ArrayBuffer]);
  return l2Normalize(new Float32Array(output));
}
