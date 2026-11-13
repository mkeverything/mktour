import {
  Count,
  PanelScroller,
} from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import type { ActivePoint } from '@/app/[locale]/(routes)/player/[id]/ledger/ledger';
import Section from '@/app/[locale]/(routes)/player/[id]/ledger/section';
import RatingDelta from '@/app/[locale]/(routes)/player/[id]/rating-delta';
import ResultScore from '@/app/[locale]/(routes)/player/[id]/result-score';
import Medal from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/medal';
import { getTournamentState } from '@/app/[locale]/(routes)/player/[id]/tournament-state';
import {
  usePlayerResultRows,
  type PlayerResultRow,
} from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import Empty from '@/components/empty';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import { useMediaQuery } from '@/components/providers/media-query-provider';
import SkeletonList from '@/components/skeleton-list';
import {
  TournamentMonths,
  TournamentRow,
} from '@/components/tournament-months';
import type { RatingPoint } from '@/lib/rating-chart';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Dispatch,
  FC,
  RefObject,
  SetStateAction,
  useEffect,
  useRef,
} from 'react';

/** every tournament the player entered, as on the club page, each with how it went for them */
const TournamentResults: FC<{
  playerId: string;
  points: RatingPoint[];
  active: ActivePoint;
  setActive: Dispatch<SetStateAction<ActivePoint>>;
  chartRef: RefObject<HTMLDivElement | null>;
}> = ({ playerId, points, active, setActive, chartRef }) => {
  const t = useTranslations('Player.Page');
  const panelRef = useRef<HTMLElement>(null);
  const isColumnLayout = useMediaQuery('(min-width: 1024px)', false);
  const { data: stats } = usePlayerStats(playerId);
  const { rows, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePlayerResultRows(playerId, points);

  // the chart picked a point: bring its tournament into view. on a phone the
  // page is the scroller and the chart follows it instead, so nothing moves there
  useEffect(() => {
    if (active?.source !== 'chart' || !isColumnLayout) return;
    panelRef.current
      ?.querySelector(`[data-point="${active.index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, isColumnLayout]);

  // on a phone nothing hovers: the row passing under the pinned chart marks its point, if it has one
  useEffect(() => {
    const panel = panelRef.current;
    if (isColumnLayout || !panel) return;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pinnedBottom =
          chartRef.current?.getBoundingClientRect().bottom ?? 0;
        const point =
          panel.getBoundingClientRect().top < pinnedBottom
            ? [...panel.querySelectorAll<HTMLElement>('[data-row]')].find(
                (row) => row.getBoundingClientRect().bottom > pinnedBottom,
              )?.dataset.point
            : undefined;
        const index = point === undefined ? null : Number(point);
        setActive((current) =>
          index === null
            ? null
            : current?.source === 'table' && current.index === index
              ? current
              : { index, source: 'table' },
        );
      });
    };
    window.addEventListener('scroll', follow, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, { capture: true });
    };
  }, [isColumnLayout, setActive, chartRef]);

  return (
    <Section
      ref={panelRef}
      title={
        <>
          {t('tournaments')}
          <Count value={stats?.tournamentsPlayed} />
        </>
      }
      className="gap-0 lg:min-h-0 lg:flex-1"
    >
      <PanelScroller
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={<SkeletonList length={3} className="mt-2 h-16" />}
      >
        {!rows.length && <Empty>{t('noTournaments')}</Empty>}
        <TournamentMonths
          items={rows}
          getDate={({ tournament }) => tournament.date}
        >
          {(row) => (
            <ResultRow
              key={row.tournament.id}
              row={row}
              point={points[row.pointIndex ?? -1]}
              isActive={
                active?.source === 'chart' && active.index === row.pointIndex
              }
              setActive={setActive}
            />
          )}
        </TournamentMonths>
      </PanelScroller>
    </Section>
  );
};

/** the club page's tournament row, ending in how it went for the player and tied to the rating point it published. one that published none leaves the chart at rest */
const ResultRow: FC<{
  row: PlayerResultRow;
  point?: RatingPoint;
  isActive: boolean;
  setActive: Dispatch<SetStateAction<ActivePoint>>;
}> = ({ row, point, isActive, setActive }) => {
  const { tournament, pointIndex } = row;
  const state = getTournamentState(tournament);
  const mark = () =>
    setActive(
      pointIndex === null ? null : { index: pointIndex, source: 'table' },
    );

  return (
    <TournamentRow
      tournament={tournament}
      isRatedImplied={point?.delta != null}
      data-row
      data-point={pointIndex ?? undefined}
      onPointerEnter={(event) => event.pointerType === 'mouse' && mark()}
      onPointerLeave={(event) =>
        event.pointerType === 'mouse' && setActive(null)
      }
      onFocus={mark}
      onBlur={() => setActive(null)}
      className={cn(
        'focus-visible:bg-muted/50 scroll-mt-8 outline-none',
        isActive && 'bg-muted/50 transition-none',
      )}
    >
      {state !== 'upcoming' && (
        <ResultStats
          row={row}
          point={point}
          isFinished={state === 'finished'}
        />
      )}
    </TournamentRow>
  );
};

/** where the player finished, how they scored, and what it did to their rating. the rating itself is the chart's to show */
const ResultStats: FC<{
  row: PlayerResultRow;
  point?: RatingPoint;
  isFinished: boolean;
}> = ({ row: { unit, unitsCount }, point, isFinished }) => {
  const t = useTranslations('Player.Page');
  const place = isFinished ? unit.place : null;

  return (
    <>
      {place !== null && (
        <span
          className={cn(
            'whitespace-nowrap',
            place <= 3 && 'text-foreground font-medium',
          )}
        >
          {place <= 3 && (
            <Medal
              place={place}
              aria-hidden
              className="mr-1.5 inline-block size-2.5"
            />
          )}
          {t('place', { place, count: unitsCount })}
        </span>
      )}
      <ResultScore {...unit} />
      {point?.delta != null && (
        <RatingDelta value={point.delta} className="text-foreground" />
      )}
    </>
  );
};

export default TournamentResults;
