/*
one-off import of a `turso db export` into a freshly migrated, empty postgres database.
read README.md first. the source is opened read-only; the target url comes only from
TARGET_DATABASE_URL so no .env file can point it anywhere by accident. everything runs
in one transaction: any invalid row rolls the whole import back.
*/
import { AppError } from '@/lib/errors';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';
import { refreshPlayerStats } from '@/server/mutations/player-stats';
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
import {
  assertLinksMatchAffiliations,
  reshapeAffiliations,
  type SourceAffiliation,
  type SourceNotification,
} from './reshape-affiliations';

// parents before children, so every foreign key already resolves on insert.
// sqlite's user_preferences was never read and is left out
const TABLES: PgTable[] = [
  schema.clubs,
  schema.users,
  schema.clubs_to_users,
  schema.sessions,
  schema.apiTokens,
  schema.tournaments,
  schema.players,
  schema.tournament_units,
  schema.players_to_units,
  schema.games,
  schema.rating_events,
];
// reshaped by reshape-affiliations.ts after the tables above are in
const RESHAPED_TABLES: PgTable[] = [
  schema.affiliations,
  schema.club_notifications,
  schema.user_notifications,
];
// a derived projection: rebuilt from the imported source tables instead of copied
const REBUILT_TABLES: PgTable[] = [schema.player_stats];
// sqlite kept unit memberships without their tournament
const SOURCE_QUERIES: Record<string, string> = {
  players_to_units: `select players_to_units.*, tournament_units.tournament_id
    from players_to_units
    join tournament_units on tournament_units.id = players_to_units.unit_id`,
};
const RENAMED_COLUMNS: Record<string, string> = {
  'tournament.title': 'name',
  'tournament.is_rated': 'rated',
  'club.is_player_self_reporting_enabled': 'allow_players_set_results',
};
// nullable in sqlite, not null with a default here
const NULLS_TO_DEFAULT = new Set(['tournament_units.is_out']);
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
  (table) =>
    ![...TABLES, ...RESHAPED_TABLES, ...REBUILT_TABLES].includes(table),
);
if (unhandled.length > 0) {
  fail(
    `tables missing from the import order: ${unhandled.map(getTableName).join(', ')}`,
  );
}

const source = new Database(exportPath, { readonly: true, strict: true });
const db = drizzle({ connection: targetUrl, relations });

function toPostgresValue(table: string, column: Column, value: unknown) {
  const where = `${table}.${column.name}`;
  if (value === null)
    return NULLS_TO_DEFAULT.has(where) ? column.default : null;
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
  const columns = Object.entries(getColumns(table))
    .filter(([, column]) => !column.generated)
    .map(([key, column]) => ({
      key,
      column,
      sourceColumn: RENAMED_COLUMNS[`${name}.${column.name}`] ?? column.name,
    }));
  const query = source.query<Record<string, unknown>, []>(
    SOURCE_QUERIES[name] ?? `select * from "${name}"`,
  );
  const sourceColumns = new Set(query.columnNames);
  const missing = columns.filter(
    ({ sourceColumn }) => !sourceColumns.has(sourceColumn),
  );
  if (missing.length > 0) {
    fail(
      `${name} export lacks ${missing.map(({ sourceColumn }) => sourceColumn).join(', ')}: apply every sqlite migration before exporting`,
    );
  }

  return query
    .all()
    .map((row) =>
      Object.fromEntries(
        columns.map(({ key, column, sourceColumn }) => [
          key,
          toPostgresValue(name, column, row[sourceColumn]),
        ]),
      ),
    );
}

function readNotifications(
  table: PgTable,
  owner: 'club_id' | 'user_id',
): SourceNotification[] {
  const name = getTableName(table);
  const { isSeen, createdAt } = getColumns(table);
  return source
    .query<Record<string, unknown>, []>(`select * from "${name}"`)
    .all()
    .map((row) => ({
      id: String(row.id),
      ownerId: String(row[owner]),
      event: String(row.event),
      isSeen: toPostgresValue(name, isSeen, row.is_seen) as boolean,
      createdAt: toPostgresValue(name, createdAt, row.created_at) as Date,
      metadata: JSON.parse(String(row.metadata)),
    }));
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

  const ids = async (
    table: typeof schema.clubs | typeof schema.users | typeof schema.players,
  ) =>
    new Set(
      (await tx.select({ id: table.id }).from(table)).map(({ id }) => id),
    );
  const reshaped = reshapeAffiliations({
    affiliations: readTable(schema.affiliations) as SourceAffiliation[],
    clubNotifications: readNotifications(schema.club_notifications, 'club_id'),
    userNotifications: readNotifications(schema.user_notifications, 'user_id'),
    existing: {
      clubs: await ids(schema.clubs),
      users: await ids(schema.users),
      players: await ids(schema.players),
    },
  });
  for (const [table, rows] of [
    [schema.affiliations, reshaped.affiliations],
    [schema.club_notifications, reshaped.clubNotifications],
    [schema.user_notifications, reshaped.userNotifications],
  ] as const) {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      await tx.insert(table).values(rows.slice(i, i + INSERT_CHUNK_SIZE));
    }
    imported[getTableName(table)] = await tx.$count(table);
  }
  imported['left out request notifications'] = reshaped.requestNotifications;
  imported['dropped notifications'] = reshaped.droppedNotifications;

  await assertLinksMatchAffiliations(tx);

  const players = await tx
    .select({ playerId: schema.players.id, clubId: schema.players.clubId })
    .from(schema.players);
  for (let i = 0; i < players.length; i += INSERT_CHUNK_SIZE) {
    await tx
      .insert(schema.player_stats)
      .values(
        players
          .slice(i, i + INSERT_CHUNK_SIZE)
          .map(({ playerId }) => ({ playerId })),
      );
  }
  for (const [clubId, clubPlayers] of Map.groupBy(
    players,
    ({ clubId }) => clubId,
  )) {
    await refreshPlayerStats(tx, {
      clubId,
      playerIds: clubPlayers.map(({ playerId }) => playerId),
    });
  }
  imported.player_stats = players.length;
  return imported;
});

console.table(counts);
await db.$client.end();
source.close();
