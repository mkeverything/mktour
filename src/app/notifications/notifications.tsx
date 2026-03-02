'use client';

import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useMarkAllNotificationAsSeenMutation } from '@/components/hooks/mutation-hooks/use-notifications';
import {
  useUserNotifications,
  useUserNotificationsCounter,
} from '@/components/hooks/query-hooks/use-user-notifications';
import useOnReach from '@/components/hooks/use-on-reach';
import { UserNotificationLi } from '@/components/notification-items';
import SkeletonList from '@/components/skeleton-list';
import { Button } from '@/components/ui/button';
import { AnyUserNotificationExtended } from '@/types/notifications';
import { Eye } from 'lucide-react';

const UserNotifications = () => {
  const {
    data: notifications,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useUserNotifications();

  const ref = useOnReach(fetchNextPage);

  const { mutate } = useMarkAllNotificationAsSeenMutation();
  const { data: count } = useUserNotificationsCounter();

  if (isLoading)
    return (
      <div className="mk-container">
        <SkeletonList />
      </div>
    );
  if (!notifications?.pages[0].notifications.length)
    return <Empty messageId="notifications" />;
  return (
    <div className="mk-container mk-list">
      <div className="px-mk-2 text-muted-foreground flex h-8 items-center justify-between text-sm">
        <span>
          <FormattedMessage id="Menu.Subs.notifications" />
        </span>
        {!!count && (
          <Button
            onClick={() => mutate()}
            variant="ghost"
            className="gap-mk flex text-xs"
            size="sm"
          >
            <FormattedMessage id="Club.Dashboard.Notifications.mark all as read" />
            <Eye className="mr-0.5" />
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
      {isFetchingNextPage && <SkeletonList />}
      {hasNextPage && <div ref={ref} />}
    </div>
  );
};

const NotificationItemIteratee = (data: AnyUserNotificationExtended) => {
  if (data.event.startsWith('affiliation') && !data.affiliation) return null; // FIXME
  return <UserNotificationLi key={data.notification.id} {...data} />;
};

export default UserNotifications;
