import { usePlayerResults } from '@/components/hooks/query-hooks/use-player-results';
import type { RatingPoint } from '@/lib/rating-chart';
import type { PlayerResultModel } from '@/server/zod/players';

export type PlayerResultRow = PlayerResultModel & {
  /** index of the rating point the tournament published; null when it published none */
  pointIndex: number | null;
};

/** the player's loaded tournaments, newest first, each tied to its point on the rating history */
export const usePlayerResultRows = (
  playerId: string,
  points: RatingPoint[],
) => {
  const { data, ...query } = usePlayerResults(playerId);
  const pointIndexes = new Map(
    points.map((point, i) => [point.tournament?.id, i]),
  );
  const rows: PlayerResultRow[] = (
    data?.pages.flatMap((page) => page.results) ?? []
  ).map((result) => ({
    ...result,
    pointIndex: pointIndexes.get(result.tournament.id) ?? null,
  }));

  return { rows, ...query };
};
