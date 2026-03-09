'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { cn } from '@/lib/utils';
import type { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { FC } from 'react';
import { useContext } from 'react';

type BracketGameItemEditableProps = {
  game: GameModel;
};

const BracketGameItemEditable: FC<BracketGameItemEditableProps> = ({
  game,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { sendJsonMessage, status, userId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const removePlayerMutation = useTournamentRemovePlayer(
    tournamentId,
    queryClient,
    sendJsonMessage,
  );

  const canEdit = status === 'organizer' && !!userId;
  const disabled = !canEdit || removePlayerMutation.isPending;

  const handleRemovePlayer = (playerId: string) => {
    if (disabled || !userId) return;
    removePlayerMutation.mutate({ tournamentId, playerId, userId });
  };

  return (
    <div className="w-full min-w-0">
      <div
        className={cn(
          'bg-border grid min-h-0 w-full grid-flow-col grid-cols-3 grid-rows-2 gap-px overflow-hidden rounded-md border shadow-sm transition-all select-none',
          !canEdit && 'opacity-70',
        )}
      >
        <button
          type="button"
          onClick={() => handleRemovePlayer(game.whiteId)}
          disabled={disabled}
          className={cn(
            'col-span-2 flex min-h-6 items-center truncate px-2 py-1 text-left text-xs transition-colors',
            canEdit &&
              'hover:bg-destructive/10 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
          )}
        >
          <span className="truncate">{game.whiteNickname}</span>
        </button>
        <button
          type="button"
          onClick={() => handleRemovePlayer(game.blackId)}
          disabled={disabled}
          className={cn(
            'border-border/50 col-span-2 flex min-h-6 items-center truncate border-t px-2 py-1 text-left text-xs transition-colors',
            canEdit &&
              'hover:bg-destructive/10 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
          )}
        >
          <span className="truncate">{game.blackNickname}</span>
        </button>
        <div className="border-border bg-muted/30 row-span-full flex h-full min-w-9 items-center justify-center self-stretch border-l px-1.5 text-xs">
          {game.result ? (
            <span className="opacity-90 select-none">
              {game.result === '1/2-1/2'
                ? '½-½'
                : game.result === '1-0'
                  ? '1-0'
                  : '0-1'}
            </span>
          ) : (
            <span className="text-muted-foreground/70 select-none">-</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BracketGameItemEditable;
