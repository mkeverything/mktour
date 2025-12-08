/**
 * Alterations module for Swiss system pairing
 *
 * This module provides generators for bracket alterations/transpositions
 * following FIDE Dutch system rules.
 *
 * Main entry point: generateAlterations()
 */

import type {
  BracketGroups,
  BracketParameters,
} from '@/lib/client-actions/swiss-generator/types';
import { isHeteroBracket } from '@/lib/client-actions/swiss-generator/types';

import {
  generateHeterogeneousAlterations,
  generateHomogeneousAlterations,
} from './bracket-alterations';
import { generateBSNMaps } from './bsn';

// Re-export public API from submodules
export { generateCombinations, generatePermutations } from './combinatorics';

export { generateBSNMaps, convertBSNToEntity, convertEntityToBSN } from './bsn';

export {
  generateEntityExchanges,
  generateS1S2Exchanges,
  generateS2Transpositions,
  generateHomogeneousAlterations,
  generateRemainderAlterations,
  generateMainS2Transpositions,
  generateS1LimboExchanges,
  generateHeterogeneousAlterations,
} from './bracket-alterations';

/**
 * Generator function for bracket alterations/transpositions
 * Yields different BracketGroups by applying systematic alterations
 * Calculates BSNs internally for the current bracket context
 *
 * Order of alterations for homogeneous brackets:
 * 1. S2 transpositions
 * 2. S1↔S2 exchanges (after S2 transpositions exhausted)
 *
 * Order of alterations for heterogeneous brackets:
 * 1. Remainder alterations (S2R transpositions + S1R↔S2R exchanges)
 *
 * @param originalBracketGroups - Original bracket groups (S1, S2, Limbo, and possibly S1R/S2R)
 * @param bracketParameters - Bracket parameters (contains mdpPairingsCount)
 * @yields BracketGroups with different alterations applied
 */
export function* generateAlterations(
  originalBracketGroups: BracketGroups,
  bracketParameters: BracketParameters,
): Generator<BracketGroups, void, unknown> {
  yield originalBracketGroups;
  // Calculate BSNs for all players in this bracket
  let allBracketPlayers = originalBracketGroups.S1.concat(
    originalBracketGroups.S2,
  );

  // Add S1R, S2R, and Limbo players if this is a heterogeneous bracket
  if (isHeteroBracket(originalBracketGroups)) {
    allBracketPlayers = allBracketPlayers
      .concat(originalBracketGroups.S1R)
      .concat(originalBracketGroups.S2R)
      .concat(originalBracketGroups.Limbo);
  }

  const bsnMaps = generateBSNMaps(allBracketPlayers);

  // Check if bracket is heterogeneous using type guard
  if (isHeteroBracket(originalBracketGroups)) {
    // For heterogeneous brackets: yield remainder and other alterations
    yield* generateHeterogeneousAlterations(
      originalBracketGroups,
      bracketParameters,
      bsnMaps,
    );
  } else {
    // For homogeneous brackets: yield all alterations
    yield* generateHomogeneousAlterations(originalBracketGroups, bsnMaps);
  }
}
