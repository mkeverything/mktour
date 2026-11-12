import { cn } from '@/lib/utils';
import { FC } from 'react';

const RatingDelta: FC<{ value: number; className?: string }> = ({
  value,
  className,
}) => (
  <span className={cn('whitespace-nowrap tabular-nums', className)}>
    {value > 0 ? '+' : value < 0 ? '−' : '±'}
    {Math.abs(value)}
  </span>
);

export default RatingDelta;
