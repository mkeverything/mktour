'use client';

import FormattedMessage from '@/components/formatted-message';
import { useUserClubs } from '@/components/hooks/query-hooks/use-user-clubs';
import SkeletonList from '@/components/skeleton-list';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { UserModel } from '@/server/db/zod/users';
import { CalendarDays, Settings, Star, Users2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const Profile: FC<{
  user: Pick<UserModel, 'id' | 'username' | 'name' | 'rating' | 'createdAt'>;
  isOwner: boolean;
}> = ({ user, isOwner }) => {
  const { data, isPending } = useUserClubs(user.id);
  const format = useFormatter();
  const preparedCreatedAt = user.createdAt
    ? format.dateTime(user.createdAt, { dateStyle: 'long' })
    : null;
  const t = useTranslations('Profile');

  return (
    <div className="mk-container flex w-full flex-col gap-6">
      <HalfCard className="gap-mk-2 p-mk-2 sm:p-mk-3 flex flex-col">
        <CardHeader className="p-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl">{user.name}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  <Link href={`https://lichess.org/@/${user.username}`}>
                    @{user.username}
                  </Link>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatItem
              icon={Star}
              label={t('rating')}
              value={user.rating ?? '—'}
            />
            {preparedCreatedAt && (
              <StatItem
                icon={CalendarDays}
                label={t('created')}
                value={preparedCreatedAt}
              />
            )}
          </div>
        </CardContent>
      </HalfCard>

      {isOwner && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            asChild
          >
            <Link href="/profile/settings">
              <Settings className="text-muted-foreground size-5" />
              <span className="text-sm">
                <FormattedMessage id="Common.settings" />
              </span>
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            asChild
          >
            <Link href="/clubs/my">
              <Users2 className="text-muted-foreground size-5" />
              <span className="text-sm">{t('myClubs')}</span>
            </Link>
          </Button>
        </div>
      )}

      <ClubList clubs={data} isPending={isPending} />
    </div>
  );
};

const StatItem: FC<{
  icon: FC<{ className?: string }>;
  label: string;
  value: string | number;
}> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="bg-muted flex aspect-square size-10 items-center justify-center rounded-lg">
      <Icon className="text-muted-foreground aspect-square size-5" />
    </div>
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  </div>
);

const ClubList: FC<ClubListProps> = ({ clubs, isPending }) => {
  const t = useTranslations('Profile');

  if (!clubs && isPending) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="pt-0">
          <SkeletonList />
        </CardContent>
      </Card>
    );
  }

  if (!clubs || clubs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="size-4" />
            {t('clubs')}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users2 className="size-4" />
          {t('clubs')} ({clubs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="flex flex-col">
          {clubs.map((club, index) => (
            <div key={club.id}>
              {index > 0 && <Separator />}
              <li className="py-1">
                <Link
                  href={`/clubs/${club.id}`}
                  className="hover:bg-muted/50 -mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
                >
                  <span className="text-sm font-medium">{club.name}</span>
                  {/* <ChevronRight className="text-muted-foreground size-4" /> */}
                </Link>
              </li>
            </div>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

type ClubListProps = {
  clubs:
    | {
        id: string;
        name: string;
      }[]
    | undefined;
  isPending: boolean;
};

export default Profile;
