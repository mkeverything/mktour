'use client';

import ClubsIteratee from '@/app/clubs/all/clubs-list';
import Empty from '@/components/empty';
import { useClubs } from '@/components/hooks/query-hooks/use-clubs';
import SkeletonList from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';

export default function ClubsAllList() {
  const {
    data: clubs,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useClubs();

  if (isLoading) return <SkeletonList className="h-18.5" />;

  if (!clubs?.pages[0].clubs.length) {
    return (
      <div className="mk-list">
        <Empty messageId="clubs" />
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
      <Paginator
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
}
