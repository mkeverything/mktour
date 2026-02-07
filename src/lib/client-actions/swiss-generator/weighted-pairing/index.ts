import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import { countMatchedVertices } from '@/lib/client-actions/swiss-generator/matching';
import {
  IS_MATCHING_DEBUG_ENABLED,
  matchingLogger,
} from '@/lib/client-actions/swiss-generator/matching/matching-logger';
import { maximumWeightMatching } from '@/lib/client-actions/swiss-generator/matching/weighted-matching';

import { buildWeightedGraph, createWeightContext } from './graph-builder';
import { extractPairingFromMatching } from './pairing-extractor';
import { ALL_CRITERIA, computeMultipliers } from './weight-calculator';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error thrown when maximum cardinality matching cannot be achieved.
 *
 * This occurs when the compatibility graph is disconnected or has
 * structural issues preventing a perfect matching.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types
 */
export class CardinalityValidationError extends Error {
  /** Expected number of matched vertices */
  readonly expectedMatched: number;

  /** Actual number of matched vertices */
  readonly actualMatched: number;

  constructor(expectedMatched: number, actualMatched: number) {
    const message = `Maximum cardinality not achieved: expected ${expectedMatched} matched vertices, got ${actualMatched}`;
    super(message);

    this.name = 'CardinalityValidationError';
    this.expectedMatched = expectedMatched;
    this.actualMatched = actualMatched;

    // Required for instanceof to work correctly when targeting ES5
    Object.setPrototypeOf(this, CardinalityValidationError.prototype);
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that the matching achieved maximum cardinality.
 *
 * For Swiss pairing, we must pair the maximum number of players.
 * - Even players: all players must be matched
 * - Odd players: all players + PAB node must be matched
 *
 * @param actualMatched - Actual number of matched vertices
 * @param playerCount - Number of players in the tournament
 * @param hasOddPlayers - Whether there is an odd number of players
 * @throws CardinalityValidationError if cardinality is not maximum
 */
function validateMaximumCardinality(
  actualMatched: number,
  playerCount: number,
  hasOddPlayers: boolean,
): void {
  const expectedMatched = hasOddPlayers
    ? playerCount + 1 // all players + PAB node
    : playerCount; // all players

  const isMaximumCardinality = actualMatched === expectedMatched;

  if (!isMaximumCardinality) {
    throw new CardinalityValidationError(expectedMatched, actualMatched);
  }
}

/**
 * Generates Swiss round pairing using weighted maximum matching.
 *
 * This implements FIDE Dutch Swiss System by:
 * 1. Building a complete weighted graph where edge weights encode all criteria
 * 2. Finding maximum weight matching using Blossom algorithm
 * 3. Validating maximum cardinality was achieved
 * 4. Extracting coloured pairs from the matching result
 *
 * @param players - All players to pair for this round
 * @param roundNumber - Current round number (1-indexed)
 * @returns Coloured pairs for this round
 * @throws Error if maximum cardinality matching was not achieved
 */
export function generateWeightedPairing(
  players: readonly ChessTournamentEntity[],
  roundNumber: number,
): readonly ColouredEntitiesPair[] {
  const context = createWeightContext(players, roundNumber);
  const multipliers = computeMultipliers(ALL_CRITERIA, context);

  const graph = buildWeightedGraph(players, context, multipliers);
  const matching = maximumWeightMatching(graph);

  if (IS_MATCHING_DEBUG_ENABLED) {
    let nullMateCount = 0;
    const mateValues = new Set<string>();
    for (const [, mate] of matching) {
      if (mate === null) {
        nullMateCount++;
      } else {
        mateValues.add(mate);
      }
    }
    matchingLogger
      .withMetadata({
        matchingSize: matching.size,
        nullMateCount,
        uniqueMates: mateValues.size,
        playerCount: players.length,
        roundNumber,
      })
      .debug('Matching result stats');
  }

  // Validate maximum cardinality: all vertices must be matched
  const actualMatchedVertices = countMatchedVertices(matching);
  validateMaximumCardinality(
    actualMatchedVertices,
    players.length,
    context.hasOddPlayers,
  );

  const pairs = extractPairingFromMatching(matching, players);

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger
      .withMetadata({
        pairCount: pairs.length,
        expectedPairs: Math.floor(players.length / 2),
        roundNumber,
      })
      .debug('Extracted pairs');
  }

  return pairs;
}

export { buildWeightedGraph, createWeightContext } from './graph-builder';
export type { WeightContext } from './types';
