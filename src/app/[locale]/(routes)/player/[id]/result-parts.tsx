import type { PlayerResultModel } from '@/server/zod/players';
import type { TournamentModel } from '@/server/zod/tournaments';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** wins, draws and losses the way crosstables write them: +6 =0 −1 */
export const ResultScore: FC<
  Pick<PlayerResultModel['unit'], 'wins' | 'draws' | 'losses'>
> = ({ wins, draws, losses }) => (
  <span className="whitespace-nowrap tabular-nums">
    +{wins} ={draws} −{losses}
  </span>
);

export const LiveRound: FC<{
  tournament: Pick<TournamentModel, 'ongoingRound' | 'roundsNumber'>;
}> = ({ tournament }) => {
  const t = useTranslations('Club.Page');
  return (
    <span className="text-foreground whitespace-nowrap">
      <span className="bg-destructive mr-1.5 inline-block size-1.5 animate-pulse rounded-full align-middle motion-reduce:animate-none" />
      {t('roundOf', {
        round: tournament.ongoingRound,
        rounds: tournament.roundsNumber,
      })}
    </span>
  );
};
