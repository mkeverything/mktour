import { describe, expect, it } from 'bun:test';

import { generatePlayerModel } from '@/lib/pairing-generators/common-generator.test';
import { generateConsecutiveRoundGames } from '@/lib/pairing-generators/consecutive-pairs-generator';
import type { PlayerTournamentModel } from '@/server/zod/players';

function createPlayers(count: number): PlayerTournamentModel[] {
  return Array.from({ length: count }, (_, index) => ({
    ...generatePlayerModel(),
    id: `player-${index + 1}`,
    nickname: `player ${index + 1}`,
    pairingNumber: index,
  }));
}

describe('generateConsecutiveRoundGames', () => {
  it('pairs players in consecutive order for an even player count', () => {
    const players = createPlayers(4);

    const games = generateConsecutiveRoundGames({
      players,
      games: [],
      roundNumber: 1,
      tournamentId: 'tournament-1',
    });

    expect(games).toHaveLength(2);
    expect(
      games.flatMap((game) => [game.whiteId, game.blackId]).sort(),
    ).toEqual(['player-1', 'player-2', 'player-3', 'player-4']);
    expect(
      games.some(
        (game) =>
          ['player-1', 'player-2'].includes(game.whiteId) &&
          ['player-1', 'player-2'].includes(game.blackId),
      ),
    ).toBe(true);
    expect(
      games.some(
        (game) =>
          ['player-3', 'player-4'].includes(game.whiteId) &&
          ['player-3', 'player-4'].includes(game.blackId),
      ),
    ).toBe(true);
    expect(games[0].whiteId).toBe('player-1');
    expect(games[0].blackId).toBe('player-2');
    expect(games[1].whiteId).toBe('player-3');
    expect(games[1].blackId).toBe('player-4');
  });

  it('leaves one player without a game for an odd player count', () => {
    const players = createPlayers(5);

    const games = generateConsecutiveRoundGames({
      players,
      games: [],
      roundNumber: 1,
      tournamentId: 'tournament-1',
    });

    expect(games).toHaveLength(2);
    expect(
      games.flatMap((game) => [game.whiteId, game.blackId]).sort(),
    ).toEqual(['player-1', 'player-2', 'player-3', 'player-4']);
    expect(
      games.some(
        (game) => game.whiteId === 'player-5' || game.blackId === 'player-5',
      ),
    ).toBe(false);
  });
});
