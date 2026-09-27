import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { clubs } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';

test('generates from a turso-style export with a wal file and imports idempotently after migration', async () => {
  const client = createClient({ url: 'file::memory:' });
  const directory = mkdtempSync(join(tmpdir(), 'mktour-player-stats-test-'));
  try {
    const migrations = readMigrationFiles({
      migrationsFolder: 'src/server/db/migrations',
    });
    const boundary = migrations.findIndex((migration) =>
      migration.sql.some((statement) =>
        statement.includes('CREATE TABLE `player_stats`'),
      ),
    );
    expect(boundary).toBeGreaterThan(0);
    await client.migrate(
      migrations.slice(0, boundary).flatMap((migration) => migration.sql),
    );

    const database = drizzle({ client });
    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    await database.insert(clubs).values([
      { id: 'club-a', name: 'a', createdAt: at },
      { id: 'club-b', name: 'b', createdAt: at },
    ]);
    const player = (
      id: string,
      clubId: string,
      rating = 1500,
      ratingDeviation = 350,
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
        player("o'winner", 'club-a', 1700, 60),
        player('loser', 'club-a', 1400, 60),
        player('idle', 'club-a', 1600, 50),
        player('solo', 'club-b'),
      ]);
    await database.insert(tournaments).values({
      id: 'closed',
      title: 'closed',
      format: 'round robin',
      type: 'solo',
      date: '2026-06-01',
      createdAt: at,
      clubId: 'club-a',
      startedAt: at,
      closedAt: at,
      roundsNumber: 1,
      ongoingRound: 1,
      rated: true,
    });
    await database.insert(tournament_units).values([
      {
        id: 'u-winner',
        size: 1,
        tournamentId: 'closed',
        nickname: 'winner',
        place: 1,
      },
      {
        id: 'u-loser',
        size: 1,
        tournamentId: 'closed',
        nickname: 'loser',
        place: 2,
      },
    ]);
    await database.insert(players_to_units).values([
      { id: 'w', playerId: "o'winner", unitId: 'u-winner', numberInUnit: 1 },
      { id: 'l', playerId: 'loser', unitId: 'u-loser', numberInUnit: 1 },
    ]);
    await database.insert(games).values({
      id: 'g',
      gameNumber: 1,
      roundNumber: 1,
      whiteUnitId: 'u-winner',
      blackUnitId: 'u-loser',
      whitePlayerId: "o'winner",
      blackPlayerId: 'loser',
      result: '1-0',
      finishedAt: at,
      tournamentId: 'closed',
    });

    const livePath = join(directory, 'live.db');
    const exportPath = join(directory, 'export.db');
    const outputPath = join(directory, 'player-stats.sql');
    await client.execute({ sql: 'VACUUM INTO ?', args: [livePath] });
    const live = new Database(livePath);
    try {
      live.exec('PRAGMA journal_mode = WAL');
      live.exec('PRAGMA wal_autocheckpoint = 0');
      live
        .query(
          'INSERT INTO player (id, nickname, club_id, rating, rating_deviation, rating_volatility, rating_last_update_at, last_seen_at) VALUES (?, ?, ?, 1500, 350, 0.06, 0, 0)',
        )
        .run('late', 'late', 'club-b');
      copyFileSync(livePath, exportPath);
      copyFileSync(`${livePath}-wal`, `${exportPath}-wal`);
    } finally {
      live.close();
    }
    expect(statSync(`${exportPath}-wal`).size).toBeGreaterThan(0);
    await database.insert(players).values(player('late', 'club-b'));

    const generator = Bun.spawn(
      [
        Bun.which('bun')!,
        'scripts/temporary/player-stats/generate-player-stats-sql.ts',
        exportPath,
        outputPath,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const stderr = await new Response(generator.stderr).text();
    expect({ code: await generator.exited, stderr }).toEqual({
      code: 0,
      stderr: '',
    });
    const importSql = await Bun.file(outputPath).text();
    expect(importSql).toContain("'late'");

    await client.migrate(
      migrations.slice(boundary).flatMap((migration) => migration.sql),
    );
    await client.executeMultiple(importSql);
    await client.executeMultiple(importSql);

    const imported = await database
      .select()
      .from(player_stats)
      .orderBy(player_stats.playerId);
    expect(imported).toEqual([
      {
        playerId: 'idle',
        clubId: 'club-a',
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        gamesWon: 0,
        gamesDrawn: 0,
        gamesLost: 0,
        gamesPlayed: 0,
        ratingRank: 2,
        tournamentsPlayedRank: null,
        tournamentsWonRank: null,
        gamesPlayedRank: null,
      },
      {
        playerId: 'late',
        clubId: 'club-b',
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        gamesWon: 0,
        gamesDrawn: 0,
        gamesLost: 0,
        gamesPlayed: 0,
        ratingRank: null,
        tournamentsPlayedRank: null,
        tournamentsWonRank: null,
        gamesPlayedRank: null,
      },
      {
        playerId: 'loser',
        clubId: 'club-a',
        tournamentsPlayed: 1,
        tournamentsWon: 0,
        gamesWon: 0,
        gamesDrawn: 0,
        gamesLost: 1,
        gamesPlayed: 1,
        ratingRank: 3,
        tournamentsPlayedRank: 2,
        tournamentsWonRank: null,
        gamesPlayedRank: 2,
      },
      {
        playerId: "o'winner",
        clubId: 'club-a',
        tournamentsPlayed: 1,
        tournamentsWon: 1,
        gamesWon: 1,
        gamesDrawn: 0,
        gamesLost: 0,
        gamesPlayed: 1,
        ratingRank: 1,
        tournamentsPlayedRank: 1,
        tournamentsWonRank: 1,
        gamesPlayedRank: 1,
      },
      {
        playerId: 'solo',
        clubId: 'club-b',
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        gamesWon: 0,
        gamesDrawn: 0,
        gamesLost: 0,
        gamesPlayed: 0,
        ratingRank: null,
        tournamentsPlayedRank: null,
        tournamentsWonRank: null,
        gamesPlayedRank: null,
      },
    ]);
    expect(
      (
        await client.execute(
          'SELECT count(*) AS missing FROM player LEFT JOIN player_stats ON player_stats.player_id = player.id WHERE player_stats.player_id IS NULL',
        )
      ).rows[0].missing,
    ).toBe(0);
    expect((await client.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
  } finally {
    client.close();
    rmSync(directory, { recursive: true });
  }
});
