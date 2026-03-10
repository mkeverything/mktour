import useOnReach from '@/components/hooks/use-on-reach';
import SkeletonList from '@/components/skeleton-list';
import { FC, ReactElement } from 'react';

const Paginator: FC<Props> = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  skeleton = <SkeletonList length={3} />,
}) => {
  const triggerRef = useOnReach(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  return (
    <div>
      <div ref={triggerRef} className="h-px w-full" />
      {isFetchingNextPage && skeleton}
    </div>
  );
};

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  skeleton?: ReactElement<typeof SkeletonList>;
};

export default Paginator;
