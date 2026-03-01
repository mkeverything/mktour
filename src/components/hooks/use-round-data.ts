import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';
import { useMemo } from 'react';

export const useRoundData = (
  round: GameModel[] | undefined,
  players: PlayerTournamentModel[] | undefined,
) => {
  const playerScores = useMemo(() => {
    if (!players || !round) return new Map<string, number>();

    const scores = new Map<string, number>();
    players.forEach((player) => {
      const score = player.wins + player.draws * 0.5;
      scores.set(player.id, score);
    });
    return scores;
  }, [round, players]);

  const sortedRound = useMemo(() => {
    if (!round || !players) return [];

    return [...round].sort((a, b) => {
      const aWhiteScore = playerScores.get(a.whiteId) || 0;
      const aBlackScore = playerScores.get(a.blackId) || 0;
      const bWhiteScore = playerScores.get(b.whiteId) || 0;
      const bBlackScore = playerScores.get(b.blackId) || 0;

      const aScore = aWhiteScore + aBlackScore;
      const bScore = bWhiteScore + bBlackScore;

      const aFinalScore = a.result !== null ? aScore - 1 : aScore;
      const bFinalScore = b.result !== null ? bScore - 1 : bScore;

      return bFinalScore - aFinalScore;
    });
  }, [players, round, playerScores]);

  const ongoingGames = useMemo(() => {
    if (!round || !players) return 0;

    return round.reduce(
      (acc, current) => (current.result === null ? acc + 1 : acc),
      0,
    );
  }, [players, round]);

  return { playerScores, sortedRound, ongoingGames };
};
