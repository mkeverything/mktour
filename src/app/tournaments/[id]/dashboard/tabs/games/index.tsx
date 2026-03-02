'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import RoundControls from '@/app/tournaments/[id]/dashboard/tabs/games/round-controls';
import RoundItem from '@/app/tournaments/[id]/dashboard/tabs/games/round-item';
import StartTournamentDrawer from '@/app/tournaments/[id]/dashboard/tabs/games/start-tournament-drawer';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import Overlay from '@/components/overlay';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

const Games: FC = () => {
  const { currentTab, roundInView, setRoundInView, selectedGameId } =
    useContext(DashboardContext);
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data, isError, isLoading } = useTournamentInfo(id);
  const {
    data: players,
    isLoading: isPlayersloading,
    isError: isPlayersError,
  } = useTournamentPlayers(id);
  const t = useTranslations('Tournament.Round');
  const trpc = useTRPC();
  const now = new Date().getTime();
  const startedAt = data?.tournament.startedAt
    ? data.tournament.startedAt.getTime()
    : 0;
  const renderDrawer = !startedAt || now - startedAt <= 5000;

  if (isError || isPlayersError) {
    return (
      <div>
        <RoundControls
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
    isPlayersloading ||
    queryClient.isMutating({
      mutationKey: trpc.tournament.saveRound.mutationKey(),
    }) > 1 ||
    queryClient.isMutating({ mutationKey: [id, 'players', 'add-existing'] }) > 0
  ) {
    return (
      <div>
        <RoundControls
          roundInView={roundInView}
          setRoundInView={setRoundInView}
          currentRound={1}
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
        roundInView={roundInView}
        setRoundInView={setRoundInView}
        currentRound={data.tournament.ongoingRound}
        currentTab={currentTab}
      />
      <RoundItem roundNumber={roundInView} />
      {renderDrawer && <StartTournamentDrawer startedAt={startedAt} />}
    </div>
  );
};

export default Games;
