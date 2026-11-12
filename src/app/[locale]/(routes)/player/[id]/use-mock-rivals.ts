import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import {
  CLUB_PLAYERS_DEFAULT_SORT,
  type PlayerModel,
} from '@/server/zod/players';

const RIVALS_COUNT = 4;

const hash = (text: string) =>
  [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);

/**
 * mock: the api has no breakdown by opponent yet. the opponents are real club
 * players of a similar rating; their games and scores are invented
 */
export const useMockRivals = (
  player: Pick<PlayerModel, 'id' | 'clubId' | 'rating'>,
) => {
  const { data } = useClubPlayers(player.clubId, CLUB_PLAYERS_DEFAULT_SORT);

  return (data?.pages.at(0)?.players ?? [])
    .filter((opponent) => opponent.id !== player.id)
    .toSorted(
      (a, b) =>
        Math.abs(a.rating - player.rating) - Math.abs(b.rating - player.rating),
    )
    .slice(0, RIVALS_COUNT)
    .map((opponent, i) => {
      const games = 18 - i * 3 + (hash(player.id + opponent.id) % 3);
      const expected =
        1 / (1 + 10 ** ((opponent.rating - player.rating) / 400));
      const draws = Math.round(games * 0.18);
      const wins = Math.round((games - draws) * expected);
      return { opponent, wins, draws, losses: games - draws - wins };
    });
};
