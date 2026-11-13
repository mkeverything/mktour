import { Count } from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import RecordSummary from '@/app/[locale]/(routes)/player/[id]/record-summary';
import {
  usePlayerAuthStats,
  usePlayerStats,
} from '@/components/hooks/query-hooks/use-player-stats';
import type { PlayerModel } from '@/server/zod/players';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren, ReactNode } from 'react';

// labelled small and muted, the way the club page's sidebar labels its facts
const Block: FC<PropsWithChildren<{ title: ReactNode }>> = ({
  title,
  children,
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-muted-foreground flex items-baseline gap-1.5 text-xs font-normal">
      {title}
    </h2>
    {children}
  </section>
);

export const Games: FC<{ playerId: string }> = ({ playerId }) => {
  const t = useTranslations('Player.Page');
  const { data: stats } = usePlayerStats(playerId);
  if (!stats?.gamesPlayed) return null;

  return (
    <Block
      title={
        <>
          {t('record')}
          <Count value={stats.gamesPlayed} />
        </>
      }
    >
      <RecordSummary
        wins={stats.gamesWon}
        draws={stats.gamesDrawn}
        losses={stats.gamesLost}
      />
    </Block>
  );
};

export const VsYou: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player.Page');
  const { data: score } = usePlayerAuthStats(player.id);
  if (!score) return null;
  const record = {
    wins: score.userWins,
    draws: score.draws,
    losses: score.playerWins,
  };

  return (
    <Block
      title={
        <>
          {t('vsYou', { player: player.nickname })}
          <Count value={record.wins + record.draws + record.losses} />
        </>
      }
    >
      <RecordSummary {...record} />
    </Block>
  );
};
