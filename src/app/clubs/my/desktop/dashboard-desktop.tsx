'use client';

import ClubMain from '@/app/clubs/my/(tabs)/main';
import ClubInbox from '@/app/clubs/my/(tabs)/notifications';
import ClubSettings from '@/app/clubs/my/(tabs)/settings';
import ClubSelect from '@/app/clubs/my/club-select';
import ClubPlayersList from '@/app/clubs/players';
import ClubDashboardTournaments from '@/app/clubs/tournaments';
import Loading from '@/app/loading';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import HalfCard from '@/components/ui-custom/half-card';
import { StatusInClub } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren } from 'react';

export default function ClubDashboardDesktop({
  userId,
  statusInClub,
}: {
  userId: string;
  statusInClub: StatusInClub | null;
}) {
  const t = useTranslations('Club.Dashboard');
  const { data, isLoading } = useAuth();

  if (!data && isLoading) return <Loading />;
  if (!data) return <Empty>{t('no data')}</Empty>;

  const tabProps = {
    userId,
    selectedClub: data?.selectedClub,
    statusInClub,
  };

  return (
    <div className="p-mk-2 relative flex flex-col pt-0">
      <div className="sticky top-14 z-10">
        <ClubSelect user={data} />
      </div>
      <div className="mk-container">
        <ClubMain {...tabProps} />
      </div>
      <div className="gap-mk-2 grid size-full auto-rows-[512px] grid-cols-3">
        <div className="gap-mk flex flex-col">
          <span className="text-sm">
            <FormattedMessage id="Club.Dashboard.tournaments" />
          </span>
          <ClubHalfCard>
            <ClubDashboardTournaments {...tabProps} />
          </ClubHalfCard>
        </div>
        <div className="gap-mk flex flex-col">
          <span className="text-sm">
            <FormattedMessage id="Club.Dashboard.players" />
          </span>
          <ClubHalfCard>
            <ClubPlayersList {...tabProps} />
          </ClubHalfCard>
        </div>
        <div className="gap-mk flex flex-col">
          <span className="text-sm">
            <FormattedMessage id="Club.Dashboard.notifications" />
          </span>
          <ClubHalfCard>
            <ClubInbox {...tabProps} />
          </ClubHalfCard>
        </div>
        <div className="col-span-3">
          <ClubSettings {...tabProps} />
        </div>
      </div>
    </div>
  );
}

const ClubHalfCard: FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => {
  return (
    <HalfCard className={`p-mk-2 h-full overflow-scroll ${className}`}>
      {children}
    </HalfCard>
  );
};
