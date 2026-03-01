'use client';

import { usePlayerAuthStats } from '@/components/hooks/query-hooks/use-player-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlayerAuthStatsModel } from '@/server/db/zod/players';
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
    <Card className="bg-muted/30 mt-3 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Target className="size-4" />
          {t('yourScore')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {isPending ? (
          <H2HSkeleton />
        ) : authStats ? (
          <H2HDisplay
            playerNickname={playerNickname}
            opponentNickname={`${authStats.userPlayerNickname} (${t('you')})`}
            playerWins={authStats.playerWins}
            opponentWins={authStats.userWins}
            draws={authStats.draws}
          />
        ) : (
          <div className="flex min-h-12 items-center justify-center">
            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              {t('h2hEmptyForClub', { player: playerNickname, club: clubName })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthStatsCard;

interface H2HDisplayProps {
  playerNickname: string;
  opponentNickname: string;
  playerWins: number;
  opponentWins: number;
  draws: number;
}

const H2HDisplay: FC<H2HDisplayProps> = ({
  playerNickname,
  opponentNickname,
  playerWins,
  opponentWins,
  draws,
}) => {
  const playerScore = playerWins + draws * 0.5;
  const opponentScore = opponentWins + draws * 0.5;

  return (
    <div className="grid min-h-12 w-full grid-cols-3 items-center gap-2">
      <span className="text-muted-foreground truncate text-center text-xs">
        {playerNickname}
      </span>
      <div className="flex flex-col items-center justify-center leading-none">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-base font-semibold">{playerScore}</span>
          <span className="text-muted-foreground text-xs">:</span>
          <span className="text-base font-semibold">{opponentScore}</span>
        </div>
        <span className="text-muted-foreground text-3xs">
          ({playerWins}-{draws}-{opponentWins})
        </span>
      </div>
      <span className="text-muted-foreground truncate text-center text-xs">
        {opponentNickname}
      </span>
    </div>
  );
};

const H2HSkeleton: FC = () => (
  <div className="grid min-h-12 w-full grid-cols-3 items-center gap-2">
    <Skeleton className="h-3 w-full" />
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-2 w-12" />
    </div>
    <Skeleton className="h-3 w-full" />
  </div>
);
