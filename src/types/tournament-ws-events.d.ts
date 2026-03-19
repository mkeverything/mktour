import { GameResult } from '@/server/zod/enums';
import { PlayerTournamentModel } from '@/server/zod/players';

type DashboardMessage =
  | { event: 'add-existing-player'; body: PlayerTournamentModel }
  | { event: 'add-new-player'; body: PlayerTournamentModel }
  | {
      event: 'edit-team-player';
      body: PlayerTournamentModel;
      previousId: string;
    }
  | { event: 'remove-player'; id: string } // onError add-exidsting-player
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
