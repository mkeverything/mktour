import {
  buildScoreMaps,
  calculateBerger,
  calculateBuchholzCut1,
  calculateUnitScore,
  hasSameStanding,
  sortUnitsByResults,
  sortUnitsByResultsWithMaps,
} from '@/lib/tournament-results';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';
import { describe, expect, it } from 'bun:test';

// Helper to create a minimal player
function makePlayer(
  overrides: Partial<UnitModel> & { id: string; nickname?: string },
): UnitModel {
  const { id, nickname, unitNickname, players, ...restOverrides } = overrides;
  const displayName = unitNickname ?? nickname ?? id;

  return {
    id,
    wins: 0,
    draws: 0,
    losses: 0,
    colorIndex: 0,
    isOut: null,
    place: null,
    number: null,
    addedAt: null,
    size: players?.length ?? 1,
    unitNickname: displayName,
    players: players ?? [
      {
        id,
        nickname: displayName,
        realname: null,
        rating: 1500,
        userId: null,
        username: null,
      },
    ],
    ...restOverrides,
  };
}

// Helper to create a minimal game
function makeGame(
  overrides: Partial<GameModel> & {
    whiteUnitId: string;
    blackUnitId: string;
    roundNumber: number;
  },
): GameModel {
  return {
    id: `game-${overrides.whiteUnitId}-${overrides.blackUnitId}-r${overrides.roundNumber}`,
    tournamentId: 'tournament-1',
    whiteNickname: overrides.whiteUnitId,
    blackNickname: overrides.blackUnitId,
    gameNumber: overrides.roundNumber,
    roundName: null,
    whitePrevGameId: null,
    blackPrevGameId: null,
    result: null,
    whitePlayerId: null,
    blackPlayerId: null,
    finishedAt: null,
    ...overrides,
  };
}

describe('calculateUnitScore', () => {
  it('should return 0 for a player with no results in round 0', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 0,
      draws: 0,
      losses: 0,
    });
    expect(calculateUnitScore(player, 0, [])).toBe(0);
  });

  it('should count wins as 1 point each', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 3,
      draws: 0,
      losses: 0,
    });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p3',
        blackUnitId: 'p1',
        roundNumber: 2,
        result: '0-1',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p4',
        roundNumber: 3,
        result: '1-0',
      }),
    ];
    expect(calculateUnitScore(player, 3, games)).toBe(3);
  });

  it('should count draws as 0.5 points each', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 0,
      draws: 2,
      losses: 0,
    });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1/2-1/2',
      }),
      makeGame({
        whiteUnitId: 'p3',
        blackUnitId: 'p1',
        roundNumber: 2,
        result: '1/2-1/2',
      }),
    ];
    expect(calculateUnitScore(player, 2, games)).toBe(1);
  });

  it('should award bye points for missing rounds', () => {
    // Player has 1 win in 3 rounds, 0 unfinished games → 2 byes
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 1,
      draws: 0,
      losses: 0,
    });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
    ];
    // sumOfResults = 1, unfinished = 0, actual = 1, byes = 3 - 1 = 2
    // score = 1 + 2 + 0 = 3
    expect(calculateUnitScore(player, 3, games)).toBe(3);
  });

  it('should not count unfinished games as byes', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 1,
      draws: 0,
      losses: 0,
    });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: null,
      }), // unfinished
    ];
    // sumOfResults = 1, unfinished = 1, actual = 2, byes = max(0, 2 - 2) = 0
    // score = 1 + 0 + 0 = 1
    expect(calculateUnitScore(player, 2, games)).toBe(1);
  });

  it('should not award bye points to withdrawn players', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 1,
      draws: 0,
      losses: 0,
      isOut: true,
    });

    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
    ];

    expect(calculateUnitScore(player, 3, games)).toBe(1);
  });
});

