/*
one-off import of a `turso db export` into a freshly migrated, empty postgres database.
read README.md first. the source is opened read-only; the target url comes only from
TARGET_DATABASE_URL so no .env file can point it anywhere by accident. everything runs
in one transaction: any invalid row rolls the whole import back.
*/
import { AppError } from '@/lib/errors';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';
import { buildClubPlayerStats } from '@/server/mutations/player-stats';
import { Database } from 'bun:sqlite';
import { getColumns, getTableName, is, type Column } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  PgBoolean,
  PgDateString,
  PgJsonb,
  PgTable,
  PgTimestamp,
} from 'drizzle-orm/pg-core';

// parents before children, so every foreign key already resolves on insert
const TABLES: PgTable[] = [
  schema.clubs,
  schema.users,
  schema.clubs_to_users,
  schema.user_preferences,
  schema.sessions,
  schema.apiTokens,
  schema.tournaments,
  schema.players,
  schema.tournament_units,
  schema.players_to_units,
  schema.games,
  schema.affiliations,
  schema.rating_events,
  schema.club_notifications,
  schema.user_notifications,
];
// a derived projection: rebuilt from the imported source tables instead of copied
const REBUILT_TABLES: PgTable[] = [schema.player_stats];
// the sqlite schema stored these as `timestamp_ms`; every other timestamp is in seconds
const MILLISECOND_COLUMNS = new Set(['tournament_units.added_at']);
const INSERT_CHUNK_SIZE = 1000;

const fail = (cause: string): never => {
  throw new AppError('DATABASE_MIGRATION_ERROR', { cause });
};

const [exportPath] = process.argv.slice(2);
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!exportPath || !targetUrl) {
  console.error(
    'usage: TARGET_DATABASE_URL=<postgres url> bun scripts/temporary/postgres-cutover/import-turso-export.ts <export.db>',
  );
  process.exit(1);
}

const allTables = Object.values(schema).filter((value) => is(value, PgTable));
const unhandled = allTables.filter(
  (table) => !TABLES.includes(table) && !REBUILT_TABLES.includes(table),
);
if (unhandled.length > 0) {
  fail(
    `tables missing from the import order: ${unhandled.map(getTableName).join(', ')}`,
  );
}

const source = new Database(exportPath, { readonly: true, strict: true });
const db = drizzle({ connection: targetUrl, relations });

function toPostgresValue(table: string, column: Column, value: unknown) {
  if (value === null) return null;
  const where = `${table}.${column.name}`;
  if (is(column, PgTimestamp)) {
    if (!Number.isInteger(value)) fail(`${where}: ${value}`);
    const unit = MILLISECOND_COLUMNS.has(where) ? 1 : 1000;
    return new Date((value as number) * unit);
  }
  if (is(column, PgBoolean)) {
    if (value !== 0 && value !== 1) fail(`${where}: ${value}`);
    return value === 1;
  }
  if (is(column, PgJsonb)) return JSON.parse(value as string);
  if (is(column, PgDateString) && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    fail(`${where}: ${value}`);
  }
  return value;
}

function readTable(table: PgTable) {
  const name = getTableName(table);
  const columns = Object.entries(getColumns(table)).filter(
    ([, column]) => !column.generated,
  );
  const sourceColumns = new Set(
    source
      .query<{ name: string }, []>(
        `select name from pragma_table_info('${name}')`,
      )
      .all()
      .map((column) => column.name),
  );
  const missing = columns.filter(
    ([, column]) => !sourceColumns.has(column.name),
  );
  if (missing.length > 0) {
    fail(
      `${name} export lacks ${missing.map(([, column]) => column.name).join(', ')}: apply every sqlite migration before exporting`,
    );
  }

  return source
    .query<Record<string, unknown>, []>(`select * from "${name}"`)
    .all()
    .map((row) =>
      Object.fromEntries(
        columns.map(([key, column]) => [
          key,
          toPostgresValue(name, column, row[column.name]),
        ]),
      ),
    );
}

const counts = await db.transaction(async (tx) => {
  for (const table of allTables) {
    if ((await tx.$count(table)) > 0) {
      fail(`target is not empty: ${getTableName(table)} has rows`);
    }
  }

  const imported: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = readTable(table);
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      await tx.insert(table).values(rows.slice(i, i + INSERT_CHUNK_SIZE));
    }
    const stored = await tx.$count(table);
    if (stored !== rows.length) {
      fail(`${getTableName(table)}: read ${rows.length}, stored ${stored}`);
    }
    imported[getTableName(table)] = stored;
  }

  const clubs = await tx.select({ id: schema.clubs.id }).from(schema.clubs);
  for (const club of clubs) {
    const stats = await buildClubPlayerStats(tx, club.id);
    if (stats.length > 0) await tx.insert(schema.player_stats).values(stats);
  }
  const statsCount = await tx.$count(schema.player_stats);
  if (statsCount !== imported.player) {
    fail(`player_stats: ${statsCount} rows for ${imported.player} players`);
  }
  imported.player_stats = statsCount;
  return imported;
});

console.table(counts);
await db.$client.end();
source.close();
