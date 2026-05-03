import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/config/urls';
import * as schema5 from '@/server/db/schema/clubs';
import * as schema3 from '@/server/db/schema/notifications';
import * as schema4 from '@/server/db/schema/players';
import * as schema1 from '@/server/db/schema/tournaments';
import * as schema2 from '@/server/db/schema/users';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle } from 'drizzle-orm/libsql';

const schema = {
  ...schema1,
  ...schema2,
  ...schema3,
  ...schema4,
  ...schema5,
};

let _sqlite: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

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
    _db = drizzle(getSqlite(), { schema });
  }
  return _db;
};

export const sqlite = getSqlite();
export const db = getDatabase();

export type Database = Pick<typeof db, 'select' | 'update'>;
