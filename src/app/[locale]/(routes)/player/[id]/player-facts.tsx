import { usePlayerResultRows } from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import { useFormatDate } from '@/components/hooks/use-format-date';
import type { RatingPoint } from '@/lib/rating-chart';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** the dated facts of a club career, one per line */
const PlayerFacts: FC<{
  playerId: string;
  peak: RatingPoint | null;
  joinedAt?: Date;
}> = ({ playerId, peak, joinedAt }) => {
  const t = useTranslations('Player.Page');
  const formatDate = useFormatDate();
  const { data: stats } = usePlayerStats(playerId);
  const { rows } = usePlayerResultRows(playerId, []);
  // `lastSeenAt` starts as the day the player was added, so only a finished tournament counts
  const lastPlayed = rows.find(({ tournament }) => tournament.closedAt);

  return (
    <dl className="flex flex-col gap-3 text-sm">
      {(
        [
          [
            t('peak'),
            peak && (
              <>
                {peak.rating}
                <span className="text-muted-foreground ml-2 text-xs">
                  {formatDate(peak.publishedAt, 'short')}
                </span>
              </>
            ),
          ],
          [
            t('lastPlayed'),
            lastPlayed && formatDate(lastPlayed.tournament.date, 'short'),
          ],
          [t('joined'), joinedAt && formatDate(joinedAt, 'short')],
          [t('tournaments'), stats?.tournamentsPlayed],
          [t('tournamentsWon'), stats?.tournamentsWon],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-right whitespace-nowrap tabular-nums">
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export default PlayerFacts;
