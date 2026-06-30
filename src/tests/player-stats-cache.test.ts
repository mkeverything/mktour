import { clubPlayerStatsTag } from '@/lib/cache-tags';
import { revalidateClubPlayerStats } from '@/server/cache/player-stats';
import { describe, expect, test } from 'bun:test';

describe('player stats cache', () => {
  test('uses club-scoped cache tags', () => {
    expect(clubPlayerStatsTag('club-1')).toBe('club-player-stats:club-1');
  });

  test('revalidates the club-scoped player stats tag', () => {
    expect(() => revalidateClubPlayerStats('club-1')).not.toThrow();
  });
});
