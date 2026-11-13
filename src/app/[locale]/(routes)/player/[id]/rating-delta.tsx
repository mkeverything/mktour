import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** a change in rating, with an arrow for its sign so it can't pass for a count of wins or losses */
const RatingDelta: FC<{ value: number; className?: string }> = ({
  value,
  className,
}) => {
  const t = useTranslations('Player.Page');
  return (
    <span
      title={t('ratingChange')}
      className={cn('relative whitespace-nowrap tabular-nums', className)}
    >
      {value !== 0 && (
        <span
          aria-hidden
          className="relative -top-px mr-[0.25em] text-[0.75em]"
        >
          {value > 0 ? '▲' : '▼'}
        </span>
      )}
      <span className="sr-only">{value > 0 ? '+' : value < 0 ? '−' : ''}</span>
      {value === 0 && '±'}
      {Math.abs(value)}
    </span>
  );
};

export default RatingDelta;
