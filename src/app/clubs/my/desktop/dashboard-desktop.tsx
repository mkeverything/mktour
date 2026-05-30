'use client';

import ClubInbox from '@/app/clubs/my/(tabs)/notifications';
import ClubSettings from '@/app/clubs/my/(tabs)/settings';
import ClubSelect from '@/app/clubs/my/club-select';
import ClubPlayersList from '@/app/clubs/players';
import ClubDashboardTournaments from '@/app/clubs/tournaments';
import Fab from '@/components/fab';
import { useClubNotifications } from '@/components/hooks/query-hooks/use-club-notifications';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusInClub } from '@/server/zod/enums';
import { UserModel } from '@/server/zod/users';
import { ArrowLeft, ExternalLink, Mail, Settings, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode, useState } from 'react';

const DashboardDesktop: FC<{
  user: UserModel;
  userId: string;
  statusInClub: StatusInClub;
}> = ({ user, userId, statusInClub }) => {
  const t = useTranslations('Club');
  const tCommon = useTranslations('Common');
  const [openSettings, setOpenSettings] = useState(false);
  const selectedClub = user.selectedClub;
  const [openNotifications, setOpenNotifications] = useState(false);
  const notifications = useClubNotifications(selectedClub);
  const hasNewNotifications = Boolean(
    notifications?.data?.pages?.some((page) =>
      page.notifications.some(({ isSeen }) => !isSeen),
    ),
  );

  return (
    <div className="h-mk-content-height flex w-full flex-col overflow-hidden">
      <header className="gap-mk p-mk-2 flex items-center">
        <div className="w-full max-w-xs">
          <ClubSelect user={user} />
        </div>
        {openSettings && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setOpenSettings(false)}
          >
            <ArrowLeft className="size-4" />
            {tCommon('back')}
          </Button>
        )}
        <div className="grow" />
        <Button variant="outline" asChild>
          <Link href={`/clubs/${selectedClub}`}>
            {t('page')}
            <ExternalLink />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={() => setOpenNotifications((prev) => !prev)}
        >
          <Mail />
          {hasNewNotifications && (
            <span className="bg-destructive absolute -top-1 -right-1 size-3 rounded-full" />
          )}
        </Button>
        <NotificationsDrawer
          open={openNotifications}
          setOpen={setOpenNotifications}
          selectedClub={selectedClub}
        />
        <Button
          variant={openSettings ? 'default' : 'outline'}
          size="icon"
          aria-label={t('settings')}
          onClick={() => setOpenSettings((prev) => !prev)}
        >
          <Settings />
        </Button>
      </header>

      {!openSettings ? (
        <div className="gap-mk-2 p-mk-2 flex flex-1 overflow-hidden pt-0">
          <DashboardColumn label={t('Dashboard.players')}>
            <ClubPlayersList
              selectedClub={selectedClub}
              userId={userId}
              statusInClub={statusInClub}
            />
          </DashboardColumn>
          <DashboardColumn label={t('Dashboard.tournaments')}>
            <ClubDashboardTournaments
              selectedClub={selectedClub}
              userId={userId}
              statusInClub={statusInClub}
            />
          </DashboardColumn>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ClubSettings selectedClub={selectedClub} userId={userId} />
        </div>
      )}
    </div>
  );
};

const DashboardColumn: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <Card className="bg-background flex flex-1 flex-col overflow-hidden">
    <div className="px-4 pt-4 pb-2">
      <h2 className="text-muted-foreground text-sm">{label}</h2>
    </div>
    <div className="flex flex-1 flex-col overflow-y-hidden px-4">
      {children}
    </div>
  </Card>
);

const NotificationsDrawer: FC<{
  selectedClub: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}> = ({ selectedClub, open, setOpen }) => {
  return (
    <SideDrawer open={open} setOpen={setOpen}>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <ClubInbox selectedClub={selectedClub} />
      </div>
      <Fab
        className={`${!open && 'hidden'}`}
        onClick={() => setOpen(false)}
        icon={X}
      />
    </SideDrawer>
  );
};

export default DashboardDesktop;
