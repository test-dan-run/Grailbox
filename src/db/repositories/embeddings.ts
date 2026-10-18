import { and, eq, isNotNull } from 'drizzle-orm';

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

/** Stores a computed embedding for one reference photo (phase 2). */
export async function setEmbedding(itemId: string, photoUri: string, vector: Float32Array) {
  await getDb()
    .update(itemEmbeddings)
    .set({ vector: new Uint8Array(vector.buffer.slice(0)) })
    .where(and(eq(itemEmbeddings.item_id, itemId), eq(itemEmbeddings.photo_uri, photoUri)));
}

/** All reference vectors that have been computed, for brute-force ranking. */
export async function listVectors(): Promise<{ item_id: string; vector: Float32Array }[]> {
  const rows = await getDb()
    .select({ item_id: itemEmbeddings.item_id, vector: itemEmbeddings.vector })
    .from(itemEmbeddings)
    .where(isNotNull(itemEmbeddings.vector));
  return rows
    .filter((r) => r.vector)
    .map((r) => {
      const bytes = r.vector as Uint8Array;
      const copy = bytes.slice();
      return { item_id: r.item_id, vector: new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4)) };
    });
}
