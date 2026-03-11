'use client';

import Empty from '@/components/empty';
import { useClubNotifications } from '@/components/hooks/query-hooks/use-club-notifications';
import {
  AffiliationNotificationLi,
  NotificationItem,
} from '@/components/notification-items';
import SkeletonList from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { ClubNotificationExtendedModel } from '@/server/zod/notifications';
import { RichTagsFunction, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode } from 'react';

const ClubInbox: FC<{ selectedClub: string }> = ({ selectedClub }) => {
  const t = useTranslations('Club.Dashboard.Notifications');
  const {
    data: notifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    isLoading,
  } = useClubNotifications(selectedClub);

  if (!notifications) return null;
  if (isLoading) return skeleton;
  if (status === 'error') return <p>{error.message}</p>;

  const allNotifications = notifications.pages.flatMap(
    (page) => page.notifications,
  );

  if (!allNotifications.length) return <Empty>{t('empty')}</Empty>;
  return (
    <div className="mk-list">
      {allNotifications.map((event) => (
        <Notification
          key={event.id}
          data={event}
          t={(value, values) => t.rich(`Notification.${value}`, values)}
        />
      ))}
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={skeleton}
      />
    </div>
  );
};

const Notification: FC<{
  data: ClubNotificationExtendedModel;
  t: NotificationTranslator;
}> = ({ data, t }) => {
  const user = data.user;
  const player = data.player;

  const richValues = {
    user: user?.username ?? '',
    player: player?.nickname ?? '',
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
    case 'affiliation_request':
      return <AffiliationNotificationLi key={data.id} {...data} />;
    case 'affiliation_request_approved':
      return (
        <NotificationItem
          notificationId={data.id}
          key={data.id}
          is_seen={data.isSeen}
          type="club"
          clubId={data.clubId}
        >
          <span>{t(data.event, richValues)}</span>
        </NotificationItem>
      );
    case 'affiliation_request_rejected':
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
    default:
      return null;
  }
};

const skeleton = <SkeletonList className="h-19" />;

type NotificationTranslator = (
  key: ClubNotificationExtendedModel['event'],
  values?: Record<string, string | number | Date | RichTagsFunction>,
) => ReactNode;

export default ClubInbox;
