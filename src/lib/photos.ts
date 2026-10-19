import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { newId } from './id';

/*
 * Photos stay on device. Each photo is stored twice in the app's document
 * directory: a 1080 px display copy and a 256 px thumbnail. The database
 * keeps the display copy's path relative to the document directory, because
 * the absolute container path can change between iOS app updates.
 */

const PHOTO_DIR = 'photos';
const FULL_PX = 1080;
const THUMB_PX = 256;

function photosDir(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function thumbName(relPath: string): string {
  return relPath.replace(/\.jpg$/, '_256.jpg');
}

/** Resolves a stored photo path to a file URI for display. */
export function photoUri(relPath: string | undefined, size: 'full' | 'thumb' = 'full'): string | undefined {
  if (!relPath) return undefined;
  if (/^[a-z]+:\/\//i.test(relPath)) return relPath;
  const name = size === 'thumb' ? thumbName(relPath) : relPath;
  return new File(Paths.document, name).uri;
}

async function resizeTo(uri: string, width: number, height: number, maxPx: number, dest: File) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxPx) {
    ctx.resize(width >= height ? { width: maxPx } : { height: maxPx });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const tmp = new File(saved.uri);
  if (dest.exists) dest.delete();
  tmp.moveSync(dest);
}

/** Copies a picked or captured image into app storage. Returns its stored path. */
export async function importPhoto(asset: { uri: string; width: number; height: number }): Promise<string> {
  const dir = photosDir();
  const name = `${newId()}.jpg`;
  const rel = `${PHOTO_DIR}/${name}`;
  await resizeTo(asset.uri, asset.width, asset.height, FULL_PX, new File(dir, name));
  await resizeTo(asset.uri, asset.width, asset.height, THUMB_PX, new File(dir, thumbName(name)));
  return rel;
}

/**
 * Moves a scan angle frame (an already cropped JPEG) into app storage.
 * Frames are never shown in lists, so they get no thumbnail. Returns its stored path.
 */
export function storeFramePhoto(file: File): string {
  const name = `${newId()}.jpg`;
  file.moveSync(new File(photosDir(), name));
  return `${PHOTO_DIR}/${name}`;
}

export function deletePhotoFiles(relPaths: string[]) {
  for (const rel of relPaths) {
    if (/^[a-z]+:\/\//i.test(rel)) continue;
    for (const name of [rel, thumbName(rel)]) {
      try {
        const f = new File(Paths.document, name);
        if (f.exists) f.delete();
      } catch {
        // A missing file is already gone.
      }
    }
  }
}

export type PhotoSource = 'camera' | 'library';

/**
 * Opens the camera or the photo library and imports what the user picks.
 * Returns stored paths, or [] when cancelled or permission is denied.
 */
export async function pickPhotos(source: PhotoSource, opts: { multiple?: boolean } = {}): Promise<string[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PhotoPermissionError('camera');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: source === 'library' && !!opts.multiple,
    selectionLimit: opts.multiple ? 10 : 1,
  };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  const out: string[] = [];
  for (const asset of result.assets) out.push(await importPhoto(asset));
  return out;
}

export class PhotoPermissionError extends Error {
  constructor(public kind: 'camera') {
    super('Camera permission was denied');
  }
}

/** Every stored photo file (display copies and thumbnails), for Export. */
export function listPhotoFiles(): File[] {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) return [];
  return dir.list().filter((e): e is File => e instanceof File);
}
