'use client';

import {
  DashboardRoundContext,
  DashboardTabContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { GamesGridLoadingSkeleton } from '@/app/tournaments/[id]/dashboard/loading-skeletons';
import RoundControls from '@/app/tournaments/[id]/dashboard/tabs/games/round-controls';
import RoundItem from '@/app/tournaments/[id]/dashboard/tabs/games/round-item';
import StartTournamentDrawer from '@/app/tournaments/[id]/dashboard/tabs/games/start-tournament-drawer';
import { useTournamentGamesOverviewInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import Overlay from '@/components/overlay';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext, useState } from 'react';

const Games: FC = () => {
  const { currentTab } = useContext(DashboardTabContext);
  const { roundInView, setRoundInView } = useContext(DashboardRoundContext);
  const { selectedGameId } = useContext(SelectedGameContext);
  const { id } = useParams<{ id: string }>();
  const { data, isError, isLoading } = useTournamentGamesOverviewInfo(id);
  const {
    data: units,
    isLoading: isUnitsLoading,
    isError: isUnitsError,
  } = useTournamentUnits(id);
  const t = useTranslations('Tournament.Round');
  const [startTournamentOpen, setStartTournamentOpen] = useState(false);
  const now = new Date().getTime();
  const startedAt = data?.startedAt ? data.startedAt.getTime() : 0;
  const isPending = isLoading || isUnitsLoading;
  const renderDrawer = (!startedAt || now - startedAt <= 5000) && !isPending;

  if (isError || isUnitsError) {
    return (
      <div>
        <RoundControls
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={1}
          currentTab={currentTab}
        />
      </div>
    );
  }

  if (!isPending && (!units || units.length < 2)) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm text-balance">
        {t('add two players')}
      </p>
    );
  }

  if (!isPending && !data) return 'no data'; // FIXME Intl

  const currentRound = data?.ongoingRound ?? 1;

  return (
    <div>
      {!isPending ? <Overlay open={!!selectedGameId} /> : null}
      <div className="@container w-full">
        <RoundControls
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={currentRound}
          currentTab={currentTab}
        />
        {isPending ? (
          <GamesGridLoadingSkeleton />
        ) : (
          <RoundItem
            roundNumber={roundInView}
            onOpenStartTournamentDrawer={() => setStartTournamentOpen(true)}
          />
        )}
      </div>
      {renderDrawer && (
        <StartTournamentDrawer
          startedAt={startedAt}
          open={startTournamentOpen}
          onOpenChange={setStartTournamentOpen}
        />
      )}
    </div>
  );
};

export default Games;
