import type { PlayerWithUsernameModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';

export const pairErrors = {
  nicknameTaken: 'PAIR_NICKNAME_TAKEN',
  playersNotFound: 'PAIR_PLAYERS_NOT_FOUND',
  playerAlreadyInPair: 'PLAYER_ALREADY_IN_PAIR',
} as const;

export const findPairPlayer = (
  id: string,
  playersOut: PlayerWithUsernameModel[],
  units: UnitModel[] | undefined,
  currentPairPlayers: UnitModel['players'] | null = null,
) => {
  const fromOut = playersOut.find((player) => player.id === id);
  if (fromOut) return fromOut;

  const fromPair = currentPairPlayers?.find((player) => player.id === id);
  if (fromPair) return fromPair;

  return units
    ?.find(
      (unit) =>
        unit.players.length === 1 &&
        unit.players.some((player) => player.id === id),
    )
    ?.players.at(0);
};

export const getPairErrorTranslationKey = (error: { message: string }) => {
  if (error.message === pairErrors.nicknameTaken) return 'team nickname taken';
  if (error.message === pairErrors.playerAlreadyInPair)
    return 'player already in team';
  if (error.message === pairErrors.playersNotFound)
    return 'team players not found';
  return 'team add error';
};
