'use client';

import { usePlayerAuthStats } from '@/components/hooks/query-hooks/use-player-stats';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlayerAuthStatsModel } from '@/server/zod/players';
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

interface AuthStatsCardProps {
  playerId: string;
  playerNickname: string;
  clubName: string;
  authStats?: PlayerAuthStatsModel | null;
  isPending?: boolean;
  showWhenEmpty?: boolean;
}

const AuthStatsCard: FC<AuthStatsCardProps> = ({
  playerId,
  playerNickname,
  clubName,
  authStats: providedAuthStats,
  isPending: providedIsPending,
  showWhenEmpty = true,
}) => {
  const hasProvidedState =
    providedAuthStats !== undefined && providedIsPending !== undefined;
  const { data: queriedAuthStats, isPending: queriedIsPending } =
    usePlayerAuthStats(playerId, !hasProvidedState);
  const authStats = hasProvidedState ? providedAuthStats : queriedAuthStats;
  const isPending = hasProvidedState ? providedIsPending : queriedIsPending;
  const t = useTranslations('Player.Stats');

  if (!isPending && !authStats && !showWhenEmpty) return null;

  return (
    <div className="bg-muted/50 text-muted-foreground col-span-full flex flex-col gap-3 rounded-xl p-4 text-xs">
      <div className="flex items-center gap-2">
        <Target className="size-4" />
        {t('yourScore')}
        {authStats && (
          <span className="ml-auto">
            {authStats.playerWins}-{authStats.draws}-{authStats.userWins}
          </span>
        )}
      </div>
      {isPending ? (
        <Skeleton className="h-14" />
      ) : authStats ? (
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 text-sm">
          <span className="truncate">{playerNickname}</span>
          <span className="text-foreground text-right text-xl font-semibold">
            {authStats.playerWins + authStats.draws / 2}
          </span>
          <span className="truncate">
            {authStats.userPlayerNickname} ({t('you')})
          </span>
          <span className="text-foreground text-right text-xl font-semibold">
            {authStats.userWins + authStats.draws / 2}
          </span>
        </div>
      ) : (
        <p className="text-sm">
          {t('h2hEmptyForClub', { player: playerNickname, club: clubName })}
        </p>
      )}
    </div>
  );
};

export default AuthStatsCard;
