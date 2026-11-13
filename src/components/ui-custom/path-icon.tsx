import { cn } from '@/lib/utils';
import { FC } from 'react';

const PathIcon: FC<{ path: string; className?: string }> = ({
  path,
  className,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    className={cn('size-4.5 shrink-0', className)}
  >
    <path d={path} />
  </svg>
);

export default PathIcon;
