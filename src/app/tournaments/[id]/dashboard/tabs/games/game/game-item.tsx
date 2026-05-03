import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Player from '@/app/tournaments/[id]/dashboard/tabs/games/game/player';
import Result, {
  ResultProps,
} from '@/app/tournaments/[id]/dashboard/tabs/games/game/result';
import useTournamentSetGameResult from '@/components/hooks/mutation-hooks/use-tournament-set-game-result';
import { useTournamentGameResultInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import useOutsideClick from '@/components/hooks/use-outside-click';
import PortalWrapper from '@/components/portal-wrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GameResult } from '@/server/zod/enums';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  Dispatch,
  FC,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { toast } from 'sonner';

const GameItem: FC<GameProps> = ({
  id,
  result,
  whiteId,
  whiteNickname,
  blackId,
  blackNickname,
  blackDisplayId,
  blackDisplayNickname,
  blackSlotIndex,
  canSortPlayers,
  roundNumber,
  selected,
  setSelectedGameId,
  whiteDisplayId,
  whiteDisplayNickname,
  whiteSlotIndex,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Toasts');
  const { sendJsonMessage, status, playerId, userId } =
    useContext(DashboardContext);
  const queryClient = useQueryClient();
  const mutation = useTournamentSetGameResult(queryClient, {
    tournamentId,
    sendJsonMessage,
  });
  const { data } = useTournamentGameResultInfo(tournamentId);
  const ref = useRef<HTMLDivElement>(null);
  const hasStarted = !!data?.hasStarted;
  const isActive = selected && hasStarted;
  const muted = result && !selected;
  const isClosed = !!data?.isClosed;
  const allowPlayersSetResults = !!data?.allowPlayersSetResults;
  // players can only edit their own games, and only after tournament has started
  const isPlayerInGame = playerId === whiteId || playerId === blackId;
  const canEdit =
    status === 'organizer' ||
    (status === 'player' && isPlayerInGame && hasStarted);
  const disabled = !canEdit || isClosed;
  const draw = result === '1/2-1/2';

  const handleOpenGame = () => {
    if (selected) {
      setSelectedGameId(null);
      return;
    }
    const playerBlockedByClubSetting =
      status === 'player' &&
      isPlayerInGame &&
      hasStarted &&
      !allowPlayersSetResults;
    if (playerBlockedByClubSetting) {
      toast.warning(t('player result setting disabled'));
      return;
    }
    setSelectedGameId(id);
  };

  const handleMutate = (newResult: GameResult) => {
    if (!userId) return;
    if (selected && hasStarted && !mutation.isPending) {
      mutation.mutate({
        gameId: id,
        whiteId,
        blackId,
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
        className={`${disabled && 'pointer-events-none'} cursor-pointer ${
          isActive ? 'z-50' : 'z-0'
        }`}
        initial={{ scale: 1, y: 0 }}
        exit={{ scale: 1, y: 0 }}
        animate={isActive ? { scale: 1.05, y: -10 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        onClick={handleOpenGame}
      >
        <Card
          className={`grid ${muted && 'opacity-50'} p-mk px-mk-2 mx-auto h-12 w-full rounded-lg shadow-md lg:max-w-4xl ${isActive ? 'grid-cols-3' : 'grid-cols-5'} gap-mk items-center p-1 transition-all select-none ${!isActive && !canSortPlayers && 'pointer-events-none'} ${isPlayerInGame && 'border-3'}`}
        >
          <DraggableGamePlayer
            canSort={canSortPlayers}
            id={whiteId}
            index={whiteSlotIndex}
            isWinner={result === '1-0'}
            handleMutate={() => handleMutate('1-0')}
            selected={isActive}
            nickname={whiteDisplayNickname}
            position={{ justify: 'justify-self-start', text: 'text-left' }}
            className={`${playerId === whiteDisplayId && 'font-bold'}`}
          />
          <Button
            variant="ghost"
            onClick={() => handleMutate('1/2-1/2')}
            className={`mx-mk-2 gap-mk col-span-1 flex size-full ${!isActive && 'max-w-10'} justify-self-center rounded-sm p-0 select-none ${isActive && draw && 'mk-link'}`}
          >
            <Result {...resultProps} selected={isActive} />
          </Button>
          <DraggableGamePlayer
            canSort={canSortPlayers}
            id={blackId}
            index={blackSlotIndex}
            isWinner={result === '0-1'}
            handleMutate={() => handleMutate('0-1')}
            selected={isActive}
            nickname={blackDisplayNickname}
            position={{ justify: 'justify-self-end', text: 'text-right' }}
            className={`${playerId === blackDisplayId && 'font-bold'}`}
          />
        </Card>
      </motion.div>
    </PortalWrapper>
  );
};

const DraggableGamePlayer: FC<{
  canSort: boolean;
  className?: string;
  handleMutate: () => void;
  id: string;
  index: number;
  isWinner: boolean;
  nickname: string | null;
  position: {
    justify: 'justify-self-start' | 'justify-self-end';
    text: 'text-left' | 'text-right';
  };
  selected: boolean;
}> = ({
  canSort,
  className,
  handleMutate,
  id,
  index,
  isWinner,
  nickname,
  position,
  selected,
}) => {
  const drag = useDraggable({
    id: `player:${id}`,
    data: { playerId: id, slotIndex: index },
    disabled: !canSort,
    feedback: 'clone',
  });
  const drop = useDroppable({
    id: `slot:${index}`,
    data: { slotIndex: index },
    disabled: !canSort,
  });
  const setPlayerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      drag.ref(element);
      drop.ref(element);
    },
    [drag, drop],
  );

  return (
    <Player
      canSort={canSort}
      className={`${drop.isDropTarget && canSort ? 'ring-ring/40 ring-1 ring-inset' : ''} ${className}`}
      dragHandleRef={drag.handleRef}
      handleMutate={handleMutate}
      isEmpty={!nickname}
      isWinner={isWinner}
      nickname={nickname}
      playerRef={setPlayerRef}
      position={position}
      selected={selected}
    />
  );
};

type GameProps = {
  id: string;
  result: GameResult | null;
  whiteId: string;
  whiteNickname: string;
  whiteDisplayId: string | null;
  whiteDisplayNickname: string | null;
  whiteSlotIndex: number;
  blackId: string;
  blackNickname: string;
  blackDisplayId: string | null;
  blackDisplayNickname: string | null;
  blackSlotIndex: number;
  canSortPlayers: boolean;
  roundNumber: number;
  selected: boolean;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
};

export default memo(GameItem);
