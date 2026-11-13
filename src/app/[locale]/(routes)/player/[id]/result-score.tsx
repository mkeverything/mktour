import { cn } from '@/lib/utils';
import type { PlayerResultModel } from '@/server/zod/players';
import { FC } from 'react';

/** wins, draws and losses the way crosstables write them: +6 =0 −1 */
const ResultScore: FC<
  Pick<PlayerResultModel['unit'], 'wins' | 'draws' | 'losses'> & {
    className?: string;
  }
> = ({ wins, draws, losses, className }) => (
  <span className={cn('whitespace-nowrap tabular-nums', className)}>
    +{wins} ={draws} −{losses}
  </span>
);

export default ResultScore;
