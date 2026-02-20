/**
 * Combinatorics utilities for Swiss system pairing
 *
 * Contains pure algorithms for:
 * - Array manipulation (reversal)
 * - Permutation generation (lexicographic order)
 * - Combination generation (k-sized subsets)
 *
 * These algorithms are domain-agnostic and can be reused elsewhere.
 */

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
 *
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
 *
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
