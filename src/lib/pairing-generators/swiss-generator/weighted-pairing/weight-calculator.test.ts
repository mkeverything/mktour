import { describe, expect, test } from 'bun:test';

import type { ChessTournamentEntity } from '@/lib/pairing-generators/common-generator';
import { convertUnitToEntity } from '@/lib/pairing-generators/common-generator';
import { generatePlayerModel } from '@/lib/pairing-generators/common-generator.test';
import { createWeightContext } from '@/lib/pairing-generators/swiss-generator/weighted-pairing/graph-builder';
import {
  ALL_CRITERIA,
  C5,
  computeCriterionWeight,
  computeMultipliers,
  penaltyToWeight,
} from '@/lib/pairing-generators/swiss-generator/weighted-pairing/weight-calculator';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';

/** three rounds in, draws have spread the scores across half points. */
const ROUND_NUMBER = 4;
const GAMES_PLAYED = ROUND_NUMBER - 1;

/** largest C5 penalty in ROUND_NUMBER: a bye to a player on a full score. */
const MAX_PENALTY = GAMES_PLAYED;

/** a multiplier of one exposes the raw per-edge digit. */
const MULTIPLIER = 1n;

/**
 * the fixture's game history: none. results live on each unit's
 * wins/draws/losses, so there are no byes or floats to derive.
 */
const NO_RECORDED_GAMES: GameModel[] = [];

/** C5 reads only the bye candidate's score; the input shape still needs a list. */
const NO_TOPSCORERS: ChessTournamentEntity[] = [];

/** pairing numbers for the two bye candidates; C5 never reads them. */
const LOWER_SCORER_NUMBER = 0;
const HIGHER_SCORER_NUMBER = 1;

/**
 * results a unit brings into ROUND_NUMBER; every other game was lost.
 *
 * fixtures state results rather than scores because results are what a unit
 * stores — the engine derives the score from them.
 */
interface UnitResults {
  readonly wins: number;
  readonly draws: number;
}

const DREW_ONE_LOST_REST: UnitResults = { wins: 0, draws: 1 };
const WON_ONE_LOST_REST: UnitResults = { wins: 1, draws: 0 };

/**
 * builds a unit that has played every round before ROUND_NUMBER.
 *
 * losses fill the remaining games so every unit has played every round —
 * no byes, which is what the empty game history implies.
 *
 * @param results - wins and draws; every other game was lost
 * @param index - position in the field, used as the pairing number
 * @returns a unit model with no recorded games
 */
function unitWithResults(results: UnitResults, index: number): UnitModel {
  const unit = generatePlayerModel();
  const gamesNotLost = results.wins + results.draws;

  unit.number = index;
  unit.wins = results.wins;
  unit.draws = results.draws;
  unit.losses = GAMES_PLAYED - gamesNotLost;

  return unit;
}

describe('penaltyToWeight', () => {
  test('penalties a half point apart get distinct weights', () => {
    // the per-edge floor used to encode these two onto the same digit
    const smallerPenalty = 1.5;
    const largerPenalty = 2;

    const smallerPenaltyWeight = penaltyToWeight(
      smallerPenalty,
      MAX_PENALTY,
      MULTIPLIER,
    );
    const largerPenaltyWeight = penaltyToWeight(
      largerPenalty,
      MAX_PENALTY,
      MULTIPLIER,
    );

    expect(smallerPenaltyWeight).toBeGreaterThan(largerPenaltyWeight);
  });

  test('a penalty finer than half a point cannot be encoded', () => {
    // truncating it would silently merge distinct penalties again
    const quarterPoint = 0.25;

    expect(() =>
      penaltyToWeight(quarterPoint, MAX_PENALTY, MULTIPLIER),
    ).toThrow();
  });
});

describe('C5 bye score', () => {
  test('a bye candidate half a point lower gets a better weight', () => {
    // the per-edge floor gave both the same digit: floor(3 − 0.5) = floor(3 − 1)
    const lowerUnit = unitWithResults(DREW_ONE_LOST_REST, LOWER_SCORER_NUMBER);
    const higherUnit = unitWithResults(WON_ONE_LOST_REST, HIGHER_SCORER_NUMBER);

    const lowerScorer = convertUnitToEntity(lowerUnit, NO_RECORDED_GAMES);
    const higherScorer = convertUnitToEntity(higherUnit, NO_RECORDED_GAMES);
    const field = [lowerScorer, higherScorer];

    const context = createWeightContext(field, ROUND_NUMBER);
    const multipliers = computeMultipliers(ALL_CRITERIA, context);

    const lowerScorerWeight = computeCriterionWeight(C5, {
      player: lowerScorer,
      context,
      multipliers,
      topscorers: NO_TOPSCORERS,
    });
    const higherScorerWeight = computeCriterionWeight(C5, {
      player: higherScorer,
      context,
      multipliers,
      topscorers: NO_TOPSCORERS,
    });

    expect(lowerScorerWeight).toBeGreaterThan(higherScorerWeight);
  });
});
