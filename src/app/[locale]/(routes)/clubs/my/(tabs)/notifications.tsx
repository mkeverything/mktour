'use client';

import Empty from '@/components/empty';
import { useClubAffiliations } from '@/components/hooks/query-hooks/use-club-affiliations';
import {
  useClubInboxCounter,
  useClubNotifications,
} from '@/components/hooks/query-hooks/use-club-notifications';
import {
  AffiliationRequestLi,
  NotificationItem,
} from '@/components/notification-items';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import { BadgeWithCount } from '@/components/ui-custom/badge';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAppErrorMessage } from '@/lib/errors';
import { ClubNotificationExtendedModel } from '@/server/zod/notifications';
import { Merge } from 'lucide-react';
import { RichTagsFunction, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode, useState } from 'react';

const INBOX_SECTIONS = ['requests', 'notifications'] as const;

const ClubInbox: FC<{ selectedClub: string }> = ({ selectedClub }) => {
  const t = useTranslations('Club.Dashboard.Notifications');
  const { data: counter } = useClubInboxCounter(selectedClub);
  const [section, setSection] = useState<InboxSection>();
  const activeSection =
    section ?? (counter?.requests ? 'requests' : 'notifications');

  return (
    <Tabs
      value={activeSection}
      onValueChange={(value) => setSection(value as InboxSection)}
      className="flex h-full min-h-0 flex-col"
    >
      <TabsList className="grid w-full grid-cols-2">
        {INBOX_SECTIONS.map((value) => (
          <TabsTrigger key={value} value={value} className="gap-1.5">
            {t(value)}
            {!!counter?.[value] && <BadgeWithCount count={counter[value]} />}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="requests" className="min-h-0 flex-1">
        <ClubRequests selectedClub={selectedClub} />
      </TabsContent>
      <TabsContent value="notifications" className="min-h-0 flex-1">
        <ClubNotifications selectedClub={selectedClub} />
      </TabsContent>
    </Tabs>
  );
};

const ClubRequests: FC<{ selectedClub: string }> = ({ selectedClub }) => {
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
  } = useClubAffiliations(selectedClub);

  if (isLoading) return <ClubsNotificationsSkeletonList />;
  if (status === 'error') return <p>{tErrors(getAppErrorMessage(error))}</p>;
  if (!data) return null;

  const affiliations = data.pages.flatMap((page) => page.affiliations);

  if (!affiliations.length) return <Empty>{t('no requests')}</Empty>;
  return (
    <ScrollArea className="h-full">
      <div className="mk-list">
        {affiliations.map((affiliation) => (
          <AffiliationRequestLi
            key={affiliation.id}
            affiliation={affiliation}
            clubId={selectedClub}
          />
        ))}
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

const ClubNotifications: FC<{ selectedClub: string }> = ({ selectedClub }) => {
  const t = useTranslations('Club.Dashboard.Notifications');
  const tErrors = useTranslations('Errors');
  const {
    data: notifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    isLoading,
  } = useClubNotifications(selectedClub);

  if (isLoading) return <ClubsNotificationsSkeletonList />;
  if (status === 'error') return <p>{tErrors(getAppErrorMessage(error))}</p>;
  if (!notifications) return null;

  const allNotifications = notifications.pages.flatMap(
    (page) => page.notifications,
  );

  if (!allNotifications.length) return <Empty>{t('empty')}</Empty>;
  return (
    <ScrollArea className="h-full">
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

type InboxSection = (typeof INBOX_SECTIONS)[number];

type NotificationTranslator = (
  key: ClubNotificationExtendedModel['event'],
  values?: Record<string, string | number | Date | RichTagsFunction>,
) => ReactNode;

export default ClubInbox;
