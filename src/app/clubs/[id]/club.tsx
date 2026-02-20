'use client';

import FormattedMessage from '@/components/formatted-message';
import { useAuthSelectClub } from '@/components/hooks/mutation-hooks/use-auth-select-club';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useSearchQuery } from '@/components/hooks/query-hooks/use-search-result';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useDebounce } from '@/components/hooks/use-debounce';
import TournamentItemIteratee from '@/components/tournament-item';
import { useTRPC } from '@/components/trpc/client';
import HalfCard from '@/components/ui-custom/half-card';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClubModel } from '@/server/db/zod/clubs';
import { StatusInClub } from '@/server/db/zod/enums';
import { PlayerModel } from '@/server/db/zod/players';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Home, Search, Trophy, Users2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useEffect, useState } from 'react';

const ClubPage: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
  userId: string;
}> = ({ club, statusInClub }) => {
  return (
    <div className="mk-container flex flex-col gap-6">
      <ClubHeader club={club} statusInClub={statusInClub} />
      <ClubStats clubId={club.id} />
      <MostActivePlayers clubId={club.id} />

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <ClubTournamentsSection clubId={club.id} statusInClub={statusInClub} />
        <ClubPlayersSection clubId={club.id} />
      </div>

      <div className="md:hidden">
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
            <ClubTournamentsSection
              clubId={club.id}
              statusInClub={statusInClub}
            />
          </TabsContent>
          <TabsContent value="players">
            <ClubPlayersSection clubId={club.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const ClubHeader: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
}> = ({ club, statusInClub }) => {
  const t = useTranslations('Club');
  const tStatus = useTranslations('Status');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const { mutate } = useAuthSelectClub(queryClient);
  const trpc = useTRPC();
  const { data: managers } = useQuery(
    trpc.club.managers.all.queryOptions({ clubId: club.id }),
  );

  return (
    <HalfCard>
      <CardHeader className="pb-4 max-sm:p-4 max-sm:pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{club.name}</CardTitle>
              {club.lichessTeam && (
                <Link
                  href={`https://lichess.org/team/${club.lichessTeam}`}
                  target="_blank"
                  className="transition-opacity hover:opacity-70"
                >
                  <LichessLogo className="size-5" />
                </Link>
              )}
            </div>
            {club.description && (
              <span className="text-muted-foreground text-sm">
                {club.description}
              </span>
            )}
            {managers && managers.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t('managers list')}:
                </span>
                {managers.map((manager) => (
                  <Link
                    key={manager.user.id}
                    href={`/user/${manager.user.username}`}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {manager.user.username}
                    <span className="text-muted-foreground/60 ml-1">
                      ({tStatus(manager.clubs_to_users.status)})
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {user && statusInClub && (
            <Button variant="outline" className="shrink-0 gap-2" asChild>
              <Link
                prefetch={false}
                onNavigate={() => {
                  mutate({ clubId: club.id });
                }}
                href="/clubs/my"
              >
                <Home className="size-4" />
                <span className="hidden sm:inline">{t('dashboard')}</span>
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 max-sm:px-4 max-sm:pb-0">
        <Separator className="mb-4" />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <CalendarDays className="size-4" />
          {club.createdAt &&
            t('Page.createdAt', {
              date: club.createdAt.toLocaleDateString(locale, {
                dateStyle: 'long',
              }),
            })}
        </div>
      </CardContent>
    </HalfCard>
  );
};

const ClubStats: FC<{ clubId: string }> = ({ clubId }) => {
  const { data: stats, isPending } = useClubStats(clubId);
  const t = useTranslations('Club.Stats');

  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        icon={Trophy}
        label={t('tournaments', { count: stats?.tournamentsCount ?? 0 })}
        value={stats?.tournamentsCount}
        isLoading={isPending}
      />
      <StatCard
        icon={Users2}
        label={t('players', { count: stats?.playersCount ?? 0 })}
        value={stats?.playersCount}
        isLoading={isPending}
      />
    </div>
  );
};

const StatCard: FC<{
  icon: FC<{ className?: string }>;
  label: string;
  value?: number;
  isLoading?: boolean;
}> = ({ icon: Icon, label, value, isLoading }) => (
  <div className="bg-primary/5 border-primary/10 flex items-center gap-4 rounded-xl border p-4">
    <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
      <Icon className="text-primary size-5" />
    </div>
    <div className="flex flex-col">
      {isLoading ? (
        <>
          <Skeleton className="mb-1 h-6 w-12" />
          <Skeleton className="h-3 w-16" />
        </>
      ) : (
        <>
          <span className="text-2xl leading-none font-bold">{value ?? 0}</span>
          <span className="text-muted-foreground text-xs leading-none">
            {label}
          </span>
        </>
      )}
    </div>
  </div>
);

const MostActivePlayers: FC<{ clubId: string }> = ({ clubId }) => {
  const { data: stats, isPending } = useClubStats(clubId);
  const t = useTranslations('Club.Page');

  if (isPending) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats?.mostActivePlayers?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" />
          {t('most active')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>
                <FormattedMessage id="Player.nickname" />
              </TableHead>
              <TableHead className="text-right">
                <FormattedMessage id="Player.rating" />
              </TableHead>
              <TableHead className="text-right">{t('tournaments')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.mostActivePlayers.map((player, index) => (
              <TableRow key={player.id} className="cursor-pointer">
                <TableCell className="text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/player/${player.id}`}
                    className="hover:underline"
                  >
                    {player.nickname}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{player.rating}</TableCell>
                <TableCell className="text-right">
                  {player.tournamentsPlayed}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const ClubTournamentsSection: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const secondDebouncedSearch = useDebounce(search, 290);
  const t = useTranslations();
  const { data: stats } = useClubStats(clubId);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { data: searchResults } = useSearchQuery({
    query: debouncedSearch,
    filter: {
      type: 'tournaments',
      clubId,
    },
  });

  useEffect(() => {
    if (
      !queryClient.getQueryData(
        trpc.search.queryKey({
          filter: { type: 'tournaments', clubId },
          query: secondDebouncedSearch,
        }),
      )
    ) {
      queryClient.setQueryData(
        trpc.search.queryKey({
          filter: { type: 'tournaments', clubId },
          query: secondDebouncedSearch,
        }),
        searchResults,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.search.queryKey({
          filter: { type: 'tournaments', clubId },
          query: secondDebouncedSearch,
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, queryClient, secondDebouncedSearch, trpc.search]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" />
          <FormattedMessage id="Menu.tournaments" />
          <span className="text-muted-foreground font-normal">
            ({stats?.tournamentsCount ?? 0})
          </span>
        </CardTitle>
        <div className="relative mt-2">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={t('Common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto pt-0">
        {!searchResults?.tournaments?.length && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {stats?.tournamentsCount !== 0
              ? t('GlobalSearch.not found')
              : t('Empty.tournaments')}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {searchResults?.tournaments?.map((tournament) => (
            <TournamentItemIteratee
              key={tournament.id}
              tournament={tournament}
            />
          ))}
        </div>
        {statusInClub && stats?.tournamentsCount === 0 && (
          <Button size="sm" variant="default" className="mt-2 w-full" asChild>
            <Link href="/tournaments/create">
              <FormattedMessage id="Home.make tournament" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const ClubPlayersSection: FC<{ clubId: string }> = ({ clubId }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const secondDebouncedSearch = useDebounce(search, 290);

  const t = useTranslations();
  const { playersCount } = useClubStats(clubId).data ?? {};
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { data: searchResults } = useSearchQuery({
    query: debouncedSearch,
    filter: {
      type: 'players',
      clubId,
    },
  });

  useEffect(() => {
    if (
      !queryClient.getQueryData(
        trpc.search.queryKey({
          filter: { type: 'players', clubId },
          query: secondDebouncedSearch,
        }),
      )
    ) {
      queryClient.setQueryData(
        trpc.search.queryKey({
          filter: { type: 'players', clubId },
          query: secondDebouncedSearch,
        }),
        searchResults,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.search.queryKey({
          filter: { type: 'players', clubId },
          query: secondDebouncedSearch,
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, queryClient, secondDebouncedSearch, trpc.search]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users2 className="size-4" />
          <FormattedMessage id="Club.Page.players" />
          {!!playersCount && (
            <span className="text-muted-foreground font-normal">
              ({playersCount})
            </span>
          )}
        </CardTitle>
        <div className="relative mt-2">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={t('Common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto pt-0">
        {searchResults?.players?.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {playersCount !== 0
              ? t('GlobalSearch.not found')
              : t('Empty.players')}
          </p>
        )}

        {searchResults?.players && searchResults.players.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults?.players.map((player) => (
              <PlayerItem key={player.id} player={player} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PlayerItem: FC<{ player: PlayerModel }> = ({ player }) => {
  return (
    <Link href={`/player/${player.id}`}>
      <Card className="mk-card flex items-center justify-between truncate">
        <span className="text-sm">{player.nickname}</span>
        <div className="text-muted-foreground text-xs">{player.rating}</div>
      </Card>
    </Link>
  );
};

export default ClubPage;
