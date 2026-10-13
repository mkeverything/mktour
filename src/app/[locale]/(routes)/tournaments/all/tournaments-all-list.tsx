'use client';

import Empty from '@/components/empty';
import { useTournaments } from '@/components/hooks/query-hooks/use-tournaments';
import SkeletonList, { SkeletonListProps } from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';
import Paginator from '@/components/ui-custom/paginator';
import { FC } from 'react';

export default function TournamentsAllList() {
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useTournaments();

  if (isLoading) return <TournamentsAllSkeletonList />;

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
        skeleton={<TournamentsAllSkeletonList length={3} />}
      />
    </div>
  );
}

const TournamentsAllSkeletonList: FC<SkeletonListProps> = ({ length }) => (
  <SkeletonList length={length} className="h-26 sm:h-22" />
);
