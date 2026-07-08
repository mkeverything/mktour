'use client';

import { TabProps } from '@/app/tournaments/[id]/dashboard';
import {
  DashboardContext,
  DashboardRoundContext,
  DashboardTabContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Games from '@/app/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/tournaments/[id]/dashboard/tabs/table';
import FormattedMessage from '@/components/formatted-message';
import { useDashboardWebsocket } from '@/components/hooks/use-dashboard-websocket';
import Overlay from '@/components/overlay';
import Fades from '@/components/ui-custom/fades';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DashboardDesktop: React.FC<DashboardDesktopProps> = ({
  currentTab,
  session,
  id,
  status,
  unitId,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const dashboardValue = useMemo(
    () => ({
      sendJsonMessage,
      status,
      unitId,
      userId,
    }),
    [unitId, sendJsonMessage, status, userId],
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <DashboardContext.Provider value={dashboardValue}>
      <DashboardTabContext.Provider value={tabValue}>
        <DashboardRoundContext.Provider value={roundValue}>
          <SelectedGameContext.Provider value={selectedGameValue}>
            <Overlay open={!!selectedGameId} />
            <div className="h-mk-content-height relative inset-0 flex flex-col overflow-hidden">
              <Main />
              <div
                ref={containerRef}
                className="p-mk px-mk-2 flex flex-1 gap-2 overflow-hidden lg:flex-row"
              >
                <Card className="bg-background relative h-full min-h-0 w-full flex-1 overflow-hidden lg:flex-[1]">
                  <CardContent className="flex size-full flex-col overflow-y-auto p-0">
                    <TournamentTable />
                    <Fades from="from-background" to="to-background" />
                  </CardContent>
                </Card>
                <Card className="bg-background relative h-full min-h-0 w-full flex-1 overflow-hidden lg:flex-[2]">
                  <CardContent className="flex size-full flex-col overflow-y-auto p-0">
                    <Games />
                    <Fades from="from-background" to="to-background" />
                  </CardContent>
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
          </SelectedGameContext.Provider>
        </DashboardRoundContext.Provider>
      </DashboardTabContext.Provider>
    </DashboardContext.Provider>
  );
};

interface DashboardDesktopProps extends TabProps {
  session: string | null;
  id: string;
  status: TournamentAuthStatus;
  unitId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default DashboardDesktop;
