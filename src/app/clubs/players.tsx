'use client';

import AddPlayerDrawer from '@/app/clubs/my/add-new-player';
import { ClubTabProps } from '@/app/clubs/my/tabMap';
import EditPlayerForm from '@/app/player/[id]/player-form';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import { useIntlError } from '@/components/hooks/use-intl-error';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import ComboModal from '@/components/ui-custom/combo-modal';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusInClub } from '@/server/zod/enums';
import { PlayerModel } from '@/server/zod/players';
import { UserRound, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ComponentProps, FC } from 'react';
import { toast } from 'sonner';

const ClubPlayersList: FC<ClubTabProps> = ({ selectedClub, statusInClub }) => {
  return <ClubPlayers clubId={selectedClub} statusInClub={statusInClub} />;
};

export const ClubPlayersSection: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const { playersCount } = useClubStats(clubId).data ?? {};

  return (
    <Card className="flex h-[32rem] min-w-0 flex-col overflow-hidden">
      <CardHeader className="shadow-card z-10 pb-0 shadow-md">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users2 className="size-4" />
          <FormattedMessage id="Club.Page.players" />
          {!!playersCount && (
            <span className="text-muted-foreground font-normal">
              ({playersCount})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden pt-3">
        <ClubPlayers clubId={clubId} statusInClub={statusInClub} />
      </CardContent>
    </Card>
  );
};

const ClubPlayers: FC<{
  clubId: string;
  statusInClub?: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const t = useTranslations();
  const { translateError } = useIntlError();
  const { playersCount } = useClubStats(clubId).data ?? {};
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({
    clubId,
    type: 'players',
  });
  const playersInfinite = useClubPlayers(clubId);

  const useSearch = debouncedSearch.length > 0;
  const playersFromPages =
    playersInfinite.data?.pages.flatMap((p) => p.players) ?? [];
  const players = useSearch ? (searchResults?.players ?? []) : playersFromPages;

  if (!useSearch && playersInfinite.status === 'pending') {
    return <SkeletonList length={4} className="h-14 rounded-xl" />;
  }

  if (!useSearch && playersInfinite.status === 'error') {
    const message = translateError(playersInfinite.error, {
      fallback: 'POSSIBLE_PLAYERS_NOT_LOADED',
    });
    toast.error(message);
    return <p>{message}</p>;
  }

  return (
    <div className="gap-mk flex h-full min-w-0 flex-col">
      <div className="gap-mk flex pt-2 md:top-0 md:z-20">
        <ClubSearchInput
          search={search}
          setSearch={setSearch}
          className="w-full"
        />
        {statusInClub && <AddPlayerDrawer />}
      </div>
      <ScrollArea className="h-full w-full max-w-full min-w-0">
        <div className="mk-list w-full max-w-full min-w-0 overflow-hidden">
          {players.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              statusInClub={statusInClub}
            />
          ))}
          {players.length === 0 && (
            <Empty className="text-center text-balance">
              {playersCount !== 0
                ? t('GlobalSearch.not found')
                : t('Empty.players')}
            </Empty>
          )}
          <Paginator
            disabled={useSearch}
            hasNextPage={playersInfinite.hasNextPage}
            isFetchingNextPage={playersInfinite.isFetchingNextPage}
            fetchNextPage={playersInfinite.fetchNextPage}
            skeleton={<ClubPlayersSkeletonList length={3} />}
          />
        </div>
      </ScrollArea>
    </div>
  );
};

const PlayerItem: FC<{
  player: PlayerModel;
  statusInClub?: StatusInClub | null;
}> = ({ player, statusInClub }) => {
  if (!statusInClub) {
    return (
      <Link
        href={`/player/${player.id}`}
        className="block w-full max-w-full min-w-0 overflow-hidden"
      >
        <PlayerCard player={player} />
      </Link>
    );
  }

  return (
    <ComboModal.Root>
      <ComboModal.Trigger asChild>
        <PlayerCard player={player} />
      </ComboModal.Trigger>
      <ComboModal.Content>
        <ComboModal.Header>
          <ComboModal.Title>
            <Button variant="ghost" className="text-xl" asChild>
              <Link href={`/player/${player.id}`}>
                <span>{player.nickname}</span>
                <UserRound />
              </Link>
            </Button>
          </ComboModal.Title>
        </ComboModal.Header>
        <EditPlayerForm
          clubId={player.clubId}
          player={{ playerId: player.id, ...player }}
          status={statusInClub}
          setOpen={() => null}
        />
      </ComboModal.Content>
    </ComboModal.Root>
  );
};

const PlayerCard: FC<{ player: PlayerModel } & ComponentProps<typeof Card>> = ({
  player,
  ...props
}) => (
  <Card
    {...props}
    className="mk-card grid w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden"
  >
    <span className="min-w-0 truncate text-sm">{player.nickname}</span>
    <div className="text-muted-foreground shrink-0 text-xs">
      {player.rating}
    </div>
  </Card>
);

const ClubPlayersSkeletonList: FC<SkeletonListProps> = ({ length }) => (
  <SkeletonList length={length} className="h-14" />
);

export default ClubPlayersList;
