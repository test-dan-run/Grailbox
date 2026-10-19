import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { Platform } from 'react-native';
import { loadTensorflowModel, type TensorflowModelDelegate, type TfliteModel } from 'react-native-fast-tflite';

import modelAsset from '../../../assets/models/dinov2_vits14.tflite';

import { centerSquare, EMBEDDING_DIM, INPUT_SIZE, l2Normalize, toInputTensor, type CropRect } from './preprocess';

/*
 * Scanner phase 2: on-device image embeddings with DINOv2 ViT-S/14 through
 * react-native-fast-tflite. Needs a development build (not Expo Go).
 *
 * The model is loaded once, on the GPU when the device supports it (Android
 * GPU delegate, Core ML on iOS), and on the CPU otherwise.
 *
 * Embeddings from different models cannot be compared. If the model file
 * changes, bump EMBEDDING_MODEL: stored vectors record their model, and
 * references.ts recomputes the ones from an older model.
 *
 * Measured on a Galaxy S24+ (Exynos 2400): the GPU delegate rejects the
 * graph, so it runs on the CPU, about 570 ms per photo. See docs/IMPLEMENTATION.md.
 */

export const EMBEDDING_MODEL = 'dinov2-vits14-224-fp16';

/** A file URI, or a native image such as a camera PictureRef. */
export type ImageSource = Parameters<typeof ImageManipulator.manipulate>[0];

const ACCELERATED: TensorflowModelDelegate = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';

let loading: Promise<TfliteModel> | null = null;

/** Loads a separate copy of the model on exactly these delegates (`[]` is CPU only). For measurements; the app uses getEmbeddingModel. */
export async function loadEmbeddingModel(delegates: TensorflowModelDelegate[]): Promise<TfliteModel> {
  const model = await loadTensorflowModel({ url: await modelUrl() }, delegates);
  const input = model.inputs[0]?.shape.join('×');
  const output = model.outputs[0]?.shape.join('×');
  if (input !== `1×${INPUT_SIZE}×${INPUT_SIZE}×3` || output !== `1×${EMBEDDING_DIM}`) {
    throw new Error(`Unexpected embedding model shape: input ${input}, output ${output}`);
  }
  return model;
}

/**
 * A file URL for the bundled model. Android release builds keep it as a raw
 * resource, whose name ("assets_models_dinov2_vits14") fast-tflite cannot
 * open, so expo-asset copies it to the cache first.
 */
async function modelUrl(): Promise<string> {
  const asset = await Asset.fromModule(modelAsset).downloadAsync();
  if (!asset.localUri) throw new Error('Embedding model file is not available');
  return asset.localUri;
}

async function load(): Promise<TfliteModel> {
  try {
    return await loadEmbeddingModel([ACCELERATED]);
  } catch (e) {
    console.warn(`Embedding model: ${ACCELERATED} delegate unavailable, using CPU`, e);
    return loadEmbeddingModel([]);
  }
}

/** Loads the model on first use. Call early (for example when the scanner opens) to hide the load time. */
export function getEmbeddingModel(): Promise<TfliteModel> {
  loading ??= load().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export interface PreparedImage {
  /** The model's input tensor. */
  input: Float32Array;
  /** The same image as INPUT_SIZE × INPUT_SIZE RGB bytes, for quality checks. */
  pixels: Uint8Array;
}

/**
 * Crops (by default the largest centered square) and resizes a photo, then
 * decodes it into the model's input tensor.
 */
export async function prepareImage(
  source: ImageSource,
  crop: (width: number, height: number) => CropRect = centerSquare,
): Promise<PreparedImage> {
  const full = await ImageManipulator.manipulate(source).renderAsync();
  const image = await ImageManipulator.manipulate(full)
    .crop(crop(full.width, full.height))
    .resize({ width: INPUT_SIZE, height: INPUT_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  full.release();
  image.release();
  const file = new File(saved.uri);
  try {
    const { data, width, height } = decode(new Uint8Array(await file.arrayBuffer()), {
      useTArray: true,
      formatAsRGBA: false,
    });
    return { input: toInputTensor(data, width, height, 3), pixels: data };
  } finally {
    file.delete();
  }
}

// One interpreter, one inference at a time: queue runs instead of overlapping them.
let queue: Promise<unknown> = Promise.resolve();

function serially<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

/** A unit-length 384-value embedding of a tensor from prepareImage. */
export async function embedTensor(input: Float32Array): Promise<Float32Array> {
  const model = await getEmbeddingModel();
  const [output] = await serially(() => model.run([input.buffer as ArrayBuffer]));
  return l2Normalize(new Float32Array(output));
}

/** A unit-length 384-value embedding of a photo. */
export async function embedImage(
  source: ImageSource,
  crop?: (width: number, height: number) => CropRect,
): Promise<Float32Array> {
  const [, prepared] = await Promise.all([getEmbeddingModel(), prepareImage(source, crop)]);
  return embedTensor(prepared.input);
}
