import type { ClubDashboardTab } from '@/app/clubs/my/tabMap';
import { CLUB_DASHBOARD_NAVBAR_ITEMS } from '@/components/navigation/club-dashboard-navbar-items';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from 'lucide-react';
import { FC, ReactNode } from 'react';

export default function Page() {
  return (
    <>
      <div className="md:hidden">
        <ClubDashboardTabList />
        <div className="mk-container">
          <Skeleton className="h-[80svh] w-full" />
        </div>
      </div>
      <DesktopLoading />
    </>
  );
}

const DesktopLoading: FC = () => (
  <div className="h-mk-content-height hidden w-full flex-col overflow-hidden md:flex">
    <header className="gap-mk p-mk-2 flex items-center">
      <div className="w-full max-w-xs">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grow" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="size-9" />
      <Skeleton className="size-9" />
    </header>
    <div className="gap-mk-2 p-mk-2 flex flex-1 overflow-hidden pt-0">
      <DashboardColumnLoading labelWidth="w-14">
        <PlayersLoading />
      </DashboardColumnLoading>
      <DashboardColumnLoading labelWidth="w-24">
        <TournamentsLoading />
      </DashboardColumnLoading>
    </div>
  </div>
);

const DashboardColumnLoading: FC<{
  labelWidth: string;
  children: ReactNode;
}> = ({ labelWidth, children }) => (
  <Card className="bg-background flex flex-1 flex-col overflow-hidden">
    <div className="px-4 pt-4 pb-2">
      <Skeleton className={`h-5 ${labelWidth}`} />
    </div>
    <div className="flex flex-1 flex-col overflow-y-hidden px-4">
      {children}
    </div>
  </Card>
);

const PlayersLoading: FC = () => (
  <div className="gap-mk flex h-full min-w-0 flex-col">
    <div className="gap-mk flex pt-2 md:top-0 md:z-20">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-10 shrink-0" />
    </div>
    <div className="mk-list w-full max-w-full min-w-0 overflow-hidden">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

const TournamentsLoading: FC = () => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="pb-2">
      <Skeleton className="h-9 w-full" />
    </div>
    <div className="mk-list">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-18 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

const ClubDashboardTabList: FC = () => {
  return (
    <Tabs
      defaultValue="main"
      value="main"
      className="z-40 w-full rounded-none transition-all duration-500"
    >
      <TabsList className="no-scrollbar w-full justify-around overflow-scroll rounded-none md:justify-start">
        {Object.entries(CLUB_DASHBOARD_NAVBAR_ITEMS).map(([title]) => (
          <TabsTrigger key={title} className="w-full" value={title}>
            <Logo tab={title} activeTab={title as ClubDashboardTab} />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

const Logo: FC<{ tab: ReactNode; activeTab: ClubDashboardTab }> = ({
  tab,
  activeTab,
}) => {
  const item = Object.entries(CLUB_DASHBOARD_NAVBAR_ITEMS).find(
    (item) => item[0] === tab,
  );
  const isActive = tab === activeTab;
  if (!item || !item[1].logo) return tab;

  const Icon: LucideIcon = item[1].logo;

  return <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />;
};
