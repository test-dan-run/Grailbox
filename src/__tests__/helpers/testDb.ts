import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { setDb, type AppDb } from '@/db/database';
import * as schema from '@/db/schema';

/**
 * A fresh in-memory database with every migration applied, wired in as the
 * app database. Uses node:sqlite behind Drizzle's async proxy driver.
 */
export function createTestDb(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  for (const m of readMigrationFiles({ migrationsFolder: path.join(__dirname, '../../../drizzle') })) {
    for (const stmt of m.sql) if (stmt.trim()) sqlite.exec(stmt);
  }

  const db = drizzle(
    async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      const args = params.map((p) => (typeof p === 'boolean' ? Number(p) : p));
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === 'get') {
        return { rows: (stmt.get(...args) as unknown as unknown[]) ?? undefined } as { rows: unknown[] };
      }
      return { rows: stmt.all(...args) as unknown[] };
    },
    { schema },
  );
  setDb(db as unknown as AppDb);
  return sqlite;
}
