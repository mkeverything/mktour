import { DatabaseClub } from '@/server/db/schema/clubs';
import {
  DatabaseGame,
  DatabaseTournament,
} from '@/server/db/schema/tournaments';

/**
 * combination of player general info and tournament performance, recorded in players_to_tournaments
 */
export interface PlayerModel {
  pairingNumber: number | null;
  id: string;
  nickname: string; // players.nickname
  realname: string | null;
  rating: number;
  wins: number;
  draws: number;
  losses: number;
  color_index: number;
  is_out: boolean | null;
  place: number | null;
  floatHistory: FloatHistoryItem[];
}

export type FloatType = 'up' | 'down' | 'none';

export interface FloatHistoryItem {
  roundNumber: number;
  floatType: FloatType;
}

/**
 *
 */
export interface GameModel extends DatabaseGame {
  black_nickname: string; // players where id === games.black_id  nickname;
  white_nickname: string; // players where id === games.white_id  nickname;
}

export interface TournamentInfo {
  tournament: DatabaseTournament;
  club: DatabaseClub;
}

export type Result = '0-1' | '1-0' | '1/2-1/2';

export type Format = 'swiss' | 'round robin' | 'double elimination';

export type TournamentType = 'solo' | 'doubles' | 'team';

export type TournamentStatus = 'not started' | 'ongoing' | 'finished';

export type RoundName =
  | 'final'
  | 'match_for_third'
  | 'semifinal'
  | 'quarterfinal'
  | '1/8'
  | '1/16'
  | '1/32'
  | '1/64'
  | '1/128';
