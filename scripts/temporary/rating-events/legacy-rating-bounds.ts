import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { calculateLegacyRating } from './legacy-glicko2';
import type { LegacyRatingState, LegacyResult } from './rating-reconstruction';

type RangedResult = Omit<LegacyResult, 'opponentRating'> & {
  ratings: number[];
};

const ROUNDING_MARGIN = 1e-7;
const VOLATILITY_TOLERANCE = 1e-9;

export function legacyOutcomeMayMatch(
  player: LegacyRatingState,
  results: RangedResult[],
  outcome: LegacyRatingState,
  bounded: boolean,
): boolean {
  if (!results.length) {
    const actual = calculateLegacyRating(player, [], bounded);
    return (
      actual.rating === outcome.rating &&
      actual.ratingDeviation === outcome.ratingDeviation &&
      Math.abs(actual.ratingVolatility - outcome.ratingVolatility) <=
        VOLATILITY_TOLERANCE
    );
  }

  const scale = GLICKO2_CONSTANTS.SCALE_FACTOR;
  let varianceMin = 0;
  let varianceMax = 0;
  let improvementMin = 0;
  let improvementMax = 0;
  for (const result of results) {
    if (!result.ratings.length) return false;
    const phi = result.opponentRatingDeviation / scale;
    const weight = 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);
    const expected = (rating: number) =>
      1 / (1 + Math.exp((-weight * (player.rating - rating)) / scale));
    const low = expected(Math.max(...result.ratings));
    const high = expected(Math.min(...result.ratings));
    const lowVariance = low * (1 - low);
    const highVariance = high * (1 - high);
    varianceMin += weight ** 2 * Math.min(lowVariance, highVariance);
    varianceMax +=
      weight ** 2 *
      (low <= 0.5 && high >= 0.5 ? 0.25 : Math.max(lowVariance, highVariance));
    improvementMin += weight * (result.score - high);
    improvementMax += weight * (result.score - low);
  }

  const phiSquared = (player.ratingDeviation / scale) ** 2;
  const sigmaMin = Math.max(0, outcome.ratingVolatility - VOLATILITY_TOLERANCE);
  const sigmaMax = outcome.ratingVolatility + VOLATILITY_TOLERANCE;
  const phiStarMin = phiSquared + sigmaMin ** 2;
  const phiStarMax = phiSquared + sigmaMax ** 2;
  const rdMin =
    outcome.ratingDeviation === GLICKO2_CONSTANTS.MIN_RD
      ? 0
      : (outcome.ratingDeviation - 0.5 - ROUNDING_MARGIN) / scale;
  const rdMax =
    outcome.ratingDeviation === GLICKO2_CONSTANTS.MAX_RD
      ? Math.sqrt(phiStarMax)
      : (outcome.ratingDeviation + 0.5 + ROUNDING_MARGIN) / scale;
  const newPhiMin = Math.max(rdMin ** 2, 1 / (1 / phiStarMin + varianceMax));
  const newPhiMax = Math.min(rdMax ** 2, 1 / (1 / phiStarMax + varianceMin));
  if (newPhiMin > newPhiMax + ROUNDING_MARGIN) return false;

  const improvements = [
    newPhiMin * improvementMin,
    newPhiMin * improvementMax,
    newPhiMax * improvementMin,
    newPhiMax * improvementMax,
  ];
  const project = (value: number) =>
    bounded
      ? Math.min(
          GLICKO2_CONSTANTS.MAX_RATING,
          Math.max(GLICKO2_CONSTANTS.MIN_RATING, value),
        )
      : value;
  const ratingMin = project(player.rating + scale * Math.min(...improvements));
  const ratingMax = project(player.rating + scale * Math.max(...improvements));
  return (
    ratingMin <= outcome.rating + 0.5 + ROUNDING_MARGIN &&
    ratingMax >= outcome.rating - 0.5 - ROUNDING_MARGIN
  );
}
