import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import {
  CLUB_PLAYERS_DEFAULT_SORT,
  type PlayerModel,
} from '@/server/zod/players';

const RIVALS_COUNT = 5;
const VICTORIES_COUNT = 5;
// a victory over someone this much stronger would be a miracle, not a highlight
const MAX_UPSET = 300;

type Player = Pick<PlayerModel, 'id' | 'clubId' | 'rating'>;

const hash = (text: string) =>
  [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);

/** mock: the api has no games by opponent yet. the opponents are real club players; the games are invented */
const useOpponents = (player: Player) => {
  const { data } = useClubPlayers(player.clubId, CLUB_PLAYERS_DEFAULT_SORT);
  return (data?.pages.at(0)?.players ?? []).filter(
    (opponent) => opponent.id !== player.id,
  );
};

/** mock: the players met most often, who are the ones closest in rating */
export const useMockRivals = (player: Player) =>
  useOpponents(player)
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

/** mock: the strongest players beaten */
export const useMockVictories = (player: Player) =>
  useOpponents(player)
    .filter((opponent) => opponent.rating < player.rating + MAX_UPSET)
    .toSorted((a, b) => b.rating - a.rating)
    .slice(0, VICTORIES_COUNT)
    .map((opponent) => ({ opponent }));
