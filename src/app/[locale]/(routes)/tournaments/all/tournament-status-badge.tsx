import { cn } from '@/lib/utils';
import { TournamentStatus } from '@/server/zod/enums';
import { FC, PropsWithChildren } from 'react';

const STATUS_CLASSES: Record<TournamentStatus, string> = {
  live: 'bg-destructive/10 text-destructive',
  upcoming: 'bg-primary/10 text-foreground',
  finished: 'bg-muted text-muted-foreground',
};

const TournamentStatusBadge: FC<
  PropsWithChildren<{ status: TournamentStatus; className?: string }>
> = ({ status, className, children }) => (
  <span
    className={cn(
      'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      STATUS_CLASSES[status],
      className,
    )}
  >
    {status === 'live' && (
      <span className="bg-destructive size-1.5 rounded-full motion-safe:animate-pulse" />
    )}
    {children}
  </span>
);

export default TournamentStatusBadge;
