'use client';

import Empty from '@/components/empty';
import { useClubInbox } from '@/components/hooks/query-hooks/use-club-inbox';
import {
  AffiliationRequestLi,
  NotificationItem,
} from '@/components/notification-items';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { getAppErrorMessage } from '@/lib/errors';
import { ClubNotificationExtendedModel } from '@/server/zod/notifications';
import { Merge } from 'lucide-react';
import { RichTagsFunction, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode } from 'react';

const ClubInbox: FC<{ selectedClub: string }> = ({ selectedClub }) => {
  const t = useTranslations('Club.Dashboard.Notifications');
  const tErrors = useTranslations('Errors');
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    isLoading,
  } = useClubInbox(selectedClub);

  if (isLoading) return <ClubsNotificationsSkeletonList />;
  if (status === 'error') return <p>{tErrors(getAppErrorMessage(error))}</p>;
  if (!data) return null;

  const items = data.pages.flatMap((page) => page.items);

  if (!items.length) return <Empty>{t('empty')}</Empty>;
  return (
    <ScrollArea className="h-full">
      <div className="mk-list">
        {items.map((item) =>
          item.kind === 'affiliation' ? (
            <AffiliationRequestLi
              key={item.id}
              affiliation={item}
              clubId={selectedClub}
            />
          ) : (
            <Notification
              key={item.id}
              data={item}
              t={(value, values) => t.rich(`Notification.${value}`, values)}
            />
          ),
        )}
        <Paginator
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          skeleton={<ClubsNotificationsSkeletonList length={3} />}
        />
      </div>
    </ScrollArea>
  );
};

const Notification: FC<{
  data: ClubNotificationExtendedModel;
  t: NotificationTranslator;
}> = ({ data, t }) => {
  const user = data.user;
  const player = data.player;

  const mergedPlayer = data.metadata?.mergedPlayerNickname ?? '';
  const richValues = {
    user: user?.username ?? '',
    player: player?.nickname ?? '',
    mergedPlayer,
    userLink: (chunks: ReactNode) =>
      user ? (
        <Link href={`/user/${user.username}`} className="mk-link">
          {chunks}
        </Link>
      ) : (
        chunks
      ),
    playerLink: (chunks: ReactNode) =>
      user ? (
        <Link href={`/user/${user.username}`} className="mk-link">
          {chunks}
        </Link>
      ) : player ? (
        <Link href={`/player/${player.id}`} className="mk-link">
          {chunks}
        </Link>
      ) : (
        chunks
      ),
  };

  switch (data.event) {
    case 'manager_left':
      return (
        <NotificationItem
          notificationId={data.id}
          key={data.id}
          is_seen={data.isSeen}
          type="club"
          clubId={data.clubId}
        >
          {t(data.event, richValues)}
        </NotificationItem>
      );
    case 'affiliation_cancelled':
      return (
        <NotificationItem
          notificationId={data.id}
          key={data.id}
          is_seen={data.isSeen}
          type="club"
          clubId={data.clubId}
        >
          {t(data.event, richValues)}
        </NotificationItem>
      );
    case 'player_merged':
      return (
        <NotificationItem
          notificationId={data.id}
          key={data.id}
          is_seen={data.isSeen}
          type="club"
          clubId={data.clubId}
        >
          <span>
            <Merge className="mr-2 inline size-4 align-text-bottom" />
            {t(data.event, richValues)}
          </span>
        </NotificationItem>
      );
    default:
      return null;
  }
};

const ClubsNotificationsSkeletonList: FC<SkeletonListProps> = ({ length }) => (
  <SkeletonList length={length} className="h-19" />
);

type NotificationTranslator = (
  key: ClubNotificationExtendedModel['event'],
  values?: Record<string, string | number | Date | RichTagsFunction>,
) => ReactNode;

export default ClubInbox;
