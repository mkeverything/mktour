'use client';

import Empty from '@/components/empty';
import { useTournaments } from '@/components/hooks/query-hooks/use-tournaments';
import SkeletonList from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';
import Paginator from '@/components/ui-custom/paginator';

export default function TournamentsAllList() {
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useTournaments();

  if (isLoading) return skeletonList;

  if (!tournaments?.pages[0].tournaments.length) {
    return <Empty messageId="tournaments" />;
  }

  return (
    <div className="mk-list">
      {tournaments.pages.map((page) => (
        <div key={page.nextCursor ?? 'first'} className="mk-list pb-0">
          {page.tournaments.map((props) => (
            <TournamentItemIteratee key={props.tournament.id} {...props} />
          ))}
        </div>
      ))}
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={skeletonList}
      />
    </div>
  );
}

const skeletonList = <SkeletonList className="h-26 sm:h-22" />;
