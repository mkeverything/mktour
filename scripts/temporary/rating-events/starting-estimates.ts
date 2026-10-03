import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { calculateLegacyRating } from './legacy-glicko2';
import type {
  LegacyRatingState,
  LegacyResult,
  LegacySnapshot,
  StartingReconstruction,
} from './rating-reconstruction';

const ESTIMATION_PASSES = 32;
const ESTIMATED_GRID = Array.from({ length: 53 }, (_, i) => 400 + i * 50);
type FitScore = [number, number, number];

const betterScore = (a: FitScore, b: FitScore) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};

export function addEstimatedStarts(
  snapshot: LegacySnapshot,
  cases: StartingReconstruction[],
  boundsSince: number,
): StartingReconstruction[] {
  const tournaments = new Map(snapshot.tournaments.map((t) => [t.id, t]));
  const units = new Map(snapshot.units.map((u) => [u.id, u]));
  const histories = new Map(
    snapshot.players.map((player) => [
      player.id,
      snapshot.participations
        .filter((p) => p.playerId === player.id && p.newRating !== null)
        .flatMap((p) => {
          const unit = units.get(p.unitId);
          const tournament = unit && tournaments.get(unit.tournamentId);
          if (
            !tournament?.closedAt ||
            p.newRatingDeviation === null ||
            p.newVolatility === null
          )
            return [];
          return [
            {
              tournament,
              at: tournament.closedAt.getTime(),
              state: {
                rating: p.newRating!,
                ratingDeviation: p.newRatingDeviation,
                ratingVolatility: p.newVolatility,
              },
            },
          ];
        })
        .sort(
          (a, b) =>
            a.at - b.at || a.tournament.id.localeCompare(b.tournament.id),
        ),
    ]),
  );
  const starts = new Map(
    cases.map((entry) => [
      entry.id,
      entry.event?.rating ?? GLICKO2_CONSTANTS.DEFAULT_RATING,
    ]),
  );
  const models = cases
    .filter((entry) => entry.event === null)
    .flatMap((entry) => {
      const first = histories.get(entry.id)?.[0];
      if (
        !first ||
        first.state.ratingDeviation < GLICKO2_CONSTANTS.MIN_RD ||
        first.state.ratingDeviation > GLICKO2_CONSTANTS.MAX_RD ||
        !Number.isFinite(first.state.ratingVolatility) ||
        first.state.ratingVolatility <= 0
      )
        return [];
      const games = snapshot.games.filter(
        (game) =>
          game.tournamentId === first.tournament.id &&
          game.whitePlayerId !== null &&
          game.blackPlayerId !== null &&
          game.result !== null &&
          (game.whitePlayerId === entry.id || game.blackPlayerId === entry.id),
      );
      if (!games.length) return [];
      const calculate = (rating: number, ratings: Map<string, number>) => {
        const results: LegacyResult[] = games.map((game) => {
          const white = game.whitePlayerId === entry.id;
          const opponentId = (white ? game.blackPlayerId : game.whitePlayerId)!;
          const prior = histories
            .get(opponentId)
            ?.filter((outcome) => outcome.at < first.at)
            .at(-1)?.state;
          return {
            opponentRating:
              prior?.rating ??
              ratings.get(opponentId) ??
              GLICKO2_CONSTANTS.DEFAULT_RATING,
            opponentRatingDeviation:
              prior?.ratingDeviation ?? GLICKO2_CONSTANTS.DEFAULT_RD,
            score:
              game.result === '1/2-1/2'
                ? 0.5
                : (game.result === '1-0') === white
                  ? 1
                  : 0,
          };
        });
        return calculateLegacyRating(
          {
            rating,
            ratingDeviation: GLICKO2_CONSTANTS.DEFAULT_RD,
            ratingVolatility: GLICKO2_CONSTANTS.DEFAULT_VOLATILITY,
          },
          results,
          first.at >= boundsSince,
        );
      };
      const score = (
        rating: number,
        ratings: Map<string, number>,
      ): FitScore => {
        const result = calculate(rating, ratings);
        return [
          (result.rating - first.state.rating) ** 2 +
            (result.ratingDeviation - first.state.ratingDeviation) ** 2,
          Math.abs(result.ratingVolatility - first.state.ratingVolatility),
          Math.abs(rating - GLICKO2_CONSTANTS.DEFAULT_RATING),
        ];
      };
      return [{ entry, first, calculate, score }];
    });
  const totalScore = (ratings: Map<string, number>): FitScore =>
    models.reduce<FitScore>(
      (total, model) => {
        const score = model.score(ratings.get(model.entry.id)!, ratings);
        return total.map((value, i) => value + score[i]) as FitScore;
      },
      [0, 0, 0],
    );
  let best = new Map(starts);
  let bestScore = totalScore(best);
  for (let pass = 0; pass < ESTIMATION_PASSES; pass++) {
    let changed = false;
    for (const model of models) {
      let rating = starts.get(model.entry.id)!;
      let score = model.score(rating, starts);
      for (const candidate of ESTIMATED_GRID) {
        const candidateScore = model.score(candidate, starts);
        if (betterScore(candidateScore, score)) {
          rating = candidate;
          score = candidateScore;
        }
      }
      changed ||= rating !== starts.get(model.entry.id);
      starts.set(model.entry.id, rating);
    }
    const score = totalScore(starts);
    if (betterScore(score, bestScore)) {
      best = new Map(starts);
      bestScore = score;
    }
    if (!changed) break;
  }

  const modelById = new Map(models.map((model) => [model.entry.id, model]));
  return cases.map((entry) => {
    if (entry.event !== null) return entry;
    const model = modelById.get(entry.id);
    const first = histories.get(entry.id)?.[0];
    const player = snapshot.players.find((p) => p.id === entry.id)!;
    const rating = best.get(entry.id)!;
    const fitted: LegacyRatingState | undefined = model?.calculate(
      rating,
      best,
    );
    return {
      ...entry,
      status: 'estimated',
      event: {
        playerId: entry.id,
        sourceTournamentId: null,
        isStarting: true,
        publishedAt: first
          ? new Date(first.at - 1000)
          : player.ratingLastUpdateAt,
        rating,
        ratingDeviation: GLICKO2_CONSTANTS.DEFAULT_RD,
      },
      estimate: {
        method: model ? 'inverse-first-outcome' : 'default',
        sourceTournamentId: model?.first.tournament.id ?? null,
        ratingError: fitted ? fitted.rating - model!.first.state.rating : null,
        ratingDeviationError: fitted
          ? fitted.ratingDeviation - model!.first.state.ratingDeviation
          : null,
        volatilityError: fitted
          ? fitted.ratingVolatility - model!.first.state.ratingVolatility
          : null,
      },
    };
  });
}
