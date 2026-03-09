'use client';

import GameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/game-item';
import { useRoundData } from '@/components/hooks/use-round-data';
import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';
import { FC } from 'react';

export interface RoundGamesListProps {
  games: GameModel[];
  players: PlayerTournamentModel[];
}

const RoundGamesList: FC<RoundGamesListProps> = ({ games, players }) => {
  const { sortedRound } = useRoundData(games, players);

  return (
    <div className="mk-list pb-mk-2">
      {sortedRound.map((game, index) => (
        <GameItem
          key={game.id ?? index}
          id={game.id}
          result={game.result}
          playerLeft={{
            whiteId: game.whiteId,
            whiteNickname: game.whiteNickname,
          }}
          playerRight={{
            blackId: game.blackId,
            blackNickname: game.blackNickname,
          }}
          roundNumber={game.roundNumber}
        />
      ))}
    </div>
  );
};

export default RoundGamesList;
