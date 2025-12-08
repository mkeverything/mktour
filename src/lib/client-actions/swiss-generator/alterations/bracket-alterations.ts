/**
 * Bracket alteration generators for Swiss system pairing
 *
 * Contains domain-specific generators for:
 * - Entity exchanges (S1↔S2, S1↔Limbo)
 * - S2 transpositions (permutations)
 * - Homogeneous bracket alterations
 * - Heterogeneous bracket alterations (3 phases)
 *
 * These generators implement FIDE Dutch system alteration rules.
 */

import { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import type {
  BSNMaps,
  BracketParameters,
  HeteroBracketGroups,
  HomoBracketGroups,
} from '@/lib/client-actions/swiss-generator/types';

import { generateCombinations, generatePermutations } from './combinatorics';
import { convertBSNToEntity, convertEntityToBSN, generateBSNMaps } from './bsn';

/**
 * Generic generator for entity group exchanges
 * Implements the FIDE exchange algorithm with 4-level priority system:
 * 1. Exchange size (gradually increase from 1 to min(|group1|, |group2|))
 * 2. BSN sum difference (naturally increases through lexicographic ordering)
 * 3. Group1 candidates (reversed lex order on BSN values - prefer higher BSNs)
 * 4. Group2 candidates (normal lex order on BSN values - prefer lower BSNs)
 *
 * The BSN sum difference automatically increases because:
 * - Group1 reversed lex: high BSNs first, decreasing → sum decreases
 * - Group2 normal lex: low BSNs first, increasing → sum increases
 * - Difference between them naturally grows
 *
 * @param group1 - First entity group (exchanges prefer high-BSN entities)
 * @param group2 - Second entity group (exchanges prefer low-BSN entities)
 * @param bsnMaps - Bidirectional BSN mapping for entity↔BSN conversion
 * @yields Tuple of [exchanged group1, exchanged group2]
 */
export function* generateEntityExchanges(
  group1: ChessTournamentEntity[],
  group2: ChessTournamentEntity[],
  bsnMaps: BSNMaps,
): Generator<
  [ChessTournamentEntity[], ChessTournamentEntity[]],
  void,
  unknown
> {
  // Convert entities to their BSN numbers
  const group1BSNs = group1.map((entity) =>
    convertEntityToBSN(entity, bsnMaps.bsnByEntity),
  );
  const group2BSNs = group2.map((entity) =>
    convertEntityToBSN(entity, bsnMaps.bsnByEntity),
  );

  const maxExchangeSize = Math.min(group1BSNs.length, group2BSNs.length);

  // Priority 1: Loop through exchange sizes (1, 2, 3, ...)
  for (let exchangeSize = 1; exchangeSize <= maxExchangeSize; exchangeSize++) {
    // Priority 3: Generate group1 combinations in reversed lexicographic order
    // This gives us high-BSN players first
    for (const group1BSNCombo of generateCombinations(
      group1BSNs,
      exchangeSize,
      true,
    )) {
      // Priority 4: Generate group2 combinations in normal lexicographic order
      // This gives us low-BSN players first
      for (const group2BSNCombo of generateCombinations(
        group2BSNs,
        exchangeSize,
        false,
      )) {
        // Convert BSNs back to entities
        const group1ComboEntities = group1BSNCombo.map((bsn) =>
          convertBSNToEntity(bsn, bsnMaps.entityByBSN),
        );
        const group2ComboEntities = group2BSNCombo.map((bsn) =>
          convertBSNToEntity(bsn, bsnMaps.entityByBSN),
        );

        // Create new group1: remove group1Combo entities, add group2Combo entities
        const group1WithoutExchanged = group1.filter(
          (entity) => !group1ComboEntities.includes(entity),
        );
        const newGroup1 = group1WithoutExchanged.concat(group2ComboEntities);

        // Create new group2: remove group2Combo entities, add group1Combo entities
        const group2WithoutExchanged = group2.filter(
          (entity) => !group2ComboEntities.includes(entity),
        );
        const newGroup2 = group2WithoutExchanged.concat(group1ComboEntities);

        // Yield tuple of exchanged groups
        yield [newGroup1, newGroup2];
      }
    }
  }
}

/**
 * Generator for S1↔S2 exchanges in homogeneous brackets
 * Uses the generic entity exchange generator and wraps results in HomoBracketGroups
 *
 * @param bracketGroups - Original bracket groups (S1, S2)
 * @param bsnMaps - Bidirectional BSN mapping for entity↔BSN conversion
 * @yields HomoBracketGroups with S1↔S2 exchanges applied
 */
export function* generateS1S2Exchanges(
  bracketGroups: HomoBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HomoBracketGroups, void, unknown> {
  // Use generic exchange generator for S1↔S2
  for (const [newS1, newS2] of generateEntityExchanges(
    bracketGroups.S1,
    bracketGroups.S2,
    bsnMaps,
  )) {
    yield {
      S1: newS1,
      S2: newS2,
    };
  }
}

/**
 * Generator for S2 transpositions in homogeneous brackets
 * Takes bracket groups and yields all S2 transpositions as modified BracketGroups
 * @param bracketGroups - Original bracket groups (S1, S2, Limbo)
 * @param bsnMaps - Bidirectional BSN mapping
 * @yields BracketGroups with permuted S2
 */
export function* generateS2Transpositions(
  bracketGroups: HomoBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HomoBracketGroups, void, unknown> {
  // Convert S2 entities to BSNs using the mapper
  const s2BSNs = bracketGroups.S2.map((entity) =>
    convertEntityToBSN(entity, bsnMaps.bsnByEntity),
  );

  // Generate all permutations of S2 BSNs
  for (const permutedS2BSNs of generatePermutations(s2BSNs)) {
    // Convert permuted BSNs back to entities
    const permutedS2Entities = permutedS2BSNs.map((bsn) =>
      convertBSNToEntity(bsn, bsnMaps.entityByBSN),
    );

    // Yield modified HomoBracketGroups with permuted S2 (no Limbo for homogeneous)
    yield {
      S1: [...bracketGroups.S1],
      S2: permutedS2Entities,
    };
  }
}

/**
 * Generator for homogeneous bracket alterations
 * Applies S2 transpositions followed by S1↔S2 exchanges
 * @param homoBracket - Original homogeneous bracket groups
 * @param bsnMaps - Bidirectional BSN mapping for the bracket
 * @yields HomoBracketGroups with alterations applied
 */
export function* generateHomogeneousAlterations(
  homoBracket: HomoBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HomoBracketGroups, void, unknown> {
  // 1. Yield all S2 transpositions first
  yield* generateS2Transpositions(homoBracket, bsnMaps);

  // 2. Then yield all S1↔S2 exchanges
  yield* generateS1S2Exchanges(homoBracket, bsnMaps);
}

/**
 * Phase 1: Remainder alterations for heterogeneous brackets
 * Applies homogeneous alterations (S2 transpositions + S1↔S2 exchanges) to the remainder only
 * Keeps MDP-Pairing portion unchanged
 *
 * @param heteroBracket - Original heterogeneous bracket groups
 * @yields HeteroBracketGroups with remainder alterations applied
 */
export function* generateRemainderAlterations(
  heteroBracket: HeteroBracketGroups,
): Generator<HeteroBracketGroups, void, unknown> {
  // Check if remainder exists
  if (heteroBracket.S1R.length === 0 || heteroBracket.S2R.length === 0) {
    // No remainder to alter - skip Phase 1 (Phase 2 will handle alterations)
    return;
  }

  // Calculate BSNs for remainder entities only
  const remainderPlayers = heteroBracket.S1R.concat(heteroBracket.S2R);
  const remainderBSNMaps = generateBSNMaps(remainderPlayers);

  // Create mini bracket groups for remainder (homogeneous)
  const remainderBracketGroups: HomoBracketGroups = {
    S1: heteroBracket.S1R,
    S2: heteroBracket.S2R,
  };

  // Apply homogeneous alterations to remainder (reusing homogeneous generator)
  // Note: S1 and S2 are already MDP-only after bracket formation, no slicing needed
  for (const alteredRemainder of generateHomogeneousAlterations(
    remainderBracketGroups,
    remainderBSNMaps,
  )) {
    // Reconstruct full bracket: MDP entities (unchanged) + altered remainder
    yield {
      S1: heteroBracket.S1, // Already MDP-only
      S2: heteroBracket.S2, // Already MDP-only
      Limbo: heteroBracket.Limbo,
      S1R: alteredRemainder.S1,
      S2R: alteredRemainder.S2,
    };
  }
}

/**
 * Phase 2: Main S2 transpositions for heterogeneous brackets
 * Permutes the full S2 group (MDP portion + remainder), affecting both S2 and S2R
 * Keeps S1, S1R, and Limbo unchanged
 *
 * @param heteroBracket - Original heterogeneous bracket groups
 * @param bracketParameters - Bracket parameters (contains mdpPairingsCount)
 * @param bsnMaps - BSN maps for the full bracket
 * @yields HeteroBracketGroups with S2 transpositions applied
 */
export function* generateMainS2Transpositions(
  heteroBracket: HeteroBracketGroups,
  bracketParameters: BracketParameters,
  bsnMaps: BSNMaps,
): Generator<HeteroBracketGroups, void, unknown> {
  // Combine S2 (MDP portion) with S2R (remainder) to get full S2
  const fullS2 = heteroBracket.S2.concat(heteroBracket.S2R);

  // Convert full S2 to BSNs using the bracket-wide BSN maps
  const fullS2BSNs = fullS2.map((entity) =>
    convertEntityToBSN(entity, bsnMaps.bsnByEntity),
  );

  // Generate all permutations of full S2
  for (const permutedS2BSNs of generatePermutations(fullS2BSNs)) {
    // Convert BSNs back to entities
    const permutedS2Entities = permutedS2BSNs.map((bsn) =>
      convertBSNToEntity(bsn, bsnMaps.entityByBSN),
    );

    // Split permuted S2 back into MDP portion and remainder
    const mdpCount = bracketParameters.mdpPairingsCount;
    const newS2MDP = permutedS2Entities.slice(0, mdpCount);
    const newS2R = permutedS2Entities.slice(mdpCount);

    // Yield with S1 unchanged, permuted S2, Limbo unchanged, S1R unchanged, new S2R
    yield {
      S1: heteroBracket.S1, // MDP portion, unchanged
      S2: newS2MDP, // Permuted MDP portion of S2
      Limbo: heteroBracket.Limbo,
      S1R: heteroBracket.S1R, // S1 remainder, unchanged
      S2R: newS2R, // Permuted remainder of S2
    };
  }
}

/**
 * Phase 3: S1↔Limbo exchanges for heterogeneous brackets
 * Uses the generic entity exchange generator for S1↔Limbo
 * Changes which MDPs are pairable while keeping residents (S1R, S2, S2R) unchanged
 *
 * @param heteroBracket - Original heterogeneous bracket groups
 * @param bsnMaps - BSN maps for the full bracket
 * @yields HeteroBracketGroups with S1↔Limbo exchanges applied
 */
export function* generateS1LimboExchanges(
  heteroBracket: HeteroBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HeteroBracketGroups, void, unknown> {
  // Skip if no Limbo players to exchange with
  if (heteroBracket.Limbo.length === 0) {
    return;
  }

  // Use generic exchange generator for S1↔Limbo
  for (const [newS1, newLimbo] of generateEntityExchanges(
    heteroBracket.S1,
    heteroBracket.Limbo,
    bsnMaps,
  )) {
    yield {
      S1: newS1, // Exchanged pairable MDPs
      S2: heteroBracket.S2, // Unchanged
      Limbo: newLimbo, // Exchanged excess MDPs
      S1R: heteroBracket.S1R, // Residents unchanged
      S2R: heteroBracket.S2R, // Residents unchanged
    };
  }
}

/**
 * Generator for heterogeneous bracket alterations
 * Orchestrates all phases of heterogeneous bracket alterations according to FIDE rules
 * Phase 1: Remainder alterations
 * Phase 2: Main S2 transpositions
 * Phase 3: S1↔Limbo exchanges
 *
 * @param heteroBracket - Original heterogeneous bracket groups
 * @param bracketParameters - Bracket parameters (contains mdpPairingsCount)
 * @param bsnMaps - BSN maps for the full bracket
 * @yields HeteroBracketGroups with alterations applied
 */
export function* generateHeterogeneousAlterations(
  heteroBracket: HeteroBracketGroups,
  bracketParameters: BracketParameters,
  bsnMaps: BSNMaps,
): Generator<HeteroBracketGroups, void, unknown> {
  // Phase 1: Remainder alterations
  yield* generateRemainderAlterations(heteroBracket);

  // Phase 2: Main S2 transpositions
  yield* generateMainS2Transpositions(
    heteroBracket,
    bracketParameters,
    bsnMaps,
  );

  // Phase 3: S1↔Limbo exchanges
  yield* generateS1LimboExchanges(heteroBracket, bsnMaps);
}
