'use client';

import { ClubTabProps } from '@/app/clubs/my/tabMap';
import EditPlayerForm from '@/app/player/[id]/player-form';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import SkeletonList from '@/components/skeleton-list';
import ComboModal from '@/components/ui-custom/combo-modal';
import Paginator from '@/components/ui-custom/paginator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusInClub } from '@/server/db/zod/enums';
import { PlayerModel } from '@/server/db/zod/players';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const ClubPlayersList: FC<ClubTabProps> = ({ selectedClub, statusInClub }) => {
  const { fetchNextPage, ...players } = useClubPlayers(selectedClub);
  const t = useTranslations('Empty');
  const playersData = players.data?.pages.flatMap((page) => page.players) ?? [];

  if (players.status === 'pending' || players.status === 'error')
    return <SkeletonList length={4} className="h-14 rounded-xl" />;
  if (!playersData.length) {
    return <Empty className="text-center text-balance">{t('players')}</Empty>;
  }

  return (
    <div className="mk-list">
      <div className="mk-list">
        {playersData.map((player) => (
          <PlayerItemIteratee
            key={player.id}
            player={player}
            statusInClub={statusInClub}
          />
        ))}
      </div>
      <Paginator
        hasNextPage={players.hasNextPage}
        isFetchingNextPage={players.isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
};

const PlayerItemIteratee = ({
  player,
  statusInClub,
}: {
  player: PlayerModel;
  statusInClub: StatusInClub | null | undefined;
}) => {
  return (
    <PlayerItem player={player} key={player.id} statusInClub={statusInClub} />
  );
};

const PlayerItem: FC<{
  player: PlayerModel;
  statusInClub: StatusInClub | null | undefined;
}> = ({ player, statusInClub }) => {
  const { id, nickname, rating } = player;

  return (
    <ComboModal.Root>
      <ComboModal.Trigger>
        <Card
          key={id}
          className="mk-card flex items-center justify-between truncate"
        >
          <span className="text-sm">{nickname}</span>
          <div className="text-muted-foreground text-xs">{rating}</div>
        </Card>
      </ComboModal.Trigger>
      <ComboModal.Content>
        <ComboModal.Title className="gap-mk-2 flex items-center pl-2">
          <span>{nickname}</span>
          <Link href={`/player/${player?.id}`}>
            <Button variant="outline" className="">
              <UserRound />
              <FormattedMessage id="Tournament.Table.Player.profile" />
            </Button>
          </Link>
        </ComboModal.Title>
        <EditPlayerForm
          clubId={player.clubId}
          player={player}
          status={statusInClub}
          setOpen={() => null}
        />
      </ComboModal.Content>
    </ComboModal.Root>
  );
};

export default ClubPlayersList;
