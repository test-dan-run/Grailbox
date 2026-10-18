import { desc, eq } from 'drizzle-orm';

import { newId, nowIso } from '@/lib/id';

import { getDb, notifyChange } from '../database';
import { journalEntries, type JournalRow } from '../schema';
import type { JournalEntry, JournalEntryInput } from '../types';
import { touchCollection } from './collections';

function toEntry(r: JournalRow): JournalEntry {
  return {
    id: r.id,
    collection_id: r.collection_id,
    date: r.date,
    title: r.title,
    notes: r.notes ?? undefined,
    entry_type: r.entry_type,
    is_grail: r.is_grail,
    item_ids: r.item_ids ?? [],
    photos: r.photos ?? [],
    created_at: r.created_at,
  };
}

/** A collection's timeline, newest first. */
export async function listEntries(collectionId: string): Promise<JournalEntry[]> {
  const rows = await getDb()
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.collection_id, collectionId))
    .orderBy(desc(journalEntries.date), desc(journalEntries.created_at));
  return rows.map(toEntry);
}

export async function getEntry(id: string): Promise<JournalEntry | undefined> {
  const [row] = await getDb().select().from(journalEntries).where(eq(journalEntries.id, id));
  return row ? toEntry(row) : undefined;
}

/** The entries before and after one entry in date order. */
export async function entryNeighbours(
  entry: JournalEntry,
): Promise<{ earlier?: JournalEntry; later?: JournalEntry }> {
  const all = await listEntries(entry.collection_id);
  const i = all.findIndex((e) => e.id === entry.id);
  if (i === -1) return {};
  // The list is newest first, so "later" is the previous element.
  return { later: all[i - 1], earlier: all[i + 1] };
}

function toColumns(input: Partial<JournalEntryInput>): Partial<JournalRow> {
  const v: Partial<JournalRow> = {};
  if (input.collection_id !== undefined) v.collection_id = input.collection_id;
  if (input.date !== undefined) v.date = input.date.slice(0, 10);
  if (input.title !== undefined) v.title = input.title.trim();
  if ('notes' in input) v.notes = input.notes?.trim() || null;
  if (input.entry_type !== undefined) v.entry_type = input.entry_type;
  if ('is_grail' in input) v.is_grail = !!input.is_grail;
  if (input.item_ids !== undefined) v.item_ids = [...new Set(input.item_ids)];
  if (input.photos !== undefined) v.photos = input.photos;
  return v;
}

export async function createEntry(input: JournalEntryInput): Promise<string> {
  const id = newId();
  await getDb()
    .insert(journalEntries)
    .values({ ...toColumns(input), id, created_at: nowIso() } as JournalRow);
  await touchCollection(input.collection_id);
  notifyChange();
  return id;
}

export async function updateEntry(id: string, patch: Partial<JournalEntryInput>) {
  const before = await getEntry(id);
  if (!before) throw new Error('Entry not found');
  await getDb().update(journalEntries).set(toColumns(patch)).where(eq(journalEntries.id, id));
  await touchCollection(before.collection_id);
  notifyChange();
}

/** Deletes an entry. Returns its photo paths so the caller can remove the files. */
export async function deleteEntry(id: string): Promise<string[]> {
  const before = await getEntry(id);
  if (!before) return [];
  await getDb().delete(journalEntries).where(eq(journalEntries.id, id));
  await touchCollection(before.collection_id);
  notifyChange();
  return before.photos;
}
