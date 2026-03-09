'use client';

import {
  Medal,
  medalColour,
} from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import { TableCell, TableHead } from '@/components/ui/table';
import FormattedMessage from '@/components/formatted-message';
import { PlayerTournamentModel } from '@/server/zod/players';
import { UserModel } from '@/server/zod/users';
import { Flag, Scale, Trophy, UserRound } from 'lucide-react';
import { FC, PropsWithChildren, ReactNode } from 'react';

export type Stat =
  | keyof Pick<PlayerTournamentModel, 'wins' | 'draws' | 'losses'>
  | 'score'
  | 'tiebreak';

export const STATS_WITH_TIEBREAK: Stat[] = [
  'wins',
  'draws',
  'losses',
  'score',
  'tiebreak',
];

export const TableCellStyled: FC<
  PropsWithChildren & { className?: string }
> = ({ children, className }) => (
  <TableCell className={`p-3 ${className}`}>{children}</TableCell>
);

export const TableHeadStyled: FC<
  PropsWithChildren & { className?: string }
> = ({ children, className }) => (
  <TableHead className={`h-11 ${className}`}>{children}</TableHead>
);

export const TableStatsHeads: FC<{ stats: Stat[] }> = ({ stats }) => (
  <>
    {stats.map((stat) => (
      <TableHeadStyled key={stat} className="text-center">
        {statHeadRenderers[stat]}
      </TableHeadStyled>
    ))}
  </>
);

export const Place: FC<
  { player: PlayerTournamentModel; hasEnded: boolean } & PropsWithChildren
> = ({ player, hasEnded, children }) => {
  const place = player.place;
  if (!place || !hasEnded) return children;
  return place > 3 ? (
    place
  ) : (
    <Medal className={`${medalColour[place - 1]} size-4`} />
  );
};

export const Status: FC<
  {
    player: PlayerTournamentModel;
    user: UserModel | null | undefined;
  } & PropsWithChildren
> = ({ player, children }) => {
  const pairPlayers = player.pairPlayers ?? [];
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        className={`gap-mk flex min-w-0 items-center ${player.isOut && 'text-muted-foreground'}`}
      >
        <span className="truncate">{children}</span>
        {player.username && (
          <UserRound className="text-muted-foreground size-4 shrink-0" />
        )}
        {player.isOut && <Flag className="size-4 shrink-0" />}
      </div>
      {pairPlayers.length === 2 && (
        <small className="text-muted-foreground text-2xs truncate">
          {pairPlayers[0].nickname}, {pairPlayers[1].nickname}
        </small>
      )}
    </div>
  );
};

export const Stat: FC<PropsWithChildren> = ({ children }) => (
  <TableCellStyled className="min-w-8 text-center font-medium">
    {children}
  </TableCellStyled>
);

const renderTextHead = (stat: Exclude<Stat, 'score' | 'tiebreak'>) => (
  <>
    <div className="block sm:hidden md:block xl:hidden">
      <FormattedMessage id={`Tournament.Table.Stats.short.${stat}`} />
    </div>
    <div className="hidden sm:block md:hidden xl:block">
      <FormattedMessage id={`Tournament.Table.Stats.full.${stat}`} />
    </div>
  </>
);

export const statHeadRenderers: Record<Stat, ReactNode> = {
  wins: renderTextHead('wins'),
  draws: renderTextHead('draws'),
  losses: renderTextHead('losses'),
  score: <Trophy className="m-auto size-3.5" />,
  tiebreak: <Scale className="m-auto size-4" />,
};
