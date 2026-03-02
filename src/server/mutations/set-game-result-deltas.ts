import type { GameResult } from '@/server/zod/enums';

type ResultStats = {
  wins: number;
  draws: number;
  losses: number;
  colorIndex: number;
};

function getResultStats(result: GameResult | null): {
  white: ResultStats;
  black: ResultStats;
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

export function getPlayerResultDeltas(
  prevResult: GameResult | null,
  nextResult: GameResult | null,
) {
  const prev = getResultStats(prevResult);
  const next = getResultStats(nextResult);

  return {
    white: {
      wins: next.white.wins - prev.white.wins,
      draws: next.white.draws - prev.white.draws,
      losses: next.white.losses - prev.white.losses,
      colorIndex: next.white.colorIndex - prev.white.colorIndex,
    },
    black: {
      wins: next.black.wins - prev.black.wins,
      draws: next.black.draws - prev.black.draws,
      losses: next.black.losses - prev.black.losses,
      colorIndex: next.black.colorIndex - prev.black.colorIndex,
    },
  };
}
