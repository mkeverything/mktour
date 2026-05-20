'use client';

import {
  DashboardRoundContext,
  DashboardTabContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import RoundControls from '@/app/tournaments/[id]/dashboard/tabs/games/round-controls';
import RoundItem from '@/app/tournaments/[id]/dashboard/tabs/games/round-item';
import StartTournamentDrawer from '@/app/tournaments/[id]/dashboard/tabs/games/start-tournament-drawer';
import { useTournamentGamesOverviewInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import Overlay from '@/components/overlay';
import SkeletonList from '@/components/skeleton-list';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

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
  const now = new Date().getTime();
  const startedAt = data?.startedAt ? data.startedAt.getTime() : 0;
  const renderDrawer = !startedAt || now - startedAt <= 5000;

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

  if (isLoading || isUnitsLoading) {
    return (
      <div>
        <RoundControls
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={1}
          currentTab={currentTab}
        />
        <div className="p-mk md:px-mk-2">
          <SkeletonList length={8} className="h-12 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!units || units.length < 2) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm text-balance">
        {t('add two players')}
      </p>
    );
  }

  if (!data) return 'no data'; // FIXME Intl

  return (
    <div>
      <Overlay open={!!selectedGameId} />
      <RoundControls
        roundInView={roundInView}
        setRoundInView={setRoundInView}
        currentRound={data.ongoingRound}
        currentTab={currentTab}
      />
      <RoundItem roundNumber={roundInView} />
      {renderDrawer && <StartTournamentDrawer startedAt={startedAt} />}
    </div>
  );
};

export default Games;
