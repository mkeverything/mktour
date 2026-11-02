'use client';

import {
  ClubDashboardTab,
  tabMap,
} from '@/app/[locale]/(routes)/clubs/my/tabMap';
import { useClubInboxCounter } from '@/components/hooks/query-hooks/use-club-notifications';
import { CLUB_DASHBOARD_NAVBAR_ITEMS } from '@/components/navigation/club-dashboard-navbar-items';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import Badge, { BadgeWithCount } from '@/components/ui-custom/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useContext } from 'react';

const ClubDashboardTabList: FC<{
  selectedClub: string;
  setTab: (_arg: ClubDashboardTab) => void;
  activeTab: ClubDashboardTab;
}> = ({ selectedClub, setTab, activeTab }) => {
  const { isMobile } = useContext(MediaQueryContext);
  const preparedTabs = Object.keys(tabMap) as ClubDashboardTab[];
  const { data: inboxCounter } = useClubInboxCounter(selectedClub);
  const counter = inboxCounter
    ? inboxCounter.requests + inboxCounter.notifications
    : 0;
  const hasNewNotifications = counter > 0;

  return (
    <Tabs
      defaultValue="main"
      onValueChange={(value) => setTab(value as ClubDashboardTab)}
      value={activeTab}
      className="z-40 w-full rounded-none"
    >
      <TabsList className="no-scrollbar w-full justify-around overflow-scroll rounded-none md:justify-start lg:px-[20%]">
        {preparedTabs.map((tab) => (
          <TabsTrigger key={tab} className="w-full" value={tab}>
            <TabContent
              tab={tab}
              hasNewNotifications={hasNewNotifications}
              activeTab={activeTab}
              isMobile={isMobile}
              counter={counter}
            />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

const TabContent: FC<{
  tab: ClubDashboardTab;
  activeTab: ClubDashboardTab;
  hasNewNotifications: boolean;
  isMobile: boolean;
  counter: number;
}> = ({ tab, activeTab, hasNewNotifications, isMobile, counter }) => {
  const item = CLUB_DASHBOARD_NAVBAR_ITEMS[tab];
  const isActive = tab === activeTab;
  const t = useTranslations('Club.Dashboard');

  if (!item || !item.logo) return tab;

  const Icon: LucideIcon = item.logo;
  const shouldShowBadge = hasNewNotifications && tab === 'notifications';

  return (
    <div className="gap-mk relative flex w-fit items-center">
      {isMobile ? <Icon size={18} strokeWidth={isActive ? 2.5 : 2} /> : t(tab)}
      {shouldShowBadge &&
        (isMobile ? (
          <Badge className="top-0" />
        ) : (
          <BadgeWithCount count={counter} />
        ))}
    </div>
  );
};

export default ClubDashboardTabList;
