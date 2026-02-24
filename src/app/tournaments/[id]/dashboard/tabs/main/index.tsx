'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ActionButtons from '@/app/tournaments/[id]/dashboard/tabs/main/action-buttons';
import TournamentInfoList from '@/app/tournaments/[id]/dashboard/tabs/main/tournament-info';
import Center from '@/components/center';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';

import { Skeleton } from '@/components/ui/skeleton';
import { getTournamentDisplayName } from '@/lib/tournament-display';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

const Main = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data, isLoading } = useTournamentInfo(tournamentId);
  const { status } = useContext(DashboardContext);
  const formatUtil = useFormatter();
  const t = useTranslations('MakeTournament');

  if (isLoading) return <LoadingElement />;
  if (!data) return <Center>no data</Center>;

  const tournamentDisplayName = getTournamentDisplayName(
    data?.tournament,
    t,
    formatUtil,
  );
  const title = data.tournament.title || tournamentDisplayName;

  return (
    <div className="max-md:mk-container md:px-mk md:pl-mk-2 pt-mk md:flex md:justify-between">
      <div>
        <div className="p-mk flex items-center truncate pt-0 pb-2 text-xl font-bold whitespace-break-spaces max-md:border-b md:pb-0">
          {title}
        </div>
        <TournamentInfoList />
      </div>
      <ActionButtons status={status} tournament={data.tournament} />
    </div>
  );
};

export const LoadingElement = () => {
  return (
    <div className="flex flex-col gap-4 p-4 md:pb-2">
      <div className="md:gap-mk md:flex">
        <Skeleton className="h-11 w-full" />
        <div className="hidden w-1/3 md:block">
          <Skeleton className="h-11" />
        </div>
      </div>
      <div className="mk-list md:hidden">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  );
};

export const InfoItem: FC<{
  icon: FC<{ className?: string }>;
  value: string | number | null | undefined;
  href?: string;
  format?: boolean;
  children?: React.ReactNode;
}> = ({ icon: Icon, value, href, format, children }) => {
  const t = useTranslations('Tournament.Main');
  return (
    <div className="flex gap-2">
      <Icon className="text-muted-foreground my-auto size-4" />
      {!href ? (
        format ? (
          <span>{t(String(value))}</span>
        ) : (
          <span>{value}</span>
        )
      ) : (
        <Link href={href} className="mk-link hover:opacity-75">
          {value}
        </Link>
      )}
      {children}
    </div>
  );
};

export default Main;
