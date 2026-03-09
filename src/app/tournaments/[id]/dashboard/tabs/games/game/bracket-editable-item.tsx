'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { cn } from '@/lib/utils';
import type { PlayerTournamentModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { FC } from 'react';
import { useContext } from 'react';

type BracketEditableItemProps =
  | {
      game: GameModel;
      byePlayer?: never;
    }
  | {
      game?: never;
      byePlayer: PlayerTournamentModel;
    };

const BracketEditableItem: FC<BracketEditableItemProps> = (props) => {
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

  const isGame = !!props.game;
  const game = props.game;
  const byePlayer = props.byePlayer;

  const handleRemovePlayer = (playerId: string) => {
    if (disabled || !userId) return;
    removePlayerMutation.mutate({ tournamentId, playerId, userId });
  };

  const handleOpenDrawer = () => {
    if (!canEdit) return;
    const fab = document.getElementById('tournament-add-player-fab');
    fab?.click();
  };

  const topLabel = isGame ? game.whiteNickname : byePlayer.nickname;
  const bottomLabel = isGame ? game.blackNickname : '–';
  const result = isGame ? game.result : null;

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
          onClick={() =>
            isGame
              ? handleRemovePlayer(game.whiteId)
              : handleRemovePlayer(byePlayer.id)
          }
          disabled={disabled}
          className={cn(
            'col-span-2 flex min-h-6 items-center truncate px-2 py-1 text-left text-xs transition-colors',
            canEdit &&
              'hover:bg-destructive/10 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
          )}
        >
          <span className="truncate">{topLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (isGame) {
              handleRemovePlayer(game.blackId);
            } else {
              handleOpenDrawer();
            }
          }}
          disabled={disabled && isGame}
          className={cn(
            'border-border/50 col-span-2 flex min-h-6 items-center truncate border-t px-2 py-1 text-left text-xs transition-colors',
            canEdit &&
              'hover:bg-muted/80 focus-visible:ring-ring focus:outline-none focus-visible:ring-1 focus-visible:ring-inset',
          )}
        >
          <span
            className={cn('truncate', !isGame && 'text-muted-foreground/70')}
          >
            {bottomLabel}
          </span>
        </button>
        <div className="border-border bg-muted/30 row-span-full flex h-full min-w-9 items-center justify-center self-stretch border-l px-1.5 text-xs">
          {result ? (
            <span className="opacity-90 select-none">
              {result === '1/2-1/2' ? '½-½' : result === '1-0' ? '1-0' : '0-1'}
            </span>
          ) : (
            <span className="text-muted-foreground/70 select-none">?</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BracketEditableItem;
