'use client';

import { turboPascal } from '@/app/fonts';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ActionButtons, {
  DestructiveTournamentButtonsDropdown,
} from '@/app/tournaments/[id]/dashboard/tabs/main/action-buttons';
import TournamentInfoList from '@/app/tournaments/[id]/dashboard/tabs/main/tournament-info';
import Center from '@/components/center';
import useTournamentEditTitle from '@/components/hooks/mutation-hooks/use-tournament-edit-title';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import { InputGhost } from '@/components/ui-custom/input-ghost';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FC, useCallback, useContext, useState } from 'react';

const Main: FC<{ toggleFullscreen?: () => void }> = ({ toggleFullscreen }) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data, isLoading } = useTournamentInfo(tournamentId);
  const { status } = useContext(DashboardContext);
  const tournamentTitle = data?.tournament.title;
  const fallbackTitle = useTournamentFallbackTitle(data?.tournament);
  const title = tournamentTitle || fallbackTitle;
  const [controlledTitle, setControlledTitle] = useState(title);
  const canEditTitle = status === 'organizer' && !data?.tournament.startedAt;

  const { mutate } = useTournamentEditTitle();

  const handleTitleUpdate = useCallback(() => {
    if (controlledTitle !== tournamentTitle)
      mutate({ tournamentId, title: controlledTitle });
  }, [controlledTitle, mutate, tournamentId, tournamentTitle]);

  if (isLoading) return <LoadingElement />;
  if (!data) return <Center>no data</Center>;

  return (
    <div className="max-md:mk-container md:px-mk md:pl-mk-2 items-center md:flex md:justify-between">
      <div>
        <div
          className={`p-mk flex items-center justify-between max-md:border-b max-md:pt-0 md:pb-0`}
        >
          <InputGhost
            disabled={!canEditTitle}
            placeholder={fallbackTitle}
            value={controlledTitle}
            onBlur={handleTitleUpdate}
            onChange={(event) => setControlledTitle(event.target.value)}
            className={`text-3xl ${turboPascal.className} truncate`}
          />
          <DestructiveTournamentButtonsDropdown
            tournament={data.tournament}
            className="md:hidden"
          />
        </div>
        <TournamentInfoList />
      </div>
      <div className="flex items-center">
        <Button
          className="ml-mk text-muted-foreground hover:text-primary hidden justify-self-end md:flex"
          variant="ghost"
          size="icon-sm"
          onClick={toggleFullscreen}
        >
          <Maximize2 className="size-4" />
        </Button>
        <DestructiveTournamentButtonsDropdown
          tournament={data.tournament}
          className="hidden md:flex"
        />
        <ActionButtons status={status} tournament={data.tournament} />
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
    <div className="gap-mk flex md:gap-1">
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

export default Main;
