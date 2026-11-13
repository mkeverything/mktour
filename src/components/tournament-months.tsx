import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import { toDate } from '@/lib/local-date';
import { cn } from '@/lib/utils';
import { TournamentModel } from '@/server/zod/tournaments';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ComponentProps, FC, ReactNode } from 'react';

/** tournaments newest first, a card of rows for each month */
export const TournamentMonths = <T,>({
  items,
  getDate,
  children: renderRow,
}: {
  items: T[];
  getDate: (item: T) => string;
  children: (item: T) => ReactNode;
}) => {
  const months = new Map<string, T[]>();
  for (const item of items.toSorted((a, b) =>
    getDate(b).localeCompare(getDate(a)),
  )) {
    const month = getDate(item).slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), item]);
  }

  return [...months].map(([month, monthItems]) => (
    <section key={month} className="not-first:mt-2">
      <MonthHeading month={month} />
      <div className="bg-card divide-y overflow-hidden rounded-xl border">
        {monthItems.map((item) => renderRow(item))}
      </div>
    </section>
  ));
};

const MonthHeading: FC<{ month: string }> = ({ month }) => {
  const format = useFormatter();
  const date = toDate(`${month}-01`);
  const isThisYear = date.getFullYear() === new Date().getFullYear();

  return (
    <h3 className="bg-background text-muted-foreground sticky top-(--list-sticky-top) z-10 flex h-8 items-center text-xs lowercase">
      {format.dateTime(date, {
        month: 'long',
        year: isThisYear ? undefined : 'numeric',
      })}
    </h3>
  );
};

/** a tournament in a month's card: what it is and when, then what kind it is, with whatever its context adds at the end of that line */
export const TournamentRow: FC<
  {
    tournament: TournamentModel;
    /** the context shows what the tournament did to a rating, so the row need not say it was rated */
    isRatedImplied?: boolean;
  } & Omit<ComponentProps<typeof Link>, 'href'>
> = ({ tournament, isRatedImplied, className, children, ...props }) => {
  const t = useTranslations('MakeTournament');
  const format = useFormatter();
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const isLive = Boolean(tournament.startedAt && !tournament.closedAt);
  const details = [
    tournament.isRated ? !isRatedImplied && t('rated') : t('unrated'),
    t(tournament.format),
    t(`Types.${tournament.type}`),
  ].filter(Boolean);

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className={cn(
        'hover:bg-muted/50 active:bg-muted grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 py-3 transition-colors active:transition-none',
        className,
      )}
      {...props}
    >
      <span className="line-clamp-2 text-sm font-medium break-words">
        {tournament.title || fallbackTitle}
      </span>
      <span className="text-xs">
        {isLive ? (
          <LiveRound tournament={tournament} />
        ) : (
          <span className="text-muted-foreground lowercase tabular-nums">
            {format.dateTime(toDate(tournament.date), {
              day: 'numeric',
              month: 'long',
            })}
          </span>
        )}
      </span>
      <span className="text-muted-foreground col-span-full flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs">
        <span>{details.join(' · ')}</span>
        {children && (
          <span className="ml-auto flex items-baseline gap-3 tabular-nums">
            {children}
          </span>
        )}
      </span>
    </Link>
  );
};

export const LiveRound: FC<{
  tournament: Pick<TournamentModel, 'ongoingRound' | 'roundsNumber'>;
}> = ({ tournament }) => {
  const t = useTranslations('Club.Page');
  return (
    <span className="whitespace-nowrap">
      <span className="bg-destructive mr-1.5 inline-block size-1.5 animate-pulse rounded-full align-middle motion-reduce:animate-none" />
      {t('roundOf', {
        round: tournament.ongoingRound,
        rounds: tournament.roundsNumber,
      })}
    </span>
  );
};
