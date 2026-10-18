import { asc, count, desc, eq, max, sql } from 'drizzle-orm';

import { newId, nowIso } from '@/lib/id';

import { getDb, notifyChange } from '../database';
import { collections, items, journalEntries, type CollectionRow } from '../schema';
import type { Collection, CollectionSummary, StatusCounts } from '../types';

function toCollection(r: CollectionRow): Collection {
  return { ...r, categories: r.categories ?? [] };
}

export async function listCollections(): Promise<Collection[]> {
  const rows = await getDb().select().from(collections).orderBy(asc(collections.sort_order), asc(collections.created_at));
  return rows.map(toCollection);
}

export async function getCollection(id: string): Promise<Collection | undefined> {
  const [row] = await getDb().select().from(collections).where(eq(collections.id, id));
  return row ? toCollection(row) : undefined;
}

/** The most recently updated collection (default target for new wishlist items). */
export async function mostRecentCollectionId(): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ id: collections.id })
    .from(collections)
    .orderBy(desc(collections.updated_at))
    .limit(1);
  return row?.id;
}

function emptyCounts(): StatusCounts {
  return { owned: 0, wishlist: 0, in_transit: 0 };
}

/** Per-collection item counts by status. */
export async function statusCounts(collectionId?: string): Promise<Map<string, StatusCounts>> {
  const db = getDb();
  const base = db
    .select({ collection_id: items.collection_id, status: items.status, n: count() })
    .from(items);
  const rows = await (collectionId ? base.where(eq(items.collection_id, collectionId)) : base).groupBy(
    items.collection_id,
    items.status,
  );
  const out = new Map<string, StatusCounts>();
  for (const r of rows) {
    const c = out.get(r.collection_id) ?? emptyCounts();
    if (r.status === 'OWNED') c.owned = r.n;
    else if (r.status === 'WISHLIST') c.wishlist = r.n;
    else if (r.status === 'IN_TRANSIT') c.in_transit = r.n;
    out.set(r.collection_id, c);
  }
  return out;
}

export async function collectionCounts(collectionId: string): Promise<StatusCounts> {
  return (await statusCounts(collectionId)).get(collectionId) ?? emptyCounts();
}

/** Dashboard cards: collections with derived counts, preview photos and latest acquisition. */
export async function listCollectionSummaries(): Promise<CollectionSummary[]> {
  const db = getDb();
  const [cols, counts, owned] = await Promise.all([
    listCollections(),
    statusCounts(),
    db
      .select({
        id: items.id,
        collection_id: items.collection_id,
        title: items.title,
        photos: items.photos,
      })
      .from(items)
      .where(eq(items.status, 'OWNED'))
      .orderBy(desc(sql`coalesce(${items.acquisition_date}, ${items.created_at})`), desc(items.created_at)),
  ]);

  const previews = new Map<string, { item_id: string; photo?: string }[]>();
  const latest = new Map<string, string>();
  for (const it of owned) {
    if (!latest.has(it.collection_id)) latest.set(it.collection_id, it.title);
    const list = previews.get(it.collection_id) ?? [];
    if (list.length < 4) {
      list.push({ item_id: it.id, photo: it.photos?.[0] });
      previews.set(it.collection_id, list);
    }
  }

  return cols.map((c) => ({
    ...c,
    ...(counts.get(c.id) ?? emptyCounts()),
    previews: previews.get(c.id) ?? [],
    latest_title: latest.get(c.id),
  }));
}

export async function createCollection(input: { name: string; categories?: string[] }): Promise<string> {
  const db = getDb();
  const [{ top } = { top: null }] = await db.select({ top: max(collections.sort_order) }).from(collections);
  const id = newId();
  const now = nowIso();
  await db.insert(collections).values({
    id,
    name: input.name.trim(),
    categories: cleanCategories(input.categories ?? []),
    sort_order: (top ?? -1) + 1,
    created_at: now,
    updated_at: now,
  });
  notifyChange();
  return id;
}

export async function updateCollection(id: string, patch: { name?: string; categories?: string[] }) {
  const values: Partial<CollectionRow> = { updated_at: nowIso() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.categories !== undefined) values.categories = cleanCategories(patch.categories);
  await getDb().update(collections).set(values).where(eq(collections.id, id));
  notifyChange();
}

/** Bump updated_at after any item or journal change in the collection. */
export async function touchCollection(id: string) {
  await getDb().update(collections).set({ updated_at: nowIso() }).where(eq(collections.id, id));
}

/** Persists a new dashboard order. */
export async function reorderCollections(orderedIds: string[]) {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(collections).set({ sort_order: i }).where(eq(collections.id, orderedIds[i]));
  }
  notifyChange();
}

/** Deletes a collection with its items and journal entries. Returns the photo paths to remove. */
export async function deleteCollection(id: string): Promise<string[]> {
  const db = getDb();
  const [itemPhotos, entryPhotos] = await Promise.all([
    db.select({ photos: items.photos }).from(items).where(eq(items.collection_id, id)),
    db.select({ photos: journalEntries.photos }).from(journalEntries).where(eq(journalEntries.collection_id, id)),
  ]);
  await db.delete(collections).where(eq(collections.id, id));
  notifyChange();
  return [...itemPhotos, ...entryPhotos].flatMap((r) => r.photos ?? []);
}

function cleanCategories(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const c = raw.trim();
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      out.push(c);
    }
  }
  return out;
}
