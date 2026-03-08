'use client';

import ClubsIteratee from '@/app/clubs/all/clubs-list';
import Empty from '@/components/empty';
import { useClubs } from '@/components/hooks/query-hooks/use-clubs';
import useOnReach from '@/components/hooks/use-on-reach';
import SkeletonList from '@/components/skeleton-list';

export default function ClubsAllList() {
  const {
    data: clubs,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useClubs();

  const ref = useOnReach(fetchNextPage);

  if (isLoading) {
    return (
      <div className="mk-list">
        <SkeletonList />
      </div>
    );
  }

  if (!clubs?.pages[0].clubs.length) {
    return (
      <div className="mk-list">
        <Empty>no clubs yet</Empty>
      </div>
    );
  }

  return (
    <div className="mk-list">
      {clubs.pages.map((page) => (
        <div key={page.nextCursor ?? 'first'} className="mk-list pb-0">
          <ClubsIteratee clubs={page.clubs} />
        </div>
      ))}
      {isFetchingNextPage && <SkeletonList />}
      {hasNextPage && <div ref={ref} />}
    </div>
  );
}
