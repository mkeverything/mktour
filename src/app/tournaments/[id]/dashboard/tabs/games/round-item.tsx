'use client';
import { LoadingSpinner } from '@/app/loading';
import {
  DashboardContext,
  DashboardRoundContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import GameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/game-item';
import Center from '@/components/center';
import { useTournamentReorderPlayers } from '@/components/hooks/mutation-hooks/use-tournament-reorder-players';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentRoundProgressInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { useRoundData } from '@/components/hooks/use-round-data';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { RoundProps } from '@/lib/pairing-generators/common-generator';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { generateWeightedSwissRound } from '@/lib/pairing-generators/swiss-generator';
import { TournamentFormat } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { PlayerTournamentModel } from '@/server/zod/players';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  ComponentProps,
  Dispatch,
  FC,
  memo,
  SetStateAction,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const RoundItem: FC<RoundItemProps> = ({ roundNumber }) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const {
    data: round,
    isError,
    isLoading,
  } = useTournamentRoundGames({
    tournamentId,
    roundNumber,
  });
  const info = useTournamentRoundProgressInfo(tournamentId);
  const { data: players } = useTournamentPlayers(tournamentId);
  const { status } = useContext(DashboardContext);
  const { selectedGameId, setSelectedGameId } = useContext(SelectedGameContext);
  const { sortedRound, ongoingGames } = useRoundData(round, players);
  const reorderPlayers = useTournamentReorderPlayers(tournamentId);
  const slots = useMemo(() => buildGamePlayerSlots(sortedRound), [sortedRound]);
  const [activeDrag, setActiveDrag] = useState<ActiveGamePlayerDrag | null>(
    null,
  );
  const activeDragRef = useRef<ActiveGamePlayerDrag | null>(null);

  if (isLoading || !info.data || !players)
    return (
      <div className="mx-auto px-4 pt-2 lg:max-w-xl lg:px-0">
        <SkeletonList length={8} className="h-12" />
      </div>
    );

  if (isError) return <Center>error</Center>;
  if (!round) return <Center>no round</Center>;

  const { ongoingRound, roundsNumber, closedAt, format, startedAt } = info.data;
  const canSortPlayers =
    status === 'organizer' &&
    !startedAt &&
    roundNumber === 1 &&
    sortedRound.length > 0;
  const activePlayer = activeDrag
    ? slots.find((slot) => slot.playerId === activeDrag.playerId)
    : null;
  const getDisplayedSlotPlayer = (slotIndex: number) => {
    if (!activeDrag || activeDrag.overIndex === activeDrag.fromIndex) {
      return slots[slotIndex] ?? null;
    }

    if (slotIndex === activeDrag.fromIndex) {
      return activeDrag.overIndex === null
        ? null
        : (slots[activeDrag.overIndex] ?? null);
    }

    if (slotIndex === activeDrag.overIndex) {
      return null;
    }

    return slots[slotIndex] ?? null;
  };
  const handleDragStart: NonNullable<
    ComponentProps<typeof DragDropProvider>['onDragStart']
  > = (event) => {
    const source = event.operation.source;
    const activePlayerId = source?.data.playerId;
    const fromIndex = source?.data.slotIndex;
    if (!canSortPlayers || typeof activePlayerId !== 'string') return;
    if (typeof fromIndex !== 'number') return;

    const nextDrag = {
      playerId: activePlayerId,
      fromIndex,
      overIndex: null,
    };
    activeDragRef.current = nextDrag;
    setActiveDrag(nextDrag);
  };
  const handleDragOver: NonNullable<
    ComponentProps<typeof DragDropProvider>['onDragOver']
  > = (event) => {
    const overIndex = event.operation.target?.data.slotIndex;
    if (!canSortPlayers || typeof overIndex !== 'number') return;

    setActiveDrag((current) => {
      if (!current) return current;
      const nextDrag = { ...current, overIndex };
      activeDragRef.current = nextDrag;
      return nextDrag;
    });
  };
  const handleDragEnd: NonNullable<
    ComponentProps<typeof DragDropProvider>['onDragEnd']
  > = (event) => {
    const dragState = activeDragRef.current;
    activeDragRef.current = null;
    setActiveDrag(null);
    if (!canSortPlayers || event.canceled || !dragState) return;

    const fromIndex = event.operation.source?.data.slotIndex;
    const toIndex =
      event.operation.target?.data.slotIndex ?? dragState.overIndex;

    if (typeof fromIndex !== 'number') return;
    if (typeof toIndex !== 'number' || fromIndex === toIndex) return;

    const sourceSlot = slots[fromIndex];
    const targetSlot = slots[toIndex];
    if (!sourceSlot || !targetSlot) return;

    const playerIds = swapPlayerIds(
      players,
      sourceSlot.playerId,
      targetSlot.playerId,
    );
    if (!playerIds) return;

    reorderPlayers.mutate({ tournamentId, playerIds });
  };
  const renderFinishButton =
    status === 'organizer' && !closedAt && ongoingRound === roundsNumber;
  const renderNewRoundButton =
    roundNumber === ongoingRound &&
    ongoingRound !== roundsNumber &&
    ongoingGames === 0 &&
    status === 'organizer' &&
    round.length > 0;

  return (
    <div className="mk-list px-mk md:px-mk-2 pt-2">
      <ActionButton
        renderNewRoundButton={renderNewRoundButton}
        roundNumber={roundNumber}
        roundsNumber={roundsNumber}
        tournamentId={tournamentId}
        renderFinishButton={renderFinishButton}
        format={format}
      />
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {sortedRound.map((game, gameIndex) => {
          const whiteSlotIndex = gameIndex * 2;
          const blackSlotIndex = whiteSlotIndex + 1;
          const whiteDisplayPlayer = getDisplayedSlotPlayer(whiteSlotIndex);
          const blackDisplayPlayer = getDisplayedSlotPlayer(blackSlotIndex);

          return (
            <GamesIteratee
              key={game.id}
              blackDisplayId={blackDisplayPlayer?.playerId ?? null}
              blackDisplayNickname={blackDisplayPlayer?.nickname ?? null}
              blackSlotIndex={blackSlotIndex}
              canSortPlayers={canSortPlayers}
              selected={selectedGameId === game.id}
              setSelectedGameId={setSelectedGameId}
              whiteDisplayId={whiteDisplayPlayer?.playerId ?? null}
              whiteDisplayNickname={whiteDisplayPlayer?.nickname ?? null}
              whiteSlotIndex={whiteSlotIndex}
              {...game}
            />
          );
        })}
        <DragOverlay dropAnimation={null}>
          {activePlayer ? (
            <div className="bg-background ring-border text-2xs rounded-md px-3 py-2 shadow-xl ring-1 lg:text-xs">
              {activePlayer.nickname}
            </div>
          ) : null}
        </DragOverlay>
      </DragDropProvider>
    </div>
  );
};

