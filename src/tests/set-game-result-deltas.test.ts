import { getPlayerResultDeltas } from '@/server/mutations/set-game-result-deltas';
import type { GameResult } from '@/server/zod/enums';
import { describe, expect, it } from 'bun:test';

type Stats = {
  wins: number;
  draws: number;
  losses: number;
  colorIndex: number;
};

function getExpectedStatsForResult(result: GameResult | null): {
  white: Stats;
  black: Stats;
} {
  if (result === null) {
    return {
      white: { wins: 0, draws: 0, losses: 0, colorIndex: 0 },
      black: { wins: 0, draws: 0, losses: 0, colorIndex: 0 },
    };
  }
  if (result === '1-0') {
    return {
      white: { wins: 1, draws: 0, losses: 0, colorIndex: 1 },
      black: { wins: 0, draws: 0, losses: 1, colorIndex: 0 },
    };
  }
  if (result === '0-1') {
    return {
      white: { wins: 0, draws: 0, losses: 1, colorIndex: 1 },
      black: { wins: 1, draws: 0, losses: 0, colorIndex: 0 },
    };
  }
  return {
    white: { wins: 0, draws: 1, losses: 0, colorIndex: 1 },
    black: { wins: 0, draws: 1, losses: 0, colorIndex: 0 },
  };
}

function applyDelta(stats: Stats, delta: Stats): Stats {
  return {
    wins: stats.wins + delta.wins,
    draws: stats.draws + delta.draws,
    losses: stats.losses + delta.losses,
    colorIndex: stats.colorIndex + delta.colorIndex,
  };
}

describe('set game result deltas', () => {
  const allResults: Array<GameResult | null> = [null, '1-0', '0-1', '1/2-1/2'];

  it('maps every result transition correctly for white and black', () => {
    for (const prevResult of allResults) {
      for (const nextResult of allResults) {
        const prev = getExpectedStatsForResult(prevResult);
        const next = getExpectedStatsForResult(nextResult);
        const deltas = getPlayerResultDeltas(prevResult, nextResult);

        expect(applyDelta(prev.white, deltas.white)).toEqual(next.white);
        expect(applyDelta(prev.black, deltas.black)).toEqual(next.black);
      }
    }
  });

  it('rolls back counters when result is aborted', () => {
    const whiteWinRollback = getPlayerResultDeltas('1-0', null);
    expect(whiteWinRollback.white).toEqual({
      wins: -1,
      draws: 0,
      losses: 0,
      colorIndex: -1,
    });
    expect(whiteWinRollback.black).toEqual({
      wins: 0,
      draws: 0,
      losses: -1,
      colorIndex: 0,
    });

    const drawRollback = getPlayerResultDeltas('1/2-1/2', null);
    expect(drawRollback.white).toEqual({
      wins: 0,
      draws: -1,
      losses: 0,
      colorIndex: -1,
    });
    expect(drawRollback.black).toEqual({
      wins: 0,
      draws: -1,
      losses: 0,
      colorIndex: 0,
    });
  });
});
