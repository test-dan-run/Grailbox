import { and, asc, count, desc, eq, getTableColumns, inArray, isNotNull, like, min, or, sql } from 'drizzle-orm';

import { newId, nowIso } from '@/lib/id';

import { getDb, hasFullTextSearch, notifyChange } from '../database';
import { collections, items, type ItemRow } from '../schema';
import type { CollectibleItem, ItemInput, ItemSearchResult, ItemStatus } from '../types';
import { touchCollection } from './collections';

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export function toItem(r: ItemRow): CollectibleItem {
  return {
    id: r.id,
    collection_id: r.collection_id,
    title: r.title,
    line: opt(r.line),
    line_url: opt(r.line_url),
    category: opt(r.category),
    status: r.status,
    origin: r.origin,
    quantity: r.quantity,
    variant_tags: r.variant_tags ?? [],
    priority: opt(r.priority),
    estimated_price: opt(r.estimated_price),
    purchase_price: opt(r.purchase_price),
    currency: r.currency,
    acquisition_date: opt(r.acquisition_date),
    acquisition_source: opt(r.acquisition_source),
    condition: opt(r.condition),
    storage_location: opt(r.storage_location),
    specs: {
      release_year: opt(r.release_year),
      manufacturer: opt(r.manufacturer),
      size: opt(r.size),
      barcode: opt(r.barcode),
    },
    photos: r.photos ?? [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const blank = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Flattens a domain patch into column values; empty strings become NULL. */
function toColumns(input: Partial<ItemInput>): Partial<ItemRow> {
  const v: Partial<ItemRow> = {};
  if ('collection_id' in input) v.collection_id = input.collection_id!;
  if ('title' in input) v.title = (input.title ?? '').trim();
  if ('line' in input) v.line = blank(input.line);
  if ('line_url' in input) v.line_url = blank(input.line_url);
  if ('category' in input) v.category = blank(input.category);
  if ('status' in input) v.status = input.status!;
  if ('origin' in input) v.origin = input.origin ?? 'OFFICIAL';
  if ('quantity' in input) v.quantity = Math.max(1, Math.round(input.quantity ?? 1));
  if ('variant_tags' in input) v.variant_tags = (input.variant_tags ?? []).map((t) => t.trim()).filter(Boolean);
  if ('priority' in input) v.priority = input.priority ?? null;
  if ('estimated_price' in input) v.estimated_price = input.estimated_price ?? null;
  if ('purchase_price' in input) v.purchase_price = input.purchase_price ?? null;
  if ('currency' in input) v.currency = (input.currency ?? 'USD').toUpperCase();
  if ('acquisition_date' in input) v.acquisition_date = blank(input.acquisition_date);
  if ('acquisition_source' in input) v.acquisition_source = blank(input.acquisition_source);
  if ('condition' in input) v.condition = input.condition ?? null;
  if ('storage_location' in input) v.storage_location = blank(input.storage_location);
  if ('photos' in input) v.photos = input.photos ?? [];
  if (input.specs) {
    const s = input.specs;
    v.release_year = s.release_year ?? null;
    v.manufacturer = blank(s.manufacturer);
    v.size = blank(s.size);
    v.barcode = s.barcode ? normalizeBarcode(s.barcode) || null : null;
  }
  // Wishlist items carry no condition; only wishlist items carry a priority.
  if (v.status === 'WISHLIST') v.condition = null;
  if (v.status && v.status !== 'WISHLIST') v.priority = null;
  return v;
}

export async function getItem(id: string): Promise<CollectibleItem | undefined> {
  const [row] = await getDb().select().from(items).where(eq(items.id, id));
  return row ? toItem(row) : undefined;
}

export async function getItems(ids: string[]): Promise<CollectibleItem[]> {
  if (ids.length === 0) return [];
  const rows = await getDb().select().from(items).where(inArray(items.id, ids));
  const byId = new Map(rows.map((r) => [r.id, toItem(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is CollectibleItem => !!x);
}

/** All items in a collection, newest first. Filtering happens in memory so it is instant. */
export async function listItems(collectionId: string): Promise<CollectibleItem[]> {
  const rows = await getDb()
    .select()
    .from(items)
    .where(eq(items.collection_id, collectionId))
    .orderBy(desc(items.created_at), desc(sql`rowid`));
  return rows.map(toItem);
}

export async function createItem(input: ItemInput): Promise<string> {
  const id = newId();
  const now = nowIso();
  const cols = toColumns(input);
  await getDb()
    .insert(items)
    .values({
      ...cols,
      id,
      collection_id: input.collection_id,
      title: cols.title ?? input.title,
      status: input.status,
      currency: cols.currency ?? 'USD',
      created_at: now,
      updated_at: now,
    } as ItemRow);
  await touchCollection(input.collection_id);
  notifyChange();
  return id;
}

export async function updateItem(id: string, patch: Partial<ItemInput>) {
  const before = await getItem(id);
  if (!before) throw new Error('Item not found');
  // Status-dependent cleanup needs the effective status.
  const cols = toColumns({ status: before.status, ...patch });
  await getDb()
    .update(items)
    .set({ ...cols, updated_at: nowIso() })
    .where(eq(items.id, id));
  await touchCollection(before.collection_id);
  if (patch.collection_id && patch.collection_id !== before.collection_id) {
    await touchCollection(patch.collection_id);
  }
  notifyChange();
}

/** Deletes an item. Returns its photo paths so the caller can remove the files. */
export async function deleteItem(id: string): Promise<string[]> {
  const before = await getItem(id);
  if (!before) return [];
  await getDb().delete(items).where(eq(items.id, id));
  await touchCollection(before.collection_id);
  notifyChange();
  return before.photos;
}

/** Strips spaces and dashes from a scanned or typed barcode. */
export function normalizeBarcode(code: string): string {
  return code.replace(/[\s-]/g, '').trim();
}

/**
 * Lookup keys for a barcode. Numeric codes match across UPC-A, EAN-13 and
 * GTIN-14 forms, which differ only by leading zeros.
 */
export function barcodeCandidates(code: string): string[] {
  const c = normalizeBarcode(code);
  if (!c) return [];
  const out = new Set([c]);
  if (/^\d+$/.test(c)) {
    const stripped = c.replace(/^0+/, '');
    out.add(stripped);
    for (const len of [8, 12, 13, 14]) if (stripped.length <= len) out.add(stripped.padStart(len, '0'));
  }
  return [...out];
}

export interface BarcodeMatch {
  item: CollectibleItem;
  collection_name: string;
}

/** Exact barcode match. Owned and in-transit copies win over wishlist entries. */
export async function findByBarcode(code: string): Promise<BarcodeMatch | undefined> {
  const keys = barcodeCandidates(code);
  if (keys.length === 0) return undefined;
  const rows = await getDb()
    .select({ ...getTableColumns(items), collection_name: collections.name })
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collection_id))
    .where(inArray(items.barcode, keys));
  if (rows.length === 0) return undefined;
  const rank = (s: ItemStatus) => (s === 'OWNED' ? 0 : s === 'IN_TRANSIT' ? 1 : 2);
  rows.sort((a, b) => rank(a.status) - rank(b.status));
  const { collection_name, ...row } = rows[0];
  return { item: toItem(row), collection_name };
}

/** Builds an FTS5 query: every word must match, each as a prefix. */
export function toFtsQuery(text: string): string | undefined {
  const tokens = text
    .normalize('NFKC')
    .split(/\s+/)
    .map((t) => t.replace(/["*^():]/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

/**
 * Searches every item in every collection by title, line, manufacturer,
 * source and storage location. With an empty query and a status, lists all
 * items with that status.
 */
export async function searchItems(text: string, status?: ItemStatus): Promise<ItemSearchResult[]> {
  const q = toFtsQuery(text);
  if (!q && !status) return [];
  const conditions = [];
  if (q && hasFullTextSearch()) {
    conditions.push(sql`${items.id} IN (SELECT item_id FROM items_fts WHERE items_fts MATCH ${q})`);
  } else if (q) {
    conditions.push(...likeConditions(text));
  }
  if (status) conditions.push(eq(items.status, status));
  const rows = await getDb()
    .select({ ...getTableColumns(items), collection_name: collections.name })
    .from(items)
    .innerJoin(collections, eq(collections.id, items.collection_id))
    .where(and(...conditions))
    .orderBy(asc(items.title))
    .limit(200);
  return rows.map(({ collection_name, ...row }) => ({ ...toItem(row), collection_name }));
}

/** Fallback without FTS5: every word must appear in one of the searched columns. */
function likeConditions(text: string) {
  const cols = [items.title, items.line, items.manufacturer, items.acquisition_source, items.storage_location];
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const pattern = `%${word.replace(/[%_]/g, '')}%`;
      return or(...cols.map((c) => like(c, pattern)))!;
    });
}

/** Totals for the scanner's "Checking N items across M collections". */
export async function grailboxTotals(): Promise<{ items: number; collections: number }> {
  const db = getDb();
  const [[i], [c]] = await Promise.all([
    db.select({ n: count() }).from(items),
    db.select({ n: count() }).from(collections),
  ]);
  return { items: i?.n ?? 0, collections: c?.n ?? 0 };
}

/** Earliest acquisition date in a collection ("Collecting since Dec 2019"). */
export async function earliestAcquisition(collectionId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ d: min(items.acquisition_date) })
    .from(items)
    .where(and(eq(items.collection_id, collectionId), isNotNull(items.acquisition_date)));
  return row?.d ?? undefined;
}
