import { getDatabaseUrl } from '@/lib/config/non-next-urls';
import { relations } from '@/server/db/relations';
import type {
  NodePgDatabase,
  NodePgTransaction,
} from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: getDatabaseUrl() });

export const db = drizzle({ client: pool, relations });

export type Database = NodePgDatabase<typeof relations> | Transaction;
export type Transaction = NodePgTransaction<typeof relations>;
