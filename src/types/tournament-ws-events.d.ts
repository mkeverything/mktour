import { GameResult } from '@/server/zod/enums';
import { GameModel, UnitModel } from '@/server/zod/tournaments';

type DashboardMessage =
  | {
      event: 'edit-doubles-unit';
      unit: UnitModel;
    }
  | {
      event: 'prestart-units-updated';
      units: UnitModel[];
    }
  | { event: 'withdraw-unit'; id: UnitModel['id'] }
  | {
      event: 'set-game-result';
      gameId: GameModel['id'];
      result: GameResult | null;
      roundNumber: GameModel['roundNumber'];
    }
  | { event: 'start-tournament'; startedAt: Date; games: GameModel[] } // it accepts date on input but has to be converted from string to date on incomming messages
  | { event: 'reset-tournament' }
  | { event: 'reset-tournament-players' }
  | {
      event: 'new-round';
      roundNumber: GameModel['roundNumber'];
      newGames: GameModel[];
      isTournamentGoing: boolean;
    }
  | { event: 'finish-tournament'; closedAt: Date }
  | { event: 'delete-tournament' }
  | {
      event: 'swiss-new-rounds-number';
      roundsNumber: TournamentModel['roundsNumber'];
    }
  | { event: 'tournament-title-changed'; title: TournamentModel['title'] }
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
