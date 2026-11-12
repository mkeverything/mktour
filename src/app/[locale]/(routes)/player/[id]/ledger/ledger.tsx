'use client';

import { turboPascal } from '@/app/fonts';
import { Count } from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import PlayerFacts from '@/app/[locale]/(routes)/player/[id]/player-facts';
import PlayingNow from '@/app/[locale]/(routes)/player/[id]/playing-now';
import ProvisionalMark from '@/app/[locale]/(routes)/player/[id]/provisional-mark';
import type { PlayerPageDesignProps } from '@/app/[locale]/(routes)/player/[id]/player-page-props';
import RatingDelta from '@/app/[locale]/(routes)/player/[id]/rating-delta';
import RecordSummary from '@/app/[locale]/(routes)/player/[id]/record-summary';
import {
  LiveRound,
  ResultScore,
} from '@/app/[locale]/(routes)/player/[id]/result-parts';
import { getTournamentState } from '@/app/[locale]/(routes)/player/[id]/tournament-state';
import { useMockRivals } from '@/app/[locale]/(routes)/player/[id]/use-mock-rivals';
import { usePlayerRating } from '@/app/[locale]/(routes)/player/[id]/use-player-rating';
import { useRatingPointLabel } from '@/app/[locale]/(routes)/player/[id]/use-rating-point-label';
import {
  usePlayerResultRows,
  type PlayerResultRow,
} from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import {
  usePlayerAuthStats,
  usePlayerStats,
} from '@/components/hooks/query-hooks/use-player-stats';
import { useTournamentTitle } from '@/components/hooks/use-tournament-fallback-title';
import { useMediaQuery } from '@/components/providers/media-query-provider';
import RatingChart from '@/components/rating-chart';
import Paginator from '@/components/ui-custom/paginator';
import { toDate } from '@/lib/local-date';
import { getIndexAt, type RatingPoint } from '@/lib/rating-chart';
import { cn } from '@/lib/utils';
import type { PlayerModel } from '@/server/zod/players';
import { ChevronLeft } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Dispatch,
  FC,
  PropsWithChildren,
  ReactNode,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
// day, title, place, score, rating, change; on a phone the title and the change, then a second line
const ROW_GRID =
  'px-mk-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 lg:grid-cols-[1.5rem_minmax(0,1fr)_7rem_6rem_3rem_3rem] lg:px-6';

// who picked the highlighted rating point: the table follows the chart, never itself
type Active = { index: number; source: 'chart' | 'table' } | null;

/**
 * the whole record on one screen. the chart and the
 * tournaments under it are one series, so pointing at either marks the other
 */
const Ledger: FC<PlayerPageDesignProps> = ({ player, club, actions }) => {
  const t = useTranslations('Player.Page');
  const { points, latest, peak, joinedAt } = usePlayerRating(player.id);
  const [active, setActive] = useState<Active>(null);
  const facts = (
    <PlayerFacts playerId={player.id} peak={peak} joinedAt={joinedAt} />
  );

  return (
    <div
      data-fixed-viewport
      className="lg:h-mk-content-height flex w-full flex-col pb-20 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden lg:pb-0 xl:grid-cols-[18rem_minmax(0,1fr)_19rem] xl:grid-rows-[minmax(0,1fr)]"
    >
      <header className="p-mk-2 lg:small-scrollbar order-1 grid grid-cols-[minmax(0,1fr)_auto] content-start items-center gap-x-4 gap-y-3 lg:flex lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-y-auto lg:border-r lg:p-6">
        <Link
          href={`/clubs/${club.id}`}
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-w-0 items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="truncate">{club.name}</span>
        </Link>
        <div className="flex min-h-9 items-center gap-2 lg:order-last lg:mt-auto lg:pt-6">
          {actions}
        </div>
        <div className="flex min-w-0 flex-col gap-1 self-start lg:mt-8">
          <h1
            className={cn(
              turboPascal.className,
              'text-2xl leading-tight text-balance break-words sm:text-3xl',
            )}
          >
            {player.nickname}
          </h1>
          {player.realname && (
            <span className="text-muted-foreground text-sm">
              {player.realname}
            </span>
          )}
        </div>
        <span className="self-start text-5xl leading-none font-semibold tracking-tighter tabular-nums lg:mt-10 lg:text-6xl">
          {player.rating}
          {!player.isEstablished && <ProvisionalMark />}
        </span>
        <Standing player={player} latest={latest} />
        <PlayingNow playerId={player.id} className="col-span-2 lg:mt-6" />
        <div className="mt-8 border-t pt-6 max-lg:hidden">{facts}</div>
      </header>
      <History
        playerId={player.id}
        points={points}
        active={active}
        setActive={setActive}
      />
      <aside className="lg:small-scrollbar max-lg:contents lg:order-3 lg:flex lg:flex-col lg:gap-8 lg:overflow-y-auto lg:border-t lg:border-r lg:p-6 xl:border-t-0 xl:border-r-0 xl:border-l">
        <VsYou player={player} />
        <Record playerId={player.id} />
        <Rivals player={player} />
        <Block title={t('facts')} className="order-6 lg:hidden">
          {facts}
        </Block>
      </aside>
    </div>
  );
};

