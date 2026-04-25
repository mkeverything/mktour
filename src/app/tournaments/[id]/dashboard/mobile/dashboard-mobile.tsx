'use client';

import CarouselContainer from '@/app/tournaments/[id]/dashboard/carousel-container';
import {
  DashboardContext,
  DashboardRoundContext,
  DashboardTabContext,
  DashboardTab,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ShuffleButton from '@/app/tournaments/[id]/dashboard/shuffle-button';
import TabsContainer from '@/app/tournaments/[id]/dashboard/tabs-container';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useDashboardWebsocket } from '@/components/hooks/use-dashboard-websocket';
import FabProvider from '@/components/ui-custom/fab-provider';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { Dispatch, ReactNode, SetStateAction, useMemo, useState } from 'react';

interface DashboardMobileProps {
  session: string | null;
  id: string;
  status: TournamentAuthStatus;
  playerId: string | null;
  userId: string | undefined;
  currentRound: number | null;
  currentTab: DashboardTab;
  setCurrentTab: Dispatch<SetStateAction<DashboardTab>>;
}

const fabTabMap: Record<DashboardTab, ReactNode> = {
  main: <AddPlayerDrawer />,
  table: <AddPlayerDrawer />,
  games: <ShuffleButton />,
};

const DashboardMobile: React.FC<DashboardMobileProps> = ({
  session,
  id,
  status,
  playerId,
  userId,
  currentRound,
  currentTab,
  setCurrentTab,
}) => {
  const queryClient = useQueryClient();
  const [roundInView, setRoundInView] = useState(currentRound || 1);
  const { sendJsonMessage } = useDashboardWebsocket(
    session,
    id,
    queryClient,
    setRoundInView,
  );
  const fabContent = fabTabMap[currentTab];
  const [scrolling, setScrolling] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const dashboardValue = useMemo(
    () => ({
      sendJsonMessage,
      status,
      playerId,
      userId,
    }),
    [playerId, sendJsonMessage, status, userId],
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
          </SelectedGameContext.Provider>
        </DashboardRoundContext.Provider>
      </DashboardTabContext.Provider>
    </DashboardContext.Provider>
  );
};

export default DashboardMobile;
