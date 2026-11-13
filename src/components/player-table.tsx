import { Table, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ComponentProps, FC, PropsWithChildren } from 'react';

/** players the way the club page lists them: a hairline under every row, each row a way to its player */
export const PlayerTable: FC<ComponentProps<typeof Table>> = ({
  className,
  ...props
}) => (
  <Table
    className={cn(
      '[&_tbody_tr:active]:bg-muted border-separate border-spacing-0 [&_td]:border-b [&_th]:h-8 [&_th]:border-b [&_th]:text-xs',
      className,
    )}
    {...props}
  />
);

/** a cell leading to its player. only the name cell takes focus, so a row is one tab stop */
export const PlayerCell: FC<
  PropsWithChildren<{ playerId: string; isName?: boolean; className?: string }>
> = ({ playerId, isName, className, children }) => (
  <TableCell className={cn('p-0', className)}>
    {/* every cell links on its own: safari can't stretch one link over a <tr> */}
    <Link
      href={`/player/${playerId}`}
      tabIndex={isName ? undefined : -1}
      className="block p-2"
    >
      {children}
    </Link>
  </TableCell>
);
