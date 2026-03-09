import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';

export interface StandingsGroup {
  id: string;
  name: string;
  players: PlayerTournamentModel[];
  games: GameModel[];
}