describe('sortUnitsByResults', () => {
  it('prefers pairing number over addedAt when standings are equal', () => {
    const players = [
      makePlayer({
        id: 'p1',
        nickname: 'Alice',
        number: 1,
        addedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      makePlayer({
        id: 'p2',
        nickname: 'Bob',
        number: 0,
        addedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ];

    const sorted = sortUnitsByResults(
      players,
      { format: 'swiss', ongoingRound: 0 },
      [],
    );

    expect(sorted.map((player) => player.id)).toEqual(['p2', 'p1']);
  });
});

describe('calculateBerger (Sonneborn-Berger)', () => {
  it('should return 0 when no games are played', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice' });
    const scoresMap = new Map([
      ['p1', 0],
      ['p2', 0],
    ]);
    expect(calculateBerger(player, [], scoresMap)).toBe(0);
  });

  it('should sum defeated opponents scores for wins', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', wins: 2 });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: '1-0',
      }),
    ];
    const scoresMap = new Map([
      ['p1', 2],
      ['p2', 1],
      ['p3', 0.5],
    ]);
    // Berger = p2 score (1) + p3 score (0.5) = 1.5
    expect(calculateBerger(player, games, scoresMap)).toBe(1.5);
  });

  it('should add half of drawn opponents scores', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', draws: 1 });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1/2-1/2',
      }),
    ];
    const scoresMap = new Map([
      ['p1', 0.5],
      ['p2', 2],
    ]);
    // Berger = p2 score * 0.5 = 2 * 0.5 = 1
    expect(calculateBerger(player, games, scoresMap)).toBe(1);
  });

  it('should not count losses', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', losses: 1 });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '0-1',
      }),
    ];
    const scoresMap = new Map([
      ['p1', 0],
      ['p2', 3],
    ]);
    expect(calculateBerger(player, games, scoresMap)).toBe(0);
  });

  it('should handle black side wins correctly', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', wins: 1 });
    const games = [
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p1',
        roundNumber: 1,
        result: '0-1',
      }),
    ];
    const scoresMap = new Map([
      ['p1', 1],
      ['p2', 2],
    ]);
    // Player won as black → Berger += opponent score = 2
    expect(calculateBerger(player, games, scoresMap)).toBe(2);
  });

  it('should skip unfinished games', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice' });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: null,
      }),
    ];
    const scoresMap = new Map([
      ['p1', 0],
      ['p2', 3],
    ]);
    expect(calculateBerger(player, games, scoresMap)).toBe(0);
  });
});

describe('calculateBuchholzCut1', () => {
  it('should return 0 when no rounds played', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice' });
    const scoresMap = new Map([['p1', 0]]);
    expect(calculateBuchholzCut1(player, 0, [], scoresMap)).toBe(0);
  });

  it('should sum opponent scores minus the lowest', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', wins: 3 });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p4',
        roundNumber: 3,
        result: '1-0',
      }),
    ];
    const scoresMap = new Map([
      ['p1', 3],
      ['p2', 2],
      ['p3', 1],
      ['p4', 0],
    ]);
    // Opponent scores: [2, 1, 0], sum = 3, min = 0, cut1 = 3 - 0 = 3
    expect(calculateBuchholzCut1(player, 3, games, scoresMap)).toBe(3);
  });

  it('should use own score for bye rounds (not negative)', () => {
    const player = makePlayer({ id: 'p1', nickname: 'Alice', wins: 1 });
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      // Round 2 is a bye (no game)
    ];
    const scoresMap = new Map([
      ['p1', 0],
      ['p2', 1],
    ]);
    // Round 1 opponent: p2 score = 1
    // Round 2 bye: playerTotalScore = 0
    // Opponent scores: [1, 0], sum = 1, min = 0, cut1 = 1 - 0 = 1
    expect(calculateBuchholzCut1(player, 2, games, scoresMap)).toBe(1);
  });

  it('should not produce negative virtual opponent scores for 0-point players', () => {
    const player = makePlayer({
      id: 'p1',
      nickname: 'Alice',
      wins: 0,
      losses: 0,
    });
    const scoresMap = new Map([['p1', 0]]);
    // 1 round, no games (bye)
    // Virtual opponent score = playerTotalScore = 0 (not -1)
    // Opponent scores: [0], sum = 0, min = 0, cut1 = 0
    expect(calculateBuchholzCut1(player, 1, [], scoresMap)).toBe(0);
  });
});

