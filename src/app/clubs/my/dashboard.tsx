'use client';

import ClubSelect from '@/app/clubs/my/club-select';
import ClubDashboardTabList from '@/app/clubs/my/dashboard-tab-list';
import DashboardDesktop from '@/app/clubs/my/desktop/dashboard-desktop';
import { ClubDashboardTab, ClubTabProps, tabMap } from '@/app/clubs/my/tabMap';
import Loading from '@/app/loading';
import Empty from '@/components/empty';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import SwipeHandlerProvider from '@/components/swipe-handler-provider';
import { StatusInClub } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { Dispatch, FC, SetStateAction, useContext, useState } from 'react';

export default function Dashboard({
  userId,
  statusInClub,
}: {
  userId: string;
  statusInClub: StatusInClub;
}) {
  const t = useTranslations('Club.Dashboard');
  const { data, isLoading } = useAuth();
  const { isDesktop } = useContext(MediaQueryContext);
  const [tab, setTab] = useState<ClubDashboardTab>('main');
  const ActiveTab: FC<ClubTabProps> = tabMap[tab];
  const tabs = Object.keys(tabMap) as ClubDashboardTab[];
  const indexOfTab = tabs.indexOf(tab);

  if (!data && isLoading) return <Loading />;
  if (!data) return <Empty>{t('no data')}</Empty>;

  if (isDesktop)
    return (
      <DashboardDesktop
        user={data}
        userId={userId}
        statusInClub={statusInClub}
      />
    );

  return (
    <SwipeHandlerProvider
      handleSwipe={(dir) => handleSwipe(dir, indexOfTab, tabs, setTab)}
    >
      <div className="fixed top-14 z-10 w-full">
        <ClubDashboardTabList
          selectedClub={data.selectedClub}
          activeTab={tab}
          setTab={setTab}
        />
        <div className="p-mk pb-0">
          <ClubSelect user={data} currentTab={tab} />
        </div>
      </div>
      <div className="px-mk fixed h-[calc(100%-3.5rem)] w-full overflow-y-auto pt-22">
        <ActiveTab
          userId={userId}
          selectedClub={data.selectedClub}
          statusInClub={statusInClub}
        />
      </div>
    </SwipeHandlerProvider>
  );
}

const handleSwipe = (
  direction: string,
  indexOfTab: number,
  tabs: ClubDashboardTab[],
  setTab: Dispatch<SetStateAction<ClubDashboardTab>>,
) => {
  let newIndex;
  if (direction === 'right') {
    newIndex = indexOfTab > 0 ? indexOfTab - 1 : tabs.length - 1;
  } else if (direction === 'left') {
    newIndex = indexOfTab < tabs.length - 1 ? indexOfTab + 1 : 0;
  } else return;

  setTab(tabs[newIndex]);
};
