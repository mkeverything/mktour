import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FC } from 'react';

const SkeletonList: FC<{
  length?: number;
  className?: string;
}> = ({ length, className }) => {
  const list = new Array(length || 5).fill('');

  return (
    <div className="mk-list relative z-10 h-full max-h-[60dvh] overflow-hidden">
      <div className="from-background absolute inset-0 w-full bg-linear-to-t" />
      <div className="-z-10 flex flex-col gap-2">
        {list.map((_, i) => (
          <Skeleton key={i} className={cn(`h-18 w-full`, className)} />
        ))}
      </div>
    </div>
  );
};

export default SkeletonList;
