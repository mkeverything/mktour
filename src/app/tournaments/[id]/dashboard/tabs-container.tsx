import { TabProps } from '@/app/tournaments/[id]/dashboard';
import {
  DashboardContext,
  DashboardContextType,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { getTabsForMockMode } from '@/app/tournaments/[id]/dashboard/tabs';
import Overlay from '@/components/overlay';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-grid';
import { useTranslations } from 'next-intl';
import { FC, useContext, useMemo, useRef } from 'react';

const TabsContainer: FC<TabProps> = ({
  currentTab,
  setCurrentTab,
  mockMode,
}) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Tournament.Tabs');
  const { selectedGameId } = useContext(DashboardContext);
  const visibleTabs = useMemo(() => getTabsForMockMode(mockMode), [mockMode]);
  const valueInVisible = visibleTabs.some((tab) => tab.title === currentTab)
    ? currentTab
    : (visibleTabs[0]?.title ?? 'main');

  return (
    <Tabs
      defaultValue="main"
      onValueChange={(v) =>
        setCurrentTab(v as DashboardContextType['currentTab'])
      }
      value={valueInVisible}
      className={`relative h-10 w-full rounded-none`}
    >
      <Overlay open={!!selectedGameId} />
      <TabsList
        ref={tabRef}
        className={`no-scrollbar px-mk h-full w-full justify-around overflow-scroll rounded-none md:justify-evenly lg:px-[20%]`}
      >
        {visibleTabs.map((tab) => (
          <div key={tab.title}>
            <TabsTrigger className="w-full" value={tab.title}>
              {t(tab.title)}
            </TabsTrigger>
          </div>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default TabsContainer;
