'use client';

import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentSetGameResult from '@/components/hooks/mutation-hooks/use-tournament-set-game-result';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import useOutsideClick from '@/components/hooks/use-outside-click';
import PortalWrapper from '@/components/portal-wrapper';
import { cn } from '@/lib/utils';
import { GameResult } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext, useRef } from 'react';
import { toast } from 'sonner';

const BracketGameItem: FC<BracketGameItemProps> = ({
  id,
  result,
  playerLeft,
  playerRight,
  roundNumber,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Toasts');
  const {
    selectedGameId,
    setSelectedGameId,
    sendJsonMessage,
    status,
    playerId,
    userId,
  } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const mutation = useTournamentSetGameResult(queryClient, {
    tournamentId,
    sendJsonMessage,
  });
  const { data } = useTournamentInfo(tournamentId);
  const ref = useRef<HTMLDivElement>(null);
  const hasStarted = !!data?.tournament.startedAt;
  const selected = selectedGameId === id;
  const isActive = selected && hasStarted;
  const muted = result && !selected;
  const isClosed = !!data?.tournament.closedAt;
  const allowPlayersSetResults = !!data?.club.allowPlayersSetResults;
  const isPlayerInGame =
    playerId === playerLeft.whiteId || playerId === playerRight.blackId;
  const canEdit =
    status === 'organizer' ||
    (status === 'player' && isPlayerInGame && hasStarted);
  const disabled = !canEdit || isClosed;

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

  const handleSectionClick = (resultToSet: GameResult) => {
    if (disabled) return;
    if (!selected) {
      handleOpenGame();
      return;
    }
    handleMutate(resultToSet);
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
        className={cn(
          'w-full min-w-0',
          disabled && 'pointer-events-none',
          isActive && 'z-50',
        )}
        initial={{ scale: 1 }}
        animate={isActive ? { scale: 1.02 } : { scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3 }}
      >
        <div
          className={cn(
            'bg-border grid min-h-0 w-full grid-flow-col grid-cols-3 grid-rows-2 gap-px overflow-hidden rounded-md border shadow-sm transition-all select-none',
            muted && 'opacity-60',
            isActive && 'ring-primary ring-2',
            isPlayerInGame && 'border-primary/50 border-2',
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSectionClick('1-0');
            }}
            className={cn(
              'col-span-2 flex min-h-6 items-center truncate px-2 py-1 text-left text-xs transition-colors',
              'hover:bg-muted/80 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
              result === '1-0' && 'bg-muted font-medium',
              playerId === playerLeft.whiteId && 'font-semibold',
            )}
          >
            <span className="truncate">{playerLeft.whiteNickname ?? '–'}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSectionClick('0-1');
            }}
            className={cn(
              'border-border/50 col-span-2 flex min-h-6 items-center truncate border-t px-2 py-1 text-left text-xs transition-colors',
              'hover:bg-muted/80 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
              result === '0-1' && 'bg-muted font-medium',
              playerId === playerRight.blackId && 'font-semibold',
            )}
          >
            <span className="truncate">{playerRight.blackNickname ?? '–'}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSectionClick('1/2-1/2');
            }}
            className={cn(
              'border-border bg-muted/30 row-span-full flex h-full min-w-9 items-center justify-center self-stretch border-l px-1.5 text-xs transition-colors',
              'hover:bg-muted/60 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
              result === '1/2-1/2' && 'bg-muted',
            )}
          >
            {mutation.isPending ? (
              <LoadingSpinner />
            ) : isActive ? (
              <span className="text-muted-foreground text-[10px] select-none">
                draw
              </span>
            ) : result ? (
              <span className="opacity-90 select-none">
                {result === '1/2-1/2'
                  ? '½-½'
                  : result === '1-0'
                    ? '1-0'
                    : '0-1'}
              </span>
            ) : (
              <span className="text-muted-foreground/70 select-none">?</span>
            )}
          </button>
        </div>
      </motion.div>
    </PortalWrapper>
  );
};

export type BracketGameItemProps = {
  id: string;
  result: GameResult | null;
  playerLeft: Pick<GameModel, 'whiteId' | 'whiteNickname'>;
  playerRight: Pick<GameModel, 'blackId' | 'blackNickname'>;
  roundNumber: number;
};

export default BracketGameItem;
