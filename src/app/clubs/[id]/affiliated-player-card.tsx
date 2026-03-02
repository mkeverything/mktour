'use client';

import { useTRPC } from '@/components/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Percent, Star, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const AffiliatedPlayerCard: FC<{ clubId: string; userId: string }> = ({
  clubId,
  userId,
}) => {
  const trpc = useTRPC();
  const tPage = useTranslations('Club.Page');
  const tProfile = useTranslations('Profile');
  const tPlayerStats = useTranslations('Player.Stats');

  const {
    data: player,
    isPending: isPlayerPending,
    isError: isPlayerError,
  } = useQuery(
    trpc.club.authPlayer.queryOptions(
      { clubId },
      {
        enabled: Boolean(userId),
      },
    ),
  );

  const { data: stats, isPending: isStatsPending } = useQuery(
    trpc.player.stats.public.queryOptions(
      { playerId: player?.id ?? '' },
      {
        enabled: Boolean(player?.id),
      },
    ),
  );

  if (!userId || isPlayerError) return null;

  if (isPlayerPending) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-14 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!player) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {tPage('yourStatsInClub')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-2 px-1 py-1 md:flex-row md:items-center md:justify-between">
          <Link
            href={`/player/${player.id}`}
            className="flex min-w-0 items-center hover:opacity-80 md:shrink-0"
          >
            <span className="truncate text-sm font-medium">
              {player.nickname}
            </span>
          </Link>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 whitespace-nowrap md:justify-end">
            <CompactStat
              icon={Star}
              label={tProfile('clubRating')}
              value={player.rating}
            />
            <CompactStat
              icon={Trophy}
              label={tPlayerStats('tournaments')}
              value={
                isStatsPending ? '...' : (stats?.tournamentsPlayed.value ?? 0)
              }
            />
            <CompactStat
              icon={Percent}
              label={tPlayerStats('winRate')}
              value={isStatsPending ? '...' : `${stats?.winRate.value ?? 0}%`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CompactStat: FC<{
  icon: FC<{ className?: string }>;
  label: string;
  value: string | number;
}> = ({ icon: Icon, label, value }) => (
  <div className="bg-muted/60 flex items-center gap-1.5 rounded-lg px-2 py-1">
    <Icon className="text-muted-foreground size-3.5" />
    <span className="text-foreground text-xs font-semibold">{value}</span>
    <span className="sr-only">{label}</span>
  </div>
);

export default AffiliatedPlayerCard;
