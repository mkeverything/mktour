import { beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { mergePlayers } from '@/server/mutations/player-merge';
import { getSeededTestData } from '@/tests/setup/utils';

describe('player merge', () => {
  let clubId: string;

  beforeAll(async () => {
    const { firstClub } = await getSeededTestData();
    clubId = firstClub.id;
  });

  test('merges two unlinked club players and deletes the merged player', async () => {
    const [base, merged] = await db
      .select()
      .from(players)
      .where(and(eq(players.clubId, clubId), isNull(players.userId)))
      .limit(2);

    expect(base).toBeDefined();
    expect(merged).toBeDefined();

    const result = await mergePlayers({
      clubId,
      basePlayerId: base.id,
      mergedPlayerId: merged.id,
    });

    expect(result).toBeUndefined();

    const surviving = await db.query.players.findFirst({
      where: eq(players.id, base.id),
    });
    const deleted = await db.query.players.findFirst({
      where: eq(players.id, merged.id),
    });

    expect(surviving).toBeDefined();
    expect(deleted).toBeUndefined();
  });

  test('rejects merge when players belong to different clubs', async () => {
    const [base] = await db
      .select()
      .from(players)
      .where(eq(players.clubId, clubId))
      .limit(1);

    const differentClubPlayer = (
      await db.select().from(players).limit(20)
    ).find((player) => player.clubId !== clubId);

    expect(base).toBeDefined();
    expect(differentClubPlayer).toBeDefined();

    await expect(
      mergePlayers({
        clubId,
        basePlayerId: base.id,
        mergedPlayerId: differentClubPlayer!.id,
      }),
    ).rejects.toMatchObject({ message: 'PLAYER_NOT_IN_CLUB' });
  });

  test('rejects merging a player with itself', async () => {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.clubId, clubId))
      .limit(1);

    expect(player).toBeDefined();

    await expect(
      mergePlayers({
        clubId,
        basePlayerId: player.id,
        mergedPlayerId: player.id,
      }),
    ).rejects.toMatchObject({ message: 'PLAYER_MERGE_SAME_PLAYER' });
  });
});
