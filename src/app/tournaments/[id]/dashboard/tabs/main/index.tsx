'use client';

import { turboPascal } from '@/app/fonts';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import ShuffleButton from '@/app/tournaments/[id]/dashboard/shuffle-button';
import ActionButtons, {
  DestructiveTournamentButtonsComboModal,
} from '@/app/tournaments/[id]/dashboard/tabs/main/action-buttons';
import TournamentInfoList from '@/app/tournaments/[id]/dashboard/tabs/main/tournament-info';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import Center from '@/components/center';
import useTournamentEditTitle from '@/components/hooks/mutation-hooks/use-tournament-edit-title';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import { MainTabLoadingSkeleton } from '@/app/tournaments/[id]/dashboard/loading-skeletons';
import { InputGhost } from '@/components/ui-custom/input-ghost';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChangeEvent,
  FC,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const Main: FC<{ toggleFullscreen?: () => void }> = ({ toggleFullscreen }) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data, isLoading } = useTournamentInfo(tournamentId);
  const { status } = useContext(DashboardContext);
  const tournamentTitle = data?.tournament.title;
  const fallbackTitle = useTournamentFallbackTitle(data?.tournament);
  const title = tournamentTitle || fallbackTitle;
  const [controlledTitle, setControlledTitle] = useState(title);
  const isOrganizer = status === 'organizer';
  const t = useTranslations('Tournament.Main');

  const { mutate } = useTournamentEditTitle(tournamentId);

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setControlledTitle(event.target.value);
    },
    [],
  );

  const handleTitleUpdate = useCallback(() => {
    if (controlledTitle !== tournamentTitle)
      mutate({ tournamentId, title: controlledTitle });
  }, [controlledTitle, mutate, tournamentId, tournamentTitle]);

  if (isLoading) return <LoadingElement />;
  if (!data) return <Center>no data</Center>;

  return (
    <>
      <div className="px-mk pb-mk flex flex-col gap-0 md:hidden">
        <TournamentTitle
          controlledTitle={controlledTitle}
          fallbackTitle={fallbackTitle}
          handleTitleChange={handleTitleChange}
          handleTitleUpdate={handleTitleUpdate}
          isOrganizer={isOrganizer}
          tournament={data.tournament}
          mobile
        />
        <TournamentInfoList />
        {isOrganizer && <ActionButtons tournament={data.tournament} />}
      </div>
      <div className="px-mk md:px-mk-2 hidden md:grid md:grid-cols-2">
        <div className="col-span-2">
          <TournamentTitle
            controlledTitle={controlledTitle}
            fallbackTitle={fallbackTitle}
            handleTitleChange={handleTitleChange}
            handleTitleUpdate={handleTitleUpdate}
            isOrganizer={isOrganizer}
            tournament={data.tournament}
          />
        </div>
        <TournamentInfoList />
        <div className="flex w-full items-start justify-end md:col-span-1 md:items-end">
          <div className="p-mk flex w-full flex-wrap items-center justify-end pr-0 md:w-fit">
            <div className="gap-mk hidden items-center md:flex">
              <AddPlayerDrawer />
              <ShuffleButton />
            </div>
            {isOrganizer && <ActionButtons tournament={data.tournament} />}
            <Button
              title={t('fullscreen')}
              className="text-muted-foreground hover:text-primary hidden justify-self-end md:flex"
              variant="ghost"
              size="icon-sm"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="size-4" />
            </Button>
            {isOrganizer && (
              <DestructiveTournamentButtonsComboModal
                tournament={data.tournament}
                className="hidden md:flex"
              />
            )}
          </div>
        </div>
      </div>
    </>
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

export const LoadingElement = MainTabLoadingSkeleton;

const titleGhostClassName =
  'file:text-foreground placeholder:text-primary selection:bg-primary selection:text-primary-foreground dark:bg-background focus-visible:placeholder:text-muted-foreground w-full max-w-full min-w-0 rounded-md bg-transparent shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed';

const TournamentTitle = memo(function TournamentTitle({
  controlledTitle,
  fallbackTitle,
  handleTitleChange,
  handleTitleUpdate,
  isOrganizer,
  tournament,
  mobile = false,
}: {
  controlledTitle: string;
  fallbackTitle: string;
  handleTitleChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleTitleUpdate: () => void;
  isOrganizer: boolean;
  tournament: Parameters<
    typeof DestructiveTournamentButtonsComboModal
  >[0]['tournament'];
  mobile?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleClassName = cn(`text-3xl ${turboPascal.className}`, {
    truncate: !mobile,
  });

  const resizeTitleTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = '0';
    const lineHeight =
      parseFloat(getComputedStyle(el).lineHeight) ||
      parseFloat(getComputedStyle(el).fontSize) * 1.25;
    const maxHeight = lineHeight * 2;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useLayoutEffect(() => {
    if (mobile && isOrganizer) resizeTitleTextarea();
  }, [controlledTitle, mobile, isOrganizer, resizeTitleTextarea]);

  const handleMobileTitleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      handleTitleChange(event);
      resizeTitleTextarea();
    },
    [handleTitleChange, resizeTitleTextarea],
  );

  return (
    <div
      className={
        mobile
          ? 'py-mk-2 flex items-start gap-0 pl-4'
          : 'p-mk flex items-center justify-between md:pb-0'
      }
    >
      {mobile && !isOrganizer ? (
        <p
          className={cn(
            titleClassName,
            'line-clamp-2 flex-1 leading-tight wrap-break-word',
          )}
        >
          {controlledTitle || fallbackTitle}
        </p>
      ) : mobile ? (
        <textarea
          ref={textareaRef}
          disabled={!isOrganizer}
          placeholder={fallbackTitle}
          value={controlledTitle}
          onBlur={handleTitleUpdate}
          onChange={handleMobileTitleChange}
          rows={1}
          className={cn(
            titleGhostClassName,
            titleClassName,
            'flex-1 resize-none overflow-hidden leading-tight wrap-break-word',
          )}
        />
      ) : (
        <InputGhost
          disabled={!isOrganizer}
          placeholder={fallbackTitle}
          value={controlledTitle}
          onBlur={handleTitleUpdate}
          onChange={handleTitleChange}
          className={titleClassName}
        />
      )}
      {isOrganizer && (
        <DestructiveTournamentButtonsComboModal
          tournament={tournament}
          className={mobile ? '-mr-0.5 shrink-0 self-start' : 'md:hidden'}
        />
      )}
    </div>
  );
});

export default memo(Main);
