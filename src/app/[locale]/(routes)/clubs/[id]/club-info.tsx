import { turboPascal } from '@/app/fonts';
import { useAuthSelectClub } from '@/components/hooks/mutation-hooks/use-auth-select-club';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useTRPC } from '@/components/trpc/client';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClubModel } from '@/server/zod/clubs';
import { StatusInClub } from '@/server/zod/enums';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useLayoutEffect, useRef, useState } from 'react';

export const ClubInfo: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
}> = ({ club, statusInClub }) => {
  const t = useTranslations('Club');
  const tStatus = useTranslations('Status');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data: managers } = useQuery(
    trpc.club.managers.all.queryOptions({ clubId: club.id }),
  );
  return (
    <header className="lg:small-scrollbar grid shrink-0 grid-cols-[minmax(0,1fr)_auto] content-start items-start gap-x-4 gap-y-1.5 lg:grid-cols-1 lg:gap-y-6 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:pr-6">
      <h1
        className={cn(
          turboPascal.className,
          'text-2xl leading-tight text-balance break-words md:text-3xl',
        )}
      >
        {club.name}
        {club.lichessTeam && <LichessTeamLink team={club.lichessTeam} />}
      </h1>
      <DashboardButton
        clubId={club.id}
        statusInClub={statusInClub}
        className="lg:justify-self-start"
      />
      {club.description && <ClubDescription description={club.description} />}
      <div className="text-muted-foreground col-span-full flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs lg:flex-col lg:items-start lg:gap-6">
        {club.createdAt && (
          <span>
            {t('Page.createdAt', {
              date: club.createdAt.toLocaleDateString(locale, {
                dateStyle: 'long',
              }),
            })}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-2 max-sm:basis-full lg:flex-col lg:items-start lg:gap-1">
          <span className="max-lg:hidden">{t('managers list')}</span>
          {managers?.map((manager, i) => (
            <span key={manager.user.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn('lg:hidden', i === 0 && 'max-sm:hidden')}
              >
                ·
              </span>
              <Link
                href={`/user/${manager.user.username}`}
                className="hover:text-foreground lg:text-foreground transition-colors lg:text-sm"
              >
                {manager.user.username}
                <span className="text-muted-foreground ml-1.5 text-xs opacity-70">
                  {tStatus(manager.clubs_to_users.status)}
                </span>
              </Link>
            </span>
          ))}
        </div>
      </div>
    </header>
  );
};

const ClubDescription: FC<{ description: string }> = ({ description }) => {
  const t = useTranslations('Common');
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || isExpanded) return;
    const observer = new ResizeObserver(() =>
      setIsClamped(text.scrollHeight > text.clientHeight),
    );
    observer.observe(text);
    return () => observer.disconnect();
  }, [isExpanded]);

  return (
    <div className="col-span-full flex flex-col items-start gap-0.5">
      <p
        ref={textRef}
        className={cn(
          'text-muted-foreground max-w-prose text-sm whitespace-pre-line',
          !isExpanded && 'line-clamp-2 lg:line-clamp-8',
        )}
      >
        {description}
      </p>
      {isClamped && (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('collapse') : t('expand')}
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground active:bg-muted -mx-1.5 mx-auto rounded-full p-1.5 transition-colors active:transition-none"
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-300 ease-out motion-reduce:transition-none',
              isExpanded && 'rotate-180',
            )}
          />
        </button>
      )}
    </div>
  );
};

const DashboardButton: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
  className?: string;
}> = ({ clubId, statusInClub, className }) => {
  const t = useTranslations('Club');
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const { mutate } = useAuthSelectClub(queryClient);

  if (!user || !statusInClub) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('shrink-0 gap-2', className)}
      asChild
    >
      <Link
        prefetch={false}
        onNavigate={() => mutate({ clubId })}
        href="/clubs/my"
        aria-label={t('dashboard')}
      >
        <SlidersHorizontal className="size-4" />
        <span className="max-sm:hidden">{t('dashboard')}</span>
      </Link>
    </Button>
  );
};

const LichessTeamLink: FC<{ team: string }> = ({ team }) => (
  <Link
    href={`https://lichess.org/team/${team}`}
    target="_blank"
    className="ml-3 inline-block align-[-0.1em] transition-opacity hover:opacity-70"
  >
    <LichessLogo className="size-5" />
  </Link>
);