function generateRound(
  format: TournamentFormat,
  props: RoundProps,
): GameModel[] {
  switch (format) {
    case 'swiss':
      return generateWeightedSwissRound(props);
    case 'round robin':
      return generateRoundRobinRound(props);
    default:
      throw new Error(`unsupported format: ${format}`);
  }
}

const NewRoundButton: FC<{
  tournamentId: string;
  roundNumber: number;
  format: TournamentFormat;
}> = ({ tournamentId, roundNumber, format }) => {
  const t = useTranslations('Tournament.Round');
  const { data: tournamentGames } = useTournamentGames(tournamentId);
  const queryClient = useQueryClient();
  const { setRoundInView } = useContext(DashboardRoundContext);

  const { mutate, isPending: mutating } = useSaveRound({
    isTournamentGoing: true,
    setRoundInView,
  });
  const trpc = useTRPC();

  const newRound = () => {
    const players = queryClient.getQueryData(
      trpc.tournament.playersIn.queryKey({ tournamentId }),
    );
    const games = tournamentGames;
    if (!players || !games) return;
    const newGames = generateRound(format, {
      players,
      games,
      roundNumber: roundNumber + 1,
      tournamentId,
    });
    mutate({ tournamentId, roundNumber: roundNumber + 1, newGames });
  };

  return (
    <Button className="w-full" onClick={newRound} disabled={mutating}>
      {!mutating ? <ArrowRightIcon /> : <LoadingSpinner />}
      {t('new round button')}
    </Button>
  );
};

