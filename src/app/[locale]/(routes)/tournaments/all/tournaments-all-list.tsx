'use client';

import TournamentListItem from '@/app/[locale]/(routes)/tournaments/all/tournament-list-item';
import {
  hasActiveFilters,
  RESET_FILTERS,
  TournamentFilterChips,
  TournamentFilterSidebar,
} from '@/app/[locale]/(routes)/tournaments/all/tournament-filters';
import TournamentStatusTabs from '@/app/[locale]/(routes)/tournaments/all/tournament-status-tabs';
import DiscoverySearch from '@/components/discovery/discovery-search';
import LocationNotice from '@/components/discovery/location-notice';
import { useNearFilter } from '@/components/discovery/use-near-filter';
import Empty from '@/components/empty';
import { useTournamentStatusCounts } from '@/components/hooks/query-hooks/use-tournament-status-counts';
import { useTournaments } from '@/components/hooks/query-hooks/use-tournaments';
import { useDiscoveryParams } from '@/components/hooks/use-discovery-params';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

export default function TournamentsAllList() {
  const t = useTranslations('Discovery');
  const { params, setParams } = useDiscoveryParams();
  const { near, ready } = useNearFilter(params.radiusKm);
  const filters = {
    format: params.format,
    type: params.type,
    rated: params.rated,
    search: params.search,
    ...near,
  };
  const { data: counts } = useTournamentStatusCounts(filters, ready);

  return (
    <div className="gap-mk flex flex-col md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
      <div className="hidden md:block">
        <div className="sticky top-4">
          <TournamentFilterSidebar params={params} setParams={setParams} />
        </div>
      </div>
      <div className="gap-mk flex min-w-0 flex-col">
        <div className="gap-mk flex flex-col lg:flex-row-reverse lg:items-center">
          <DiscoverySearch
            value={params.search}
            onChange={(q) => setParams({ q })}
            placeholder={t('search tournaments')}
            className="lg:w-72 lg:shrink-0"
          />
          <TournamentStatusTabs
            status={params.status}
            counts={counts}
            onChange={(status) => setParams({ status })}
            className="lg:flex-1"
          />
        </div>
        <div className="md:hidden">
          <TournamentFilterChips params={params} setParams={setParams} />
        </div>
        <LocationNotice radiusKm={params.radiusKm} />
        <TournamentsList
          input={{ ...filters, status: params.status }}
          enabled={ready}
          radiusKm={near.radiusKm}
          onReset={
            hasActiveFilters(params)
              ? () => setParams(RESET_FILTERS)
              : undefined
          }
        />
      </div>
    </div>
  );
}

const TournamentsList: FC<{
  input: Parameters<typeof useTournaments>[0];
  enabled: boolean;
  radiusKm?: number;
  onReset?: () => void;
}> = ({ input, enabled, radiusKm, onReset }) => {
  const t = useTranslations('Discovery');
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isPending,
    isFetchingNextPage,
  } = useTournaments(input, enabled);

  if (isPending || !tournaments) return <TournamentsAllSkeletonList />;

  const items = tournaments.pages.flatMap((page) => page.tournaments);
  if (!items.length && !hasNextPage) {
    return (
      <div className="flex flex-col items-center gap-2">
        {onReset ? (
          <Empty>
            {radiusKm ? t('no nearby', { radius: radiusKm }) : t('no results')}
          </Empty>
        ) : (
          <Empty messageId="tournaments" />
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            {t('reset filters')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mk-list md:gap-0 md:rounded-lg md:border">
      <div className="text-muted-foreground hidden grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,13rem)] gap-4 border-b px-4 py-2 text-xs md:grid">
        <span>{t('when')}</span>
        <span>{t('tournament')}</span>
        <span>{t('players')}</span>
        <span>{t('result')}</span>
      </div>
      {items.map((item) => (
        <TournamentListItem key={item.tournament.id} item={item} />
      ))}
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={<TournamentsAllSkeletonList length={3} />}
      />
    </div>
  );
};

const TournamentsAllSkeletonList: FC<SkeletonListProps> = ({ length }) => (
  <SkeletonList length={length} className="h-28 md:h-14" />
);
