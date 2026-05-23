import { ERRORS, getAppErrorCode } from '@/lib/errors';
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

export const getDoublesErrorTranslationKey = (error: { message: string }) => {
  const code = getAppErrorCode(error);
  if (code === doublesErrors.nicknameTaken) {
    return 'team nickname taken';
  }
  if (code === doublesErrors.playerAlreadyInPair) {
    return 'player already in team';
  }
  if (code === doublesErrors.playersNotFound) {
    return 'team players not found';
  }
  if (code === doublesErrors.invalidDoublesPair)
    return 'team players not found';
  return 'team add error';
};
