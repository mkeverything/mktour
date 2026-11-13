'use client';

import {
  BestVictories,
  MostPlayed,
} from '@/app/[locale]/(routes)/player/[id]/ledger/opponents';
import RatingHistory from '@/app/[locale]/(routes)/player/[id]/ledger/rating-history';
import {
  Games,
  VsYou,
} from '@/app/[locale]/(routes)/player/[id]/ledger/records';
import TournamentResults from '@/app/[locale]/(routes)/player/[id]/ledger/tournament-results';
import type { PlayerPageDesignProps } from '@/app/[locale]/(routes)/player/[id]/player-page-props';
import PlayingNow from '@/app/[locale]/(routes)/player/[id]/playing-now';
import ProvisionalMark from '@/app/[locale]/(routes)/player/[id]/provisional-mark';
import RatingDelta from '@/app/[locale]/(routes)/player/[id]/rating-delta';
import { usePlayerRating } from '@/app/[locale]/(routes)/player/[id]/use-player-rating';
import { usePlayerResultRows } from '@/app/[locale]/(routes)/player/[id]/use-player-results-rows';
import { turboPascal } from '@/app/fonts';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import SidebarLayout from '@/components/sidebar-layout';
import type { RatingPoint } from '@/lib/rating-chart';
import { cn } from '@/lib/utils';
import type { PlayerModel } from '@/server/zod/players';
import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode, useRef, useState } from 'react';

// who picked the highlighted rating point: the list follows the chart, never itself
export type ActivePoint = {
  index: number;
  source: 'chart' | 'table';
} | null;

/**
 * laid out like the club page, a column for each question: who the player is,
 * how they got here, and who they play. the chart and the tournaments are one
 * series, so pointing at either marks the other
 */
const Ledger: FC<PlayerPageDesignProps> = ({ player, club, edit, actions }) => {
  const { points, latest } = usePlayerRating(player.id);
  const { rows, isPending } = usePlayerResultRows(player.id, points);
  const [active, setActive] = useState<ActivePoint>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const isNew = !isPending && !rows.length && points.length < 2;

  return (
    <SidebarLayout
      sidebar={
        <div className="flex flex-col gap-8">
          <Identity
            player={player}
            club={club}
            edit={edit}
            actions={actions}
            latest={latest}
          />
          <Games playerId={player.id} />
          <VsYou player={player} />
        </div>
      }
    >
      {isNew ? (
        <NothingYet />
      ) : (
        <div className="flex flex-col gap-8 max-lg:pt-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* the endless list goes last on a phone, under its chart pinned to the top. the two are one series, so they sit closer than sections do */}
          <div className="flex min-w-0 flex-col gap-4 max-lg:order-last lg:min-h-0 lg:[--list-sticky-top:-1px]">
            <RatingHistory
              ref={chartRef}
              points={points}
              active={active}
              setActive={setActive}
            />
            <TournamentResults
              playerId={player.id}
              points={points}
              active={active}
              setActive={setActive}
              chartRef={chartRef}
            />
          </div>
          <div className="lg:small-scrollbar flex min-w-0 flex-col gap-8 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            <MostPlayed player={player} />
            <BestVictories player={player} />
          </div>
        </div>
      )}
    </SidebarLayout>
  );
};

// a player who has entered nothing has one thing to say, so it is said once, where the eye lands
const NothingYet: FC = () => {
  const t = useTranslations('Player.Page');
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center text-sm">
      <h2 className="font-medium">{t('noTournaments')}</h2>
      <p className="text-muted-foreground max-w-xs text-balance">
        {t('noTournamentsHint')}
      </p>
    </div>
  );
};

const Identity: FC<PlayerPageDesignProps & { latest?: RatingPoint }> = ({
  player,
  club,
  edit,
  actions,
  latest,
}) => (
  <div className="flex flex-col gap-5 lg:gap-6">
    <ClubCard club={club} />
    {/* claiming the player is a claim on the name, so it sits under it */}
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h1
            className={cn(
              turboPascal.className,
              'min-w-0 text-2xl leading-tight text-balance break-words md:text-3xl',
            )}
          >
            {player.nickname}
          </h1>
          {edit && <div className="-mt-0.5 -mr-2.5 shrink-0">{edit}</div>}
        </div>
        {player.realname && (
          <span className="text-muted-foreground text-sm">
            {player.realname}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 empty:hidden">{actions}</div>
    </div>
    <Standing player={player} latest={latest} />
    <PlayingNow playerId={player.id} />
  </div>
);

/**
 * the club holds the player: their rating, rank and tournaments are all its own, so it heads the column.
 * it is drawn like the tournament cards, and its name's first line sits level with the other columns' headings
 */
const ClubCard: FC<Pick<PlayerPageDesignProps, 'club'>> = ({ club }) => (
  <Link
    href={`/clubs/${club.id}`}
    className="bg-card hover:bg-muted/50 active:bg-muted flex min-h-9 items-center gap-3 rounded-xl border px-3 py-1.75 text-balance transition-colors active:transition-none"
  >
    <Home aria-hidden className="text-muted-foreground size-5 shrink-0" />
    <span className="line-clamp-2 min-w-0 text-sm font-medium break-words">
      {club.name}
    </span>
  </Link>
);

// a pair of figures labelled like the records under them, so the name alone stands out
const Standing: FC<{ player: PlayerModel; latest?: RatingPoint }> = ({
  player,
  latest,
}) => {
  const t = useTranslations('Player');
  const { data: stats } = usePlayerStats(player.id);
  const { data: clubStats } = useClubStats(player.clubId);

  return (
    <dl className="grid grid-cols-2 gap-4">
      <Fact
        label={t('rating')}
        value={
          <>
            {player.rating}
            {!player.isEstablished && <ProvisionalMark />}
          </>
        }
        note={latest?.delta != null && <RatingDelta value={latest.delta} />}
      />
      {stats?.ratingRank && clubStats && (
        <Fact
          label={t('Page.clubRank')}
          value={stats.ratingRank}
          note={t('Page.outOf', { count: clubStats.playersCount })}
        />
      )}
    </dl>
  );
};

const Fact: FC<{ label: string; value: ReactNode; note: ReactNode }> = ({
  label,
  value,
  note,
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {note && <span className="text-muted-foreground text-sm">{note}</span>}
    </dd>
  </div>
);

export default Ledger;
