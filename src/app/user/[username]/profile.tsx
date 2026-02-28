'use client';

import { turboPascal } from '@/app/fonts';
import CancelAffiliationByUser from '@/app/player/[id]/cancel-affiliation-by-user';
import EditButton from '@/app/player/[id]/edit-button';
import PlayerStats from '@/components/ui-custom/player-stats';
import { UserWithPlayers } from '@/app/user/[username]/page';
import FormattedMessage from '@/components/formatted-message';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useUserClubs } from '@/components/hooks/query-hooks/use-user-clubs';
import LastTournaments from '@/components/last-tournaments';
import CarouselDots from '@/components/ui-custom/carousel-dots';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { StatusInClub } from '@/server/db/zod/enums';
import { UserPlayerClubModel } from '@/server/db/zod/players';
import { CalendarDays, Settings, Star, User, Users2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useMemo } from 'react';

const Profile: FC<{
  user: UserWithPlayers;
  isOwner: boolean;
}> = ({ user, isOwner }) => {
  const { data: authUser } = useAuth();
  const { data: managedClubs, isPending } = useUserClubs(user.id);
  const { data: viewerClubs } = useUserClubs(authUser?.id);
  const format = useFormatter();
  const preparedCreatedAt = user.createdAt
    ? format.dateTime(user.createdAt, { dateStyle: 'long' })
    : null;
  const t = useTranslations('Profile');

  const playerClubIds = useMemo(
    () => new Set(user.userPlayers.map((up) => up.club.id)),
    [user.userPlayers],
  );

  const clubStatusMap = useMemo(
    () => new Map(managedClubs?.map((c) => [c.id, c.status]) ?? []),
    [managedClubs],
  );
  const viewerManagedClubIds = useMemo(
    () =>
      new Set(
        viewerClubs
          ?.filter(
            (club) => club.status === 'admin' || club.status === 'co-owner',
          )
          .map((club) => club.id) ?? [],
      ),
    [viewerClubs],
  );

  const managedOnlyClubs = useMemo(
    () =>
      managedClubs?.filter(
        (club) => !playerClubIds.has(club.id) && club.hasFinishedTournaments,
      ) ?? [],
    [managedClubs, playerClubIds],
  );

  return (
    <div className="mk-container gap-mk-2 flex w-full flex-col">
      <HalfCard className="gap-mk-2 p-mk-2 py-mk sm:p-mk-3 flex flex-col">
        <CardHeader className="p-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle
                  className={`text-3xl font-light ${turboPascal.className}`}
                >
                  {user.name}
                </CardTitle>
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

      {/* Owner actions */}
      {isOwner && (
        <div className="gap-mk grid grid-cols-2">
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

      {/* Club profiles carousel */}
      <ClubProfilesCarousel
        userPlayers={user.userPlayers}
        isOwner={isOwner}
        clubStatusMap={clubStatusMap}
        viewerManagedClubIds={viewerManagedClubIds}
      />

      {/* Managed-only clubs mention */}
      {!isPending && managedOnlyClubs.length > 0 && (
        <ManagedOnlyClubsMention clubs={managedOnlyClubs} />
      )}

      {/* Last tournaments */}
      <LastTournaments tournaments={user.lastTournaments} />
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

const ClubProfilesCarousel: FC<{
  userPlayers: UserWithPlayers['userPlayers'];
  isOwner: boolean;
  clubStatusMap: Map<string, StatusInClub>;
  viewerManagedClubIds: Set<string>;
}> = ({ userPlayers, isOwner, clubStatusMap, viewerManagedClubIds }) => {
  const t = useTranslations('Profile');

  if (!userPlayers || userPlayers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="gap-mk flex items-center text-base">
            <User className="size-4" />
            {t('clubProfiles')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center text-sm">
            {t('noClubProfiles')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (userPlayers.length === 1) {
    const { club, player } = userPlayers[0];
    return (
      <ClubPlayerCard
        club={club}
        player={player}
        isOwner={isOwner}
        status={clubStatusMap.get(club.id) ?? null}
        canEdit={isOwner || viewerManagedClubIds.has(club.id)}
        canEditRealname={viewerManagedClubIds.has(club.id)}
      />
    );
  }

  return (
    <Carousel>
      <CarouselContent>
        {userPlayers.map(({ club, player }) => (
          <CarouselItem key={club.id}>
            <ClubPlayerCard
              club={club}
              player={player}
              isOwner={isOwner}
              status={clubStatusMap.get(club.id) ?? null}
              canEdit={isOwner || viewerManagedClubIds.has(club.id)}
              canEditRealname={viewerManagedClubIds.has(club.id)}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselDots count={userPlayers.length} className="sm:hidden" />
      <CarouselPrevious className={`max-sm:hidden`} />
      <CarouselNext className="max-sm:hidden" />
    </Carousel>
  );
};

const ClubPlayerCard: FC<
  UserPlayerClubModel & {
    isOwner: boolean;
    status: StatusInClub | null;
    canEdit: boolean;
    canEditRealname: boolean;
  }
> = ({ club, player, isOwner, status, canEdit, canEditRealname }) => {
  const t = useTranslations('Profile');
  const format = useFormatter();
  const tStatus = useTranslations('Status');
  const formattedPlayerRating = !player.rating
    ? '—'
    : player.ratingDeviation > GLICKO2_CONSTANTS.STABLE_RD_THRESHOLD
      ? `${player.rating}?`
      : player.rating;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              <Link href={`/clubs/${club.id}`} className="hover:underline">
                {club.name}
              </Link>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {player.nickname}
              {status && (
                <span className="bg-primary/10 text-primary text-3xs rounded-md px-1.5 py-0.5 font-medium">
                  {tStatus(status)}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <EditButton
                player={{ ...player, clubId: club.id }}
                status={null}
                canEditRealname={canEditRealname}
              />
            )}
            {isOwner && <CancelAffiliationByUser playerId={player.id} />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            icon={Star}
            label={t('clubRating')}
            value={formattedPlayerRating}
          />
          <StatItem
            icon={CalendarDays}
            label={t('lastTournament')}
            value={
              player.lastSeenAt
                ? format.dateTime(player.lastSeenAt, { dateStyle: 'medium' })
                : '—'
            }
          />
        </div>
        <PlayerStats player={player} wrapper="none" />
      </CardContent>
    </Card>
  );
};

const ManagedOnlyClubsMention: FC<{
  clubs: { id: string; name: string }[];
}> = ({ clubs }) => {
  const t = useTranslations('Profile');

  return (
    <p className="text-muted-foreground text-sm">
      {t('alsoManages')}{' '}
      {clubs.map((club, i) => (
        <span key={club.id}>
          {i > 0 && ', '}
          <Link href={`/clubs/${club.id}`} className="hover:underline">
            {club.name}
          </Link>
        </span>
      ))}
    </p>
  );
};

export default Profile;
