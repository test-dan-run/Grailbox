import { createCollection } from './repositories/collections';
import { createEntry } from './repositories/journal';
import { createItem } from './repositories/items';
import type { ItemInput } from './types';

/**
 * Sample data matching the design canvas: 3 collections, the 8 Rowlet items
 * and 3 journal entries. Seed items have no photos, so they show the tinted
 * placeholders. Barcodes are made-up test codes for trying the scanner.
 */
export const SEED_BARCODES = {
  jumboPlush: '4521329266181',
  jugglingPlush: '4521329311119',
} as const;

const base = {
  quantity: 1,
  variant_tags: [] as string[],
  currency: 'USD',
  photos: [] as string[],
  specs: {},
};

/** Returns the new Rowlet item ids by title. */
export async function seedDatabase(): Promise<Map<string, string>> {
  const rowlet = await createCollection({
    name: 'Rowlet Plushies & Merch',
    categories: ['Plushies', 'Figures', 'Pin & Flat Merch'],
  });
  await createCollection({ name: 'Ado Merch', categories: ['Apparel', 'Acrylics', 'Music'] });
  await createCollection({ name: 'Suisei Hoshimachi Merch', categories: ['Acrylics', 'Figures', 'Music'] });

  const rowletItems: ItemInput[] = [
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Jumbo Plush',
      line: 'Pokémon Center',
      category: 'Plushies',
      status: 'OWNED',
      origin: 'OFFICIAL',
      variant_tags: ['Jumbo size', 'Japan release'],
      purchase_price: 3500,
      acquisition_date: '2019-12-14',
      acquisition_source: 'Pokémon Center Tokyo',
      condition: 'NWT',
      storage_location: 'Shelf B, Display Case 1',
      specs: { release_year: 2016, manufacturer: 'Pokémon Center', size: '46 cm', barcode: SEED_BARCODES.jumboPlush },
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Juggling Plush',
      line: 'Pokémon Center',
      category: 'Plushies',
      status: 'WISHLIST',
      origin: 'OFFICIAL',
      priority: 'HIGH',
      estimated_price: 2800,
      specs: { manufacturer: 'Pokémon Center', barcode: SEED_BARCODES.jugglingPlush },
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Pokédoll',
      line: 'Pokémon Center',
      category: 'Plushies',
      status: 'OWNED',
      origin: 'OFFICIAL',
      purchase_price: 1800,
      acquisition_date: '2021-03-02',
      acquisition_source: 'Pokémon Center Online',
      condition: 'LOOSE_MINT',
      storage_location: 'Shelf B',
      specs: { manufacturer: 'Pokémon Center', release_year: 2017 },
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Moncolle Figure',
      line: 'Takara Tomy',
      category: 'Figures',
      status: 'OWNED',
      origin: 'OFFICIAL',
      currency: 'JPY',
      purchase_price: 550,
      acquisition_date: '2022-07-20',
      acquisition_source: 'Surugaya',
      condition: 'BOXED',
      storage_location: 'Display Case 1',
      specs: { manufacturer: 'Takara Tomy' },
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Acrylic Stand',
      line: 'Mossy Owl Studio',
      category: 'Pin & Flat Merch',
      status: 'IN_TRANSIT',
      origin: 'FAN',
      purchase_price: 1200,
      acquisition_date: '2026-10-02',
      acquisition_source: 'Artist booth, online',
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Enamel Pin',
      line: 'Leaflet Pins',
      category: 'Pin & Flat Merch',
      status: 'WISHLIST',
      origin: 'FAN',
      priority: 'MEDIUM',
      estimated_price: 1500,
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Sitting Cuties Plush',
      line: 'Pokémon Center',
      category: 'Plushies',
      status: 'OWNED',
      origin: 'OFFICIAL',
      purchase_price: 2000,
      acquisition_date: '2026-09-12',
      acquisition_source: 'Pokémon Center Singapore',
      condition: 'NWT',
      storage_location: 'Shelf B',
      specs: { manufacturer: 'Pokémon Center', release_year: 2021 },
    },
    {
      ...base,
      collection_id: rowlet,
      title: 'Rowlet Figure',
      line: 'Bandai',
      category: 'Figures',
      status: 'OWNED',
      origin: 'OFFICIAL',
      purchase_price: 900,
      acquisition_date: '2026-09-12',
      acquisition_source: 'Convention dealer hall',
      condition: 'LOOSE_MINT',
      storage_location: 'Display Case 1',
      specs: { manufacturer: 'Bandai' },
    },
  ];

  // Insert in reverse so the gallery (newest first) lists them in canvas order.
  const ids = new Map<string, string>();
  for (const it of [...rowletItems].reverse()) ids.set(it.title, await createItem(it));
  const jumbo = ids.get('Rowlet Jumbo Plush')!;
  const acrylicStand = ids.get('Rowlet Acrylic Stand')!;
  const sittingCuties = ids.get('Rowlet Sitting Cuties Plush')!;
  const figure = ids.get('Rowlet Figure')!;

  await createEntry({
    collection_id: rowlet,
    date: '2026-09-12',
    title: 'Shelf Refresh',
    entry_type: 'BATCH_ADD',
    notes: 'Picked up a few new pieces and rebuilt the top shelf around them.',
    item_ids: [sittingCuties, figure, acrylicStand],
    photos: [],
  });
  await createEntry({
    collection_id: rowlet,
    date: '2026-08-20',
    title: 'Grail Found',
    entry_type: 'MILESTONE',
    is_grail: true,
    notes:
      "Finally tracked down the 2016 Jumbo from Japan! Tags still attached and the stitching is perfect. It's getting the center spot on Shelf B.",
    item_ids: [jumbo],
    photos: [],
  });
  await createEntry({
    collection_id: rowlet,
    date: '2026-07-05',
    title: 'Shelf reorganization',
    entry_type: 'NOTE',
    notes: 'Moved all plushies to Shelf B, figures to Display Case 1.',
    item_ids: [],
    photos: [],
  });
  return ids;
}
