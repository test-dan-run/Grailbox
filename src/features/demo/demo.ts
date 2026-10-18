import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { updateItem } from '@/db/repositories/items';
import { SEED_BARCODES, seedDatabase } from '@/db/seed';
import { importPhoto } from '@/lib/photos';

import juggling from '../../../assets/demo/juggling-plush.jpg';
import jumbo from '../../../assets/demo/jumbo-plush.jpg';
import scanBarcode from '../../../assets/demo/scan-barcode.jpg';
import scanPhoto from '../../../assets/demo/scan-photo.jpg';

/*
 * The store video build (EXPO_PUBLIC_DEMO=1, `eas build --profile demo`).
 * Recorded on an emulator, which has no real camera to point at an item, so:
 * - the scanner shows still "camera" scenes instead of the camera, and runs
 *   the real barcode lookup and photo matching on them;
 * - "Load sample data" also gives some sample items photos, so photo matching
 *   has references and the gallery is not all placeholders.
 * The images live in assets/demo/. See video/README.md.
 */

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export interface DemoScene {
  image: number;
  /** Read as if the camera saw it, shortly after the scene shows. Scenes without one wait for "Check this item". */
  barcode?: string;
}

/** In order: "Scan Again" moves to the next scene. */
export const DEMO_SCENES: DemoScene[] = [{ image: scanBarcode, barcode: SEED_BARCODES.jumboPlush }, { image: scanPhoto }];

/** Sample item photos, by item title. */
const ITEM_PHOTOS: Record<string, number[]> = {
  'Rowlet Jumbo Plush': [jumbo],
  'Rowlet Juggling Plush': [juggling],
};

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

/** The normal sample data, plus photos for the items in ITEM_PHOTOS. */
export async function seedDemo() {
  const ids = await seedDatabase();
  for (const [title, modules] of Object.entries(ITEM_PHOTOS)) {
    const id = ids.get(title);
    if (!id) continue;
    const photos: string[] = [];
    for (const module of modules) photos.push(await importPhoto(await localFile(module)));
    await updateItem(id, { photos });
  }
}
