'use client';

import Empty from '@/components/empty';
import { useClubNotifications } from '@/components/hooks/query-hooks/use-club-notifications';
import useOnReach from '@/components/hooks/use-on-reach';
import {
  AffiliationNotificationLi,
  NotificationItem,
} from '@/components/notification-items';
import SkeletonList from '@/components/skeleton-list';
import { ClubNotificationExtendedModel } from '@/server/db/zod/notifications';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

const ClubInbox: FC<{ selectedClub: string }> = ({ selectedClub }) => {
  const t = useTranslations('Club.Dashboard.Notifications');
  const {
    data: notifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useClubNotifications(selectedClub);

  const ref = useOnReach(fetchNextPage);

  if (!notifications) return null;
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
          t={(value, values) => t(`Notification.${value}`, values)}
        />
      ))}
      {isFetchingNextPage && <SkeletonList />}
      {hasNextPage && <div ref={ref} />}
    </div>
  );
};

const Notification: FC<{
  data: ClubNotificationExtendedModel;
  t: NotificationTranslator;
}> = ({ data, t }) => {
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
          {t(data.event, {
            player: data.player?.nickname || '',
            user: data.user?.username || '',
          })}
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
          {t(data.event, {
            user: data.user?.username || '',
            player: data.player?.nickname || '',
          })}
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
          {t(data.event, {
            user: data.user?.username || '',
          })}
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
          {t(data.event, {
            user: data.user?.username || '',
            player: data.player?.nickname || '',
          })}
        </NotificationItem>
      );
    default:
      return null;
  }
};

type NotificationTranslator = (
  key: ClubNotificationExtendedModel['event'],
  values?: Record<string, string | number | Date>,
) => string;

export default ClubInbox;
