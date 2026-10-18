import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { getItem, updateItem } from '@/db/repositories/items';
import { seedDatabase } from '@/db/seed';
import { importPhoto } from '@/lib/photos';

import { ITEM_PHOTOS, SCENE_IMAGES } from './assets';

/*
 * The showcase video build (EXPO_PUBLIC_DEMO=1, `eas build --profile demo`).
 * Recorded on an emulator, which has no real camera to point at an item, so:
 * - the scanner shows still "camera" scenes instead of the camera, and runs
 *   the real photo matcher on them;
 * - "Load sample data" also gives the sample items product photos, so photo
 *   matching has references, and leaves out the barcodes, which the video
 *   doesn't show.
 * The images are real product photos, so the demo build is for internal
 * showcases only. See assets.ts and video/README.md.
 */

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export interface DemoScene {
  image: number;
}

/** In order: "Scan Again" moves to the next scene. */
export const DEMO_SCENES: DemoScene[] = SCENE_IMAGES.map((image) => ({ image }));

/**
 * Saves a bundled image to a file. Android release builds keep bundled images
 * as drawable resources, which have no file URI, so expo-image loads them.
 */
async function localFile(module: number) {
  const loaded = await Image.loadAsync(module);
  const rendered = await ImageManipulator.manipulate(loaded).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  loaded.release();
  rendered.release();
  return saved;
}

/** A file URI for a scene's image, for the photo matcher. */
export async function sceneUri(scene: DemoScene): Promise<string> {
  return (await localFile(scene.image)).uri;
}

/** The normal sample data, with photos for the items in ITEM_PHOTOS and without barcodes. */
export async function seedDemo() {
  const ids = await seedDatabase();
  for (const [title, modules] of Object.entries(ITEM_PHOTOS)) {
    const id = ids.get(title);
    if (!id) continue;
    const photos: string[] = [];
    for (const module of modules) photos.push(await importPhoto(await localFile(module)));
    const { barcode: _, ...specs } = (await getItem(id))?.specs ?? {};
    await updateItem(id, { photos, specs });
  }
}
