import type { PlayerWithUsernameModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';

export const doublesErrors = {
  nicknameTaken: 'UNIT_NICKNAME_TAKEN',
  playersNotFound: 'UNIT_PLAYERS_NOT_FOUND',
  playerAlreadyInPair: 'PLAYER_ALREADY_IN_PAIR',
  invalidDoublesPair: 'INVALID_DOUBLES_PAIR',
} as const;

export const findDoublesUnitPlayer = (
  id: string,
  playersOut: PlayerWithUsernameModel[],
  currentUnit: UnitModel,
) =>
  currentUnit.players.find((player) => player.id === id) ??
  playersOut.find((player) => player.id === id);

export const getDoublesErrorTranslationKey = (error: { message: string }) => {
  if (error.message === doublesErrors.nicknameTaken) {
    return 'team nickname taken';
  }
  if (error.message === doublesErrors.playerAlreadyInPair) {
    return 'player already in team';
  }
  if (error.message === doublesErrors.playersNotFound) {
    return 'team players not found';
  }
  if (error.message === doublesErrors.invalidDoublesPair)
    return 'team players not found';
  return 'team add error';
};
