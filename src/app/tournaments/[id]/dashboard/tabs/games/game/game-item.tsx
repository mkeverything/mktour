import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Player from '@/app/tournaments/[id]/dashboard/tabs/games/game/player';
import Result, {
  ResultProps,
} from '@/app/tournaments/[id]/dashboard/tabs/games/game/result';
import useTournamentSetGameResult from '@/components/hooks/mutation-hooks/use-tournament-set-game-result';
import { useTournamentGameResultInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import useOutsideClick from '@/components/hooks/use-outside-click';
import PortalWrapper from '@/components/portal-wrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GameResult } from '@/server/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Dispatch, FC, memo, SetStateAction, useContext, useRef } from 'react';
import { toast } from 'sonner';

const GameItem: FC<GameProps> = ({
  id,
  result,
  whiteUnitId,
  whiteNickname,
  blackUnitId,
  blackNickname,
  roundNumber,
  selected,
  setSelectedGameId,
  onOpenStartTournamentDrawer,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Toasts');
  const { sendJsonMessage, status, unitId, userId } =
    useContext(DashboardContext);
  const queryClient = useQueryClient();
  const mutation = useTournamentSetGameResult(queryClient, {
    tournamentId,
    sendJsonMessage,
  });
  const { data } = useTournamentGameResultInfo(tournamentId);
  const ref = useRef<HTMLDivElement>(null);
  const hasStarted = !!data?.hasStarted;
  const isActive = selected && hasStarted;
  const muted = result && !selected;
  const isClosed = !!data?.isClosed;
  const allowPlayersSetResults = !!data?.allowPlayersSetResults;
  // players can only edit their own games, and only after tournament has started
  const isPlayerUnitInGame = unitId === whiteUnitId || unitId === blackUnitId;
  const canEdit =
    status === 'organizer' ||
    (status === 'player' && isPlayerUnitInGame && hasStarted);
  const disabled = !canEdit || isClosed;
  const draw = result === '1/2-1/2';

  const handleOpenGame = () => {
    if (selected) {
      setSelectedGameId(null);
      return;
    }
    if (!hasStarted) {
      onOpenStartTournamentDrawer();
      return;
    }
    const playerBlockedByClubSetting =
      status === 'player' && isPlayerUnitInGame && !allowPlayersSetResults;
    if (playerBlockedByClubSetting) {
      toast.warning(t('player result setting disabled'));
      return;
    }
    setSelectedGameId(id);
  };

  const handleMutate = (newResult: GameResult) => {
    if (!userId) return;
    if (selected && hasStarted && !mutation.isPending) {
      mutation.mutate({
        gameId: id,
        whiteUnitId,
        blackUnitId,
        result: newResult,
        prevResult: result,
        tournamentId,
        roundNumber,
        userId,
      });
    }
  };

  const resultProps: ResultProps = {
    isPending: mutation.isPending,
    result,
    selected,
  };

  useOutsideClick(() => {
    if (selected) {
      setSelectedGameId(null);
    }
  }, ref);

  return (
    <PortalWrapper portalled={isActive}>
      <motion.div
        key={id}
        ref={ref}
        className={`${disabled && 'pointer-events-none'} w-full min-w-0 cursor-pointer ${
          isActive ? 'z-50' : 'z-0'
        }`}
        initial={{ scale: 1, y: 0 }}
        exit={{ scale: 1, y: 0 }}
        animate={isActive ? { scale: 1.05, y: -10 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        onClick={handleOpenGame}
      >
        <Card
          className={`relative grid grid-cols-4 overflow-hidden ${muted && 'opacity-50'} p-mk px-mk-2 gap-mk min-h-20 w-full min-w-0 items-stretch rounded-lg p-2 shadow-md transition-all select-none ${!isActive && 'pointer-events-none'} ${isPlayerUnitInGame && 'border-3'}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 left-0 flex w-[3px] flex-col"
          >
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-black" />
          </div>
          <div className="divide-border col-span-3 flex min-h-0 flex-col justify-center divide-y">
            <Player
              isWinner={result === '1-0'}
              handleMutate={() => handleMutate('1-0')}
              selected={isActive}
              nickname={whiteNickname}
              className={`${unitId === whiteUnitId && 'font-bold'}`}
            />
            <Player
              isWinner={result === '0-1'}
              handleMutate={() => handleMutate('0-1')}
              selected={isActive}
              nickname={blackNickname}
              className={`${unitId === blackUnitId && 'font-bold'}`}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => handleMutate('1/2-1/2')}
            className={`col-span-1 flex h-full w-full justify-center rounded-sm p-0 select-none ${isActive && draw && 'mk-link'}`}
          >
            <Result {...resultProps} selected={isActive} />
          </Button>
        </Card>
      </motion.div>
    </PortalWrapper>
  );
};

type GameProps = {
  id: string;
  result: GameResult | null;
  whiteUnitId: string;
  whiteNickname: string;
  blackUnitId: string;
  blackNickname: string;
  roundNumber: number;
  selected: boolean;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
  onOpenStartTournamentDrawer: () => void;
};

export default memo(GameItem);
