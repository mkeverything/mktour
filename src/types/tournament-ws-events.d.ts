import { GameResult } from '@/server/zod/enums';
import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';

type DashboardMessage =
  | {
      event: 'edit-team-player';
      body: PlayerTournamentModel;
      previousId: string;
    }
  | {
      event: 'prestart-round-updated';
      players: PlayerTournamentModel[];
      games: GameModel[];
      roundNumber: 1;
    }
  | { event: 'withdraw-player'; id: string }
  | {
      event: 'set-game-result';
      gameId: string;
      result: GameResult;
      roundNumber: number;
    }
  | { event: 'start-tournament'; startedAt: Date } // it accepts date on input but has to be converted from string to date on incomming messages
  | { event: 'reset-tournament' }
  | {
      event: 'new-round';
      roundNumber: number;
      newGames: GameModel[];
      isTournamentGoing: boolean;
    }
  | { event: 'finish-tournament'; closedAt: Date }
  | { event: 'delete-tournament' }
  | { event: 'swiss-new-rounds-number'; roundsNumber: number }
  | { event: 'tournament-title-changed'; title: string }
  | ErrorMessage;

type ErrorMessage = {
  event: 'error';
  message: string;
};

type GlobalErrorMessage = {
  recipientId: string;
  event: 'error';
  message: string;
};
