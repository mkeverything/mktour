'use client';

import CarouselContainer from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/carousel-container';
import {
  DashboardContext,
  DashboardRoundContext,
  DashboardTabContext,
  DashboardTab,
  SelectedGameContext,
} from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/dashboard-context';
import ShuffleButton from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/shuffle-button';
import TabsContainer from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs-container';
import AddPlayerDrawer from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentEvents } from '@/components/hooks/use-tournament-events';
import FabProvider from '@/components/ui-custom/fab-provider';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { Dispatch, ReactNode, SetStateAction, useMemo, useState } from 'react';

interface DashboardMobileProps {
  id: string;
  status: TournamentAuthStatus;
  unitId: string | null;
  userId: string | undefined;
  currentTab: DashboardTab;
  setCurrentTab: Dispatch<SetStateAction<DashboardTab>>;
}

const fabTabMap: Record<DashboardTab, ReactNode> = {
  main: <AddPlayerDrawer />,
  table: <AddPlayerDrawer />,
  games: <ShuffleButton />,
};

const DashboardMobile: React.FC<DashboardMobileProps> = ({
  id,
  status,
  unitId,
  userId,
  currentTab,
  setCurrentTab,
}) => {
  const { data: tournament } = useTournamentInfo(id);
  const [roundInView, setRoundInView] = useState(
    tournament?.tournament.ongoingRound || 1,
  );
  useTournamentEvents(id, setRoundInView);
  const fabContent = fabTabMap[currentTab];
  const [scrolling, setScrolling] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const dashboardValue = useMemo(
    () => ({
      status,
      unitId,
      userId,
    }),
    [unitId, status, userId],
  );
  const tabValue = useMemo(() => ({ currentTab }), [currentTab]);
  const roundValue = useMemo(
    () => ({
      roundInView,
      setRoundInView,
    }),
    [roundInView, setRoundInView],
  );
  const selectedGameValue = useMemo(
    () => ({
      selectedGameId,
      setSelectedGameId,
    }),
    [selectedGameId, setSelectedGameId],
  );

  return (
    <DashboardContext.Provider value={dashboardValue}>
      <DashboardTabContext.Provider value={tabValue}>
        <DashboardRoundContext.Provider value={roundValue}>
          <SelectedGameContext.Provider value={selectedGameValue}>
            <div className="fixed top-[var(--spacing-mk-navbar-total-height)] right-0 bottom-0 left-0 overflow-hidden">
              <TabsContainer
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
              />
              <CarouselContainer
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                setScrolling={setScrolling}
              />
              <FabProvider
                status={status}
                fabContent={fabContent}
                scrolling={scrolling}
              />
            </div>
          </SelectedGameContext.Provider>
        </DashboardRoundContext.Provider>
      </DashboardTabContext.Provider>
    </DashboardContext.Provider>
  );
};

export default DashboardMobile;
