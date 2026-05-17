import {
  GameModel,
  TournamentModel,
  UnitModel,
} from '@/server/zod/tournaments';

export interface SortedUnitsResult<T extends UnitModel = UnitModel> {
  units: T[];
  unitScoresMap: Map<UnitModel['id'], number>;
  tiebreakScoresMap: Map<UnitModel['id'], number>;
}

function pairingOrder(u: Pick<UnitModel, 'number'>): number {
  return u.number ?? Number.MAX_SAFE_INTEGER;
}

function addedAtSortKey(u: Pick<UnitModel, 'addedAt'>): number {
  const d = u.addedAt;
  if (d == null) return 0;
  return typeof d === 'number' ? d : d.getTime();
}

export const hasSameStanding = (
  unit: UnitModel,
  previousUnit: UnitModel,
  unitScoresMap: Map<string, number>,
  tiebreakScoresMap: Map<string, number>,
): boolean => {
  const score = unitScoresMap.get(unit.id) ?? 0;
  const previousScore = unitScoresMap.get(previousUnit.id) ?? 0;
  if (score !== previousScore) return false;

  const tiebreakScore = tiebreakScoresMap.get(unit.id) ?? 0;
  const previousTiebreakScore = tiebreakScoresMap.get(previousUnit.id) ?? 0;
  if (tiebreakScore !== previousTiebreakScore) return false;

  return unit.wins === previousUnit.wins;
};

export const calculateUnitScore = (
  unit: UnitModel,
  roundNumber: number,
  unitGames: GameModel[],
): number => {
  const wins = unit.wins;
  const draws = unit.draws * 0.5;

  const byes = unit.isOut ? 0 : Math.max(0, roundNumber - unitGames.length);

  return wins + draws + byes;
};

export const calculateBuchholzCut1 = (
  unit: Pick<UnitModel, 'id'>,
  roundNumber: number,
  allGames: GameModel[],
  unitScoresMap: Map<string, number>,
): number => {
  // for bye rounds (no opponent), use the unit's own score as virtual opponent score
  // (standard FIDE Buchholz convention for unplayed games / byes)
  const unitTotalScore = unitScoresMap.get(unit.id) ?? 0;
  const opponentScores: number[] = [];
  const opponentsByRound = new Map<number, string>();

  for (const game of allGames) {
    let opponentId: string | null = null;
    if (game.whiteUnitId === unit.id) {
      opponentId = game.blackUnitId;
    } else if (game.blackUnitId === unit.id) {
      opponentId = game.whiteUnitId;
    }

    if (opponentId) {
      opponentsByRound.set(game.roundNumber, opponentId);
    }
  }

  for (let r = 1; r <= roundNumber; r++) {
    const opponentId = opponentsByRound.get(r);
    if (opponentId) {
      opponentScores.push(unitScoresMap.get(opponentId) ?? 0);
    } else {
      opponentScores.push(unitTotalScore);
    }
  }

  if (opponentScores.length === 0) return 0;
  const sum = opponentScores.reduce((a, b) => a + b, 0);
  const minScore = Math.min(...opponentScores);
  return sum - minScore;
};

export const calculateBerger = (
  unit: Pick<UnitModel, 'id'>,
  allGames: GameModel[],
  unitScoresMap: Map<string, number>,
): number => {
  let berger = 0;
  for (const game of allGames) {
    if (!game.result) continue;

    let opponentId: string | null = null;
    let unitWon = false;
    let isDraw = false;

    if (game.whiteUnitId === unit.id) {
      opponentId = game.blackUnitId;
      if (game.result === '1-0') unitWon = true;
      else if (game.result === '1/2-1/2') isDraw = true;
    } else if (game.blackUnitId === unit.id) {
      opponentId = game.whiteUnitId;
      if (game.result === '0-1') unitWon = true;
      else if (game.result === '1/2-1/2') isDraw = true;
    }

    if (opponentId) {
      const opponentScore = unitScoresMap.get(opponentId) ?? 0;
      if (unitWon) {
        berger += opponentScore;
      } else if (isDraw) {
        berger += opponentScore * 0.5;
      }
    }
  }
  return berger;
};

/**
 * builds unit score and tiebreak maps without sorting.
 * useful when callers need the maps for display purposes.
 */
export const buildScoreMaps = (
  units: UnitModel[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): {
  unitScoresMap: Map<string, number>;
  tiebreakScoresMap: Map<string, number>;
} => {
  const roundNumber = tournament.ongoingRound ?? 0;

  const unitScoresMap = new Map<string, number>();
  for (const u of units) {
    const unitGames = allGames.filter(
      (g) => g.whiteUnitId === u.id || g.blackUnitId === u.id,
    );
    unitScoresMap.set(u.id, calculateUnitScore(u, roundNumber, unitGames));
  }

  const tiebreakScoresMap = new Map<string, number>();
  for (const u of units) {
    const score =
      tournament.format === 'swiss'
        ? calculateBuchholzCut1(u, roundNumber, allGames, unitScoresMap)
        : calculateBerger(u, allGames, unitScoresMap);
    tiebreakScoresMap.set(u.id, score);
  }

  return {
    unitScoresMap,
    tiebreakScoresMap,
  };
};

export const baselineUnitSort = (
  a: Pick<UnitModel, 'number' | 'addedAt' | 'id'>,
  b: Pick<UnitModel, 'number' | 'addedAt' | 'id'>,
): number => {
  if (a.number != null || b.number != null) {
    const orderA = pairingOrder(a);
    const orderB = pairingOrder(b);

    if (orderA !== orderB) {
      return orderA - orderB;
    }
  }

  const addedAtA = addedAtSortKey(a);
  const addedAtB = addedAtSortKey(b);
  if (addedAtA !== addedAtB) return addedAtA - addedAtB;

  return a.id.localeCompare(b.id);
};

function makeUnitComparator(
  unitScoresMap: Map<string, number>,
  tiebreakScoresMap: Map<string, number>,
) {
  return (a: UnitModel, b: UnitModel): number => {
    const scoreA = unitScoresMap.get(a.id) ?? 0;
    const scoreB = unitScoresMap.get(b.id) ?? 0;

    if (scoreB !== scoreA) return scoreB - scoreA;

    const tbA = tiebreakScoresMap.get(a.id) ?? 0;
    const tbB = tiebreakScoresMap.get(b.id) ?? 0;

    if (tbB !== tbA) return tbB - tbA;

    if (b.wins !== a.wins) return b.wins - a.wins;

    return baselineUnitSort(a, b);
  };
}

export function sortUnitsByResults<T extends UnitModel>(
  units: T[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): T[] {
  const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
    units,
    tournament,
    allGames,
  );

  return [...units].sort(makeUnitComparator(unitScoresMap, tiebreakScoresMap));
}

/**
 * sorts units and returns both the sorted array and score maps.
 * use when you need the maps for display (e.g. tournament table UI).
 */
export function sortUnitsByResultsWithMaps<T extends UnitModel>(
  units: T[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): SortedUnitsResult<T> {
  const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
    units,
    tournament,
    allGames,
  );

  const sorted = [...units].sort(
    makeUnitComparator(unitScoresMap, tiebreakScoresMap),
  );

  return { units: sorted, unitScoresMap, tiebreakScoresMap };
}
