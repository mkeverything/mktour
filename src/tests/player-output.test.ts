import { describe, expect, test } from 'bun:test';
import { clubNotificationExtendedSchema } from '@/server/zod/notifications';
import {
  playerFormSchema,
  playerOutputSchema,
  playerWithUsernameOutputSchema,
  userPlayerClubSchema,
  type PlayerRecordModel,
} from '@/server/zod/players';

const player: PlayerRecordModel = {
  id: 'player',
  clubId: 'club',
  nickname: 'player',
  realname: null,
  userId: null,
  rating: 1500,
  ratingPeak: null,
  ratingDeviation: 60,
  ratingVolatility: 0.06,
  ratingLastUpdateAt: new Date(),
  lastSeenAt: new Date(),
};

function expectPublic(value: object) {
  expect(value).toHaveProperty('isEstablished');
  for (const key of [
    'ratingDeviation',
    'ratingVolatility',
    'ratingLastUpdateAt',
  ]) {
    expect(value).not.toHaveProperty(key);
  }
}

describe('public player projection', () => {
  test('derives current establishment without changing stored inputs', () => {
    expect(playerOutputSchema.parse(player).isEstablished).toBe(true);
    const inactive = { ...player, ratingLastUpdateAt: new Date('2020-01-01') };
    const output = playerOutputSchema.parse(inactive);
    expect(output.isEstablished).toBe(false);
    expect(output.rating).toBe(player.rating);
    expect(inactive.ratingDeviation).toBe(60);
    expectPublic(output);
  });

  test('direct and nested outputs share the public uncertainty contract', () => {
    expectPublic(playerOutputSchema.parse(player));
    expectPublic(
      playerWithUsernameOutputSchema.parse({ ...player, username: 'user' }),
    );
    expectPublic(
      userPlayerClubSchema.parse({ club: { id: 'club', name: 'club' }, player })
        .player,
    );
  });

  test('club profile projection strips fields outside its public selection', () => {
    expect(userPlayerClubSchema.shape.player.parse(player)).toEqual({
      id: player.id,
      nickname: player.nickname,
      rating: player.rating,
      isEstablished: true,
      ratingPeak: player.ratingPeak,
      lastSeenAt: player.lastSeenAt,
    });
  });

  test('notification projection strips club and uncertainty fields', () => {
    const schema = clubNotificationExtendedSchema.shape.player;
    const output = schema.parse(player)!;
    expectPublic(output);
    expect(output).not.toHaveProperty('clubId');
    expect(Object.keys(output).sort()).toEqual(
      Object.keys(playerOutputSchema.parse(player))
        .filter((key) => key !== 'clubId')
        .sort(),
    );
    expect(output).toMatchObject({ id: player.id, nickname: player.nickname });
    expect(schema.parse(null)).toBeNull();
  });

  test('creation input accepts rating points, not internal baseline fields', () => {
    expect(playerFormSchema.parse(player)).toEqual({
      nickname: 'player',
      realname: null,
      rating: 1500,
      clubId: 'club',
    });
  });
});
