'use client';

import ClubCard from '@/app/[locale]/(routes)/clubs/club-card';
import DiscoverySearch from '@/components/discovery/discovery-search';
import LocationNotice from '@/components/discovery/location-notice';
import { ClubsMap } from '@/components/discovery/maps';
import NearMeControl from '@/components/discovery/near-me-control';
import { useNearFilter } from '@/components/discovery/use-near-filter';
import Empty from '@/components/empty';
import { useClubLocations } from '@/components/hooks/query-hooks/use-club-locations';
import { useClubs } from '@/components/hooks/query-hooks/use-clubs';
import { useDiscoveryParams } from '@/components/hooks/use-discovery-params';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscoveryView } from '@/lib/discovery-params';
import { List, Map as MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

export default function ClubsAllList() {
  const t = useTranslations('Discovery');
  const { params, setParams } = useDiscoveryParams();
  const { near, ready } = useNearFilter(params.radiusKm);
  const isMap = params.view === 'map';

  return (
    <div className="gap-mk flex w-full flex-col">
      <div className="gap-mk flex flex-col md:flex-row md:items-center">
        <DiscoverySearch
          value={params.search}
          onChange={(q) => setParams({ q })}
          placeholder={t('search clubs')}
          className="md:w-80"
        />
        <div className="flex items-center justify-between gap-2 md:flex-1">
          <NearMeControl
            radiusKm={params.radiusKm}
            onChange={(radius) =>
              setParams({ near: radius ? String(radius) : null })
            }
          />
          <ViewToggle
            view={params.view}
            onChange={(view) =>
              setParams({ view: view === 'map' ? view : null })
            }
          />
        </div>
      </div>
      <LocationNotice radiusKm={params.radiusKm} />
      {isMap ? (
        <div className="gap-mk flex flex-col md:grid md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="h-[60dvh] overflow-hidden rounded-lg border md:sticky md:top-4 md:order-last md:h-[calc(100dvh-12rem)]">
            <ClubsMapView search={params.search} />
          </div>
          <ClubsList
            input={{ search: params.search, ...near }}
            enabled={ready}
            radiusKm={near.radiusKm}
            compact
          />
        </div>
      ) : (
        <ClubsList
          input={{ search: params.search, ...near }}
          enabled={ready}
          radiusKm={near.radiusKm}
        />
      )}
    </div>
  );
}

const ViewToggle: FC<{
  view: DiscoveryView;
  onChange: (view: DiscoveryView) => void;
}> = ({ view, onChange }) => {
  const t = useTranslations('Discovery');
  return (
    <Tabs
      value={view}
      onValueChange={(value) => onChange(value as DiscoveryView)}
    >
      <TabsList className="h-8 px-1">
        <TabsTrigger value="list" className="h-full gap-1.5 px-2 text-xs">
          <List className="size-3.5" />
          {t('list')}
        </TabsTrigger>
        <TabsTrigger value="map" className="h-full gap-1.5 px-2 text-xs">
          <MapIcon className="size-3.5" />
          {t('map')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

const ClubsMapView: FC<{ search?: string }> = ({ search }) => {
  const t = useTranslations('Discovery');
  const { data: locations, isPending } = useClubLocations(search);
  if (!isPending && !locations?.length) {
    return (
      <div className="bg-muted flex size-full items-center justify-center p-4">
        <Empty>{t('no located clubs')}</Empty>
      </div>
    );
  }
  return <ClubsMap clubs={locations ?? []} />;
};

const ClubsList: FC<{
  input: Parameters<typeof useClubs>[0];
  enabled: boolean;
  radiusKm?: number;
  compact?: boolean;
}> = ({ input, enabled, radiusKm, compact }) => {
  const t = useTranslations('Discovery');
  const {
    data: clubs,
    fetchNextPage,
    hasNextPage,
    isPending,
    isFetchingNextPage,
  } = useClubs(input, enabled);

  if (isPending || !clubs) return <ClubsAllSkeletonList />;

  const items = clubs.pages.flatMap((page) => page.clubs);
  if (!items.length && !hasNextPage) {
    if (radiusKm) return <Empty>{t('no nearby', { radius: radiusKm })}</Empty>;
    if (input?.search) return <Empty>{t('no results')}</Empty>;
    return <Empty messageId="clubs" />;
  }

  return (
    <div className="flex flex-col">
      <div
        className={
          compact
            ? 'mk-list'
            : 'gap-mk grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }
      >
        {items.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={<ClubsAllSkeletonList length={3} />}
      />
    </div>
  );
};

const ClubsAllSkeletonList: FC<SkeletonListProps> = ({ length }) => (
  <SkeletonList length={length} className="h-40" />
);
