'use client';

import AuthStatsCard from '@/app/[locale]/(routes)/player/[id]/auth-stats-card';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import HalfCard from '@/components/ui-custom/half-card';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  PlayerAuthStatsModel,
  PlayerModel,
  PlayerStatsModel,
} from '@/server/zod/players';
import { Crown, Swords, TrendingUp, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, ReactNode } from 'react';

interface PlayerStatsProps {
  player: Pick<PlayerModel, 'id' | 'nickname' | 'ratingPeak'>;
  wrapper?: 'half-card' | 'none';
  clubName: string;
  renderAuthStatsCard?: boolean;
  authStats?: PlayerAuthStatsModel | null;
  isAuthStatsPending?: boolean;
  showAuthStatsWhenEmpty?: boolean;
}

export default function PlayerStats({
  player,
  wrapper = 'half-card',
  clubName,
  renderAuthStatsCard = true,
  authStats,
  isAuthStatsPending,
  showAuthStatsWhenEmpty = true,
}: PlayerStatsProps) {
  const { data: stats, isPending } = usePlayerStats(player.id);
  const t = useTranslations('Player.Stats');

  const content = (
    <div className="@container">
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        <StatItem
          icon={Trophy}
          label={t('tournaments')}
          value={stats?.tournamentsPlayed}
          isLoading={isPending}
          rank={stats?.tournamentsPlayedRank}
        />
        <StatItem
          icon={Crown}
          label={t('tournamentsWon')}
          value={stats?.tournamentsWon}
          isLoading={isPending}
          rank={stats?.tournamentsWonRank}
        />
        <StatItem
          icon={Swords}
          label={t('gamesPlayed')}
          value={stats?.gamesPlayed}
          isLoading={isPending}
          detail={stats && <GamesRecord {...stats} />}
          rank={stats?.gamesPlayedRank}
        />
        <StatItem
          icon={TrendingUp}
          label={t('ratingPeak')}
          value={player.ratingPeak}
        />
        {renderAuthStatsCard && (
          <AuthStatsCard
            playerId={player.id}
            playerNickname={player.nickname}
            clubName={clubName}
            authStats={authStats}
            isPending={isAuthStatsPending}
            showWhenEmpty={showAuthStatsWhenEmpty}
          />
        )}
      </div>
    </div>
  );

  if (wrapper === 'none') return content;

  return (
    <HalfCard>
      <CardContent className="max-sm:p-mk pt-mk-3">{content}</CardContent>
    </HalfCard>
  );
}

export const PlayerRatingRank: FC<{ playerId: string }> = ({ playerId }) => {
  const { data: stats } = usePlayerStats(playerId);
  if (!stats || stats.ratingRank === null) return null;
  return (
    <span className="text-muted-foreground text-xs">#{stats.ratingRank}</span>
  );
};

const GamesRecord: FC<
  Pick<PlayerStatsModel, 'gamesWon' | 'gamesDrawn' | 'gamesLost'>
> = ({ gamesWon, gamesDrawn, gamesLost }) => (
  <span>
    {gamesWon}-{gamesDrawn}-{gamesLost}
  </span>
);

interface StatItemProps {
  icon: FC<{ className?: string }>;
  label: string;
  value?: number | null;
  detail?: ReactNode;
  rank?: number | null;
  isLoading?: boolean;
}

const StatItem: FC<StatItemProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  rank,
  isLoading,
}) => (
  <div className="bg-muted/50 text-muted-foreground flex flex-col gap-3 rounded-xl p-4 text-xs">
    <div className="flex items-center justify-between">
      <Icon className="size-4" />
      {value && rank ? `#${rank}` : null}
    </div>
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        {isLoading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <span className="text-foreground text-2xl font-semibold">
            {value ?? '—'}
          </span>
        )}
        {detail}
      </div>
      {label}
    </div>
  </div>
);
