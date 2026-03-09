'use client';

import { cn } from '@/lib/utils';
import { FC } from 'react';

const BracketGhostItem: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'border-muted-foreground/30 bg-muted/20 grid min-h-[52px] w-full min-w-0 grid-flow-col grid-cols-3 grid-rows-2 gap-px overflow-hidden rounded-md border-2 border-dashed',
      className,
    )}
    aria-hidden
  >
    <div className="col-span-2 min-h-6 px-2 py-1" />
    <div className="border-muted-foreground/20 col-span-2 min-h-6 border-t border-dashed px-2 py-1" />
    <div className="border-muted-foreground/20 bg-muted/10 row-span-2 flex min-w-9 items-center justify-center border-l border-dashed">
      <span className="text-muted-foreground/50 text-xs">–</span>
    </div>
  </div>
);

export default BracketGhostItem;
