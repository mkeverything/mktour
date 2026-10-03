import type { LegacyRatingState, LegacyResult } from './rating-reconstruction';

// frozen arithmetic from 6ef9e965:src/lib/glicko2.ts, not the elapsed-time calculator.
// 477e9a32 added only rating clamping; earlier versions used the same drift/rd rounding.
export function calculateLegacyRating(
  player: LegacyRatingState,
  results: LegacyResult[],
  bounded: boolean,
): LegacyRatingState {
  const scale = 173.7178;
  const mu = (player.rating - 1500) / scale;
  const phi = player.ratingDeviation / scale;
  const sigma = player.ratingVolatility;
  if (!results.length) {
    return {
      rating: Math.round(player.rating),
      ratingDeviation: Math.round(
        Math.min(Math.sqrt(phi * phi + sigma * sigma) * scale, 350),
      ),
      ratingVolatility: sigma,
    };
  }
  const g = (rd: number) =>
    1 / Math.sqrt(1 + (3 * (rd / scale) ** 2) / Math.PI ** 2);
  const expected = (opponent: LegacyResult) =>
    1 /
    (1 +
      Math.exp(
        -g(opponent.opponentRatingDeviation) *
          (mu - (opponent.opponentRating - 1500) / scale),
      ));
  let variance = 0;
  let delta = 0;
  for (const opponent of results) {
    const weight = g(opponent.opponentRatingDeviation);
    const probability = expected(opponent);
    variance += weight * weight * probability * (1 - probability);
    delta += weight * (opponent.score - probability);
  }
  variance = 1 / variance;
  delta *= variance;
  const tau = 0.5;
  const alpha = Math.log(sigma * sigma);
  const phiSquared = phi * phi;
  const deltaSquared = delta * delta;
  const f = (x: number) => {
    const exp = Math.exp(x);
    const sum = phiSquared + variance + exp;
    return (
      (exp * (deltaSquared - phiSquared - variance - exp)) / (2 * sum * sum) -
      (x - alpha) / (tau * tau)
    );
  };
  let a = alpha;
  let b: number;
  if (deltaSquared > phiSquared + variance) {
    b = Math.log(deltaSquared - phiSquared - variance);
  } else {
    let k = 1;
    while (f(alpha - k * tau) < 0) k++;
    b = alpha - k * tau;
  }
  let fa = f(a);
  let fb = f(b);
  let iterations = 0;
  while (Math.abs(b - a) > 0.000001 && iterations < 100) {
    const c = a + ((a - b) * fa) / (fb - fa);
    const fc = f(c);
    if (fc * fb < 0) {
      a = b;
      fa = fb;
    } else {
      fa /= 2;
    }
    b = c;
    fb = fc;
    iterations++;
  }
  const volatility = iterations >= 100 ? sigma : Math.exp(a / 2);
  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  let newMu = mu;
  for (const opponent of results) {
    newMu +=
      newPhi *
      newPhi *
      g(opponent.opponentRatingDeviation) *
      (opponent.score - expected(opponent));
  }
  const rating = Math.round(newMu * scale + 1500);
  return {
    rating: bounded ? Math.min(Math.max(rating, 400), 3400) : rating,
    ratingDeviation: Math.max(Math.min(Math.round(newPhi * scale), 350), 30),
    ratingVolatility: volatility,
  };
}
