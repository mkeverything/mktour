import { describe, expect, test } from 'bun:test';

import { db } from '@/server/db';
import { fixtures } from '@/server/db/seed';
import { mergePlayers } from '@/server/mutations/player-merge';

describe('player merge', () => {
  const {
    clubId,
    playerIds: [base, merged, player],
  } = fixtures.clubs.next().value!;
  const otherClub = fixtures.clubs.next().value!;

  test('merges two unlinked club players and deletes the merged player', async () => {
    const result = await mergePlayers({
      clubId,
      basePlayerId: base,
      mergedPlayerId: merged,
    });

    expect(result).toBeUndefined();

    const surviving = await db.query.players.findFirst({
      where: { id: base },
    });
    const deleted = await db.query.players.findFirst({
      where: { id: merged },
    });

    expect(surviving).toBeDefined();
    expect(deleted).toBeUndefined();
  });

  test('rejects merge when players belong to different clubs', async () => {
    await expect(
      mergePlayers({
        clubId,
        basePlayerId: base,
        mergedPlayerId: otherClub.playerIds[0],
      }),
    ).rejects.toMatchObject({ message: 'PLAYER_NOT_IN_CLUB' });
  });

  test('rejects merging a player with itself', async () => {
    await expect(
      mergePlayers({
        clubId,
        basePlayerId: player,
        mergedPlayerId: player,
      }),
    ).rejects.toMatchObject({ message: 'PLAYER_MERGE_SAME_PLAYER' });
  });
});
