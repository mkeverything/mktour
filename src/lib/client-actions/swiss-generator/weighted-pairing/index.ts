import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import { countMatchedVertices } from '@/lib/client-actions/swiss-generator/matching';
import { maximumWeightMatching } from '@/lib/client-actions/swiss-generator/matching/weighted-matching';

import { buildWeightedGraph, createWeightContext } from './graph-builder';
import { extractPairingFromMatching } from './pairing-extractor';
import { ALL_CRITERIA, computeMultipliers } from './weight-calculator';

/** Error message for cardinality validation failure */
const CARDINALITY_ERROR_MESSAGE = 'Maximum cardinality not achieved';

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
 * @throws Error if cardinality is not maximum
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
    throw new Error(
      `${CARDINALITY_ERROR_MESSAGE}: expected ${expectedMatched} matched vertices, got ${actualMatched}`,
    );
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

  // Validate maximum cardinality: all vertices must be matched
  const actualMatchedVertices = countMatchedVertices(matching);
  validateMaximumCardinality(
    actualMatchedVertices,
    players.length,
    context.hasOddPlayers,
  );

  return extractPairingFromMatching(matching, players);
}

export { buildWeightedGraph, createWeightContext } from './graph-builder';
export type { WeightContext } from './types';
