import { ERRORS } from '@/lib/errors';
import type { PlayerWithUsernameModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';

export const doublesErrors = {
  nicknameTaken: ERRORS.UNIT_NICKNAME_TAKEN,
  playersNotFound: ERRORS.UNIT_PLAYERS_NOT_FOUND,
  playerAlreadyInPair: ERRORS.PLAYER_ALREADY_IN_PAIR,
  invalidDoublesPair: ERRORS.INVALID_DOUBLES_PAIR,
} as const;

export const findDoublesUnitPlayer = (
  id: string,
  playersOut: PlayerWithUsernameModel[],
  currentUnit: UnitModel,
) =>
  currentUnit.players.find((player) => player.id === id) ??
  playersOut.find((player) => player.id === id);
