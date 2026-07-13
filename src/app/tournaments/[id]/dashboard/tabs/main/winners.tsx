'use client';

import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { playerPublicProfileHref } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';
import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const placeLabelKeys = ['first place', 'second place', 'third place'] as const;

const Winners: FC<{
  closedAt: Date | null;
  tournamentId: string;
}> = ({ closedAt, tournamentId }) => {
  const { data: units } = useTournamentUnits(tournamentId);
  const winners = groupWinnersByPlace(units);
  const t = useTranslations('Tournament.Main');

  if (!closedAt || Object.keys(winners).length === 0) return null;

  return (
    <div className="gap-mk p-mk flex flex-col md:hidden">
      <h3 className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
        <Trophy className="size-4" />
        {t('winners')}
      </h3>
      {Object.entries(winners).map(([place, placeUnits]) => (
        <WinnerCard
          key={place}
          place={parseInt(place)}
          units={placeUnits}
          label={t(placeLabelKeys[parseInt(place) - 1])}
        />
      ))}
    </div>
  );
};

const WinnerCard: FC<{
  place: number;
  units: UnitModel[];
  label: string;
}> = ({ place, units, label }) => (
  <div className="bg-primary/5 border-primary/10 flex items-center gap-4 rounded-xl border p-4">
    <Medal className={`size-6 shrink-0 ${medalColour[place - 1]}`} />
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {units.map((unit) => (
        <WinnerUnit key={unit.id} unit={unit} />
      ))}
    </div>
  </div>
);

const WinnerUnit: FC<{ unit: UnitModel }> = ({ unit }) => {
  if (isSoloUnit(unit)) {
    const [player] = unit.players;

    return (
      <Link
        href={playerPublicProfileHref(player)}
        className="mk-link truncate text-sm font-medium"
      >
        {unit.unitNickname}
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm font-medium">{unit.unitNickname}</span>
      <span className="text-muted-foreground truncate text-xs">
        {unit.players.map((player, i) => (
          <span key={player.id}>
            <Link href={playerPublicProfileHref(player)} className="mk-link">
              {player.nickname}
            </Link>
            {i < unit.players.length - 1 && ', '}
          </span>
        ))}
      </span>
    </div>
  );
};

const isSoloUnit = (unit: UnitModel) => unit.players.length === 1;

export const Medal: FC<{ className: string }> = ({ className }) => (
  <div className={`aspect-square rounded-full ${className}`} />
);

export const medalColour = ['bg-amber-300', 'bg-gray-300', 'bg-amber-700'];

const groupWinnersByPlace = (units: UnitModel[] | undefined) => {
  const winners = units?.filter(({ place }) => place && place <= 3);

  if (!winners) return {};
  return winners.reduce(
    (acc, unit) => {
      const place = unit.place || 0;
      if (!acc[place]) {
        acc[place] = [];
      }
      acc[place].push(unit);
      return acc;
    },
    {} as Record<number, UnitModel[]>,
  );
};

export default Winners;
