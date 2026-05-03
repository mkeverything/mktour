/**
 * builds a Map from pairing_number → circle seat index
 * for the round-robin rotation algorithm.
 *
 * pairing numbers 0 and 1 map to seats paired in round 1,
 * so consecutive boards (0 vs 1), (2 vs 3), … align with the circle schedule.
 */
export function buildPairingToCircleSeatMap(n: number): Map<number, number> {
  const map = new Map<number, number>();
  if (n <= 0) return map;
  if (n === 1) return map.set(0, 0);

  if (n % 2 === 0) {
    for (let k = 0; k < n / 2; k++) {
      map.set(2 * k, k);
      map.set(2 * k + 1, n - 1 - k);
    }
    return map;
  }

  const half = (n - 1) / 2;
  for (let j = 0; j < half; j++) {
    map.set(2 * j, j + 1);
    map.set(2 * j + 1, n - j - 1);
  }
  map.set(n - 1, 0);
  return map;
}

export function circleSeatForPairingNumber(
  map: Map<number, number>,
  pairingNumber: number,
): number {
  const seat = map.get(pairingNumber);
  if (seat === undefined) throw new RangeError('INVALID_ROUND_ROBIN_RANK');
  return seat;
}

export function pairingNumberToCircleSeat(
  pairingNumber: number,
  playerCount: number,
): number {
  return circleSeatForPairingNumber(
    buildPairingToCircleSeatMap(playerCount),
    pairingNumber,
  );
}

console.log(buildPairingToCircleSeatMap(5));
