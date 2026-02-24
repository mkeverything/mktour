'use client';

import DashboardMobile from '@/app/tournaments/[id]/dashboard/mobile/dashboard-mobile';
import { DashboardContextType } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import DashboardDesktop from '@/app/tournaments/[id]/dashboard/desktop/dashboard-desktop';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Status } from '@/server/queries/get-status-in-tournament';
import { Dispatch, FC, SetStateAction, useState, useContext } from 'react';

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
  const { isDesktop } = useContext(MediaQueryContext);

  if (isDesktop) {
    return (
      <DashboardDesktop
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        session={session}
        id={id}
        status={status}
        playerId={playerId}
        userId={userId}
        currentRound={currentRound}
      />
    );
  }

  return (
    <DashboardMobile
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      session={session}
      id={id}
      status={status}
      playerId={playerId}
      userId={userId}
      currentRound={currentRound}
    />
  );
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
