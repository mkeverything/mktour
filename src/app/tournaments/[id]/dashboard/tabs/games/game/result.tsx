import { LoadingSpinner } from '@/app/loading';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GameResult } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

const Result: FC<ResultProps> = ({ isPending, result, selected }) => {
  const t = useTranslations('Tournament.Results');

  if (isPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex h-full w-full items-center justify-center select-none">
        <small className="select-none">{t('draw')}</small>
      </div>
    );
  }

  if (!result) {
    return (
      <Card className="relative grid h-full w-24 min-w-16 grid-cols-2 rounded-md select-none">
        <div className="flex w-full items-center justify-center" />
        <div className="border-l-muted flex w-full items-center justify-center border-l" />
      </Card>
    );
  }

  const parsedResult = result.split('-');
  const left = parsedResult?.at(0) === '1/2' ? '½' : parsedResult?.at(0);
  const right = parsedResult?.at(1) === '1/2' ? '½' : parsedResult?.at(1);

  return (
    <Card className="grid h-full w-24 min-w-16 grid-cols-2 rounded-md select-none">
      <div
        className={cn(
          'flex w-full items-center justify-center opacity-60',
          result === '0-1' && 'opacity-30',
        )}
      >
        {left ?? ''}
      </div>
      <div
        className={cn(
          'border-l-muted flex w-full items-center justify-center border-l opacity-60',
          result === '1-0' && 'opacity-30',
        )}
      >
        {right ?? ''}
      </div>
    </Card>
  );
};

export type ResultProps = {
  result: GameResult | null;
  selected?: boolean;
  isPending?: boolean;
};

export default Result;
