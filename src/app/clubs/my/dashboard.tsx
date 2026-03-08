'use client';

import AddPlayerDrawer from '@/app/clubs/my/add-new-player';
import ClubSelect from '@/app/clubs/my/club-select';
import ClubDashboardTabList from '@/app/clubs/my/dashboard-tab-list';
import { ClubDashboardTab, ClubTabProps, tabMap } from '@/app/clubs/my/tabMap';
import Loading from '@/app/loading';
import Empty from '@/components/empty';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import useScrollableContainer from '@/components/hooks/use-scrollable-container';
import SwipeHandlerProvider from '@/components/swipe-handler-provider';
import FabProvider from '@/components/ui-custom/fab-provider';
import { StatusInClub } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { Dispatch, FC, ReactNode, SetStateAction, useState } from 'react';

export default function Dashboard({
  userId,
  statusInClub,
}: {
  userId: string;
  statusInClub: StatusInClub | null;
}) {
  const t = useTranslations('Club.Dashboard');
  const { data, isLoading } = useAuth();
  const [tab, setTab] = useState<ClubDashboardTab>('main');
  const ActiveTab: FC<ClubTabProps> = tabMap[tab];
  const tabs = Object.keys(tabMap) as ClubDashboardTab[];
  const indexOfTab = tabs.indexOf(tab);
  const fabContent = fabTabMap[tab];
  const [scrolling, setScrolling] = useState(false);
  const ref = useScrollableContainer({ setScrolling });

  if (!data && isLoading) return <Loading />;
  if (!data) return <Empty>{t('no data')}</Empty>;

  return (
    <SwipeHandlerProvider
      handleSwipe={(dir) => handleSwipe(dir, indexOfTab, tabs, setTab)}
    >
      <FabProvider
        status="organizer"
        fabContent={fabContent}
        scrolling={scrolling}
      />
      <div className="fixed top-14 z-10 w-full">
        <ClubDashboardTabList
          selectedClub={data.selectedClub}
          activeTab={tab}
          setTab={setTab}
        />
        <ClubSelect user={data} />
      </div>
      <div className="fixed h-full w-full overflow-scroll">
        <div ref={ref} className="mk-container relative pt-24">
          <div className="m-auto h-full max-w-xl pb-20">
            <ActiveTab
              userId={userId}
              selectedClub={data.selectedClub}
              statusInClub={statusInClub}
            />
          </div>
        </div>
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

const fabTabMap: Record<ClubDashboardTab, ReactNode | undefined> = {
  players: <AddPlayerDrawer />,
  tournaments: undefined,
  main: undefined,
  notifications: undefined,
  settings: undefined,
};
