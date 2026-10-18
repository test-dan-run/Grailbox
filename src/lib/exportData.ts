import { File, FileMode, Paths } from 'expo-file-system';
import { strToU8, Zip, ZipPassThrough } from 'fflate';

import { listCollections } from '@/db/repositories/collections';
import { listItems } from '@/db/repositories/items';
import { listEntries } from '@/db/repositories/journal';
import type { Collection, CollectibleItem, JournalEntry } from '@/db/types';

import { todayIso } from './dates';
import { listPhotoFiles } from './photos';

export const EXPORT_FORMAT = 'grailbox-export';
export const EXPORT_VERSION = 1;

export interface GrailboxExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exported_at: string;
  /** Prices are integers in minor units of each item's own currency. */
  collections: Collection[];
  items: CollectibleItem[];
  journal_entries: JournalEntry[];
}

/** Everything in the database as one JSON-ready object. */
export async function buildExport(): Promise<GrailboxExport> {
  const collections = await listCollections();
  const items: CollectibleItem[] = [];
  const journal_entries: JournalEntry[] = [];
  for (const c of collections) {
    items.push(...(await listItems(c.id)));
    journal_entries.push(...(await listEntries(c.id)));
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: new Date().toISOString(), collections, items, journal_entries };
}

/**
 * Writes the backup: one zip holding grailbox.json and a photos/ folder.
 * Photo paths in the JSON (photos/<id>.jpg) match the paths inside the zip.
 * Thumbnails are left out; they can be rebuilt from the photos. The zip is
 * streamed to disk one photo at a time, without recompressing JPEGs.
 */
export async function writeExportZip(): Promise<{ file: File; photos: number; data: GrailboxExport }> {
  const data = await buildExport();
  const out = new File(Paths.cache, `grailbox-export-${todayIso()}.zip`);
  if (out.exists) out.delete();
  out.create();
  const handle = out.open(FileMode.Truncate);
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else handle.writeBytesSync(chunk);
  });
  const add = (name: string, bytes: Uint8Array) => {
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    entry.push(bytes, true);
  };
  let photos = 0;
  try {
    add('grailbox.json', strToU8(JSON.stringify(data, null, 2)));
    for (const f of listPhotoFiles()) {
      if (f.name.endsWith('_256.jpg')) continue;
      add(`photos/${f.name}`, await f.bytes());
      photos += 1;
    }
    zip.end();
  } finally {
    handle.close();
  }
  if (failure) throw failure;
  return { file: out, photos, data };
}
