import { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import {
  compareByPairingNumber,
  compareByScore,
} from '@/lib/client-actions/swiss-generator/ordering';
import type {
  BracketGroups,
  BracketParameters,
  BSNMaps,
  HeteroBracketGroups,
  HomoBracketGroups,
} from '@/lib/client-actions/swiss-generator/types';
import { isHeteroBracket } from '@/lib/client-actions/swiss-generator/types';

/**
 * Creates a new array with a portion reversed
 * @param array - Source array
 * @param startIndex - Starting index of the portion to reverse (inclusive)
 * @param endIndex - Ending index of the portion to reverse (inclusive)
 * @returns New array with the specified portion reversed
 */
export function getArrayWithReversedPortion<ArrayElementType>(
  array: ArrayElementType[],
  startIndex: number,
  endIndex: number,
): ArrayElementType[] {
  const beforePortion = array.slice(0, startIndex);
  const portionToReverse = array.slice(startIndex, endIndex + 1);
  const afterPortion = array.slice(endIndex + 1);

  const reversedPortion = portionToReverse.reverse();
  const resultArray = beforePortion.concat(reversedPortion, afterPortion);

  return resultArray;
}

/**
 * Tries to find the pivot index for the next permutation algorithm
 * The pivot is the largest index where array[index] < array[index + 1]
 * @param array - Current permutation array
 * @param isReversed - Shlould the order be reversed or not, it will swap the sign in comparison

 * @returns Pivot index if found, null if no pivot exists (all permutations generated)
 */
export function tryFindPivotIndex<ArrayElementType>(
  array: ArrayElementType[],
  isReversed = false,
): number | null {
  let candidateIndex = array.length - 2;

  while (candidateIndex >= 0) {
    const currentElement = array[candidateIndex];
    const nextElement = array[candidateIndex + 1];

    let isPivot;
    if (isReversed) isPivot = currentElement > nextElement;
    else isPivot = currentElement < nextElement;

    if (isPivot) {
      return candidateIndex;
    }

    candidateIndex--;
  }

  return null;
}

/**
 * Finds the successor index for the next permutation algorithm
 * The successor is the largest index greater than pivotIndex where array[pivotIndex] < array[successorIndex]
 * @param array - Current permutation array
 * @param pivotIndex - The pivot index
 * @param isReversed - Shlould the order be reversed or not, it will swap the sign in comparison

 * @returns Successor index
 */
export function findSuccessorIndex<ArrayElementType>(
  array: ArrayElementType[],
  pivotIndex: number,
  isReversed = false,
): number {
  const pivotElement = array[pivotIndex];
  let candidateIndex = array.length - 1;

  while (candidateIndex > pivotIndex) {
    const candidateElement = array[candidateIndex];

    let isSuccessor;
    if (isReversed) isSuccessor = pivotElement > candidateElement;
    else isSuccessor = pivotElement < candidateElement;

    if (isSuccessor) {
      return candidateIndex;
    }

    candidateIndex--;
  }

  throw new Error('Successor index not found - this should never happen');
}

/**
 * Creates the initial index array for combination generation.
 *
 * For normal lexicographic order, we start with the first k indices: [0, 1, 2, ..., k-1]
 * For example, selecting 3 from 8 elements: [0, 1, 2]
 *
 * For reversed lexicographic order, we start with the last k indices in descending order: [n-1, n-2, ..., n-k]
 * For example, selecting 3 from 8 elements: [7, 6, 5]
 *
 * @param totalElements - Total number of elements (n)
 * @param combinationSize - Number of elements to select (k)
 * @param isReversed - If true, start from the end (reversed lexicographic order)
 * @returns Initial index array representing the first combination
 */
function initializeCombinationIndices(
  totalElements: number,
  combinationSize: number,
  isReversed: boolean,
): number[] {
  const indices: number[] = [];

  if (isReversed) {
    // Reversed: Start from the last k positions in descending order
    // For n=8, k=3: we want [7, 6, 5]
    // Loop from highest index down to lowest index
    const highestIndex = totalElements - 1;
    const lowestIndex = totalElements - combinationSize;
    for (
      let currentIndex = highestIndex;
      currentIndex >= lowestIndex;
      currentIndex--
    ) {
      indices.push(currentIndex);
    }
  } else {
    // Normal: Start from the first k positions
    // For n=8, k=3: we want [0, 1, 2]
    for (let currentIndex = 0; currentIndex < combinationSize; currentIndex++) {
      indices.push(currentIndex);
    }
  }

  return indices;
}

/**
 * Finds the rightmost index position that can be changed to generate the next combination.
 *
 * For normal lexicographic order (left to right):
 * - An index can be incremented if there's room to move right
 * - Check: indices[i] < totalElements - combinationSize + i
 * - Example: [0,1,4] with n=8, k=3 → position 2 can increment because 4 < 5
 *
 * For reversed lexicographic order (right to left):
 * - An index can be decremented if there's room for descending values below
 * - Check: indices[i] > combinationSize - 1 - i (minimum value for position i)
 * - Example: [7,6,4] with n=8, k=3 → position 2 can decrement because 4 > 0
 *
 * @param indices - Current index array
 * @param totalElements - Total number of elements (n)
 * @param combinationSize - Size of combinations (k)
 * @param isReversed - Direction of generation
 * @returns Position of rightmost changeable index, or null if none can be changed
 */
function findRightmostChangeableIndex(
  indices: number[],
  totalElements: number,
  combinationSize: number,
  isReversed: boolean,
): number | null {
  // Scan from right to left to find the first index that can be changed
  for (let position = combinationSize - 1; position >= 0; position--) {
    const currentIndexValue = indices[position];

    if (isReversed) {
      // For reversed order: Can we decrement this index?
      // With descending array like [7,6,5], we need room for positions below
      // For example with k=3:
      //   position 0 min is 2 (needs room for 2 positions below: 1 and 0)
      //   position 1 min is 1 (needs room for 1 position below: 0)
      //   position 2 min is 0 (no positions below)
      const minValueForPosition = combinationSize - 1 - position;

      if (currentIndexValue > minValueForPosition) {
        // Yes, we can decrement this position
        return position;
      }
    } else {
      // For normal order: Can we increment this index?
      // The maximum value for position i is (n - k + i)
      // For example with n=8, k=3:
      //   position 0 max is 5 (8-3+0)
      //   position 1 max is 6 (8-3+1)
      //   position 2 max is 7 (8-3+2)
      const maxValueForPosition = totalElements - combinationSize + position;

      if (currentIndexValue < maxValueForPosition) {
        // Yes, we can increment this position
        return position;
      }
    }
  }

  // No position can be changed - we've exhausted all combinations
  return null;
}

/**
 * Updates the index array to generate the next combination after changing one position.
 *
 * For normal lexicographic order:
 * - Increment the index at changePosition
 * - Reset all following indices to consecutive ascending values
 * - Example: [0,1,4] at position 2 → [0,1,5]
 * - Example: [0,3,4] at position 1 → [0,4,5] (position 2 becomes 5)
 *
 * For reversed lexicographic order:
 * - Decrement the index at changePosition
 * - Pack all following indices in descending order from the new value
 * - Example: [7,6,4] at position 2 → [7,6,3]
 * - Example: [7,4,3] at position 1 → [7,3,2] (position 2 becomes 2)
 *
 * @param indices - Current index array (will be modified in place)
 * @param changePosition - Position where we're making a change
 * @param combinationSize - Size of combinations (k)
 * @param isReversed - Direction of generation
 */
function updateIndicesAfterChange(
  indices: number[],
  changePosition: number,
  combinationSize: number,
  isReversed: boolean,
): void {
  // Step 1: Update the value at the change position
  const currentIndexValue = indices[changePosition];
  const newFirstIndexValue = isReversed
    ? currentIndexValue - 1
    : currentIndexValue + 1;
  indices[changePosition] = newFirstIndexValue;

  // Step 2: Update all following positions
  // For normal order: consecutive ascending values [v+1, v+2, v+3, ...]
  // For reversed order: consecutive descending values [v-1, v-2, v-3, ...]
  const firstPositionToUpdate = changePosition + 1;
  for (
    let position = firstPositionToUpdate;
    position < combinationSize;
    position++
  ) {
    const previousPosition = position - 1;
    const previousIndexValue = indices[previousPosition];

    const nextIndexValue = isReversed
      ? previousIndexValue - 1 // Descending: subtract 1
      : previousIndexValue + 1; // Ascending: add 1

    indices[position] = nextIndexValue;
  }
}

/**
 * Generates all k-sized combinations from an array in lexicographic order.
 *
 * This generator produces all possible ways to select k elements from n elements,
 * yielding them in a systematic order determined by the isReversed flag.
 *
 * Normal lexicographic order (isReversed=false):
 * - Starts with first k elements: [0,1,2]
 * - Progresses by incrementing rightmost possible index
 * - Example for C(5,3): [0,1,2] → [0,1,3] → [0,1,4] → [0,2,3] → [0,2,4] → ... → [2,3,4]
 *
 * Reversed lexicographic order (isReversed=true):
 * - Starts with last k elements in descending order: [n-1, n-2, ..., n-k]
 * - Progresses by decrementing rightmost possible index
 * - Example for C(5,3): [4,3,2] → [4,3,1] → [4,3,0] → [4,2,1] → [4,2,0] → ... → [2,1,0]
 *
 * Use cases in Swiss pairing:
 * - Normal order for S2 exchanges (prefer lower-ranked players first)
 * - Reversed order for S1 exchanges (prefer higher-ranked players first)
 *
 * @param elements - Source array to generate combinations from
 * @param k - Number of elements to select in each combination
 * @param isReversed - If true, generate in reversed lexicographic order
 * @yields Each k-sized combination as an array of elements
 *
 * @example
 * // Normal order: selecting 2 from ['a','b','c','d']
 * for (const combo of generateCombinations(['a','b','c','d'], 2, false)) {
 *   console.log(combo);
 * }
 * // Output: ['a','b'], ['a','c'], ['a','d'], ['b','c'], ['b','d'], ['c','d']
 *
 * @example
 * // Reversed order: selecting 2 from ['a','b','c','d']
 * for (const combo of generateCombinations(['a','b','c','d'], 2, true)) {
 *   console.log(combo);
 * }
 * // Output: ['d','c'], ['d','b'], ['d','a'], ['c','b'], ['c','a'], ['b','a']
 */
export function* generateCombinations<T>(
  elements: T[],
  k: number,
  isReversed = false,
): Generator<T[], void, unknown> {
  const n = elements.length;

  // Validate inputs
  if (k > n || k < 0) {
    return; // Invalid combination size - no combinations possible
  }

  if (k === 0) {
    yield []; // Only one combination: the empty set
    return;
  }

  // Step 1: Initialize the index array for the first combination
  const indices = initializeCombinationIndices(n, k, isReversed);

  // Step 2: Yield the first combination
  const firstCombination = indices.map((index) => elements[index]);
  yield firstCombination;

  // Step 3: Generate all subsequent combinations
  while (true) {
    // Find the rightmost index that can be changed
    const changePosition = findRightmostChangeableIndex(
      indices,
      n,
      k,
      isReversed,
    );

    // If no position can be changed, we've generated all combinations
    if (changePosition === null) {
      break;
    }

    // Update the indices to form the next combination
    updateIndicesAfterChange(indices, changePosition, k, isReversed);

    // Yield the next combination
    const nextCombination = indices.map((index) => elements[index]);
    yield nextCombination;
  }
}

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
function* generateEntityExchanges(
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
function* generateS1S2Exchanges(
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
 * Generates all permutations of an array in lexicographical order
 * Uses the "next permutation" algorithm to generate permutations in sorted order
 * Time complexity: O(n! * n), Space complexity: O(n)
 * @param elementsToPermute - Array of elements to generate permutations for
 * @param isReversed -- should we generate the lexicographic order, or reversed order
 * @yields Each permutation of the input array in lexicographical order
 */
export function* generatePermutations<PermutedObjectType>(
  elementsToPermute: PermutedObjectType[],
  isReversed = false,
): Generator<PermutedObjectType[], void, unknown> {
  let currentPermutation = [...elementsToPermute];

  // we start with the perfect reversed order if we'd like to reverse
  if (isReversed) currentPermutation.reverse();

  // Yield the first permutation (the array in its current order)
  yield [...currentPermutation];

  // Find the first pivot index
  let pivotIndex = tryFindPivotIndex(currentPermutation, isReversed);

  // Generate all subsequent permutations using next permutation algorithm
  while (pivotIndex !== null) {
    // Step 1: Find the successor index
    const successorIndex = findSuccessorIndex(
      currentPermutation,
      pivotIndex,
      isReversed,
    );

    // Step 2: Swap elements at pivot and successor positions
    const elementAtPivot = currentPermutation[pivotIndex];
    const elementAtSuccessor = currentPermutation[successorIndex];
    currentPermutation[pivotIndex] = elementAtSuccessor;
    currentPermutation[successorIndex] = elementAtPivot;

    // Step 3: Reverse the sequence from pivotIndex + 1 to the end
    const reversalStartIndex = pivotIndex + 1;
    const reversalEndIndex = currentPermutation.length - 1;
    currentPermutation = getArrayWithReversedPortion(
      currentPermutation,
      reversalStartIndex,
      reversalEndIndex,
    );

    // Yield the next permutation
    yield [...currentPermutation];

    // Step 4: Find the next pivot index for the next iteration
    pivotIndex = tryFindPivotIndex(currentPermutation, isReversed);
  }
}
/**
 * Generator for S2 transpositions in homogeneous brackets
 * Takes bracket groups and yields all S2 transpositions as modified BracketGroups
 * @param bracketGroups - Original bracket groups (S1, S2, Limbo)
 * @param bsnMaps - Bidirectional BSN mapping
 * @yields BracketGroups with permuted S2
 */
function* generateS2Transpositions(
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

/**
 * Generator for homogeneous bracket alterations
 * Applies S2 transpositions followed by S1↔S2 exchanges
 * @param homoBracket - Original homogeneous bracket groups
 * @param bsnMaps - Bidirectional BSN mapping for the bracket
 * @yields HomoBracketGroups with alterations applied
 */
function* generateHomogeneousAlterations(
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
function* generateRemainderAlterations(
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
function* generateMainS2Transpositions(
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
function* generateS1LimboExchanges(
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
function* generateHeterogeneousAlterations(
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

/**
 * Generates BSN (Bracket Sequence Numbers) for all players in the tournament
 * BSNs are used for tracking alterations/transpositions in Swiss system pairing
 * Sorts players by dual priority: score first, then initial pairing number
 * Creates bidirectional mapping for fast lookups in both directions
 * @param entities - Array of all tournament entities
 * @returns Object with both BSN to entity and entity to BSN maps
 */
export function generateBSNMaps(entities: ChessTournamentEntity[]): BSNMaps {
  const entityByBSN = new Map<number, ChessTournamentEntity>();
  const bsnByEntity = new Map<ChessTournamentEntity, number>();

  // Sort by dual priority: score first (descending), then pairing number (ascending)
  const sortedForBSN = entities
    .toSorted(compareByPairingNumber)
    .toSorted(compareByScore);

  sortedForBSN.forEach((entity, index) => {
    // BSN starts from 1, not 0
    const bsn = index + 1;
    entityByBSN.set(bsn, entity);
    bsnByEntity.set(entity, bsn);
  });

  return { entityByBSN, bsnByEntity };
}
/**
 * Converts a BSN to its corresponding entity
 * @param bsn - Bracket Sequence Number
 * @param entityByBSN - Map from BSN to entity
 * @returns Entity corresponding to the BSN
 * @throws Error if BSN not found in map
 */
export function convertBSNToEntity(
  bsn: number,
  entityByBSN: Map<number, ChessTournamentEntity>,
): ChessTournamentEntity {
  const entity = entityByBSN.get(bsn);

  // TODO: This undefined check is purely due to TypeScript limitations
  // Map.has() check doesn't provide type narrowing for Map.get()
  if (entity === undefined) {
    throw new Error(`Entity not found for BSN ${bsn}`);
  }

  return entity;
}

/**
 * Converts an entity to its corresponding BSN
 * @param entity - Chess tournament entity
 * @param bsnByEntity - Map from entity to BSN
 * @returns BSN corresponding to the entity
 * @throws Error if entity not found in map
 */
export function convertEntityToBSN(
  entity: ChessTournamentEntity,
  bsnByEntity: Map<ChessTournamentEntity, number>,
): number {
  const bsn = bsnByEntity.get(entity);

  // TODO: This undefined check is purely due to TypeScript limitations
  if (bsn === undefined) {
    throw new Error('BSN not found for entity');
  }

  return bsn;
}
