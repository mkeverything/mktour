import type { PlayerWithUsernameModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';

export const findDoublesUnitPlayer = (
  id: string,
  playersOut: PlayerWithUsernameModel[],
  currentUnit: UnitModel,
) =>
  currentUnit.players.find((player) => player.id === id) ??
  playersOut.find((player) => player.id === id);
