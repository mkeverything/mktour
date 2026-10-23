import SkeletonList from '@/components/skeleton-list';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mk-container flex flex-col gap-2">
      <Skeleton className="ml-2 h-4 w-48" />
      <SkeletonList length={20} className="rounded-lg" />
    </div>
  );
}
