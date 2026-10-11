import { describe, expect, test } from 'bun:test';

import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/pairing-generators/common-generator';
import { convertUnitToEntity } from '@/lib/pairing-generators/common-generator';
import { generatePlayerModel } from '@/lib/pairing-generators/common-generator.test';
import { createWeightContext } from '@/lib/pairing-generators/swiss-generator/weighted-pairing/graph-builder';
import type { WeightContext } from '@/lib/pairing-generators/swiss-generator/weighted-pairing/types';
import type { CriterionMultipliers } from '@/lib/pairing-generators/swiss-generator/weighted-pairing/weight-calculator';
import {
  ALL_CRITERIA,
  C5,
  computeCriterionWeight,
  computeMultipliers,
  computeRegularEdgeWeight,
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
const WON_EVERY_GAME: UnitResults = { wins: GAMES_PLAYED, draws: 0 };
const WON_TWO_DREW_ONE: UnitResults = { wins: 2, draws: 1 };
const WON_TWO_LOST_ONE: UnitResults = { wins: 2, draws: 0 };
const LOST_EVERY_GAME: UnitResults = { wins: 0, draws: 0 };

/** a pairing as the results its two units bring in, white first. */
type ResultsPair = readonly [UnitResults, UnitResults];

/**
 * field 3,3 · 2.5,2.5 · 2,2 · 0,0: the 2-point pair floats across the empty
 * scores, two downfloaters in all.
 */
const TWO_DOWNFLOATERS: readonly ResultsPair[] = [
  [WON_EVERY_GAME, WON_EVERY_GAME],
  [WON_TWO_DREW_ONE, WON_TWO_DREW_ONE],
  [WON_TWO_LOST_ONE, LOST_EVERY_GAME],
  [WON_TWO_LOST_ONE, LOST_EVERY_GAME],
];

/** the same field with four downfloaters, each across a half-point gap. */
const FOUR_DOWNFLOATERS: readonly ResultsPair[] = [
  [WON_EVERY_GAME, WON_TWO_DREW_ONE],
  [WON_EVERY_GAME, WON_TWO_LOST_ONE],
  [WON_TWO_DREW_ONE, WON_TWO_LOST_ONE],
  [LOST_EVERY_GAME, LOST_EVERY_GAME],
];

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

/**
 * builds the entity the engine sees for a unit with the given results.
 *
 * @param results - wins and draws; every other game was lost
 * @param pairingNumber - the unit's pairing number
 * @param games - the tournament's game history
 * @returns the unit as a chess tournament entity
 */
function entityWithResults(
  results: UnitResults,
  pairingNumber: number,
  games: GameModel[],
): ChessTournamentEntity {
  const unit = unitWithResults(results, pairingNumber);

  return convertUnitToEntity(unit, games);
}

const FIRST_PAIRING_NUMBER = 0;

/**
 * turns a matching written as results into coloured pairs, numbering the
 * units in order of appearance.
 *
 * @param matching - the matching's pairs, as results
 * @param games - the tournament's game history
 * @returns the matching as coloured pairs
 */
function buildColouredPairs(
  matching: readonly ResultsPair[],
  games: GameModel[],
): ColouredEntitiesPair[] {
  const pairs: ColouredEntitiesPair[] = [];
  let pairingNumber = FIRST_PAIRING_NUMBER;

  for (const [whiteResults, blackResults] of matching) {
    const whiteEntity = entityWithResults(whiteResults, pairingNumber, games);
    pairingNumber++;
    const blackEntity = entityWithResults(blackResults, pairingNumber, games);
    pairingNumber++;

    const colouredPair: ColouredEntitiesPair = { whiteEntity, blackEntity };
    pairs.push(colouredPair);
  }

  return pairs;
}

/**
 * lists every player in a matching.
 *
 * @param pairs - the matching as coloured pairs
 * @returns every player in the matching
 */
function collectField(
  pairs: readonly ColouredEntitiesPair[],
): ChessTournamentEntity[] {
  const field: ChessTournamentEntity[] = [];

  for (const pair of pairs) {
    field.push(pair.whiteEntity, pair.blackEntity);
  }

  return field;
}

const NO_WEIGHT = 0n;

/**
 * sums the regular-edge weights of a matching, which is how the solver
 * compares matchings.
 *
 * @param pairs - the matching as coloured pairs
 * @param context - weight context of the field
 * @param multipliers - multipliers of the field
 * @param topscorers - players the topscorer colour rules apply to
 * @returns total weight of the matching
 */
function sumRegularEdgeWeights(
  pairs: readonly ColouredEntitiesPair[],
  context: WeightContext,
  multipliers: CriterionMultipliers,
  topscorers: readonly ChessTournamentEntity[],
): bigint {
  let totalWeight = NO_WEIGHT;

  for (const pair of pairs) {
    const pairWeight = computeRegularEdgeWeight(
      pair,
      context,
      multipliers,
      topscorers,
    );
    totalWeight = totalWeight + pairWeight;
  }

  return totalWeight;
}

/**
 * weighs a matching written as results, in this file's fixture round. each
 * matching builds its context from its own field; fields with the same scores
 * get the same multipliers, so the weights of different matchings compare.
 *
 * @param matching - the matching's pairs, as results
 * @returns total weight of the matching
 */
function weighMatching(matching: readonly ResultsPair[]): bigint {
  const pairs = buildColouredPairs(matching, NO_RECORDED_GAMES);
  const field = collectField(pairs);
  const context = createWeightContext(field, ROUND_NUMBER);
  const multipliers = computeMultipliers(ALL_CRITERIA, context);

  return sumRegularEdgeWeights(pairs, context, multipliers, NO_TOPSCORERS);
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

describe('C6 downfloater count', () => {
  test('two downfloaters outweigh four that cross narrower gaps', () => {
    // |Δscore| totals 4 for the two and 2 for the four, so a score-gap
    // criterion on top prefers the four
    const twoDownfloatersWeight = weighMatching(TWO_DOWNFLOATERS);
    const fourDownfloatersWeight = weighMatching(FOUR_DOWNFLOATERS);

    expect(twoDownfloatersWeight).toBeGreaterThan(fourDownfloatersWeight);
  });
});
