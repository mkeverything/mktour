/**
 * builds a lookup table indexed by pairing_number → circle seat index
 * for the round-robin rotation algorithm.
 *
 * pairing numbers 0 and 1 map to seats paired in round 1,
 * so consecutive boards (0 vs 1), (2 vs 3), … align with the circle schedule.
 */
export function buildPairingToCircleSeatTable(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];

  const table = new Array<number>(n);

  if (n % 2 === 0) {
    for (let k = 0; k < n / 2; k++) {
      table[2 * k] = k;
      table[2 * k + 1] = n - 1 - k;
    }
    return table;
  }

  const half = (n - 1) / 2;
  for (let j = 0; j < half; j++) {
    table[2 * j] = j + 1;
    table[2 * j + 1] = n - j - 1;
  }
  table[n - 1] = 0;
  return table;
}

export function circleSeatForPairingNumber(
  table: readonly number[],
  pairingNumber: number,
): number {
  const seat = table[pairingNumber];
  if (seat === undefined) throw new RangeError('INVALID_ROUND_ROBIN_RANK');
  return seat;
}
