import { TabProps } from '@/app/tournaments/[id]/dashboard';
import {
  DashboardTab,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import tabs from '@/app/tournaments/[id]/dashboard/tabs';
import Overlay from '@/components/overlay';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-grid';
import { useTranslations } from 'next-intl';
import { FC, useContext, useRef } from 'react';

const TabsContainer: FC<TabProps> = ({ currentTab, setCurrentTab }) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Tournament.Tabs');
  const { selectedGameId } = useContext(SelectedGameContext);

  return (
    <Tabs
      defaultValue="main"
      onValueChange={(value) => setCurrentTab(value as DashboardTab)}
      value={currentTab}
      className={`relative h-10 w-full rounded-none`}
    >
      <Overlay open={!!selectedGameId} />
      <TabsList
        ref={tabRef}
        className={`no-scrollbar px-mk h-full w-full justify-around overflow-scroll rounded-none md:justify-evenly lg:px-[20%]`}
      >
        {tabs.map((tab) => (
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
