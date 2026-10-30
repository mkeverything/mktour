'use client';

import {
  DashboardRoundContext,
  DashboardTabContext,
  SelectedGameContext,
} from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/dashboard-context';
import { GamesGridLoadingSkeleton } from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/loading-skeletons';
import RoundControls from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/games/round-controls';
import RoundItem from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/games/round-item';
import StartTournamentDrawer from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/games/start-tournament-drawer';
import { useTournamentGamesOverviewInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { useIntlError } from '@/components/hooks/use-intl-error';
import Overlay from '@/components/overlay';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

const Games: FC = () => {
  const { currentTab } = useContext(DashboardTabContext);
  const { roundInView, setRoundInView } = useContext(DashboardRoundContext);
  const { selectedGameId } = useContext(SelectedGameContext);
  const { id } = useParams<{ id: string }>();
  const { data, error: infoError } = useTournamentGamesOverviewInfo(id);
  const { data: units, error: unitsError } = useTournamentUnits(id);
  const t = useTranslations('Tournament.Round');
  const { translateError } = useIntlError();
  const [startTournamentOpen, setStartTournamentOpen] = useState(false);
  const isReady = !!data && !!units;
  const currentRound = data?.ongoingRound ?? 1;
  const round = Math.min(roundInView, currentRound);
  const error = infoError ?? unitsError;

  useEffect(() => {
    if (error) toast.error(translateError(error));
  }, [error, translateError]);

  if (units && units.length < 2) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm text-balance">
        {t('add two players')}
      </p>
    );
  }

  return (
    <div>
      {isReady ? <Overlay open={!!selectedGameId} /> : null}
      <div className="@container w-full">
        <RoundControls
          roundInView={round}
          setRoundInView={setRoundInView}
          currentRound={currentRound}
          currentTab={currentTab}
        />
        {isReady ? (
          <RoundItem
            roundNumber={round}
            onOpenStartTournamentDrawer={() => setStartTournamentOpen(true)}
          />
        ) : (
          <GamesGridLoadingSkeleton />
        )}
      </div>
      {(!data?.startedAt || startTournamentOpen) && (
        <StartTournamentDrawer
          startedAt={data?.startedAt?.getTime()}
          open={startTournamentOpen}
          onOpenChange={setStartTournamentOpen}
        />
      )}
    </div>
  );
};

export default Games;
