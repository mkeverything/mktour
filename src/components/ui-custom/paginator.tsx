import useOnReach from '@/components/hooks/use-on-reach';
import { Skeleton } from '@/components/ui/skeleton';
import { FC } from 'react';

const Paginator: FC<Props> = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}) => {
  const triggerRef = useOnReach(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  return (
    <div>
      <div
        ref={triggerRef}
        className="h-0 w-full -translate-y-[calc(var(--spacing-mk-card-height)+calc((var(--spacing-mk)*2)))]"
      />
      {isFetchingNextPage && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
};

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

export default Paginator;
