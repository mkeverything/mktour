import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Player from '@/app/tournaments/[id]/dashboard/tabs/games/game/player';
import Result, {
  ResultProps,
} from '@/app/tournaments/[id]/dashboard/tabs/games/game/result';
import useTournamentSetGameResult from '@/components/hooks/mutation-hooks/use-tournament-set-game-result';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import useOutsideClick from '@/components/hooks/use-outside-click';
import PortalWrapper from '@/components/portal-wrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GameResult } from '@/server/db/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { FC, useContext, useRef } from 'react';

const GameItem: FC<GameProps> = ({
  id,
  result,
  playerLeft,
  playerRight,
  roundNumber,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const {
    selectedGameId,
    setSelectedGameId,
    sendJsonMessage,
    status,
    playerId,
  } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const mutation = useTournamentSetGameResult(queryClient, {
    tournamentId,
    sendJsonMessage,
  });
  const { data } = useTournamentInfo(tournamentId);
  const { userId } = useContext(DashboardContext);
  const ref = useRef<HTMLDivElement>(null);
  const hasStarted = !!data?.tournament.startedAt;
  const selected = selectedGameId === id;
  const isActive = selected && hasStarted;
  const muted = result && !selected;
  const isClosed = !!data?.tournament.closedAt;
  // players can only edit their own games, and only after tournament has started
  const isPlayerInGame =
    playerId === playerLeft.whiteId || playerId === playerRight.blackId;
  const canEdit =
    status === 'organizer' ||
    (status === 'player' && isPlayerInGame && hasStarted);
  const disabled = !canEdit || isClosed;
  const draw = result === '1/2-1/2';

  const handleMutate = (newResult: GameResult) => {
    if (!userId) return;
    if (selected && hasStarted && !mutation.isPending) {
      mutation.mutate({
        gameId: id,
        whiteId: playerLeft.whiteId,
        blackId: playerRight.blackId,
        result: newResult,
        prevResult: result,
        tournamentId,
        roundNumber,
        userId,
      });
    }
  };

  const resultProps: ResultProps = {
    isPending: mutation.isPending,
    result,
    selected,
  };

  useOutsideClick(() => {
    if (selected) {
      setSelectedGameId(null);
    }
  }, ref);

  return (
    <PortalWrapper portalled={isActive}>
      <motion.div
        key={id}
        ref={ref}
        className={`${disabled && 'pointer-events-none'} cursor-pointer rounded-lg shadow-md ${
          isActive ? 'z-50' : 'z-0'
        }`}
        initial={{ scale: 1, y: 0 }}
        exit={{ scale: 1, y: 0 }}
        animate={isActive ? { scale: 1.05, y: -10 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        onClick={() => setSelectedGameId(!selected ? id : null)}
      >
        <Card
          className={`grid ${muted && 'opacity-50'} p-mk px-mk-2 h-12 w-full ${isActive ? 'grid-cols-3' : 'grid-cols-5'} gap-mk items-center border p-1 transition-all select-none ${!selected && 'pointer-events-none'}`}
        >
          <Player
            isWinner={result === '1-0'}
            handleMutate={() => handleMutate('1-0')}
            selected={isActive}
            nickname={playerLeft.whiteNickname}
            position={{ justify: 'justify-self-start', text: 'text-left' }}
          />
          <Button
            variant="ghost"
            onClick={() => handleMutate('1/2-1/2')}
            className={`mx-mk-2 gap-mk col-span-1 flex size-full ${!selected && 'max-w-10'} justify-self-center rounded-sm p-0 select-none ${isActive && draw && 'mk-link'}`}
          >
            <Result {...resultProps} selected={isActive} />
          </Button>
          <Player
            isWinner={result === '0-1'}
            handleMutate={() => handleMutate('0-1')}
            selected={isActive}
            nickname={playerRight.blackNickname}
            position={{ justify: 'justify-self-end', text: 'text-right' }}
          />
        </Card>
      </motion.div>
    </PortalWrapper>
  );
};

type GameProps = {
  id: string;
  result: GameResult | null;
  playerLeft: Record<'whiteId' | 'whiteNickname', string>;
  playerRight: Record<'blackId' | 'blackNickname', string>;
  roundNumber: number;
};

export default GameItem;
