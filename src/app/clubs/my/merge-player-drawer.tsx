'use client';

import { LoadingSpinner } from '@/app/loading';
import usePlayerMergeMutation from '@/components/hooks/mutation-hooks/use-player-merge';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import RichText from '@/components/rich-text';
import SkeletonList from '@/components/skeleton-list';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PlayerModel } from '@/server/zod/players';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Info, Merge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useState } from 'react';

type MergePlayerDrawerProps = {
  clubId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  sourcePlayer: PlayerModel;
};

const MergePlayerDrawer: FC<MergePlayerDrawerProps> = ({
  clubId,
  open,
  setOpen,
  sourcePlayer,
}) => {
  const t = useTranslations('Player.Merge');
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModel | null>(
    null,
  );
  const [isSwapped, setIsSwapped] = useState(false);
  const playersInfinite = useClubPlayers(clubId);
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({ clubId, type: 'players' });
  const useSearch = debouncedSearch.length > 0;
  const playersFromPages =
    playersInfinite.data?.pages.flatMap((page) => page.players) ?? [];
  const players = (
    useSearch ? (searchResults?.players ?? []) : playersFromPages
  ).filter((player) => player.id !== sourcePlayer.id);
  const sourceInfo = useQuery(
    trpc.player.info.queryOptions(
      { playerId: sourcePlayer.id },
      { enabled: Boolean(selectedPlayer) },
    ),
  );
  const selectedInfo = useQuery(
    trpc.player.info.queryOptions(
      { playerId: selectedPlayer?.id ?? '' },
      { enabled: Boolean(selectedPlayer) },
    ),
  );
  const mergeMutation = usePlayerMergeMutation({
    queryClient,
    onSuccess: () => setOpen(false),
  });
  const projectedPlayer = !selectedPlayer
    ? null
    : isSwapped
      ? sourcePlayer
      : selectedPlayer;
  const mergedPlayer = !selectedPlayer
    ? null
    : isSwapped
      ? selectedPlayer
      : sourcePlayer;
  const projectedInfo = isSwapped ? sourceInfo.data : selectedInfo.data;
  const mergedInfo = isSwapped ? selectedInfo.data : sourceInfo.data;
  const projectedUsername =
    projectedInfo?.user?.username ?? mergedInfo?.user?.username;

  const handleClose = (state: boolean) => {
    setOpen(state);
    if (!state) {
      setSelectedPlayer(null);
      setIsSwapped(false);
      setSearch('');
    }
  };

  const merge = () => {
    if (!selectedPlayer) return;
    mergeMutation.mutate({
      clubId,
      basePlayerId: isSwapped ? sourcePlayer.id : selectedPlayer.id,
      mergedPlayerId: isSwapped ? selectedPlayer.id : sourcePlayer.id,
    });
  };

  return (
    <SideDrawer open={open} setOpen={handleClose}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('title')}</h2>
          </div>
          <div className="text-muted-foreground text-sm">
            <RichText>
              {(tags) =>
                t.rich('description', {
                  player: sourcePlayer.nickname,
                  ...tags,
                })
              }
            </RichText>
          </div>
        </div>

        <ClubSearchInput
          search={search}
          setSearch={setSearch}
          className="w-full"
        />

        <ScrollArea className="min-h-0 w-full max-w-full min-w-0 flex-1 py-0.5 [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!max-w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
          <div className="mk-list w-full max-w-full min-w-0 overflow-hidden">
            {!useSearch && playersInfinite.status === 'pending' ? (
              <SkeletonList length={4} className="h-14" />
            ) : (
              players.map((player) => (
                <PlayerMergeOption
                  key={player.id}
                  player={player}
                  selected={selectedPlayer?.id === player.id}
                  onClick={() => {
                    setSelectedPlayer(player);
                    setIsSwapped(false);
                  }}
                />
              ))
            )}
            <Paginator
              disabled={useSearch}
              hasNextPage={playersInfinite.hasNextPage}
              isFetchingNextPage={playersInfinite.isFetchingNextPage}
              fetchNextPage={playersInfinite.fetchNextPage}
              skeleton={<SkeletonList length={3} className="h-14" />}
            />
          </div>
        </ScrollArea>

        {projectedPlayer && mergedPlayer && (
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{t('result')}</span>
              <button
                type="button"
                className="hover:text-foreground active:scale-[0.97]"
                onClick={() => setIsSwapped((value) => !value)}
              >
                <span
                  className={cn(
                    'inline-flex transition-transform duration-200 ease-in-out',
                    isSwapped && 'rotate-180',
                  )}
                >
                  <ArrowLeftRight className="size-4" />
                </span>
              </button>
            </div>
            <ProjectedPlayerCard
              player={projectedPlayer}
              mergedPlayer={mergedPlayer}
              username={projectedUsername}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={merge}
            disabled={!selectedPlayer || mergeMutation.isPending}
          >
            {mergeMutation.isPending ? <LoadingSpinner /> : <Merge />}
            {t('merge')}
          </Button>
          <Button variant="secondary" onClick={() => handleClose(false)}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
};

const ProjectedPlayerCard: FC<{
  player: PlayerModel;
  mergedPlayer: PlayerModel;
  username?: string;
}> = ({ player, mergedPlayer, username }) => {
  const t = useTranslations('Player.Merge');
  const realname = player.realname ?? mergedPlayer.realname;

  return (
    <Card className="mk-card space-y-2 text-sm">
      <div className="space-y-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">
            {player.nickname}
          </span>
          <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            <span>{player.rating}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-56">
                  {t('rating tooltip', {
                    player: mergedPlayer.nickname,
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {realname && (
          <div className="text-muted-foreground truncate text-xs">
            {realname}
          </div>
        )}
        {username && (
          <div className="text-muted-foreground truncate text-xs">
            {t('affiliated user', { user: username })}
          </div>
        )}
      </div>
    </Card>
  );
};

const PlayerMergeOption: FC<{
  player: PlayerModel;
  selected: boolean;
  onClick: () => void;
}> = ({ player, selected, onClick }) => (
  <Card
    className={cn(
      'mk-card box-border w-full max-w-full min-w-0 overflow-hidden p-0',
      selected && 'ring-primary ring-2 ring-inset',
    )}
  >
    <button
      type="button"
      aria-pressed={selected}
      className="focus-visible:ring-ring w-full cursor-pointer space-y-1 p-4 text-left focus-visible:ring-2 focus-visible:outline-none"
      onClick={onClick}
      onFocus={onClick}
    >
      <PlayerLabel player={player} />
      {player.realname && (
        <div className="text-muted-foreground truncate text-xs">
          {player.realname}
        </div>
      )}
    </button>
  </Card>
);

const PlayerLabel: FC<{ player: PlayerModel }> = ({ player }) => (
  <div className="flex w-full min-w-0 items-center justify-between gap-2">
    <span className="min-w-0 flex-1 truncate">{player.nickname}</span>
    <span className="text-muted-foreground shrink-0 text-xs">
      {player.rating}
    </span>
  </div>
);

export default MergePlayerDrawer;