const Standing: FC<{ player: PlayerModel; latest?: RatingPoint }> = ({
  player,
  latest,
}) => {
  const t = useTranslations('Player.Page');
  const getLabel = useRatingPointLabel();
  const { data: stats } = usePlayerStats(player.id);
  const { data: clubStats } = useClubStats(player.clubId);

  return (
    <div className="col-span-2 flex items-baseline justify-between gap-4 text-sm lg:mt-3 lg:flex-col lg:items-stretch lg:gap-1">
      {stats?.ratingRank && clubStats && (
        <span className="shrink-0 tabular-nums">
          {t('rank', { rank: stats.ratingRank, count: clubStats.playersCount })}
        </span>
      )}
      <span className="text-muted-foreground flex min-w-0 items-baseline gap-2 text-xs">
        {latest?.delta != null && (
          <RatingDelta
            value={latest.delta}
            className="text-foreground text-sm font-medium"
          />
        )}
        <span className="truncate">
          {latest ? getLabel(latest) : t('starting')}
        </span>
      </span>
    </div>
  );
};

const History: FC<{
  playerId: string;
  points: RatingPoint[];
  active: Active;
  setActive: Dispatch<SetStateAction<Active>>;
}> = ({ playerId, points, active, setActive }) => {
  const t = useTranslations('Player');
  const getLabel = useRatingPointLabel();
  const [range, setRange] = useState<'year' | 'all'>('all');
  const point = active && points[active.index];
  const hasHistory = points.length > 1;
  const isLongHistory =
    hasHistory &&
    points[points.length - 1].publishedAt.getTime() -
      points[0].publishedAt.getTime() >
      YEAR_MS;

  return (
    <section className="order-3 flex min-w-0 flex-col max-lg:border-t lg:order-2 lg:row-span-2 lg:min-h-0 xl:row-span-1">
      {hasHistory ? (
        <div className="bg-background/85 px-mk-2 top-mk-navbar-total-height sticky z-20 flex flex-col gap-1 border-b pt-3 pb-2 backdrop-blur-md lg:static lg:gap-2 lg:bg-transparent lg:px-6 lg:pt-5 lg:pb-4 lg:backdrop-blur-none">
          <div className="flex h-7 items-center justify-between gap-4 text-xs">
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
              <h2 className="text-muted-foreground font-normal">
                {t('Rating.history')}
              </h2>
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
                      'focus-visible:ring-ring/50 rounded-md px-2.5 py-1 transition-colors outline-none focus-visible:ring-[3px]',
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
            className="h-32 lg:h-64"
          />
        </div>
      ) : (
        <p className="text-muted-foreground px-mk-2 border-b py-5 text-sm text-balance lg:px-6">
          {t('Page.noRatedTournaments')}
        </p>
      )}
      <Tournaments
        playerId={playerId}
        points={points}
        active={active}
        setActive={setActive}
      />
    </section>
  );
};

