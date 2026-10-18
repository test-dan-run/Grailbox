import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * The app's Drizzle database. The expo-sqlite driver runs in 'sync' mode on
 * device; tests use an async proxy over node:sqlite. Repositories `await`
 * every query so they work with either.
 */
export type AppDb = BaseSQLiteDatabase<'sync' | 'async', any, typeof schema>;

let current: AppDb | null = null;

export function setDb(db: AppDb) {
  current = db;
}

export function getDb(): AppDb {
  if (!current) throw new Error('Database not initialised');
  return current;
}

/**
 * Native builds ship SQLite with FTS5. The web preview's wasm SQLite has no
 * FTS5, so it skips the search migration and searches with LIKE instead.
 */
let fullTextSearch = true;

export function setFullTextSearch(enabled: boolean) {
  fullTextSearch = enabled;
}

export function hasFullTextSearch() {
  return fullTextSearch;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

/** Repositories call this after every write so mounted queries refresh. */
export function notifyChange() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion() {
  return version;
}
