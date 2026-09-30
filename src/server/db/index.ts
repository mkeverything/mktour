import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/config/urls';
import { relations } from '@/server/db/relations';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle } from 'drizzle-orm/libsql';

let _sqlite: Client | null = null;
let _db: LibSQLDatabase<typeof relations> | null = null;

export const getSqlite = () => {
  if (!_sqlite) {
    const url = getDatabaseUrl() ?? '';
    _sqlite = createClient({
      url,
      authToken: getDatabaseAuthToken(),
    });
  }
  return _sqlite;
};

export const getDatabase = () => {
  if (!_db) {
    _db = drizzle({ client: getSqlite(), relations });
  }
  return _db;
};

export const sqlite = getSqlite();
export const db = getDatabase();

export type Database = Pick<typeof db, 'select' | 'update'>;
