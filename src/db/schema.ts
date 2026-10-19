import { sql } from 'drizzle-orm';
import { customType, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Condition, ItemStatus, JournalEntryType, Origin, Priority, ReferenceSource } from './types';

/*
 * SQLite schema. Arrays are stored as JSON text. Item specs are flattened into
 * columns so the barcode can be indexed. Collection counts and preview images
 * are derived in queries, never stored.
 */

/** Raw bytes column (a Float32Array's buffer for embeddings). */
const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'blob',
});

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  categories: text('categories', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    collection_id: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    line: text('line'),
    line_url: text('line_url'),
    category: text('category'),
    status: text('status').$type<ItemStatus>().notNull(),
    origin: text('origin').$type<Origin>().notNull().default('OFFICIAL'),
    quantity: integer('quantity').notNull().default(1),
    variant_tags: text('variant_tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    priority: text('priority').$type<Priority>(),
    estimated_price: integer('estimated_price'),
    purchase_price: integer('purchase_price'),
    currency: text('currency').notNull(),
    acquisition_date: text('acquisition_date'),
    acquisition_source: text('acquisition_source'),
    condition: text('condition').$type<Condition>(),
    storage_location: text('storage_location'),
    release_year: integer('release_year'),
    manufacturer: text('manufacturer'),
    size: text('size'),
    barcode: text('barcode'),
    photos: text('photos', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [
    index('items_collection_status_idx').on(t.collection_id, t.status),
    index('items_barcode_idx').on(t.barcode),
  ],
);

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: text('id').primaryKey(),
    collection_id: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    entry_type: text('entry_type').$type<JournalEntryType>().notNull(),
    is_grail: integer('is_grail', { mode: 'boolean' }).notNull().default(false),
    item_ids: text('item_ids', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    photos: text('photos', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    created_at: text('created_at').notNull(),
  },
  (t) => [index('journal_collection_date_idx').on(t.collection_id, sql`${t.date} DESC`)],
);

/**
 * Reference photos for duplicate detection: every item photo, plus the hidden
 * frames picked from the item's scan angles video (`source` 'video'). `vector`
 * is the photo's on-device image embedding and `model` names the model that
 * made it (vectors from different models cannot be compared). Both stay empty
 * until the embedder has run on the photo.
 */
export const itemEmbeddings = sqliteTable(
  'item_embeddings',
  {
    id: text('id').primaryKey(),
    item_id: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    photo_uri: text('photo_uri').notNull(),
    source: text('source').$type<ReferenceSource>().notNull().default('photo'),
    vector: bytes('vector'),
    model: text('model'),
    created_at: text('created_at').notNull(),
  },
  (t) => [index('item_embeddings_item_idx').on(t.item_id)],
);

export type CollectionRow = typeof collections.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type JournalRow = typeof journalEntries.$inferSelect;
