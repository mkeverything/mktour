import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

const INFO_ROW_COUNT = 5;

export function MainTabLoadingSkeleton() {
  return (
    <>
      <div className="px-mk pb-mk flex flex-col gap-0 md:hidden">
        <div className="py-mk-2 pl-4">
          <Skeleton className="h-9 w-3/4" />
        </div>
        <div className="p-mk pt-mk-2 pb-mk-2 gap-mk-2 flex flex-col">
          <div className="gap-mk flex flex-col">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="gap-mk flex flex-wrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="px-mk md:px-mk-2 hidden md:grid md:grid-cols-2">
        <div className="p-mk col-span-2 md:pb-0">
          <Skeleton className="h-11 w-2/3" />
        </div>
        <div className="gap-y-mk gap-x-mk-2 p-mk flex flex-row flex-wrap items-center">
          {Array.from({ length: INFO_ROW_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28" />
          ))}
        </div>
        <div className="p-mk flex items-end justify-end">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </>
  );
}

export function GamesGridLoadingSkeleton() {
  return (
    <div className="gap-mk px-mk md:px-mk-2 pt-mk grid grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg shadow-md" />
      ))}
    </div>
  );
}

export function AddPlayerListLoadingSkeleton() {
  return Array.from({ length: 20 }).map((_, i) => (
    <TableRow key={i} className="p-0">
      <TableCell>
        <div className="line-clamp-2 break-all">
          <Skeleton className="h-4 w-36" />
        </div>
        {i % 10 === 8 && (
          <div className="text-2xs text-muted-foreground mt-1 flex items-center">
            <Skeleton className="h-3 w-24" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
    </TableRow>
  ));
}
