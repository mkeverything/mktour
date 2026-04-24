import { TournamentAuthStatus } from '@/server/zod/enums';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { createContext, Dispatch, SetStateAction } from 'react';

export type DashboardTab = 'main' | 'table' | 'games';

export const DashboardContext = createContext<DashboardContextType>({
  sendJsonMessage: () => null,
  status: 'viewer',
  playerId: null,
  userId: undefined,
});

export const DashboardTabContext = createContext<DashboardTabContextType>({
  currentTab: 'main',
});

export const DashboardRoundContext = createContext<DashboardRoundContextType>({
  roundInView: 1,
  setRoundInView: () => null,
});

export const SelectedGameContext = createContext<SelectedGameContextType>({
  selectedGameId: null,
  setSelectedGameId: () => null,
});

export type DashboardContextType = {
  sendJsonMessage: (_jsonMessage: DashboardMessage, _keep?: boolean) => void;
  status: TournamentAuthStatus;
  playerId: string | null;
  userId: string | undefined;
};

export type DashboardTabContextType = {
  currentTab: DashboardTab;
};

export type DashboardRoundContextType = {
  roundInView: number;
  setRoundInView: Dispatch<SetStateAction<number>>;
};

export type SelectedGameContextType = {
  selectedGameId: string | null;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
};
