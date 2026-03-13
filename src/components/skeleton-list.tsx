import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FC } from 'react';

const SkeletonList: FC<SkeletonListProps> = ({
  length = 5,
  className,
  card,
}) => {
  const list = new Array(length).fill('');
  const from = card ? 'from-card' : 'from-background';

  return (
    <div className="mk-list relative z-10 h-full max-h-[60dvh] overflow-hidden">
      <div className={`${from} absolute inset-0 w-full bg-linear-to-t`} />
      <div className="-z-10 flex flex-col gap-2">
        {list.map((_, i) => (
          <Skeleton
            key={i}
            className={cn(`h-16 w-full rounded-xl`, className)}
          />
        ))}
      </div>
    </div>
  );
};

export type SkeletonListProps = {
  length?: number;
  card?: boolean;
  className?: string;
};

export default SkeletonList;
