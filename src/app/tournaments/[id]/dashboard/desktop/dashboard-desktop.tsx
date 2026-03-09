'use client';

import { TabProps } from '@/app/tournaments/[id]/dashboard';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ShuffleFab from '@/app/tournaments/[id]/dashboard/shuffle-fab';
import Games from '@/app/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/tournaments/[id]/dashboard/tabs/table';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import FormattedMessage from '@/components/formatted-message';
import { useDashboardWebsocket } from '@/components/hooks/use-dashboard-websocket';
import Overlay from '@/components/overlay';
import Fades from '@/components/ui-custom/fades';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

const isElimination = (m: TabProps['mockMode']) =>
  m === 'single_elim' || m === 'double_elim';

const DashboardDesktop: React.FC<DashboardDesktopProps> = ({
  currentTab,
  session,
  id,
  status,
  playerId,
  userId,
  currentRound,
  mockMode,
  setMockMode,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

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
        mockMode,
        setMockMode,
      }}
    >
      <Overlay open={!!selectedGameId} />
      <div className="h-mk-content-height relative inset-0 flex flex-col overflow-hidden">
        <Main toggleFullscreen={toggleFullscreen} />
        <div
          ref={containerRef}
          className="p-mk px-mk-2 flex flex-1 gap-2 overflow-hidden lg:flex-row"
        >
          {!isElimination(mockMode) && (
            <Card className="bg-background relative size-full overflow-hidden">
              <CardContent className="flex size-full flex-col overflow-y-auto p-0">
                <TournamentTable />
                <Fades from="from-background" to="to-background" />
              </CardContent>
              <AddPlayerDrawer />
            </Card>
          )}
          <Card className="bg-background relative size-full overflow-hidden">
            <CardContent className="flex size-full flex-col overflow-y-auto p-0">
              <Games />
              <Fades from="from-background" to="to-background" />
            </CardContent>
            <ShuffleFab />
          </Card>
          {isFullscreen && (
            <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
              <Button
                className="opacity-30 duration-500 hover:opacity-90"
                variant="secondary"
                onClick={toggleFullscreen}
              >
                <FormattedMessage id="Tournament.Main.minimize" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardContext.Provider>
  );
};

interface DashboardDesktopProps extends TabProps {
  session: string | null;
  id: string;
  status: TournamentAuthStatus;
  playerId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default DashboardDesktop;
