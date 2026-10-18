import { and, eq, isNull, ne, or } from 'drizzle-orm';

import { newId, nowIso } from '@/lib/id';

import { getDb, notifyChange } from '../database';
import { itemEmbeddings, items } from '../schema';

/**
 * "Mark as Dupe Check": adds an item's photos to the scanner's reference set.
 * Rows start without a vector; the phase 2 embedder fills them in.
 * Returns how many photos the item now has in the set.
 */
export async function markDupeCheck(itemId: string): Promise<{ added: number; total: number }> {
  const db = getDb();
  const [item] = await db.select({ photos: items.photos }).from(items).where(eq(items.id, itemId));
  if (!item) throw new Error('Item not found');
  const existing = await db
    .select({ photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings)
    .where(eq(itemEmbeddings.item_id, itemId));
  const have = new Set(existing.map((r) => r.photo_uri));
  const fresh = (item.photos ?? []).filter((p) => !have.has(p));
  for (const photo of fresh) {
    await db.insert(itemEmbeddings).values({ id: newId(), item_id: itemId, photo_uri: photo, created_at: nowIso() });
  }
  if (fresh.length) notifyChange();
  return { added: fresh.length, total: have.size + fresh.length };
}

export async function referenceCount(itemId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: itemEmbeddings.id })
    .from(itemEmbeddings)
    .where(eq(itemEmbeddings.item_id, itemId));
  return rows.length;
}

/**
 * Makes every item photo a reference photo, and drops references to photos
 * that are no longer on their item. Returns whether anything changed.
 */
export async function syncReferencePhotos(): Promise<boolean> {
  const db = getDb();
  const owned = await db.select({ id: items.id, photos: items.photos }).from(items);
  const refs = await db
    .select({ id: itemEmbeddings.id, item_id: itemEmbeddings.item_id, photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings);
  const want = new Set(owned.flatMap((it) => it.photos.map((p) => `${it.id}\n${p}`)));
  const have = new Set(refs.map((r) => `${r.item_id}\n${r.photo_uri}`));
  let changed = false;
  for (const r of refs) {
    if (!want.has(`${r.item_id}\n${r.photo_uri}`)) {
      await db.delete(itemEmbeddings).where(eq(itemEmbeddings.id, r.id));
      changed = true;
    }
  }
  for (const it of owned) {
    for (const photo of it.photos) {
      if (have.has(`${it.id}\n${photo}`)) continue;
      have.add(`${it.id}\n${photo}`);
      await db.insert(itemEmbeddings).values({ id: newId(), item_id: it.id, photo_uri: photo, created_at: nowIso() });
      changed = true;
    }
  }
  if (changed) notifyChange();
  return changed;
}

/** Reference photos that still need a vector from `model`: never embedded, or embedded by another model. */
export async function pendingReferences(model: string): Promise<{ item_id: string; photo_uri: string }[]> {
  return getDb()
    .select({ item_id: itemEmbeddings.item_id, photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings)
    .where(or(isNull(itemEmbeddings.vector), isNull(itemEmbeddings.model), ne(itemEmbeddings.model, model)));
}

/** Stores a computed embedding for one reference photo. */
export async function setEmbedding(itemId: string, photoUri: string, vector: Float32Array, model: string) {
  await getDb()
    .update(itemEmbeddings)
    .set({ vector: new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength).slice(), model })
    .where(and(eq(itemEmbeddings.item_id, itemId), eq(itemEmbeddings.photo_uri, photoUri)));
}

/** Every reference vector computed by `model`, for brute-force ranking. */
export async function listVectors(model: string): Promise<{ item_id: string; vector: Float32Array }[]> {
  const rows = await getDb()
    .select({ item_id: itemEmbeddings.item_id, vector: itemEmbeddings.vector })
    .from(itemEmbeddings)
    .where(eq(itemEmbeddings.model, model));
  return rows
    .filter((r) => r.vector)
    .map((r) => {
      const bytes = r.vector as Uint8Array;
      const copy = bytes.slice();
      return { item_id: r.item_id, vector: new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4)) };
    });
}
