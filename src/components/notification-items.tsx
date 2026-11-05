'use client';

import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import FormattedMessage from '@/components/formatted-message';
import {
  useAffiliationAcceptMutation,
  useAffiliationRejectMutation,
} from '@/components/hooks/mutation-hooks/use-affiliation-decision';
import {
  useChangeClubNotificationStatusMutation,
  useChangeNotificationStatusMutation,
} from '@/components/hooks/mutation-hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ItemActions } from '@/components/ui/item';
import { UserNotificationEvent } from '@/server/zod/enums';
import { UserNotificationExtendedModel } from '@/server/zod/notifications';
import { ClubAffiliationModel } from '@/server/zod/players';
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
import { useFormatter } from 'next-intl';
import Link from 'next/link';
import { FC, HTMLAttributes, PropsWithChildren } from 'react';

export const AffiliationRequestLi: FC<{
  affiliation: ClubAffiliationModel;
  clubId: string;
}> = ({ affiliation, clubId }) => {
  const format = useFormatter();
  const { mutate: acceptAffiliation, isPending: pendingAccept } =
    useAffiliationAcceptMutation();
  const { mutate: rejectMutation, isPending: pendingReject } =
    useAffiliationRejectMutation();

  const { user, player, status } = affiliation;
  const variables = { clubId, affiliationId: affiliation.id };
  const isPending = status === 'requested';

  return (
    <Card
      className={`mk-card flex flex-col gap-2 ${!isPending && 'opacity-70'}`}
    >
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <GitPullRequestCreateArrow className="size-4" />
        <FormattedMessage
          id={`Club.Dashboard.Notifications.Status.${status}`}
        />
        {!isPending && (
          <span>
            {format.dateTime(affiliation.updatedAt, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </p>
      <div className="flex items-center justify-between text-sm">
        <div className="flex flex-col justify-center">
          <Link href={`/user/${user.username}`}>{user.username}</Link>
          <div className="flex items-center">
            <CornerDownRightIcon className="text-muted-foreground mx-2 size-4" />
            <Link href={`/player/${player.id}`}>{player.nickname}</Link>
          </div>
        </div>
        {isPending && (
          <ItemActions>
            <div className="ml-3 flex gap-2">
              <Button
                size="icon-lg"
                onClick={() => acceptAffiliation(variables)}
                variant="secondary"
                disabled={pendingAccept || pendingReject}
              >
                {pendingAccept ? <LoadingSpinner /> : <Check />}
              </Button>
              <Button
                size="icon-lg"
                onClick={() => rejectMutation(variables)}
                variant="destructive"
                disabled={pendingAccept || pendingReject}
              >
                {pendingReject ? <LoadingSpinner /> : <X />}
              </Button>
            </div>
          </ItemActions>
        )}
      </div>
    </Card>
  );
};

export const UserNotificationLi: FC<UserNotificationExtendedModel> = (
  props,
) => {
  const { notification } = props;
  const { messageId, Icon } = useUserNotificationItem(notification.event);

  return (
    <NotificationItem
      key={notification.id}
      notificationId={notification.id}
      is_seen={notification.isSeen}
      type="user"
    >
      <p className="text-muted-foreground mb-mk flex items-center gap-1 text-xs">
        <Icon size={16} />
        <FormattedMessage id={`Notifications.User.${messageId}`} />
      </p>
      <NotificationContent {...props} />
    </NotificationItem>
  );
};

const NotificationContent: FC<UserNotificationExtendedModel> = ({
  notification,
  player,
  club,
  tournament,
}) => {
  switch (notification.event) {
    case 'became_club_manager':
    case 'removed_from_club_managers':
      return <div>{club?.name}</div>;
    case 'tournament_won':
      return <div>{tournament?.title}</div>;
    default:
      return (
        <div className="flex items-center gap-2 text-xs">
          <Link href={`/player/${player?.id}`} className="mk-link">
            {player?.nickname}
          </Link>
          <FormattedMessage id="Notifications.User.from" />
          <Link href={`/clubs/${club?.id}`} className="mk-link">
            {club?.name}
          </Link>
        </div>
      );
  }
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
    <span>{children}</span>
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
    <Button
      size="icon-lg"
      variant="ghost"
      className="text-muted-foreground"
      onClick={onClick}
    >
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
  affiliation_cancelled: 'affiliation cancelled',
  became_club_manager: 'became club manager',
  tournament_won: 'tournament won',
  removed_from_club_managers: 'removed from club managers',
};

const iconMap: Record<UserNotificationEvent, LucideIcon> = {
  affiliation_approved: Check,
  affiliation_rejected: X,
  affiliation_cancelled: X,
  became_club_manager: ShieldUser,
  tournament_won: Medal,
  removed_from_club_managers: Skull,
};
