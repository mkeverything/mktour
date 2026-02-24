import { Status } from '@/server/queries/get-status-in-tournament';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { createContext, Dispatch, SetStateAction } from 'react';

export const DashboardContext = createContext<DashboardContextType>({
  currentTab: 'main',
  sendJsonMessage: () => null,
  status: 'viewer',
  playerId: null,
  userId: undefined,
  selectedGameId: null,
  setSelectedGameId: () => null,
  roundInView: 1,
  setRoundInView: () => null,
});

export type DashboardContextType = {
  currentTab: 'main' | 'table' | 'games';
  sendJsonMessage: (_jsonMessage: DashboardMessage, _keep?: boolean) => void;
  status: Status;
  playerId: string | null;
  userId: string | undefined;
  selectedGameId: string | null;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
  roundInView: number;
  setRoundInView: Dispatch<SetStateAction<number>>;
};
