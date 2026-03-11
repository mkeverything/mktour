'use client';

import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useMarkAllNotificationAsSeenMutation } from '@/components/hooks/mutation-hooks/use-notifications';
import {
  useUserNotifications,
  useUserNotificationsCounter,
} from '@/components/hooks/query-hooks/use-user-notifications';
import { UserNotificationLi } from '@/components/notification-items';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnyUserNotificationExtended } from '@/types/notifications';
import { LucideCheckCheck } from 'lucide-react';
import { FC } from 'react';

const UserNotifications = () => {
  const {
    data: notifications,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useUserNotifications();

  const { mutate } = useMarkAllNotificationAsSeenMutation();
  const { data: count } = useUserNotificationsCounter();

  if (isLoading)
    return (
      <div className="mk-container mk-list mt-mk gap-4">
        <Skeleton className="ml-mk-2 h-4 w-32" />
        <UserNotificationsSkeletonList />
      </div>
    );

  if (!notifications?.pages[0].notifications.length)
    return <Empty messageId="notifications" />;

  return (
    <div className="mk-container mk-list">
      <div className="pl-mk-2 text-muted-foreground flex h-8 items-center justify-between text-sm">
        <span>
          <FormattedMessage id="Menu.Subs.notifications" />
        </span>
        {!!count && (
          <Button
            onClick={() => mutate()}
            variant="ghost"
            className="gap-mk text-2xs flex"
            size="sm"
          >
            <FormattedMessage id="Club.Dashboard.Notifications.mark all as read" />
            <LucideCheckCheck />
          </Button>
        )}
      </div>
      {notifications.pages.map((page) => {
        if (!page.notifications.length) return null;
        return (
          <div key={page.notifications[0].notification.id} className="mk-list">
            {page.notifications.map(NotificationItemIteratee)}
          </div>
        );
      })}
      <Paginator
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        skeleton={<UserNotificationsSkeletonList />}
      />
    </div>
  );
};

const NotificationItemIteratee = (data: AnyUserNotificationExtended) => {
  if (data.event.startsWith('affiliation') && !data.affiliation) return null; // FIXME
  return <UserNotificationLi key={data.notification.id} {...data} />;
};

const UserNotificationsSkeletonList: FC<SkeletonListProps> = () => (
  <SkeletonList className="h-19" />
);

export default UserNotifications;