const ActionButton = ({
  renderNewRoundButton,
  roundNumber,
  roundsNumber,
  tournamentId,
  renderFinishButton,
  format,
}: {
  renderNewRoundButton: boolean;
  roundNumber: number;
  roundsNumber: number | null;
  tournamentId: string;
  renderFinishButton: boolean;
  format: TournamentFormat;
}) => {
  if (!roundsNumber) return null;
  if (renderNewRoundButton)
    return (
      <NewRoundButton
        tournamentId={tournamentId}
        roundNumber={roundNumber}
        format={format}
      />
    );
  if (renderFinishButton)
    return (
      <div className="md:hidden">
        <FinishTournamentButton lastRoundNumber={roundsNumber} />
      </div>
    );

  return null;
};

type GamePlayerSlot = {
  nickname: string | null;
  playerId: string;
};

type ActiveGamePlayerDrag = {
  fromIndex: number;
  overIndex: number | null;
  playerId: string;
};

function buildGamePlayerSlots(games: GameModel[]): GamePlayerSlot[] {
  return games.flatMap((game) => [
    { playerId: game.whiteId, nickname: game.whiteNickname },
    { playerId: game.blackId, nickname: game.blackNickname },
  ]);
}

function swapPlayerIds(
  players: PlayerTournamentModel[],
  firstPlayerId: string,
  secondPlayerId: string,
) {
  const playerIds = players.map((player) => player.id);
  const firstIndex = playerIds.indexOf(firstPlayerId);
  const secondIndex = playerIds.indexOf(secondPlayerId);

  if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
    return null;
  }

  [playerIds[firstIndex], playerIds[secondIndex]] = [
    playerIds[secondIndex],
    playerIds[firstIndex],
  ];
  return playerIds;
}

const GamesIteratee = memo(function GamesIteratee({
  id,
  result,
  whiteNickname,
  blackNickname,
  whiteId,
  blackId,
  whiteDisplayId,
  whiteDisplayNickname,
  whiteSlotIndex,
  blackDisplayId,
  blackDisplayNickname,
  blackSlotIndex,
  canSortPlayers,
  roundNumber,
  selected,
  setSelectedGameId,
}: GameModel & {
  blackDisplayId: string | null;
  blackDisplayNickname: string | null;
  blackSlotIndex: number;
  canSortPlayers: boolean;
  selected: boolean;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
  whiteDisplayId: string | null;
  whiteDisplayNickname: string | null;
  whiteSlotIndex: number;
}) {
  return (
    <GameItem
      id={id}
      result={result}
      whiteId={whiteId}
      whiteNickname={whiteNickname}
      whiteDisplayId={whiteDisplayId}
      whiteDisplayNickname={whiteDisplayNickname}
      whiteSlotIndex={whiteSlotIndex}
      blackId={blackId}
      blackNickname={blackNickname}
      blackDisplayId={blackDisplayId}
      blackDisplayNickname={blackDisplayNickname}
      blackSlotIndex={blackSlotIndex}
      canSortPlayers={canSortPlayers}
      roundNumber={roundNumber}
      selected={selected}
      setSelectedGameId={setSelectedGameId}
    />
  );
});

type RoundItemProps = {
  roundNumber: number;
  compact?: boolean;
};

export default RoundItem;
