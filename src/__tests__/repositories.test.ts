/**
 * @jest-environment node
 */
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollectionSummaries,
  reorderCollections,
  listCollections,
} from '@/db/repositories/collections';
import { listVectors, pendingReferences, setEmbedding, syncReferencePhotos } from '@/db/repositories/embeddings';
import {
  barcodeCandidates,
  createItem,
  deleteItem,
  earliestAcquisition,
  findByBarcode,
  findItemMatches,
  getItem,
  grailboxTotals,
  listItems,
  searchItems,
  toFtsQuery,
  updateItem,
} from '@/db/repositories/items';
import { createEntry, entryNeighbours, getEntry, listEntries } from '@/db/repositories/journal';
import { setFullTextSearch } from '@/db/database';
import { SEED_BARCODES, seedDatabase } from '@/db/seed';
import type { ItemInput } from '@/db/types';

import { createTestDb } from './helpers/testDb';

const item = (collection_id: string, over: Partial<ItemInput> = {}): ItemInput => ({
  collection_id,
  title: 'Test item',
  status: 'OWNED',
  origin: 'OFFICIAL',
  quantity: 1,
  variant_tags: [],
  currency: 'USD',
  specs: {},
  photos: [],
  ...over,
});

beforeEach(() => {
  createTestDb();
});

describe('seed data', () => {
  it('matches the canvas: 3 collections, 8 Rowlet items, 3 journal entries', async () => {
    await seedDatabase();
    const summaries = await listCollectionSummaries();
    expect(summaries.map((s) => s.name)).toEqual(['Rowlet Plushies & Merch', 'Ado Merch', 'Suisei Hoshimachi Merch']);
    const rowlet = summaries[0];
    expect(await listItems(rowlet.id)).toHaveLength(8);
    expect(await listEntries(rowlet.id)).toHaveLength(3);
  });

  it('derives counts from items', async () => {
    await seedDatabase();
    const [rowlet, ado] = await listCollectionSummaries();
    expect({ owned: rowlet.owned, wishlist: rowlet.wishlist, in_transit: rowlet.in_transit }).toEqual({
      owned: 5,
      wishlist: 2,
      in_transit: 1,
    });
    expect(ado.owned + ado.wishlist + ado.in_transit).toBe(0);
    expect(rowlet.previews).toHaveLength(4);
    expect(rowlet.latest_title).toMatch(/Sitting Cuties|Rowlet Figure/);
  });

  it('reports "collecting since" as the earliest acquisition', async () => {
    await seedDatabase();
    const [rowlet] = await listCollections();
    expect(await earliestAcquisition(rowlet.id)).toBe('2019-12-14');
  });
});

describe('collections', () => {
  it('appends new collections and reorders them', async () => {
    const a = await createCollection({ name: 'A' });
    const b = await createCollection({ name: 'B' });
    const c = await createCollection({ name: 'C' });
    expect((await listCollections()).map((x) => x.name)).toEqual(['A', 'B', 'C']);
    await reorderCollections([c, a, b]);
    expect((await listCollections()).map((x) => x.name)).toEqual(['C', 'A', 'B']);
  });

  it('cleans categories', async () => {
    const id = await createCollection({ name: ' X ', categories: ['Plushies', ' plushies', '', 'Figures '] });
    expect(await getCollection(id)).toMatchObject({ name: 'X', categories: ['Plushies', 'Figures'] });
  });

  it('deletes items and entries with the collection and returns their photos', async () => {
    const id = await createCollection({ name: 'Doomed' });
    await createItem(item(id, { photos: ['photos/a.jpg'] }));
    await createEntry({ collection_id: id, date: '2026-01-01', title: 'E', entry_type: 'NOTE', item_ids: [], photos: ['photos/b.jpg'] });
    expect(await deleteCollection(id)).toEqual(['photos/a.jpg', 'photos/b.jpg']);
    expect(await listItems(id)).toHaveLength(0);
    expect(await listEntries(id)).toHaveLength(0);
  });
});

