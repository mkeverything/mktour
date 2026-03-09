'use client';

import {
  type DashboardContextType,
  type MockMode,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import DashboardDesktop from '@/app/tournaments/[id]/dashboard/desktop/dashboard-desktop';
import DashboardMobile from '@/app/tournaments/[id]/dashboard/mobile/dashboard-mobile';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { Dispatch, FC, SetStateAction, useContext, useState } from 'react';

const isElimination = (m: MockMode) =>
  m === 'single_elim' || m === 'double_elim';

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
  const [mockMode, setMockMode] = useState<MockMode>('none');
  const { isDesktop } = useContext(MediaQueryContext);
  const Component = isDesktop ? DashboardDesktop : DashboardMobile;

  const effectiveTab: DashboardContextType['currentTab'] =
    isElimination(mockMode) && currentTab === 'table' ? 'games' : currentTab;

  return (
    <Component
      currentTab={effectiveTab}
      setCurrentTab={setCurrentTab}
      session={session}
      id={id}
      status={status}
      playerId={playerId}
      userId={userId}
      currentRound={currentRound}
      mockMode={mockMode}
      setMockMode={setMockMode}
    />
  );
};

export type TabProps = {
  currentTab: DashboardContextType['currentTab'];
  setCurrentTab: Dispatch<SetStateAction<DashboardContextType['currentTab']>>;
  mockMode: MockMode;
  setMockMode: Dispatch<SetStateAction<MockMode>>;
  top?: string;
};

export type TabType = {
  title: 'main' | 'table' | 'games';
  component: FC;
};

interface TournamentPageContentProps {
  session: string | null;
  id: string;
  status: TournamentAuthStatus;
  playerId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default Dashboard;
