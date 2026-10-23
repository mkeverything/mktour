import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { relations } from '@/server/db/relations';
import { clubs } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import { rerankClubs } from './rerank-clubs';

test('re-ranks clubs left by the old rule so every player has a position', async () => {
  // a file, not :memory:, because libsql opens a fresh connection after each transaction
  const directory = mkdtempSync(join(tmpdir(), 'mktour-rerank-clubs-test-'));
  const client = createClient({ url: `file:${join(directory, 'db.sqlite')}` });
  try {
    const database = drizzle({ client, relations });
    await migrate(database, { migrationsFolder: 'src/server/db/migrations' });

    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    await database.insert(clubs).values([
      { id: 'club-a', name: 'a', createdAt: at },
      { id: 'club-b', name: 'b', createdAt: at },
    ]);
    const player = (
      id: string,
      clubId: string,
      rating: number,
      ratingDeviation: number,
    ) => ({
      id,
      nickname: id,
      clubId,
      rating,
      ratingDeviation,
      ratingLastUpdateAt: at,
      lastSeenAt: at,
    });
    await database
      .insert(players)
      .values([
        player('established', 'club-a', 1700, 60),
        player('provisional', 'club-a', 1800, 200),
        player('idle', 'club-a', 1500, 350),
        player('solo', 'club-b', 1500, 350),
      ]);
    // what the old rule stored: established ratings and non-zero counts only
    const stats = (
      playerId: string,
      clubId: string,
      tournamentsPlayed: number,
      ratingRank: number | null,
      tournamentsPlayedRank: number | null,
    ) => ({
      playerId,
      clubId,
      tournamentsPlayed,
      ratingRank,
      tournamentsPlayedRank,
    });
    await database
      .insert(player_stats)
      .values([
        stats('established', 'club-a', 2, 1, 1),
        stats('provisional', 'club-a', 1, null, 2),
        stats('idle', 'club-a', 0, null, null),
        stats('solo', 'club-b', 0, null, null),
      ]);

    expect(await rerankClubs(database)).toBe(2);
    expect(
      await database
        .select({
          playerId: player_stats.playerId,
          ratingRank: player_stats.ratingRank,
          tournamentsPlayedRank: player_stats.tournamentsPlayedRank,
        })
        .from(player_stats)
        .orderBy(player_stats.playerId),
    ).toEqual([
      { playerId: 'established', ratingRank: 2, tournamentsPlayedRank: 1 },
      { playerId: 'idle', ratingRank: 3, tournamentsPlayedRank: 3 },
      { playerId: 'provisional', ratingRank: 1, tournamentsPlayedRank: 2 },
      { playerId: 'solo', ratingRank: 1, tournamentsPlayedRank: 1 },
    ]);
  } finally {
    client.close();
    rmSync(directory, { recursive: true });
  }
});