describe('sortUnitsByResults', () => {
  const tournament = { format: 'swiss' as const, ongoingRound: 3 };

  it('should sort by score descending', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 1, draws: 0, losses: 2 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 3, draws: 0, losses: 0 }),
      makePlayer({
        id: 'p3',
        nickname: 'Charlie',
        wins: 2,
        draws: 0,
        losses: 1,
      }),
    ];
    const games = [
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p1',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p3',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '0-1',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: '0-1',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p3',
        blackUnitId: 'p1',
        roundNumber: 3,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 3,
        result: '0-1',
      }),
    ];

    const sorted = sortUnitsByResults(players, tournament, games);
    expect(sorted[0].id).toBe('p2'); // 3 wins
    expect(sorted[1].id).toBe('p3'); // 2 wins
    expect(sorted[2].id).toBe('p1'); // 1 win
  });

  it('should break ties using tiebreak scores', () => {
    // Two players with same score but different opponents
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 1, draws: 0, losses: 1 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 1, draws: 0, losses: 1 }),
      makePlayer({
        id: 'p3',
        nickname: 'Charlie',
        wins: 2,
        draws: 0,
        losses: 0,
      }),
      makePlayer({ id: 'p4', nickname: 'Dave', wins: 0, draws: 0, losses: 2 }),
    ];
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 1,
        result: '0-1',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p4',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p4',
        roundNumber: 2,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p3',
        roundNumber: 2,
        result: '0-1',
      }),
    ];

    const sorted = sortUnitsByResults(
      players,
      { format: 'swiss', ongoingRound: 2 },
      games,
    );
    // p1 and p2 both have 1 win, but different Buchholz
    // p1 opponents: p3 (2pts), p4 (0pts) → Buchholz cut1 = max(2,0) - min = 2 - 0 = 2, cut1 removes min → 2
    // p2 opponents: p4 (0pts), p3 (2pts) → same Buchholz cut1 = 2
    // They should be equal in tiebreak, then sorted by wins (both 1)
    expect(sorted[0].id).toBe('p3'); // 2 wins, first
  });

  it('should not mutate the original array', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 0 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 1 }),
    ];
    const original = [...players];
    sortUnitsByResults(players, { format: 'swiss', ongoingRound: 1 }, []);
    expect(players[0].id).toBe(original[0].id);
    expect(players[1].id).toBe(original[1].id);
  });
});

describe('sortUnitsByResultsWithMaps', () => {
  it('should return score maps alongside sorted players', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 2, draws: 0, losses: 0 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 0, draws: 0, losses: 2 }),
    ];
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p1',
        roundNumber: 2,
        result: '0-1',
      }),
    ];

    const result = sortUnitsByResultsWithMaps(
      players,
      { format: 'round robin', ongoingRound: 2 },
      games,
    );

    expect(result.units[0].id).toBe('p1');
    expect(result.unitScoresMap.get('p1')).toBe(2);
    expect(result.unitScoresMap.get('p2')).toBe(0);
    expect(result.tiebreakScoresMap).toBeInstanceOf(Map);
    expect(result.tiebreakScoresMap.size).toBe(2);
  });
});

describe('buildScoreMaps', () => {
  it('should build correct score and tiebreak maps', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 1, draws: 0, losses: 0 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 0, draws: 0, losses: 1 }),
    ];
    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
    ];

    const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
      players,
      { format: 'round robin', ongoingRound: 1 },
      games,
    );

    expect(unitScoresMap.get('p1')).toBe(1);
    expect(unitScoresMap.get('p2')).toBe(0);
    // Berger for p1: won against p2 (score 0) → 0
    expect(tiebreakScoresMap.get('p1')).toBe(0);
    // Berger for p2: lost → 0
    expect(tiebreakScoresMap.get('p2')).toBe(0);
  });
});

describe('hasSameStanding', () => {
  it('should return false when wins differ despite same score and tiebreak', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 3, draws: 0, losses: 0 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 2, draws: 2, losses: 0 }),
      makePlayer({ id: 'p3', nickname: 'Carol', wins: 0, draws: 1, losses: 3 }),
      makePlayer({ id: 'p4', nickname: 'Dan', wins: 0, draws: 1, losses: 3 }),
    ];

    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p1',
        roundNumber: 2,
        result: '1/2-1/2',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p2',
        roundNumber: 3,
        result: '1/2-1/2',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 4,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p3',
        roundNumber: 4,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p4',
        roundNumber: 5,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p4',
        roundNumber: 5,
        result: '1-0',
      }),
    ];

    const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
      players,
      { format: 'swiss', ongoingRound: 5 },
      games,
    );

    expect(
      hasSameStanding(players[0], players[1], unitScoresMap, tiebreakScoresMap),
    ).toBe(false);
  });

  it('should return true when score, tiebreak, and wins all match', () => {
    const players = [
      makePlayer({ id: 'p1', nickname: 'Alice', wins: 1, draws: 0, losses: 0 }),
      makePlayer({ id: 'p2', nickname: 'Bob', wins: 1, draws: 0, losses: 0 }),
      makePlayer({ id: 'p3', nickname: 'Carol', wins: 0, draws: 0, losses: 1 }),
      makePlayer({ id: 'p4', nickname: 'Dan', wins: 0, draws: 0, losses: 1 }),
    ];

    const games = [
      makeGame({
        whiteUnitId: 'p1',
        blackUnitId: 'p3',
        roundNumber: 1,
        result: '1-0',
      }),
      makeGame({
        whiteUnitId: 'p2',
        blackUnitId: 'p4',
        roundNumber: 1,
        result: '1-0',
      }),
    ];

    const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
      players,
      { format: 'swiss', ongoingRound: 1 },
      games,
    );

    expect(
      hasSameStanding(players[0], players[1], unitScoresMap, tiebreakScoresMap),
    ).toBe(true);
  });
});
