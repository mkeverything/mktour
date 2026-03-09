import { TournamentAuthStatus } from '@/server/zod/enums';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { createContext, Dispatch, SetStateAction } from 'react';

export type MockMode = 'none' | 'single_elim' | 'double_elim' | 'group_stage';

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
  mockMode: 'none',
  setMockMode: () => null,
});

export type DashboardContextType = {
  currentTab: 'main' | 'table' | 'games';
  sendJsonMessage: (_jsonMessage: DashboardMessage, _keep?: boolean) => void;
  status: TournamentAuthStatus;
  playerId: string | null;
  userId: string | undefined;
  selectedGameId: string | null;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
  roundInView: number;
  setRoundInView: Dispatch<SetStateAction<number>>;
  mockMode: MockMode;
  setMockMode: Dispatch<SetStateAction<MockMode>>;
};
