import type { ActivePoint } from '@/app/[locale]/(routes)/player/[id]/ledger/ledger';
import Section from '@/app/[locale]/(routes)/player/[id]/ledger/section';
import RatingDelta from '@/app/[locale]/(routes)/player/[id]/rating-delta';
import { useRatingPointLabel } from '@/app/[locale]/(routes)/player/[id]/use-rating-point-label';
import RatingChart from '@/components/rating-chart';
import type { RatingPoint } from '@/lib/rating-chart';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Dispatch, FC, RefObject, SetStateAction, useState } from 'react';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** the chart over the tournaments it charts, with a readout of the point in focus. on a phone it pins over them */
const RatingHistory: FC<{
  ref: RefObject<HTMLDivElement | null>;
  points: RatingPoint[];
  active: ActivePoint;
  setActive: Dispatch<SetStateAction<ActivePoint>>;
}> = ({ ref, points, active, setActive }) => {
  const t = useTranslations('Player');
  const getLabel = useRatingPointLabel();
  const [range, setRange] = useState<'year' | 'all'>('all');
  const point = active && points[active.index];

  if (points.length < 2)
    return (
      <Section title={t('Rating.history')}>
        <p className="text-muted-foreground text-sm text-balance">
          {t('Page.noRatedTournaments')}
        </p>
      </Section>
    );

  const isLongHistory =
    points[points.length - 1].publishedAt.getTime() -
      points[0].publishedAt.getTime() >
    YEAR_MS;

  return (
    // on desktop it keeps the list's scrollbar gutter, so the chart ends where the cards do
    <div
      ref={ref}
      className="bg-background/85 max-lg:[@media(prefers-reduced-transparency:reduce)]:bg-background -mx-mk-2 px-mk-2 top-mk-navbar-total-height small-scrollbar sticky z-20 flex shrink-0 flex-col gap-1 border-b py-2 backdrop-blur-md lg:static lg:mx-0 lg:[scrollbar-gutter:stable] lg:gap-2 lg:overflow-hidden lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      <div className="flex h-9 items-center justify-between gap-4 text-xs">
        {point ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-medium tabular-nums">
              {point.rating}
              {!point.isEstablished && '?'}
            </span>
            {point.delta !== null && <RatingDelta value={point.delta} />}
            <span className="text-muted-foreground truncate">
              {getLabel(point)}
            </span>
          </span>
        ) : (
          <h2 className="text-sm font-medium">{t('Rating.history')}</h2>
        )}
        {isLongHistory && (
          <div className="flex shrink-0 gap-1">
            {(['year', 'all'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => setRange(option)}
                className={cn(
                  'focus-visible:ring-ring/50 active:bg-muted relative rounded-md px-2.5 py-1 transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-2.5 focus-visible:ring-[3px] focus-visible:ring-inset active:transition-none',
                  range === option
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(option === 'year' ? 'Page.rangeYear' : 'Page.rangeAll')}
              </button>
            ))}
          </div>
        )}
      </div>
      <RatingChart
        points={points}
        period={range === 'year' ? YEAR_MS : undefined}
        activeIndex={active?.index ?? null}
        onActiveIndexChange={(index) =>
          setActive(index === null ? null : { index, source: 'chart' })
        }
        label={t('Rating.history')}
        className="h-32 lg:h-[clamp(14rem,34svh,24rem)]"
      />
    </div>
  );
};

export default RatingHistory;
