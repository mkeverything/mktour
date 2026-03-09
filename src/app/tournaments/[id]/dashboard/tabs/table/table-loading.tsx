import {
  TableCellStyled,
  TableHeadStyled,
  TableStatsHeads,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';
import type { Stat } from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';
import FormattedMessage from '@/components/formatted-message';
import { Table, TableBody, TableHeader, TableRow } from '@/components/ui/table';
import { FC } from 'react';

const TableLoading: FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div className="h-full w-full items-center justify-center overflow-hidden">
      <span className="sr-only">
        <FormattedMessage id="Tournament.Table.loading" />
      </span>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full min-w-10 p-0">
              <FormattedMessage id="Player.name" />
            </TableHeadStyled>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(20)
            .fill(0)
            .map((_, i) => (
              <TableRow key={i}>
                <TableCellStyled className="font-small w-10 text-center">
                  <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                </TableCellStyled>
                <TableCellStyled className="font-small max-w-0 truncate pl-0">
                  <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                </TableCellStyled>
                {Array(stats.length)
                  .fill(0)
                  .map((_, j) => (
                    <TableCellStyled
                      key={j}
                      className="min-w-8 text-center font-medium"
                    >
                      <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                    </TableCellStyled>
                  ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableLoading;
