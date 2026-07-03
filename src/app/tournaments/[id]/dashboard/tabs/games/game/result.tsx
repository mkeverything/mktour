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

  const whiteScore = !result
    ? ''
    : result === '1-0'
      ? '1'
      : result === '1/2-1/2'
        ? '½'
        : '0';
  const blackScore = !result
    ? ''
    : result === '0-1'
      ? '1'
      : result === '1/2-1/2'
        ? '½'
        : '0';

  return (
    <Card className="divide-border flex h-full w-full min-w-0 flex-col divide-y rounded-md select-none">
      <div
        className={cn(
          'text-2xs flex min-h-6 flex-1 items-center justify-center lg:text-xs',
          result === '0-1' && 'opacity-30',
        )}
      >
        {whiteScore}
      </div>
      <div
        className={cn(
          'text-2xs flex min-h-6 flex-1 items-center justify-center lg:text-xs',
          result === '1-0' && 'opacity-30',
        )}
      >
        {blackScore}
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
