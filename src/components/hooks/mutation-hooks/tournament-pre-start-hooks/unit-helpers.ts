import type {
  PlayerFormModel,
  PlayerWithUsernameModel,
} from '@/server/zod/players';
import type { PlayerInUnitModel, UnitModel } from '@/server/zod/tournaments';

const toUnitPlayer = (player: PlayerInUnitModel) => ({
  id: player.id,
  nickname: player.nickname,
  realname: player.realname,
  rating: player.rating,
  userId: player.userId,
  username: player.username,
});

const createBaseUnit = (
  id: string,
  size: number,
  number: number,
  addedAt: Date | undefined,
  unitNickname: string,
  players: UnitModel['players'],
): UnitModel => ({
  id,
  size,
  wins: 0,
  losses: 0,
  draws: 0,
  colorIndex: 0,
  place: null,
  isOut: null,
  number,
  addedAt: addedAt ?? null,
  unitNickname,
  players,
});

export const createSoloUnitFromExistingPlayer = (
  unitId: string,
  player: PlayerWithUsernameModel,
  number: number,
  addedAt?: Date,
) =>
  createBaseUnit(unitId, 1, number, addedAt, player.nickname, [
    toUnitPlayer(player),
  ]);

export const createSoloUnitFromNewPlayer = (
  unitId: string,
  player: PlayerFormModel & { id: string },
  number: number,
  addedAt?: Date,
) => {
  return createBaseUnit(unitId, 1, number, addedAt, player.nickname, [
    {
      id: player.id,
      nickname: player.nickname,
      realname: player.realname ?? null,
      rating: player.rating,
      userId: null,
      username: null,
    },
  ]);
};

export const createDoublesUnit = ({
  id,
  nickname,
  firstPlayer,
  secondPlayer,
  number,
  addedAt,
}: {
  id: string;
  nickname: string;
  firstPlayer: PlayerWithUsernameModel;
  secondPlayer: PlayerWithUsernameModel;
  number: number;
  addedAt?: Date;
}) =>
  createBaseUnit(id, 2, number, addedAt, nickname, [
    toUnitPlayer(firstPlayer),
    toUnitPlayer(secondPlayer),
  ]);

export const appendUnitIfMissing = (
  units: UnitModel[] | undefined,
  unit: UnitModel,
) => {
  const cache = units ?? [];
  return cache.some((cachedUnit) => cachedUnit.id === unit.id)
    ? cache
    : cache.concat(unit);
};

export const removeUnitById = (
  units: UnitModel[] | undefined,
  unitId: string,
) => units?.filter((unit) => unit.id !== unitId) ?? [];

export const removePlayersOutByIds = <T extends { id: string }>(
  players: T[] | undefined,
  ids: string[],
) => players?.filter((player) => !ids.includes(player.id));

export const hasDuplicateUnitNickname = (
  units: UnitModel[] | undefined,
  nickname: string,
  exceptUnitId?: string,
) => {
  const normalizedNickname = nickname.toLowerCase();
  return units?.some(
    (unit) =>
      unit.id !== exceptUnitId &&
      unit.unitNickname?.toLowerCase() === normalizedNickname,
  );
};
