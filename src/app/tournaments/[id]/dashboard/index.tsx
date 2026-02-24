'use client';

import CarouselContainer from '@/app/tournaments/[id]/dashboard/carousel-container';
import {
  DashboardContext,
  DashboardContextType,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ShuffleFab from '@/app/tournaments/[id]/dashboard/shuffle-fab';
import TabsContainer from '@/app/tournaments/[id]/dashboard/tabs-container';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useDashboardWebsocket } from '@/components/hooks/use-dashboard-websocket';
import FabProvider from '@/components/ui-custom/fab-provider';
import { Status } from '@/server/queries/get-status-in-tournament';
import { useQueryClient } from '@tanstack/react-query';
import { Dispatch, FC, SetStateAction, useState } from 'react';

const Dashboard: FC<TournamentPageContentProps> = ({
  userId,
  session,
  id,
  status,
  playerId,
  currentRound,
}) => {
  const [currentTab, setCurrentTab] =
    useState<DashboardContextType['currentTab']>('main');
  const queryClient = useQueryClient();
  const [roundInView, setRoundInView] = useState(currentRound || 1);
  const { sendJsonMessage } = useDashboardWebsocket(
    session,
    id,
    queryClient,
    setRoundInView,
  );
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const fabContent = fabTabMap[currentTab];
  const [scrolling, setScrolling] = useState(false);

  return (
    <DashboardContext.Provider
      value={{
        currentTab,
        sendJsonMessage,
        status,
        playerId,
        userId,
        setSelectedGameId,
        selectedGameId,
        roundInView,
        setRoundInView,
      }}
    >
      <TabsContainer currentTab={currentTab} setCurrentTab={setCurrentTab} />
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
    </DashboardContext.Provider>
  );
};

const fabTabMap = {
  main: <AddPlayerDrawer />,
  table: <AddPlayerDrawer />,
  games: <ShuffleFab />,
};

export type TabProps = {
  currentTab: DashboardContextType['currentTab'];
  setCurrentTab: Dispatch<SetStateAction<DashboardContextType['currentTab']>>;
  top?: string;
};

export type TabType = {
  title: 'main' | 'table' | 'games';
  component: FC;
};

interface TournamentPageContentProps {
  session: string | null;
  id: string;
  status: Status;
  playerId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default Dashboard;
