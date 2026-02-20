'use client';

import { LoadingSpinner } from '@/app/loading';
import FormattedMessage from '@/components/formatted-message';
import useAffiliationAcceptMutation from '@/components/hooks/mutation-hooks/use-affiliation-accept';
import useAffiliationRejectMutation from '@/components/hooks/mutation-hooks/use-affiliation-reject';
import {
  useChangeClubNotificationStatusMutation,
  useChangeNotificationStatusMutation,
} from '@/components/hooks/mutation-hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ItemActions } from '@/components/ui/item';
import { UserNotificationEvent } from '@/server/db/zod/enums';
import { ClubNotificationExtendedModel } from '@/server/db/zod/notifications';
import {
  AnyUserNotificationExtended,
  UserNotificationExtended,
} from '@/types/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CornerDownRightIcon,
  Eye,
  EyeOff,
  GitPullRequestCreateArrow,
  LucideIcon,
  Medal,
  ShieldUser,
  Skull,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FC, HTMLAttributes, PropsWithChildren } from 'react';

export const AffiliationNotificationLi = ({
  affiliation,
  player,
  user,
  clubId,
  id,
  isSeen,
}: ClubNotificationExtendedModel) => {
  const queryClient = useQueryClient();
  const { mutate: acceptAffiliation, isPending: pendingAccept } =
    useAffiliationAcceptMutation({
      queryClient,
    });
  const { mutate: rejectMutation, isPending: pendingReject } =
    useAffiliationRejectMutation({
      queryClient,
    });

  const isPending = pendingAccept || pendingReject;

  if (!user || !affiliation) return null;

  const variables = {
    clubId,
    affiliationId: affiliation.id,
    notificationId: id,
  };

  const handleAccept = (accept: boolean) => {
    const fn = accept ? acceptAffiliation : rejectMutation;
    fn(variables);
  };

  if (!affiliation) return null;

  return (
    <Card
      key={id}
      className={`mk-card flex flex-col gap-2 ${isSeen && 'opacity-70'}`}
    >
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <GitPullRequestCreateArrow className="size-4" />
        <FormattedMessage id="Club.Dashboard.Notifications.affiliation" />
      </p>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <Link href={`/user/${user?.username}`}>{user?.username}</Link>
              </div>
              <div className="flex items-center">
                <CornerDownRightIcon className="text-muted-foreground mx-2 size-4" />
                <Link href={`/player/${player?.id}`}>{player?.nickname}</Link>
              </div>
            </div>
          </div>
        </div>
        <ItemActions>
          {isPending ? (
            <LoadingSpinner />
          ) : (
            <div className="ml-3 flex gap-2">
              <Button
                size="icon-lg"
                onClick={() => handleAccept(true)}
                variant="secondary"
              >
                <Check />{' '}
              </Button>
              <Button
                size="icon-lg"
                onClick={() => handleAccept(false)}
                variant="destructive"
              >
                <X />{' '}
              </Button>
            </div>
          )}
        </ItemActions>
      </div>
    </Card>
  );
};

export const UserNotificationLi: FC<AnyUserNotificationExtended> = (props) => {
  const { event, notification } = props;
  const { messageId, Icon } = useUserNotificationItem(event);

  return (
    <NotificationItem
      key={notification.id}
      notificationId={notification.id}
      is_seen={notification.isSeen}
      type="user"
    >
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <Icon size={16} />
        <FormattedMessage id={`Notifications.User.${messageId}`} />
      </p>
      <NotificationContent {...props} />
    </NotificationItem>
  );
};

const NotificationContent: FC<AnyUserNotificationExtended> = (notification) => {
  if (notification.event === 'became_club_manager')
    return <ManagerNotification {...notification} />;
  if (notification.event === 'tournament_won')
    return <TournamentNotification {...notification} />;

  const { player, club } = notification;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Link href={`/player/${player?.id}`} className="mk-link">
        {player?.nickname}
      </Link>
      from
      <Link href={`/clubs/${club?.id}`} className="mk-link">
        {club?.name}
      </Link>
    </div>
  );
};

const useUserNotificationItem = (event: UserNotificationEvent) => {
  const messageId = messageIdMap[event];
  const Icon: LucideIcon = iconMap[event];

  return { messageId, Icon };
};

export const NotificationItem: FC<
  PropsWithChildren & {
    is_seen: boolean;
    className?: HTMLAttributes<HTMLDivElement>['className'];
    notificationId: string;
    type: 'user' | 'club';
    clubId?: string;
  }
> = ({
  is_seen,
  className,
  children,
  notificationId,
  type = 'user',
  clubId,
}) => (
  <Card
    className={`mk-card ${is_seen && 'opacity-70'} ${className} flex items-center justify-between text-xs`}
  >
    <div className="flex flex-col gap-2">{children}</div>
    {type === 'user' ? (
      <ToggleIsSeen notificationId={notificationId} isSeen={is_seen} />
    ) : (
      <ToggleClubIsSeen
        notificationId={notificationId}
        isSeen={is_seen}
        clubId={clubId}
      />
    )}
  </Card>
);

const ToggleIsSeen: FC<{ notificationId: string; isSeen: boolean }> = ({
  notificationId,
  isSeen,
}) => {
  const { mutate } = useChangeNotificationStatusMutation();
  const onClick = () => mutate({ notificationId, seen: !isSeen });
  const icon = isSeen ? <EyeOff /> : <Eye />;

  return (
    <Button size="icon-lg" variant="ghost" onClick={onClick}>
      {icon}
    </Button>
  );
};

const ToggleClubIsSeen: FC<{
  notificationId: string;
  isSeen: boolean;
  clubId?: string;
}> = ({ notificationId, isSeen, clubId }) => {
  const { mutate } = useChangeClubNotificationStatusMutation();
  if (!clubId) return null;
  const onClick = () => mutate({ clubId, notificationId, isSeen: !isSeen });
  const icon = isSeen ? <EyeOff /> : <Eye />;

  return (
    <Button size="icon-lg" variant="ghost" onClick={onClick}>
      {icon}
    </Button>
  );
};

const messageIdMap: Record<
  UserNotificationEvent,
  keyof IntlMessages['Notifications']['User']
> = {
  affiliation_approved: 'affiliation approved',
  affiliation_rejected: 'affiliation rejected',
  became_club_manager: 'became club manager',
  tournament_won: 'tournament won',
  removed_from_club_managers: 'removed from club managers',
};

const iconMap: Record<UserNotificationEvent, LucideIcon> = {
  affiliation_approved: Check,
  affiliation_rejected: X,
  became_club_manager: ShieldUser,
  tournament_won: Medal,
  removed_from_club_managers: Skull,
};

const ManagerNotification: FC<Props<'became_club_manager'>> = (
  notification,
) => {
  if (!notification.club) return null;
  return <div>{notification.club.name}</div>;
};

const TournamentNotification: FC<
  UserNotificationExtended<'tournament_won'>
> = ({ metadata }) => {
  return <div>{metadata.name}</div>;
};

type Props<T extends UserNotificationEvent> = UserNotificationExtended<T>;