describe('items', () => {
  it('round-trips specs, tags and prices', async () => {
    const c = await createCollection({ name: 'C' });
    const id = await createItem(
      item(c, {
        title: '  Plush ',
        variant_tags: ['Jumbo', ' '],
        purchase_price: 3500,
        specs: { release_year: 2016, barcode: '4521-3292 66181' },
      }),
    );
    const got = await getItem(id);
    expect(got).toMatchObject({
      title: 'Plush',
      variant_tags: ['Jumbo'],
      purchase_price: 3500,
      specs: { release_year: 2016, barcode: '4521329266181' },
    });
  });

  it('drops condition for wishlist items and priority for owned ones', async () => {
    const c = await createCollection({ name: 'C' });
    const id = await createItem(item(c, { status: 'WISHLIST', condition: 'NWT', priority: 'GRAIL' }));
    expect(await getItem(id)).toMatchObject({ condition: undefined, priority: 'GRAIL' });
    await updateItem(id, { status: 'OWNED', condition: 'BOXED' });
    expect(await getItem(id)).toMatchObject({ status: 'OWNED', condition: 'BOXED', priority: undefined });
  });

  it('bumps the collection updated_at on change', async () => {
    const c = await createCollection({ name: 'C' });
    const before = (await getCollection(c))!.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    await createItem(item(c));
    expect((await getCollection(c))!.updated_at > before).toBe(true);
  });

  it('returns photos on delete', async () => {
    const c = await createCollection({ name: 'C' });
    const id = await createItem(item(c, { photos: ['photos/x.jpg'] }));
    expect(await deleteItem(id)).toEqual(['photos/x.jpg']);
    expect(await getItem(id)).toBeUndefined();
  });
});

describe('search', () => {
  it('builds prefix queries and ignores FTS syntax', () => {
    expect(toFtsQuery('  rowl  plu ')).toBe('"rowl"* "plu"*');
    expect(toFtsQuery('"a" OR (b)')).toBe('"a"* "OR"* "b"*');
    expect(toFtsQuery('   ')).toBeUndefined();
  });

  it('matches title, line, manufacturer, source and shelf, accent-insensitive', async () => {
    await seedDatabase();
    expect((await searchItems('jumbo')).map((i) => i.title)).toEqual(['Rowlet Jumbo Plush']);
    expect((await searchItems('pokemon center tokyo')).map((i) => i.title)).toEqual(['Rowlet Jumbo Plush']);
    expect((await searchItems('takara')).map((i) => i.title)).toEqual(['Rowlet Moncolle Figure']);
    expect((await searchItems('surugaya')).map((i) => i.title)).toEqual(['Rowlet Moncolle Figure']);
    expect((await searchItems('display case')).length).toBe(3);
    expect((await searchItems('mossy')).map((i) => i.collection_name)).toEqual(['Rowlet Plushies & Merch']);
  });

  it('filters by status, with or without text', async () => {
    await seedDatabase();
    expect((await searchItems('', 'WISHLIST')).map((i) => i.title)).toEqual(['Rowlet Enamel Pin', 'Rowlet Juggling Plush']);
    expect((await searchItems('plush', 'OWNED')).map((i) => i.title)).toEqual(['Rowlet Jumbo Plush', 'Rowlet Sitting Cuties Plush']);
    expect(await searchItems('')).toEqual([]);
  });

  it('falls back to LIKE where SQLite has no FTS5', async () => {
    await seedDatabase();
    setFullTextSearch(false);
    try {
      expect((await searchItems('jumbo')).map((i) => i.title)).toEqual(['Rowlet Jumbo Plush']);
      expect((await searchItems('display case', 'OWNED')).length).toBe(3);
      expect((await searchItems('takara figure')).map((i) => i.title)).toEqual(['Rowlet Moncolle Figure']);
    } finally {
      setFullTextSearch(true);
    }
  });

  it('stays in sync after updates and deletes', async () => {
    const c = await createCollection({ name: 'C' });
    const id = await createItem(item(c, { title: 'Alpha' }));
    await updateItem(id, { title: 'Bravo' });
    expect(await searchItems('alpha')).toHaveLength(0);
    expect(await searchItems('bravo')).toHaveLength(1);
    await deleteItem(id);
    expect(await searchItems('bravo')).toHaveLength(0);
  });
});

