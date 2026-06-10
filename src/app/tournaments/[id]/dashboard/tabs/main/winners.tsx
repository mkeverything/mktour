'use client';

import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { playerPublicProfileHref } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';
import Link from 'next/link';
import { FC } from 'react';

const Winners: FC<{
  closedAt: Date | null;
  tournamentId: string;
}> = ({ closedAt, tournamentId }) => {
  const { data: units } = useTournamentUnits(tournamentId);
  const winners = groupWinnersByPlace(units);

  if (!winners || !closedAt) return null;
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {Object.entries(winners).map(([place, units]) => (
        <MedalGroup key={place} place={place} units={units} />
      ))}
    </div>
  );
};

const MedalGroup: FC<{ place: string; units: UnitModel[] }> = ({
  place,
  units,
}) => {
  return (
    <div className="flex items-start gap-2 truncate">
      <Medal className={`size-6 ${medalColour[parseInt(place) - 1]}`} />
      <div className="flex flex-col gap-2">
        {units.map((unit, i) => {
          const shouldShowSeparator = units.length > 1 && i < units.length - 1;

          return (
            <div key={unit.id}>
              <WinnerUnit unit={unit} />
              {shouldShowSeparator && ','}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WinnerUnit: FC<{ unit: UnitModel }> = ({ unit }) => {
  if (isSoloUnit(unit)) {
    const [player] = unit.players;

    return (
      <Link href={playerPublicProfileHref(player)} className="mk-link">
        {unit.unitNickname}
      </Link>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      <span>{unit.unitNickname}</span>
      <span className="text-muted-foreground">
        (
        {unit.players.map((player, i) => (
          <span key={player.id}>
            <Link href={playerPublicProfileHref(player)} className="mk-link">
              {player.nickname}
            </Link>
            {i < unit.players.length - 1 && ', '}
          </span>
        ))}
        )
      </span>
    </span>
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
