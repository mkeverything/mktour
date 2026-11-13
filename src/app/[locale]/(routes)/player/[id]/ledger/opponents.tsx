import Section from '@/app/[locale]/(routes)/player/[id]/ledger/section';
import {
  useMockRivals,
  useMockVictories,
} from '@/app/[locale]/(routes)/player/[id]/use-mock-opponents';
import { usePlayerStats } from '@/components/hooks/query-hooks/use-player-stats';
import { PlayerCell, PlayerTable } from '@/components/player-table';
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClubPlayerModel, PlayerModel } from '@/server/zod/players';
import { useTranslations } from 'next-intl';
import { FC, ReactNode } from 'react';

export const MostPlayed: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player.Page');
  const { data: stats } = usePlayerStats(player.id);
  const rivals = useMockRivals(player);
  if (!stats?.gamesPlayed || !rivals.length) return null;
  // the crosstable's signs, named on hover
  const outcomes = [
    ['wins', '+', t('won')],
    ['draws', '=', t('drawn')],
    ['losses', '−', t('lost')],
  ] as const;

  return (
    <Section title={t('mostPlayed')} isMock>
      <OpponentTable
        rows={rivals}
        columns={[
          {
            id: 'games',
            head: t('record'),
            className: 'text-right tabular-nums',
            cell: ({ wins, draws, losses }) => (
              <span className="font-semibold">{wins + draws + losses}</span>
            ),
          },
          ...outcomes.map(([outcome, sign, name]) => ({
            id: outcome,
            head: (
              <abbr title={name} className="no-underline">
                {sign}
              </abbr>
            ),
            className: 'text-muted-foreground text-right text-xs tabular-nums',
            cell: (rival: (typeof rivals)[number]) => rival[outcome],
          })),
        ]}
      />
    </Section>
  );
};

export const BestVictories: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player');
  const { data: stats } = usePlayerStats(player.id);
  const victories = useMockVictories(player);
  if (!stats?.gamesWon || !victories.length) return null;

  return (
    <Section title={t('Page.bestVictories')} isMock>
      <OpponentTable
        rows={victories}
        columns={[
          {
            id: 'rating',
            head: t('rating'),
            className: 'text-right tabular-nums',
            cell: ({ opponent }) => (
              <span className="font-semibold">
                {opponent.rating}
                {!opponent.isRatingEstablished && '?'}
              </span>
            ),
          },
        ]}
      />
    </Section>
  );
};

/** opponents in the club page's table: the name first, then what the table is about */
const OpponentTable = <
  T extends { opponent: Pick<ClubPlayerModel, 'id' | 'nickname'> },
>({
  rows,
  columns,
}: {
  rows: T[];
  columns: {
    id: string;
    head: ReactNode;
    className: string;
    cell: (row: T) => ReactNode;
  }[];
}) => {
  const t = useTranslations('Player');
  return (
    // its outer columns sit on the column's edges, under the section's heading
    <PlayerTable className="[&_td:first-child_a]:pl-0 [&_td:last-child_a]:pr-0 [&_th:first-child]:pl-0 [&_th:last-child]:pr-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-full">{t('nickname')}</TableHead>
          {columns.map(({ id, head, className }) => (
            <TableHead key={id} className={className}>
              {head}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.opponent.id}>
            <PlayerCell
              playerId={row.opponent.id}
              isName
              className="w-full max-w-0"
            >
              <span className="block truncate">{row.opponent.nickname}</span>
            </PlayerCell>
            {columns.map(({ id, className, cell }) => (
              <PlayerCell
                key={id}
                playerId={row.opponent.id}
                className={className}
              >
                {cell(row)}
              </PlayerCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </PlayerTable>
  );
};
