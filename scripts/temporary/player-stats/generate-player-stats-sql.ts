/*
read-only, local-only backfill generator for the player_stats projection.
follow README.md: maintenance on, export, generate, migrate, apply, verify, reopen.

run from the repository root, with bun:
  bun scripts/temporary/player-stats/generate-player-stats-sql.ts \
    /absolute/export.db /absolute/player-stats.sql

the input is a `turso db export` taken after maintenance is on. keep its `-wal` file
beside it under the same name: sqlite reads the uncheckpointed frames from there. the
tool reads only domain tables and never connects to turso or imports application
database credentials. the output file must not exist.
*/
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { getColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { AppError } from '@/lib/errors';
import { player_stats, players } from '@/server/db/schema/players';
import {
  buildClubPlayerStats,
  type PlayerStatsRow,
} from '@/server/mutations/player-stats';

type Database = Parameters<typeof buildClubPlayerStats>[0];

const { gamesPlayed: _, ...insertableColumns } = getColumns(player_stats);
const COLUMNS = Object.entries(insertableColumns) as [
  keyof PlayerStatsRow,
  (typeof insertableColumns)[keyof typeof insertableColumns],
][];

async function buildPlayerStats(database: Database, now: Date) {
  const clubs = await database
    .select({ clubId: players.clubId })
    .from(players)
    .groupBy(players.clubId);
  const rows: PlayerStatsRow[] = [];
  for (const { clubId } of clubs) {
    rows.push(...(await buildClubPlayerStats(database, clubId, now)));
  }
  return rows;
}

const sqlValue = (value: string | number | null) =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;

function playerStatsSql(rows: PlayerStatsRow[]) {
  const names = COLUMNS.map(([, column]) => column.name);
  const updates = names
    .filter((name) => name !== player_stats.playerId.name)
    .map((name) => `${name} = excluded.${name}`)
    .join(', ');
  const upserts = rows.map(
    (row) =>
      `INSERT INTO player_stats (${names.join(', ')}) VALUES (${COLUMNS.map(([key]) => sqlValue(row[key])).join(', ')}) ON CONFLICT (player_id) DO UPDATE SET ${updates};`,
  );
  return `-- generated from a frozen export; apply after the player_stats migration, with maintenance still on.
-- idempotent upserts: on error ROLLBACK, investigate and rerun the whole file.
BEGIN IMMEDIATE;
${upserts.join('\n')}
COMMIT;
SELECT count(*) AS players_without_stats FROM player LEFT JOIN player_stats ON player_stats.player_id = player.id WHERE player_stats.player_id IS NULL;
PRAGMA foreign_key_check;
`;
}

if (import.meta.main) {
  const [input, output] = Bun.argv.slice(2);
  if (!input || !output || !existsSync(input) || existsSync(output)) {
    throw new AppError('CONFIG_ERROR', {
      cause:
        'read the generator header: provide a sqlite export and a new output path',
    });
  }
  const client = createClient({ url: `file:${resolve(input)}` });
  try {
    const rows = await buildPlayerStats(drizzle({ client }), new Date());
    await Bun.write(output, playerStatsSql(rows));
    console.log({ players: rows.length, sql: output });
  } finally {
    client.close();
  }
}
