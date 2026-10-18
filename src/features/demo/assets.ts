/*
 * The demo build's images. They are real product photos, so they stay out of
 * git: `npm run products && npm run demo-assets` in video/ makes them. Builds
 * without EXPO_PUBLIC_DEMO=1 get assets.stub.ts instead (metro.config.js), so
 * they build without the images.
 */

import acrylicStand from '../../../assets/demo/acrylic-stand.jpg';
import enamelPin from '../../../assets/demo/enamel-pin.jpg';
import figure from '../../../assets/demo/figure.jpg';
import juggling from '../../../assets/demo/juggling-plush.jpg';
import jumbo from '../../../assets/demo/jumbo-plush.jpg';
import moncolle from '../../../assets/demo/moncolle-figure.jpg';
import pokedoll from '../../../assets/demo/pokedoll.jpg';
import scanOwned from '../../../assets/demo/scan-owned.jpg';
import scanWishlist from '../../../assets/demo/scan-wishlist.jpg';
import sittingCuties from '../../../assets/demo/sitting-cuties-plush.jpg';

/** The scanner's scenes, in order: an owned item, then a wishlist item. */
export const SCENE_IMAGES: number[] = [scanOwned, scanWishlist];

/** Sample item photos, by item title. */
export const ITEM_PHOTOS: Record<string, number[]> = {
  'Rowlet Jumbo Plush': [jumbo],
  'Rowlet Juggling Plush': [juggling],
  'Rowlet Pokédoll': [pokedoll],
  'Rowlet Moncolle Figure': [moncolle],
  'Rowlet Acrylic Stand': [acrylicStand],
  'Rowlet Enamel Pin': [enamelPin],
  'Rowlet Sitting Cuties Plush': [sittingCuties],
  'Rowlet Figure': [figure],
};
