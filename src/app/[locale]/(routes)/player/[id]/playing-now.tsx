import { LiveRound } from '@/app/[locale]/(routes)/player/[id]/result-parts';
import { getTournamentState } from '@/app/[locale]/(routes)/player/[id]/tournament-state';
import { usePlayerResultRows } from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import { useTournamentTitle } from '@/components/hooks/use-tournament-fallback-title';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

/** a way into the tournament the player is in right now, if there is one */
const PlayingNow: FC<{ playerId: string; className?: string }> = ({
  playerId,
  className,
}) => {
  const t = useTranslations('Player.Page');
  const getTitle = useTournamentTitle();
  const { rows } = usePlayerResultRows(playerId, []);
  const live = rows.find(
    ({ tournament }) => getTournamentState(tournament) === 'live',
  );
  if (!live) return null;

  return (
    <Link
      href={`/tournaments/${live.tournament.id}`}
      className={cn(
        'bg-muted/60 hover:bg-muted active:bg-muted flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors active:transition-none',
        className,
      )}
    >
      <span className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{t('playingNow')}</span>
        <LiveRound tournament={live.tournament} />
      </span>
      <span className="truncate text-sm font-medium">
        {getTitle(live.tournament)}
      </span>
    </Link>
  );
};

export default PlayingNow;
