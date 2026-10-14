'use client';

import Medal, {
  PLACE_LABEL_KEYS,
} from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/medal';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { playerPublicProfileHref } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';
import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const Winners: FC<{
  closedAt: Date | null;
  tournamentId: string;
}> = ({ closedAt, tournamentId }) => {
  const { data: units = [] } = useTournamentUnits(tournamentId);
  const t = useTranslations('Tournament.Main');
  const podium = PLACE_LABEL_KEYS.map((labelKey, i) => ({
    place: i + 1,
    labelKey,
    units: units.filter(({ place }) => place === i + 1),
  })).filter(({ units }) => units.length > 0);

  if (!closedAt || podium.length === 0) return null;

  return (
    <div className="gap-mk p-mk flex flex-col md:hidden">
      <h3 className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
        <Trophy className="size-4" />
        {t('winners')}
      </h3>
      {podium.map(({ place, labelKey, units }) => (
        <WinnerCard
          key={place}
          place={place}
          units={units}
          label={t(labelKey)}
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
    <Medal place={place} className="size-6 shrink-0" aria-hidden />
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

export default Winners;
