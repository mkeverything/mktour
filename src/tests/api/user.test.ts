/* eslint-disable @typescript-eslint/no-explicit-any */
import { publicCaller } from '@/server/api/index';
import { clubsSelectSchema } from '@/server/db/zod/clubs';
import { playersSelectSchema } from '@/server/db/zod/players';
import {
  usersSelectPublicSchema,
  usersSelectSchema,
} from '@/server/db/zod/users';
import { beforeAll, describe, expect, it } from 'bun:test';

import { getSeededTestData } from '../setup/utils';

describe('user router', () => {
  let testData: Awaited<ReturnType<typeof getSeededTestData>>;

  beforeAll(async () => {
    testData = await getSeededTestData();
  });

  describe('user.all', () => {
    it('validates output schema', async () => {
      const result = await publicCaller.user.all();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Validate against expected schema (id, username, name)
      const expectedSchema = usersSelectSchema.pick({
        username: true,
        name: true,
        id: true,
      });
      result.forEach((user) => {
        const parseResult = expectedSchema.safeParse(user);
        expect(parseResult.success).toBe(true);
      });
    });

    it('returns data', async () => {
      const result = await publicCaller.user.all();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBeDefined();
    });
  });

  describe('user.info', () => {
    it('validates output schema', async () => {
      const result = await publicCaller.user.info({
        userId: testData.firstUser.id,
      });

      expect(result).toBeDefined();

      // Validate against expected schema (username, name, rating)
      const expectedSchema = usersSelectSchema.pick({
        username: true,
        name: true,
        rating: true,
      });
      if (result) {
        const parseResult = expectedSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      }
    });

    it('returns null for non-existent user', async () => {
      const result = await publicCaller.user.info({
        userId: 'non-existent-user-id',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('user.infoByUsername', () => {
    it('validates output schema', async () => {
      const result = await publicCaller.user.infoByUsername({
        username: testData.firstUser.username,
      });

      expect(result).toBeDefined();

      // Validate against public schema (all fields except email)
      const parseResult = usersSelectPublicSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('throws not_found for non-existent username', async () => {
      expect(
        publicCaller.user.infoByUsername({
          username: 'nonexistentuser123',
        }),
      ).rejects.toThrow('NOT_FOUND');
    });

    it('is case sensitive', async () => {
      const username = testData.firstUser.username;

      const exactResult = await publicCaller.user.infoByUsername({
        username: username,
      });
      expect(exactResult).toBeDefined();

      expect(
        publicCaller.user.infoByUsername({
          username: username.toUpperCase(),
        }),
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('user.clubs', () => {
    it('validates output schema', async () => {
      const result = await publicCaller.user.clubs({
        userId: testData.firstUser.id,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Validate against expected schema (id, name)
      const expectedSchema = clubsSelectSchema.pick({ id: true, name: true });
      result.forEach((club) => {
        const parseResult = expectedSchema.safeParse(club);
        expect(parseResult.success).toBe(true);
      });
    });

    it('handles non-existent user id', async () => {
      const result = await publicCaller.user.clubs({
        userId: 'non-existent-user-id',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('user.playerClubs', () => {
    it('validates output schema', async () => {
      const userWithPlayers = testData.players.find((p) => p.userId);

      if (!userWithPlayers?.userId) {
        console.log('no players with userId found, skipping test');
        return;
      }

      const result = await publicCaller.user.playerClubs({
        userId: userWithPlayers.userId,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const clubSchema = clubsSelectSchema.pick({ id: true, name: true });
        const playerSchema = playersSelectSchema.pick({
          id: true,
          nickname: true,
          rating: true,
        });

        result.forEach((item) => {
          expect(item.club).toBeDefined();
          expect(item.player).toBeDefined();

          const clubParseResult = clubSchema.safeParse(item.club);
          expect(clubParseResult.success).toBe(true);

          const playerParseResult = playerSchema.safeParse(item.player);
          expect(playerParseResult.success).toBe(true);
        });
      }
    });

    it('returns empty array for user with no players', async () => {
      const userWithoutPlayers = testData.users.find(
        (u) => !testData.players.some((p) => p.userId === u.id),
      );

      if (!userWithoutPlayers) {
        console.log('all users have players, skipping test');
        return;
      }

      const result = await publicCaller.user.playerClubs({
        userId: userWithoutPlayers.id,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('handles non-existent user id', async () => {
      const result = await publicCaller.user.playerClubs({
        userId: 'non-existent-user-id',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('returns distinct clubs when user has multiple players in same club', async () => {
      const userWithPlayers = testData.players.find((p) => p.userId);

      if (!userWithPlayers?.userId) {
        console.log('no players with userId found, skipping test');
        return;
      }

      const result = await publicCaller.user.playerClubs({
        userId: userWithPlayers.userId,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      const clubIds = result.map((item) => item.club.id);
      const uniqueClubIds = new Set(clubIds);
      expect(clubIds.length).toBe(uniqueClubIds.size);
    });

    it('includes correct player data', async () => {
      const userWithPlayers = testData.players.find((p) => p.userId);

      if (!userWithPlayers?.userId) {
        console.log('no players with userId found, skipping test');
        return;
      }

      const result = await publicCaller.user.playerClubs({
        userId: userWithPlayers.userId,
      });

      if (result.length > 0) {
        const firstItem = result[0];

        expect(firstItem.player.id).toBeDefined();
        expect(typeof firstItem.player.id).toBe('string');
        expect(firstItem.player.nickname).toBeDefined();
        expect(typeof firstItem.player.nickname).toBe('string');
        expect(firstItem.player.rating).toBeDefined();
        expect(typeof firstItem.player.rating).toBe('number');
      }
    });
  });

  describe('edge cases', () => {
    it('handles malformed input', () => {
      expect(
        publicCaller.user.info({ userId: undefined as any }),
      ).rejects.toThrow();

      expect(
        publicCaller.user.infoByUsername({ username: undefined as any }),
      ).rejects.toThrow();

      expect(
        publicCaller.user.clubs({ userId: undefined as any }),
      ).rejects.toThrow();

      expect(
        publicCaller.user.playerClubs({ userId: undefined as any }),
      ).rejects.toThrow();
    });

    it('handles special characters in username', async () => {
      const specialUser = testData.users.find(
        (u) => u.username && /[^\w]/.test(u.username),
      );

      if (specialUser) {
        const result = await publicCaller.user.infoByUsername({
          username: specialUser.username,
        });
        expect(result).toBeDefined();
        expect(result?.username).toBe(specialUser.username);
      }
    });

    it('handles concurrent requests', async () => {
      const promises = [
        publicCaller.user.all(),
        publicCaller.user.info({ userId: testData.firstUser.id }),
        publicCaller.user.clubs({ userId: testData.firstUser.id }),
        publicCaller.user.playerClubs({ userId: testData.firstUser.id }),
      ];

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it('maintains data consistency between endpoints', async () => {
      const userId = testData.firstUser.id;

      const infoResult = await publicCaller.user.info({ userId });
      const allUsersResult = await publicCaller.user.all();
      const userFromAll = allUsersResult.find((u) => u.id === userId);

      expect(infoResult?.username).toBe(userFromAll?.username);
      expect(infoResult?.name).toBe(userFromAll?.name);
    });
  });
});
