import { and, asc, eq, inArray, isNull, max, ne, or } from 'drizzle-orm';

import { newId, nowIso } from '@/lib/id';

import { getDb, notifyChange } from '../database';
import { itemEmbeddings, items } from '../schema';

const toBytes = (vector: Float32Array) => new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength).slice();

/**
 * Makes every item photo a reference photo, and drops references to photos
 * that are no longer on their item. Returns whether anything changed. Scan
 * angle frames are not item photos, so setReferenceFrames manages them.
 */
export async function syncReferencePhotos(): Promise<boolean> {
  const db = getDb();
  const owned = await db.select({ id: items.id, photos: items.photos }).from(items);
  const refs = await db
    .select({ id: itemEmbeddings.id, item_id: itemEmbeddings.item_id, photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings)
    .where(eq(itemEmbeddings.source, 'photo'));
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
    .set({ vector: toBytes(vector), model })
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

/** An item's scan angle frames, in the order they were picked. */
export async function listReferenceFrames(itemId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings)
    .where(and(eq(itemEmbeddings.item_id, itemId), eq(itemEmbeddings.source, 'video')))
    .orderBy(asc(itemEmbeddings.created_at), asc(itemEmbeddings.id));
  return rows.map((r) => r.photo_uri);
}

/**
 * Makes `frames` the item's scan angle frames, replacing any it had. A frame
 * the item already has keeps its stored vector; a new frame stores the vector
 * given with it, from `model`, or waits for references.ts to embed it.
 * Returns the frames removed, so the caller can delete their files.
 */
export async function setReferenceFrames(
  itemId: string,
  frames: { photo_uri: string; vector?: Float32Array }[],
  model: string,
): Promise<string[]> {
  const db = getDb();
  const before = await listReferenceFrames(itemId);
  const keep = new Set(frames.map((f) => f.photo_uri));
  const removed = before.filter((p) => !keep.has(p));
  if (removed.length) {
    await db
      .delete(itemEmbeddings)
      .where(
        and(eq(itemEmbeddings.item_id, itemId), eq(itemEmbeddings.source, 'video'), inArray(itemEmbeddings.photo_uri, removed)),
      );
  }
  const have = new Set(before);
  const added = frames.filter((f) => !have.has(f.photo_uri));
  // Times after the item's latest frame keep the picking order, even for two calls in the same millisecond.
  const [latest] = await db
    .select({ at: max(itemEmbeddings.created_at) })
    .from(itemEmbeddings)
    .where(and(eq(itemEmbeddings.item_id, itemId), eq(itemEmbeddings.source, 'video')));
  const now = Math.max(Date.now(), latest?.at ? Date.parse(latest.at) + 1 : 0);
  for (const [i, f] of added.entries()) {
    await db.insert(itemEmbeddings).values({
      id: newId(),
      item_id: itemId,
      photo_uri: f.photo_uri,
      source: 'video',
      vector: f.vector ? toBytes(f.vector) : null,
      model: f.vector ? model : null,
      created_at: new Date(now + i).toISOString(),
    });
  }
  if (removed.length || added.length) notifyChange();
  return removed;
}

/** Scan angle frames of every item, by item id, for Export. */
export async function referenceFramesByItem(): Promise<Map<string, string[]>> {
  const rows = await getDb()
    .select({ item_id: itemEmbeddings.item_id, photo_uri: itemEmbeddings.photo_uri })
    .from(itemEmbeddings)
    .where(eq(itemEmbeddings.source, 'video'))
    .orderBy(asc(itemEmbeddings.created_at), asc(itemEmbeddings.id));
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.item_id, [...(out.get(r.item_id) ?? []), r.photo_uri]);
  return out;
}
