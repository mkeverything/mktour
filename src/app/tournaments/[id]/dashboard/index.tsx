'use client';

import { DashboardTab } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import DashboardDesktop from '@/app/tournaments/[id]/dashboard/desktop/dashboard-desktop';
import DashboardMobile from '@/app/tournaments/[id]/dashboard/mobile/dashboard-mobile';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { Dispatch, FC, SetStateAction, useContext, useState } from 'react';

const Dashboard: FC<TournamentPageContentProps> = ({
  userId,
  session,
  id,
  status,
  unitId,
  currentRound,
}) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>('main');
  const { isDesktop } = useContext(MediaQueryContext);
  const Component = isDesktop ? DashboardDesktop : DashboardMobile;

  return (
    <Component
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      session={session}
      id={id}
      status={status}
      unitId={unitId}
      userId={userId}
      currentRound={currentRound}
    />
  );
};

export type TabProps = {
  currentTab: DashboardTab;
  setCurrentTab: Dispatch<SetStateAction<DashboardTab>>;
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
  unitId: string | null;
  userId: string | undefined;
  currentRound: number | null;
}

export default Dashboard;
