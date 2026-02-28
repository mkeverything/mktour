'use client';

import AuthStatsCard from '@/app/player/[id]/auth-stats-card';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import HalfCard from '@/components/ui-custom/half-card';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerModel } from '@/server/db/zod/players';
import { Percent, Swords, TrendingUp, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

export default function PlayerStats({
  player,
}: {
  player: Pick<PlayerModel, 'id' | 'nickname' | 'ratingPeak'>;
}) {
  const { data: stats, isPending } = usePlayerStats(player.id);
  const t = useTranslations('Player.Stats');

  return (
    <div className="flex flex-col gap-4">
      <HalfCard>
        <CardContent className="max-sm:p-mk pt-mk-3">
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              icon={Trophy}
              label={t('tournaments')}
              value={stats?.tournamentsPlayed.value}
              rank={stats?.tournamentsPlayed.rank}
              isLoading={isPending}
            />
            <StatItem
              icon={Swords}
              label={t('gamesPlayed')}
              value={stats?.gamesPlayed.value}
              rank={stats?.gamesPlayed.rank}
              isLoading={isPending}
            />
            <StatItem
              icon={Percent}
              label={t('winRate')}
              value={stats ? `${stats.winRate.value}%` : undefined}
              rank={stats?.winRate.rank}
              isLoading={isPending}
            />
            <StatItem
              icon={TrendingUp}
              label={t('ratingPeak')}
              value={player.ratingPeak ?? '—'}
              rank={stats?.ratingPeakRank}
              isLoading={isPending}
            />
          </div>
        </CardContent>
      </HalfCard>
      <AuthStatsCard playerId={player.id} playerNickname={player.nickname} />
    </div>
  );
}

interface StatItemProps {
  icon: FC<{ className?: string }>;
  label: string;
  value?: string | number;
  rank?: number;
  isLoading?: boolean;
}

const StatItem: FC<StatItemProps> = ({
  icon: Icon,
  label,
  value,
  rank,
  isLoading,
}) => (
  <div className="bg-muted/50 grid grid-cols-[auto_50%_auto] items-center justify-between gap-4 rounded-lg p-4">
    <Icon className="text-muted-foreground size-5" />
    <div className="flex flex-col">
      {isLoading ? (
        <>
          <Skeleton className="mb-1 h-5 w-12" />
          <Skeleton className="h-3 w-16" />
        </>
      ) : (
        <>
          <span className="text-primary text-lg font-semibold">{value}</span>
          <span className="text-muted-foreground text-3xs truncate text-left sm:text-xs">
            {label}
          </span>
        </>
      )}
    </div>
    {!isLoading && rank !== undefined && (
      <span className="text-muted-foreground text-xs">#{rank}</span>
    )}
  </div>
);
