/*
one-off re-rank of every club after ranks became row numbers for all players
(docs/adr/0002). until a club is re-ranked it keeps ranks from the old rule,
which numbered established ratings only, so a club without one shows only dashes.

deploy the release first, so nothing writes ranks under the old rule afterwards.
then run it from the repository root with the database spelled out inline:

  DATABASE_URL=libsql://<db host> \
  DATABASE_AUTH_TOKEN=$(turso db tokens create <db> --expiration 1h) \
    bun scripts/temporary/rerank-clubs/rerank-clubs.ts <db host>

the argument must match the url's host, so a stray .env can't choose the
database. each club is re-ranked in its own write transaction, so it is safe
while the app is live, and a rerun rewrites only rows that changed. delete this
folder once beta and main are done.
*/
import { createClient } from '@libsql/client';
import { count, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { AppError } from '@/lib/errors';
import type { Database } from '@/server/db';
import { relations } from '@/server/db/relations';
import { player_stats } from '@/server/db/schema/players';
import { refreshPlayerStats } from '@/server/mutations/player-stats';

export async function rerankClubs(database: Database) {
  const clubs = await database
    .selectDistinct({ clubId: player_stats.clubId })
    .from(player_stats);
  for (const { clubId } of clubs) {
    await database.transaction((tx) =>
      refreshPlayerStats(tx, { clubId, playerIds: [] }),
    );
  }
  return clubs.length;
}

const countUnranked = async (database: Database) =>
  (
    await database
      .select({ count: count() })
      .from(player_stats)
      .where(isNull(player_stats.ratingRank))
  )[0].count;

if (import.meta.main) {
  const [host] = Bun.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!host || !url || new URL(url).host !== host) {
    throw new AppError('CONFIG_ERROR', {
      cause: 'read the script header: pass the host of DATABASE_URL',
    });
  }
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    const database = drizzle({ client, relations });
    const unrankedBefore = await countUnranked(database);
    const clubs = await rerankClubs(database);
    const unrankedAfter = await countUnranked(database);
    console.log({ clubs, unrankedBefore, unrankedAfter });
  } finally {
    client.close();
  }
}
