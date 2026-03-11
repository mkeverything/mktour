import useOnReach from '@/components/hooks/use-on-reach';
import SkeletonList from '@/components/skeleton-list';
import { FC, ReactNode } from 'react';

const Paginator: FC<Props> = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  disabled,
  skeleton = <SkeletonList />,
}) => {
  const triggerRef = useOnReach(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  if (disabled) return null;
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
  disabled?: boolean;
  skeleton?: ReactNode;
};

export default Paginator;
