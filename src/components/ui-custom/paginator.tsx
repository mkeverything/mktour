import SkeletonList from '@/components/skeleton-list';
import { useInView } from 'framer-motion';
import { FC, ReactNode, RefObject, useEffect, useRef } from 'react';

const Paginator: FC<Props> = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  disabled,
  root,
  skeleton = <SkeletonList length={3} />,
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(triggerRef, { root, margin: '300px' });

  useEffect(() => {
    if (!disabled && isInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [disabled, isInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <div ref={triggerRef} className="h-px w-full" />
      {!disabled && isFetchingNextPage && skeleton}
    </div>
  );
};

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  disabled?: boolean;
  root?: RefObject<Element | null>;
  skeleton?: ReactNode;
};

export default Paginator;
