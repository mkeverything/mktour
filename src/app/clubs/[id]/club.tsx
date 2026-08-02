'use client';

import { DashboardButton, LichessTeamLink } from '@/app/clubs/[id]/club-shared';
import { ClubTournaments } from '@/app/clubs/tournaments';
import { turboPascal } from '@/app/fonts';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ClubModel } from '@/server/zod/clubs';
import { StatusInClub } from '@/server/zod/enums';
import { PlayerModel } from '@/server/zod/players';
import { TournamentModel } from '@/server/zod/tournaments';
import { useQuery } from '@tanstack/react-query';
import { Dot, Percent, Trophy, Users2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, ReactNode } from 'react';

const ClubPage: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
  userId: string;
}> = ({ club, statusInClub, userId }) => {
  return (
    <div className="p-mk md:p-mk-2 gap-mk lg:h-mk-content-height flex w-full flex-col lg:overflow-hidden">
      <HeaderStrip club={club} statusInClub={statusInClub} />

      <div className="gap-mk-2 hidden min-h-0 flex-1 lg:flex">
        <div className="gap-mk flex min-h-0 min-w-0 flex-[5] flex-col">
          <LiveNowCarousel clubId={club.id} />
          <Section
            icon={Trophy}
            title={<FormattedMessage id="Menu.tournaments" />}
            className="flex-1"
          >
            <ClubTournaments clubId={club.id} statusInClub={statusInClub} />
          </Section>
        </div>
        <PlayersLeaderboard
          clubId={club.id}
          userId={userId}
          className="min-h-0 flex-[4]"
        />
      </div>

      <div className="gap-mk flex flex-col lg:hidden">
        <LiveNowCarousel clubId={club.id} />
        <Tabs defaultValue="tournaments" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournaments">
              <FormattedMessage id="Menu.tournaments" />
            </TabsTrigger>
            <TabsTrigger value="players">
              <FormattedMessage id="Club.Page.players" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tournaments">
            <div className="h-[32rem] pt-2">
              <ClubTournaments clubId={club.id} statusInClub={statusInClub} />
            </div>
          </TabsContent>
          <TabsContent value="players">
            <PlayersLeaderboard
              clubId={club.id}
              userId={userId}
              className="h-[32rem] pt-2"
              hideHeading
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const HeaderStrip: FC<{
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
    <header className="gap-mk flex shrink-0 flex-wrap items-end justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-3">
          <h1
            className={cn(
              turboPascal.className,
              'truncate text-2xl leading-tight md:text-3xl',
            )}
          >
            {club.name}
          </h1>
          {club.lichessTeam && <LichessTeamLink team={club.lichessTeam} />}
        </div>
        {club.description && (
          <p className="text-muted-foreground max-w-prose text-sm lg:line-clamp-1">
            {club.description}
          </p>
        )}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {club.createdAt && (
            <span>
              {t('Page.createdAt', {
                date: club.createdAt.toLocaleDateString(locale, {
                  dateStyle: 'medium',
                }),
              })}
            </span>
          )}
          {managers && managers.length > 0 && (
            <>
              <span aria-hidden>·</span>
              {managers.map((manager) => (
                <Link
                  key={manager.user.id}
                  href={`/user/${manager.user.username}`}
                  className="hover:text-foreground transition-colors"
                >
                  {manager.user.username}
                  <span className="text-muted-foreground/60 ml-0.5">
                    ({tStatus(manager.clubs_to_users.status)})
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="gap-mk-2 flex items-center">
        <InlineStats clubId={club.id} />
        <DashboardButton clubId={club.id} statusInClub={statusInClub} />
      </div>
    </header>
  );
};

const InlineStats: FC<{ clubId: string }> = ({ clubId }) => {
  const { data: stats, isPending } = useClubStats(clubId);
  const t = useTranslations('Club.Stats');

  if (isPending) return <Skeleton className="h-8 w-32" />;
  return (
    <div className="gap-mk-2 flex items-baseline">
      <InlineStat
        value={stats?.tournamentsCount ?? 0}
        label={t('tournaments', { count: stats?.tournamentsCount ?? 0 })}
      />
      <InlineStat
        value={stats?.playersCount ?? 0}
        label={t('players', { count: stats?.playersCount ?? 0 })}
      />
    </div>
  );
};

const InlineStat: FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="flex items-baseline gap-1.5">
    <span className={cn(turboPascal.className, 'text-2xl leading-none')}>
      {value}
    </span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </span>
);

const Section: FC<{
  icon: FC<{ className?: string }>;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ icon: Icon, title, className, children }) => (
  <section className={cn('flex min-h-0 min-w-0 flex-col', className)}>
    <div className="flex shrink-0 items-center gap-2 border-b pb-2">
      <Icon className="text-muted-foreground size-4" />
      <h2 className="text-sm font-medium">{title}</h2>
    </div>
    <div className="flex min-h-0 flex-1 flex-col pt-2">{children}</div>
  </section>
);

const LiveNowCarousel: FC<{ clubId: string }> = ({ clubId }) => {
  const { data } = useClubTournaments(clubId);
  const liveTournaments =
    data?.pages
      .flatMap((page) => page.tournaments)
      .filter((tournament) => tournament.startedAt && !tournament.closedAt) ??
    [];

  if (!liveTournaments.length) return null;
  return (
    <div className="gap-mk no-scrollbar flex shrink-0 snap-x overflow-x-auto">
      {liveTournaments.map((tournament) => (
        <LiveTournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
};

const LiveTournamentCard: FC<{ tournament: TournamentModel }> = ({
  tournament,
}) => {
  const t = useTranslations('Club.Page');
  const tTournament = useTranslations('MakeTournament');
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const title = tournament.title || fallbackTitle;
  const details = [
    tournament.rated ? tTournament('rated') : tTournament('unrated'),
    tTournament(tournament.format),
    tTournament(`Types.${tournament.type}`),
  ];

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="min-w-72 flex-1 snap-start"
    >
      <Card className="border-primary/15 bg-primary/5 p-mk-2 hover:bg-primary/10 flex h-full flex-col gap-1 transition-colors">
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="text-xs font-medium">{t('liveNow')}</span>
          {!!tournament.roundsNumber && (
            <span className="text-muted-foreground ml-auto text-xs">
              {t('roundOf', {
                round: tournament.ongoingRound,
                rounds: tournament.roundsNumber,
              })}
            </span>
          )}
        </div>
        <span className="truncate text-sm font-medium">{title}</span>
        <div className="text-muted-foreground flex flex-wrap items-center text-xs">
          {details.map((detail, i) => (
            <span key={i} className="flex items-center">
              {detail}
              {i !== details.length - 1 && <Dot className="size-4" />}
            </span>
          ))}
        </div>
      </Card>
    </Link>
  );
};

const LiveDot: FC = () => (
  <span className="relative flex size-2">
    <span className="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
    <span className="bg-destructive relative inline-flex size-2 rounded-full" />
  </span>
);

// per-player win rate and tournaments played are not in the players list
// payload yet; deterministic mocks until a server-side aggregate exists
const mockWinRate = (rating: number) => 35 + (rating % 31);
const mockTournamentsPlayed = (rating: number) => (rating % 17) + 1;

const LEADERBOARD_ROW_GRID =
  'grid grid-cols-[2rem_minmax(0,1fr)_3.5rem_2.5rem_2.5rem] items-center gap-2';

const PlayersLeaderboard: FC<{
  clubId: string;
  userId: string;
  className?: string;
  hideHeading?: boolean;
}> = ({ clubId, userId, className, hideHeading }) => {
  const t = useTranslations();
  const trpc = useTRPC();
  const { data: stats } = useClubStats(clubId);
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({ clubId, type: 'players' });
  const playersInfinite = useClubPlayers(clubId);
  const { data: me } = useQuery(
    trpc.club.authPlayer.queryOptions({ clubId }, { enabled: Boolean(userId) }),
  );

  const useSearch = debouncedSearch.length > 0;
  const playersFromPages =
    playersInfinite.data?.pages.flatMap((p) => p.players) ?? [];
  const players = useSearch ? (searchResults?.players ?? []) : playersFromPages;
  const meLoaded = Boolean(
    me && playersFromPages.some((player) => player.id === me.id),
  );

  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      {!hideHeading && (
        <div className="mb-2 flex items-center gap-2 border-b pb-2">
          <Users2 className="text-muted-foreground size-4" />
          <h2 className="text-sm font-medium">
            <FormattedMessage id="Club.Page.players" />
          </h2>
        </div>
      )}
      <div className="pb-2">
        <ClubSearchInput search={search} setSearch={setSearch} />
      </div>
      <div
        className={cn(
          LEADERBOARD_ROW_GRID,
          'text-muted-foreground border-b px-1 pb-1 text-xs',
        )}
      >
        <span>#</span>
        <span>{t('Player.nickname')}</span>
        <span className="text-right">{t('Player.rating')}</span>
        <span
          className="flex justify-end"
          title={t('Player.Stats.tournaments')}
        >
          <Trophy className="size-3.5" />
          <span className="sr-only">{t('Player.Stats.tournaments')}</span>
        </span>
        <span className="flex justify-end" title={t('Player.Stats.winRate')}>
          <Percent className="size-3.5" />
          <span className="sr-only">{t('Player.Stats.winRate')}</span>
        </span>
      </div>
      {playersInfinite.status === 'pending' && !useSearch ? (
        <SkeletonList length={8} className="h-8" />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col">
            {players.map((player, index) => (
              <LeaderboardRow
                key={player.id}
                player={player}
                rank={useSearch ? null : index + 1}
                isMe={player.id === me?.id}
              />
            ))}
            {players.length === 0 && (
              <Empty className="text-center text-balance">
                {stats?.playersCount !== 0
                  ? t('GlobalSearch.not found')
                  : t('Empty.players')}
              </Empty>
            )}
            <Paginator
              disabled={useSearch}
              hasNextPage={playersInfinite.hasNextPage}
              isFetchingNextPage={playersInfinite.isFetchingNextPage}
              fetchNextPage={playersInfinite.fetchNextPage}
              skeleton={<SkeletonList length={3} className="h-8" />}
            />
            {me && !useSearch && !meLoaded && (
              <LeaderboardRow player={me} rank={null} isMe />
            )}
          </div>
        </ScrollArea>
      )}
    </section>
  );
};

const LeaderboardRow: FC<{
  player: PlayerModel;
  rank: number | null;
  isMe?: boolean;
}> = ({ player, rank, isMe }) => (
  <Link
    href={`/player/${player.id}`}
    className={cn(
      LEADERBOARD_ROW_GRID,
      'hover:bg-muted/50 border-b px-1 py-1.5 text-sm transition-colors last:border-0',
      isMe && 'bg-muted hover:bg-muted sticky top-0 bottom-0 z-10 font-medium',
    )}
  >
    <span className="text-muted-foreground text-xs">{rank ?? '—'}</span>
    <span className="min-w-0 truncate">{player.nickname}</span>
    <span className="text-right font-semibold">{player.rating}</span>
    <span className="text-muted-foreground text-right text-xs">
      {mockTournamentsPlayed(player.rating)}
    </span>
    <span className="text-muted-foreground text-right text-xs">
      {mockWinRate(player.rating)}%
    </span>
  </Link>
);

export default ClubPage;