describe('barcode matching', () => {
  it('treats UPC-A and EAN-13 forms as the same code', () => {
    expect(barcodeCandidates('012345678905')).toEqual(
      expect.arrayContaining(['012345678905', '0012345678905', '12345678905']),
    );
  });

  it('finds owned and wishlist items by barcode', async () => {
    await seedDatabase();
    const owned = await findByBarcode(SEED_BARCODES.jumboPlush);
    expect(owned?.item.title).toBe('Rowlet Jumbo Plush');
    expect(owned?.collection_name).toBe('Rowlet Plushies & Merch');
    const wish = await findByBarcode(SEED_BARCODES.jugglingPlush);
    expect(wish?.item.status).toBe('WISHLIST');
    expect(await findByBarcode('0000000000000')).toBeUndefined();
  });

  it('prefers an owned copy over a wishlist entry with the same code', async () => {
    const c = await createCollection({ name: 'C' });
    await createItem(item(c, { title: 'Wish', status: 'WISHLIST', specs: { barcode: '123' } }));
    await createItem(item(c, { title: 'Mine', status: 'OWNED', specs: { barcode: '123' } }));
    expect((await findByBarcode('123'))?.item.title).toBe('Mine');
  });

  it('counts items across collections', async () => {
    await seedDatabase();
    expect(await grailboxTotals()).toEqual({ items: 8, collections: 3 });
  });
});

describe('journal', () => {
  it('sorts newest first and walks neighbours in date order', async () => {
    await seedDatabase();
    const [rowlet] = await listCollections();
    const entries = await listEntries(rowlet.id);
    expect(entries.map((e) => e.title)).toEqual(['Shelf Refresh', 'Grail Found', 'Shelf reorganization']);
    const grail = (await getEntry(entries[1].id))!;
    expect(grail).toMatchObject({ is_grail: true, entry_type: 'MILESTONE' });
    const n = await entryNeighbours(grail);
    expect(n.earlier?.title).toBe('Shelf reorganization');
    expect(n.later?.title).toBe('Shelf Refresh');
    expect((await entryNeighbours(entries[0])).later).toBeUndefined();
    expect((await entryNeighbours(entries[2])).earlier).toBeUndefined();
  });
});

describe('scanner references', () => {
  it('makes every item photo a reference, and drops removed photos', async () => {
    const c = await createCollection({ name: 'C' });
    const a = await createItem(item(c, { photos: ['photos/a.jpg', 'photos/b.jpg'] }));
    const b = await createItem(item(c, { photos: ['photos/c.jpg'] }));
    await createItem(item(c));
    expect(await syncReferencePhotos()).toBe(true);
    expect(await syncReferencePhotos()).toBe(false);
    const pending = (await pendingReferences('m1')).map((r) => r.photo_uri).sort();
    expect(pending).toEqual(['photos/a.jpg', 'photos/b.jpg', 'photos/c.jpg']);

    await updateItem(a, { photos: ['photos/b.jpg'] });
    expect(await syncReferencePhotos()).toBe(true);
    expect((await pendingReferences('m1')).map((r) => r.item_id).sort()).toEqual([a, b].sort());
  });

  it('stores vectors per model and recomputes after a model change', async () => {
    const c = await createCollection({ name: 'C' });
    const id = await createItem(item(c, { photos: ['photos/a.jpg'] }));
    await syncReferencePhotos();
    const v = new Float32Array([0.6, 0.8, 0]);
    await setEmbedding(id, 'photos/a.jpg', v, 'm1');
    expect(await pendingReferences('m1')).toEqual([]);
    expect(await listVectors('m1')).toEqual([{ item_id: id, vector: v }]);
    // A newer model ignores the old vector and asks for it again.
    expect(await listVectors('m2')).toEqual([]);
    expect(await pendingReferences('m2')).toEqual([{ item_id: id, photo_uri: 'photos/a.jpg' }]);
  });
});

describe('photo match lookup', () => {
  it('returns items with their collection, in ranked order', async () => {
    const c = await createCollection({ name: 'Shelf' });
    const a = await createItem(item(c, { title: 'A' }));
    const b = await createItem(item(c, { title: 'B' }));
    const found = await findItemMatches([b, 'missing', a]);
    expect(found.map((m) => [m.item.title, m.collection_name])).toEqual([
      ['B', 'Shelf'],
      ['A', 'Shelf'],
    ]);
    expect(await findItemMatches([])).toEqual([]);
  });
});
