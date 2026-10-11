/**
 * unit tests for weighted pairing graph construction.
 */

import { describe, expect, test } from 'bun:test';

import type { ChessTournamentEntity } from '@/lib/pairing-generators/common-generator';

import { createWeightContext } from '@/lib/pairing-generators/swiss-generator/weighted-pairing/graph-builder';

/** round number for cases where the round itself does not matter. */
const ANY_ROUND = 6;

/** first round, where every player still has a score of zero. */
const FIRST_ROUND = 1;

/** level index of the highest occupied score. */
const TOP_LEVEL = 0;

/** level index one bracket below the top. */
const SECOND_LEVEL = 1;

/** level index two brackets below the top. */
const THIRD_LEVEL = 2;

/** a field where two scores are held by more than one player. */
const REPEATED_SCORES = [5, 4, 0, 4, 5];

/** repetition collapses: three occupied scores are three levels. */
const LEVELS_OF_REPEATED_SCORES = new Map([
  [5, TOP_LEVEL],
  [4, SECOND_LEVEL],
  [0, THIRD_LEVEL],
]);

/** a field where the scores 3 and 2 stand empty. */
const GAPPED_SCORES = [5, 4, 1];

/** empty scores are not brackets, so the levels stay consecutive. */
const LEVELS_OF_GAPPED_SCORES = new Map([
  [5, TOP_LEVEL],
  [4, SECOND_LEVEL],
  [1, THIRD_LEVEL],
]);

/** a field holding a half point, as any round after a draw does. */
const HALF_POINT_SCORES = [2, 1.5, 1];

/** a half point is an occupied score, so it is a level of its own. */
const LEVELS_OF_HALF_POINT_SCORES = new Map([
  [2, TOP_LEVEL],
  [1.5, SECOND_LEVEL],
  [1, THIRD_LEVEL],
]);

/** every player before a game has been played. */
const UNSCORED_FIELD = [0, 0, 0, 0];

/** one occupied score is one bracket, so nobody can float. */
const LEVELS_OF_UNSCORED_FIELD = new Map([[0, TOP_LEVEL]]);

/**
 * builds the minimal entity shape createWeightContext reads.
 *
 * @param entityScore - current score of the player
 * @returns entity stub carrying only the score
 */
function stubScoredEntity(entityScore: number): ChessTournamentEntity {
  return { entityScore } as ChessTournamentEntity;
}

describe('createWeightContext', () => {
  test('indexes occupied scores as levels, highest score first', () => {
    const players = REPEATED_SCORES.map(stubScoredEntity);

    const context = createWeightContext(players, ANY_ROUND);

    expect(context.levelIndexByScore).toEqual(LEVELS_OF_REPEATED_SCORES);
  });

  test('leaves no level where a score is unoccupied', () => {
    const players = GAPPED_SCORES.map(stubScoredEntity);

    const context = createWeightContext(players, ANY_ROUND);

    expect(context.levelIndexByScore).toEqual(LEVELS_OF_GAPPED_SCORES);
  });

  test('indexes half-point scores as their own levels', () => {
    const players = HALF_POINT_SCORES.map(stubScoredEntity);

    const context = createWeightContext(players, ANY_ROUND);

    expect(context.levelIndexByScore).toEqual(LEVELS_OF_HALF_POINT_SCORES);
  });

  test('has a single level when every player has the same score', () => {
    const players = UNSCORED_FIELD.map(stubScoredEntity);

    const context = createWeightContext(players, FIRST_ROUND);

    expect(context.levelIndexByScore).toEqual(LEVELS_OF_UNSCORED_FIELD);
  });
});
