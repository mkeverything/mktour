'use client';

import BracketGameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/bracket-game-item';
import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';
import { FC, useMemo } from 'react';

export interface EliminationBracketTreeProps {
  games: GameModel[];
  players: PlayerTournamentModel[];
}

function groupGamesByRound(games: GameModel[]): Map<number, GameModel[]> {
  const byRound = new Map<number, GameModel[]>();
  for (const g of games) {
    const r = g.roundNumber;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(g);
  }
  for (const arr of byRound.values()) {
    arr.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  return byRound;
}

const EliminationBracketTree: FC<EliminationBracketTreeProps> = ({
  games,
  players,
}) => {
  const byRound = useMemo(() => groupGamesByRound(games), [games]);
  const sortedRounds = useMemo(
    () => [...byRound.keys()].sort((a, b) => a - b),
    [byRound],
  );
  const maxCols = useMemo(() => {
    const firstRound = sortedRounds[0];
    if (firstRound === undefined) return 1;
    return byRound.get(firstRound)?.length ?? 1;
  }, [byRound, sortedRounds]);

  if (sortedRounds.length === 0) return null;

  return (
    <div
      className="grid w-full gap-x-4 gap-y-6 py-2"
      style={{
        gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${sortedRounds.length}, auto)`,
      }}
    >
      {sortedRounds.map((roundNum, rowIndex) => {
        const roundGames = byRound.get(roundNum) ?? [];
        const span = maxCols / roundGames.length;
        return roundGames.map((game, i) => (
          <div
            key={game.id}
            className="flex justify-center"
            style={{
              gridColumn: `${i * span + 1} / span ${span}`,
              gridRow: rowIndex + 1,
            }}
          >
            <div className="w-full max-w-[200px]">
              <BracketGameItem
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
            </div>
          </div>
        ));
      })}
    </div>
  );
};

export default EliminationBracketTree;
