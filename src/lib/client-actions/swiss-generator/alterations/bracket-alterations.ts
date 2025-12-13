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
import { splitRemainder } from '@/lib/client-actions/swiss-generator/bracket-formation';
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
 * Yields original bracket first (no exchange), then all exchanges
 * Uses the generic entity exchange generator and wraps results in HomoBracketGroups
 *
 * @param bracketGroups - Original bracket groups (S1, S2)
 * @param bsnMaps - Bidirectional BSN mapping for entity↔BSN conversion
 * @yields HomoBracketGroups - first original, then with S1↔S2 exchanges applied
 */
export function* generateS1S2Exchanges(
  bracketGroups: HomoBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HomoBracketGroups, void, unknown> {
  // Yield original bracket first (no exchange)
  yield bracketGroups;

  // Then yield all actual exchanges
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
 * Per FIDE rules: for each exchange level (including no exchange), apply all S2 transpositions
 * @param homoBracket - Original homogeneous bracket groups
 * @param bsnMaps - Bidirectional BSN mapping for the bracket
 * @yields HomoBracketGroups with alterations applied
 */
export function* generateHomogeneousAlterations(
  homoBracket: HomoBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HomoBracketGroups, void, unknown> {
  // For each exchange level (original first, then actual exchanges)
  // apply all S2 transpositions
  for (const exchangedBracket of generateS1S2Exchanges(homoBracket, bsnMaps)) {
    // Recalculate BSNs for the current bracket configuration
    const bracketPlayers = exchangedBracket.S1.concat(exchangedBracket.S2);
    const bracketBSNMaps = generateBSNMaps(bracketPlayers);

    yield* generateS2Transpositions(exchangedBracket, bracketBSNMaps);
  }
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
 *
 * Per FIDE Article 3.2.3, S2 initially contains ALL remaining resident players.
 * This function permutes all residents (S2 + S1R + S2R), then re-splits:
 * - First mdpPairingsCount residents become new S2 (for MDP-Pairing)
 * - Remaining residents form the new remainder, split into S1R/S2R
 *
 * This allows any resident to potentially pair with MDPs through transposition.
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
  // Per FIDE Article 3.2.3: S2 contains ALL residents (S2 + S1R + S2R)
  const allResidents = heteroBracket.S2.concat(heteroBracket.S1R).concat(
    heteroBracket.S2R,
  );

  // Convert all residents to BSNs using the bracket-wide BSN maps
  const allResidentBSNs = allResidents.map((entity) =>
    convertEntityToBSN(entity, bsnMaps.bsnByEntity),
  );

  // Generate all permutations of all residents
  for (const permutedBSNs of generatePermutations(allResidentBSNs)) {
    // Convert BSNs back to entities
    const permutedResidents = permutedBSNs.map((bsn) =>
      convertBSNToEntity(bsn, bsnMaps.entityByBSN),
    );

    // Split permuted residents: first mdpPairingsCount become S2 (for MDP-Pairing)
    const mdpPairingsCount = bracketParameters.mdpPairingsCount;
    const newS2 = permutedResidents.slice(0, mdpPairingsCount);

    // Remaining residents form the remainder, split into S1R/S2R
    const remainder = permutedResidents.slice(mdpPairingsCount);
    const { S1R: newS1R, S2R: newS2R } = splitRemainder(remainder);

    yield {
      S1: heteroBracket.S1, // MDPs unchanged
      S2: newS2, // Permuted resident portion for MDP-Pairing
      Limbo: heteroBracket.Limbo,
      S1R: newS1R, // Permuted upper half of remainder
      S2R: newS2R, // Permuted lower half of remainder
    };
  }
}

/**
 * Phase 3: S1↔Limbo exchanges for heterogeneous brackets
 * Yields original bracket first (no exchange), then all exchanges
 * Uses the generic entity exchange generator for S1↔Limbo
 * Changes which MDPs are pairable while keeping residents (S1R, S2, S2R) unchanged
 *
 * @param heteroBracket - Original heterogeneous bracket groups
 * @param bsnMaps - BSN maps for the full bracket
 * @yields HeteroBracketGroups - first original, then with S1↔Limbo exchanges applied
 */
export function* generateS1LimboExchanges(
  heteroBracket: HeteroBracketGroups,
  bsnMaps: BSNMaps,
): Generator<HeteroBracketGroups, void, unknown> {
  // Yield original bracket first (no exchange)
  yield heteroBracket;

  // Skip actual exchanges if no Limbo players to exchange with
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
 * Per FIDE rules: for each S1↔Limbo exchange level (including no exchange),
 * apply remainder alterations and Main S2 transpositions
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
  // For each S1↔Limbo exchange level (original first, then actual exchanges)
  for (const exchangedBracket of generateS1LimboExchanges(
    heteroBracket,
    bsnMaps,
  )) {
    // Recalculate BSNs for the current bracket configuration
    const allBracketPlayers = exchangedBracket.S1.concat(exchangedBracket.S2)
      .concat(exchangedBracket.Limbo)
      .concat(exchangedBracket.S1R)
      .concat(exchangedBracket.S2R);
    const exchangedBSNMaps = generateBSNMaps(allBracketPlayers);

    // Phase 1: Remainder alterations
    yield* generateRemainderAlterations(exchangedBracket);

    // Phase 2: Main S2 transpositions
    yield* generateMainS2Transpositions(
      exchangedBracket,
      bracketParameters,
      exchangedBSNMaps,
    );
  }
}
