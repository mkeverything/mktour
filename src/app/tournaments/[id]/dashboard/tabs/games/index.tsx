'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import GamesContent from '@/app/tournaments/[id]/dashboard/tabs/games/games-content';
import RoundControls from '@/app/tournaments/[id]/dashboard/tabs/games/round-controls';
import StartTournamentDrawer from '@/app/tournaments/[id]/dashboard/tabs/games/start-tournament-drawer';
import { generateMockGroups } from '@/app/tournaments/[id]/dashboard/tabs/standings-groups';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import Overlay from '@/components/overlay';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext, useMemo } from 'react';

const Games: FC = () => {
  const {
    currentTab,
    roundInView,
    setRoundInView,
    selectedGameId,
    status,
    mockMode,
  } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data, isError, isLoading } = useTournamentInfo(id);
  const {
    data: players,
    isLoading: isPlayersLoading,
    isError: isPlayersError,
  } = useTournamentPlayers(id);
  const {
    data: roundGames,
    isLoading: isRoundLoading,
    isError: isRoundError,
  } = useTournamentRoundGames({ tournamentId: id, roundNumber: roundInView });
  const { data: allGames } = useTournamentGames(id);
  const isEliminationFormat =
    data?.tournament.format === 'single elimination' ||
    data?.tournament.format === 'double elimination';
  const isElimination =
    isEliminationFormat ||
    mockMode === 'single_elim' ||
    mockMode === 'double_elim';
  const t = useTranslations('Tournament.Round');
  const trpc = useTRPC();
  const now = new Date().getTime();
  const startedAt = data?.tournament.startedAt
    ? data.tournament.startedAt.getTime()
    : 0;
  const renderDrawer = !startedAt || now - startedAt <= 5000;

  const standingsGroups = useMemo(
    () => (mockMode === 'group_stage' ? generateMockGroups(players ?? []) : []),
    [players, mockMode],
  );

  if (isError || isPlayersError || isRoundError) {
    return (
      <div>
        <RoundControls
          format={mockMode || data?.tournament.format}
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={1}
          currentTab={currentTab}
        />
      </div>
    );
  }

  if (
    isLoading ||
    isPlayersLoading ||
    isRoundLoading ||
    queryClient.isMutating({
      mutationKey: trpc.tournament.saveRound.mutationKey(),
    }) > 1 ||
    queryClient.isMutating({ mutationKey: [id, 'players', 'add-existing'] }) > 0
  ) {
    return (
      <div>
        <RoundControls
          format={mockMode || data?.tournament.format}
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={data?.tournament.ongoingRound ?? 1}
          currentTab={currentTab}
        />
        <div className="p-mk md:px-mk-2">
          <SkeletonList length={8} className="h-12 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!players || players.length < 2) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm text-balance">
        {t('add two players')}
      </p>
    );
  }

  if (!data) return 'no data'; // FIXME Intl

  return (
    <div>
      <Overlay open={!!selectedGameId} />
      <RoundControls
        format={mockMode || data?.tournament.format}
        roundInView={roundInView}
        setRoundInView={setRoundInView}
        currentRound={data.tournament.ongoingRound}
        currentTab={currentTab}
      />
      <GamesContent
        roundGames={roundGames}
        allGames={isElimination ? (allGames ?? undefined) : undefined}
        standingsGroups={standingsGroups}
        players={players}
        roundNumber={roundInView}
        tournament={data.tournament}
        status={status}
        tournamentId={id}
        mockMode={mockMode}
        isElimination={isElimination}
      />
      {renderDrawer && <StartTournamentDrawer startedAt={startedAt} />}
    </div>
  );
};

export default Games;
