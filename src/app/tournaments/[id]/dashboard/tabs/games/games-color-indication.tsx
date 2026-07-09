import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FC } from 'react';

const ColorHint: FC<{ className?: string }> = ({ className }) => (
  <div className={cn('gap-mk flex min-w-0', className)}>
    <Card className="h-mk dark:bg-primary bg-secondary min-w-0 flex-1 rounded-lg" />
    <Card className="h-mk dark:bg-secondary bg-primary min-w-0 flex-1 rounded-lg" />
  </div>
);

export function GamesColorIndication({ gamesCount }: { gamesCount?: number }) {
  const multiCols = gamesCount !== 1;

  return (
    <div
      className={`gap-mk px-mk md:px-mk-2 grid ${multiCols ? 'grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-3' : 'grid-cols-1'}`}
    >
      <ColorHint />
      {multiCols ? (
        <>
          <ColorHint className="hidden @3xl:flex" />
          <ColorHint className="hidden @6xl:flex" />
        </>
      ) : null}
    </div>
  );
}
