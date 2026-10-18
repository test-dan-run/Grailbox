import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { setDb, type AppDb } from './database';
import * as schema from './schema';

const NAME = 'grailbox.db';

export type ClientDb = ExpoSQLiteDatabase<typeof schema>;

/**
 * Opens the on-device database. Native opens synchronously; the web preview
 * first warms expo-sqlite's worker asynchronously, since its synchronous calls
 * time out while the wasm build is still loading.
 */
export async function openAppDatabase(): Promise<ClientDb> {
  if (Platform.OS === 'web') {
    const warm = await openDatabaseAsync(NAME);
    await warm.closeAsync();
  }
  const sqlite = openDatabaseSync(NAME);
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  setDb(db as unknown as AppDb);
  return db;
}