const Tournaments: FC<{
  playerId: string;
  points: RatingPoint[];
  active: Active;
  setActive: Dispatch<SetStateAction<Active>>;
}> = ({ playerId, points, active, setActive }) => {
  const t = useTranslations('Player.Page');
  const tPlayer = useTranslations('Player');
  const format = useFormatter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isColumnLayout = useMediaQuery('(min-width: 1024px)', false);
  const { data: stats } = usePlayerStats(playerId);
  const { rows, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePlayerResultRows(playerId, points);

  // the chart picked a point: bring its tournament into view. on a phone the
  // page is the scroller and the chart follows it instead, so nothing moves there
  useEffect(() => {
    if (active?.source !== 'chart' || !isColumnLayout) return;
    scrollerRef.current
      ?.querySelector(`[data-point="${active.index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, isColumnLayout]);

  // on a phone nothing hovers: the row passing under the pinned chart marks its point
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (isColumnLayout || !scroller) return;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pinnedBottom =
          scroller.previousElementSibling?.getBoundingClientRect().bottom ?? 0;
        const index =
          scroller.getBoundingClientRect().top < pinnedBottom
            ? [
                ...scroller.querySelectorAll<HTMLElement>('[data-in-force]'),
              ].find((row) => row.getBoundingClientRect().bottom > pinnedBottom)
                ?.dataset.inForce
            : undefined;
        setActive((current) =>
          index === undefined
            ? null
            : current?.source === 'table' && current.index === Number(index)
              ? current
              : { index: Number(index), source: 'table' },
        );
      });
    };
    window.addEventListener('scroll', follow, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, { capture: true });
    };
  }, [isColumnLayout, setActive]);

  const months = new Map<string, PlayerResultRow[]>();
  for (const row of rows) {
    const month = row.tournament.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), row]);
  }
  const thisYear = new Date().getFullYear();

  return (
    <div
      ref={scrollerRef}
      className="small-scrollbar flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
    >
      <div
        className={cn(
          ROW_GRID,
          'text-muted-foreground pt-5 pb-1 text-xs lg:text-right',
        )}
      >
        <h2 className="col-span-2 flex items-baseline gap-1.5 text-left font-normal">
          {t('tournaments')}
          <Count value={stats?.tournamentsPlayed} />
        </h2>
        <span className="max-lg:hidden">{t('columnPlace')}</span>
        <span className="max-lg:hidden">+ = −</span>
        <span className="max-lg:hidden">{tPlayer('rating')}</span>
        <span className="max-lg:hidden">±</span>
      </div>
      {!rows.length && (
        <p className="text-muted-foreground px-mk-2 py-3 text-sm lg:px-6">
          {t('noTournaments')}
        </p>
      )}
      {[...months].map(([month, monthRows]) => {
        const date = toDate(`${month}-01`);
        return (
          <section key={month}>
            <h3 className="bg-background text-muted-foreground px-mk-2 z-10 flex h-8 items-end pb-1.5 text-xs lowercase lg:sticky lg:top-0 lg:px-6">
              {format.dateTime(date, {
                month: 'long',
                year: date.getFullYear() === thisYear ? undefined : 'numeric',
              })}
            </h3>
            <ul className="divide-y border-y">
              {monthRows.map((row) => {
                const state = getTournamentState(row.tournament);
                // an unrated tournament still happened at some rating: the one in force then
                const inForce =
                  state !== 'finished' || !points.length
                    ? undefined
                    : (row.pointIndex ??
                      getIndexAt(
                        points,
                        row.tournament.closedAt?.getTime() ?? 0,
                      ));
                return (
                  <li key={row.tournament.id}>
                    <TournamentRow
                      row={row}
                      point={points[row.pointIndex ?? -1]}
                      inForce={inForce}
                      isActive={
                        active?.source === 'chart' &&
                        active.index === row.pointIndex
                      }
                      setActive={setActive}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        root={isColumnLayout ? scrollerRef : undefined}
      />
    </div>
  );
};

const TournamentRow: FC<{
  row: PlayerResultRow;
  point?: RatingPoint;
  inForce?: number;
  isActive: boolean;
  setActive: Dispatch<SetStateAction<Active>>;
}> = ({
  row: { tournament, unit, unitsCount, pointIndex },
  point,
  inForce,
  isActive,
  setActive,
}) => {
  const t = useTranslations('Player.Page');
  const tTournament = useTranslations('MakeTournament');
  const format = useFormatter();
  const getTitle = useTournamentTitle();
  const state = getTournamentState(tournament);
  const meta = [
    tTournament(tournament.format),
    tournament.type !== 'solo' && tTournament(`Types.${tournament.type}`),
    !tournament.isRated && tTournament('unrated'),
  ]
    .filter(Boolean)
    .join(' · ');
  const day = format.dateTime(toDate(tournament.date), { day: 'numeric' });
  const mark = () =>
    setActive(
      inForce === undefined ? null : { index: inForce, source: 'table' },
    );

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      data-point={pointIndex ?? undefined}
      data-in-force={inForce}
      onPointerEnter={(event) => event.pointerType === 'mouse' && mark()}
      onPointerLeave={(event) =>
        event.pointerType === 'mouse' && setActive(null)
      }
      onFocus={mark}
      onBlur={() => setActive(null)}
      className={cn(
        ROW_GRID,
        'hover:bg-muted/60 active:bg-muted focus-visible:bg-muted/60 scroll-mt-8 gap-y-0.5 py-2.5 text-sm outline-none',
        isActive && 'bg-muted/60',
        state === 'upcoming' && 'text-muted-foreground',
      )}
    >
      <span className="text-muted-foreground text-xs tabular-nums max-lg:hidden">
        {day}
      </span>
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="truncate font-medium">{getTitle(tournament)}</span>
        <span className="text-muted-foreground shrink-0 text-xs max-lg:hidden">
          {meta}
        </span>
      </span>
      <span className="text-muted-foreground col-span-2 row-start-2 flex items-baseline justify-between gap-4 text-xs lg:contents lg:text-sm">
        <span className="truncate lg:hidden">
          {day} · {meta}
        </span>
        <span className="flex shrink-0 items-baseline gap-3 lg:contents">
          <span
            className={cn(
              'lg:text-right',
              state === 'finished' &&
                unit.place &&
                unit.place <= 3 &&
                'text-foreground font-medium',
            )}
          >
            {state === 'upcoming' && t('upcoming')}
            {state === 'live' && <LiveRound tournament={tournament} />}
            {state === 'finished' &&
              unit.place &&
              t('place', { place: unit.place, count: unitsCount })}
          </span>
          <span className="lg:text-right">
            {state !== 'upcoming' && <ResultScore {...unit} />}
          </span>
        </span>
      </span>
      <span className="text-muted-foreground text-right tabular-nums max-lg:hidden">
        {point?.rating}
      </span>
      <span className="col-start-2 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
        {point?.delta != null && <RatingDelta value={point.delta} />}
      </span>
    </Link>
  );
};

const Block: FC<
  PropsWithChildren<{
    title: ReactNode;
    detail?: ReactNode;
    className?: string;
  }>
> = ({ title, detail, className, children }) => (
  <section
    className={cn(
      'px-mk-2 flex flex-col gap-4 py-5 max-lg:border-t lg:p-0',
      className,
    )}
  >
    <h2 className="text-muted-foreground flex items-baseline justify-between gap-4 text-xs font-normal">
      <span className="flex min-w-0 items-baseline gap-1.5">{title}</span>
      <span className="shrink-0">{detail}</span>
    </h2>
    {children}
  </section>
);

const VsYou: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player.Page');
  const { data: score } = usePlayerAuthStats(player.id);
  if (!score) return null;
  const record = {
    wins: score.userWins,
    draws: score.draws,
    losses: score.playerWins,
  };

  return (
    <Block
      title={
        <span className="truncate">
          {t('vsYou', { player: player.nickname })}
        </span>
      }
      detail={t('games', {
        count: record.wins + record.draws + record.losses,
      })}
      className="order-2"
    >
      <RecordSummary {...record} />
    </Block>
  );
};

const Record: FC<{ playerId: string }> = ({ playerId }) => {
  const t = useTranslations('Player.Page');
  const { data: stats } = usePlayerStats(playerId);
  if (!stats?.gamesPlayed) return null;
  const record = {
    wins: stats.gamesWon,
    draws: stats.gamesDrawn,
    losses: stats.gamesLost,
  };

  return (
    <Block
      title={
        <>
          {t('record')}
          <Count value={stats.gamesPlayed} />
        </>
      }
      detail={t('score', {
        percent: Math.round(
          ((record.wins + record.draws / 2) / stats.gamesPlayed) * 100,
        ),
      })}
      className="order-4"
    >
      <RecordSummary {...record} />
    </Block>
  );
};

const Rivals: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player.Page');
  const { data: stats } = usePlayerStats(player.id);
  const rivals = useMockRivals(player);
  if (!stats?.gamesPlayed || !rivals.length) return null;

  return (
    <Block
      title={t('rivals')}
      detail={
        <span className="rounded-sm border border-dashed px-1.5 py-0.5">
          {t('mock')}
        </span>
      }
      className="order-5"
    >
      <ul className="-my-1 flex flex-col divide-y text-sm">
        {rivals.map(({ opponent, ...score }) => (
          <li key={opponent.id}>
            <Link
              href={`/player/${opponent.id}`}
              className="group flex items-baseline justify-between gap-4 py-2"
            >
              <span className="truncate underline-offset-4 group-hover:underline">
                {opponent.nickname}
                <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                  {opponent.rating}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                <ResultScore {...score} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
};

export default Ledger;
