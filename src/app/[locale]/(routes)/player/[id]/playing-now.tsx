import { getTournamentState } from '@/app/[locale]/(routes)/player/[id]/tournament-state';
import { usePlayerResultRows } from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import { useTournamentTitle } from '@/components/hooks/use-tournament-fallback-title';
import { LiveRound } from '@/components/tournament-months';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

/** a way into the tournament the player is in right now, if there is one */
const PlayingNow: FC<{ playerId: string }> = ({ playerId }) => {
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
      className="bg-card hover:bg-muted/50 active:bg-muted flex flex-col gap-0.5 rounded-xl border px-3 py-2.25 transition-colors active:transition-none"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-muted-foreground whitespace-nowrap">
          {t('playingNow')}
        </span>
        <LiveRound tournament={live.tournament} />
      </span>
      <span className="truncate text-sm font-medium">
        {getTitle(live.tournament)}
      </span>
    </Link>
  );
};

export default PlayingNow;
