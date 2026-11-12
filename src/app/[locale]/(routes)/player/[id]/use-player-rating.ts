import { usePlayerRatingHistory } from '@/components/hooks/query-hooks/use-player-rating-history';
import { findPeak, toRatingPoints } from '@/lib/rating-chart';

/** the player's rating history as chart points, with the facts the page reads off it */
export const usePlayerRating = (playerId: string) => {
  const { data: history } = usePlayerRatingHistory(playerId);
  const points = toRatingPoints(history ?? []);
  const latest = points.at(-1);

  return {
    points,
    /** the last rated tournament's outcome; absent until the player has one */
    latest: latest?.isStarting ? undefined : latest,
    peak: findPeak(points),
    joinedAt: points.at(0)?.publishedAt,
  };
};
