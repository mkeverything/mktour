'use client';

import Empty from '@/components/empty';
import { useTournaments } from '@/components/hooks/query-hooks/use-tournaments';
import useOnReach from '@/components/hooks/use-on-reach';
import SkeletonList from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';

export default function TournamentsAllList() {
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useTournaments();

  const ref = useOnReach(fetchNextPage);

  if (isLoading) {
    return <SkeletonList />;
  }

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
      {isFetchingNextPage && <SkeletonList />}
      {hasNextPage && <div ref={ref} />}
    </div>
  );
}
