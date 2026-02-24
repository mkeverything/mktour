'use client';

import { TabProps } from '@/app/tournaments/[id]/dashboard';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ShuffleFab from '@/app/tournaments/[id]/dashboard/shuffle-fab';
import Games from '@/app/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/tournaments/[id]/dashboard/tabs/table';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useDashboardWebsocket } from '@/components/hooks/use-dashboard-websocket';
import Overlay from '@/components/overlay';
import { Card, CardContent } from '@/components/ui/card';
import { Status } from '@/server/queries/get-status-in-tournament';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const DashboardDesktop: React.FC<DashboardDesktopProps> = ({
  currentTab,
  session,
  id,
  status,
  playerId,
  userId,
  currentRound,
}) => {
  const queryClient = useQueryClient();
  const [roundInView, setRoundInView] = useState(currentRound || 1);
  const { sendJsonMessage } = useDashboardWebsocket(
    session,
    id,
    queryClient,
    setRoundInView,
  );
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

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
      <Overlay open={!!selectedGameId} />
      <Main />
      <div className="flex h-[calc(100dvh-10rem)] gap-2 overflow-hidden p-2 lg:flex-row">
        <Card className="size-full">
          <CardContent className="relative flex size-full flex-col overflow-y-auto p-2">
            <TournamentTable />
            <AddPlayerDrawer />
          </CardContent>
        </Card>
        <Card className="size-full">
          <CardContent className="relative flex size-full flex-col overflow-y-auto p-2">
            <Games />
            <ShuffleFab />
          </CardContent>
        </Card>
      </div>
    </DashboardContext.Provider>
  );
};

interface DashboardDesktopProps extends TabProps {
  session: string | null;
  id: string;
  status: Status;
  playerId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default DashboardDesktop;
