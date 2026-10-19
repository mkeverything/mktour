'use client';

import { ClubInfo } from '@/app/[locale]/(routes)/clubs/[id]/club-info';
import { Count } from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import { PlayersPanel } from '@/app/[locale]/(routes)/clubs/[id]/club-players';
import { TournamentsPanel } from '@/app/[locale]/(routes)/clubs/[id]/club-tournaments';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClubModel } from '@/server/zod/clubs';
import { StatusInClub } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { FC, useRef } from 'react';

const PANEL_CLASS_NAME =
  'gap-2 mt-0 flex min-w-0 flex-col max-lg:data-[state=inactive]:hidden lg:min-h-0';

const ClubPage: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
  userId: string;
}> = ({ club, statusInClub, userId }) => {
  const t = useTranslations();
  const { data: stats } = useClubStats(club.id);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsBarRef = useRef<HTMLDivElement>(null);

  const keepTabsInView = () => {
    const tabsTop = tabsRef.current?.getBoundingClientRect().top ?? 0;
    const barTop = tabsBarRef.current?.getBoundingClientRect().top ?? 0;
    if (tabsTop < barTop) tabsRef.current?.scrollIntoView();
  };

  return (
    <div
      data-fixed-viewport
      className="lg:h-mk-content-height p-mk-2 flex w-full flex-col gap-4 scroll-smooth lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <ClubInfo club={club} statusInClub={statusInClub} />
      <Tabs
        ref={tabsRef}
        defaultValue="tournaments"
        onValueChange={keepTabsInView}
        className="scroll-mt-mk-navbar-total-height club-sticky-top lg:grid lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-4"
      >
        <div
          ref={tabsBarRef}
          className="bg-background top-mk-navbar-total-height sticky z-30 -mx-2 px-2 py-2 lg:hidden"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournaments" className="gap-1.5">
              {t('Menu.tournaments')}
              <Count value={stats?.tournamentsCount} />
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-1.5">
              {t('Club.Page.players')}
              <Count value={stats?.playersCount} />
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          forceMount
          value="tournaments"
          className={PANEL_CLASS_NAME}
        >
          <TournamentsPanel clubId={club.id} statusInClub={statusInClub} />
        </TabsContent>
        <TabsContent forceMount value="players" className={PANEL_CLASS_NAME}>
          <PlayersPanel clubId={club.id} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClubPage;
