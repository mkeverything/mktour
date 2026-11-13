'use client';

import { DashboardTab } from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/dashboard-context';
import DashboardDesktop from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/desktop/dashboard-desktop';
import DashboardMobile from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/mobile/dashboard-mobile';
import tabs from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { TournamentAuthStatus } from '@/server/zod/enums';
import {
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';

const Dashboard: FC<TournamentPageContentProps> = ({
  userId,
  id,
  status,
  unitId,
  tab,
}) => {
  const [currentTab, setCurrentTab] = useState<DashboardTab>(
    () => tabs.find(({ title }) => title === tab)?.title ?? 'main',
  );
  const { isDesktop } = useContext(MediaQueryContext);
  const Component = isDesktop ? DashboardDesktop : DashboardMobile;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentTab === 'main') url.searchParams.delete('tab');
    else url.searchParams.set('tab', currentTab);
    if (url.href !== window.location.href) {
      window.history.replaceState(null, '', url);
    }
  }, [currentTab]);

  return (
    <Component
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      id={id}
      status={status}
      unitId={unitId}
      userId={userId}
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
  id: string;
  status: TournamentAuthStatus;
  unitId: string | null;
  userId: string | undefined;
  tab: string | undefined;
}

export default Dashboard;
