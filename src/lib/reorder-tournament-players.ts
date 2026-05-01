import { PlayerTournamentModel } from '@/server/zod/players';

export const arrayMove = <T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] => {
  const next = [...items];
  const [movedItem] = next.splice(fromIndex, 1);

  if (!movedItem) return items;

  next.splice(toIndex, 0, movedItem);
  return next;
};

export const applyManualPlayerOrder = (
  players: PlayerTournamentModel[],
): PlayerTournamentModel[] => {
  return players.map((player, index) => ({
    ...player,
    pairingNumber: index,
  }));
};

export const reorderTournamentPlayersByIndex = (
  players: PlayerTournamentModel[],
  fromIndex: number,
  toIndex: number,
): PlayerTournamentModel[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return players;
  }

  return applyManualPlayerOrder(arrayMove(players, fromIndex, toIndex));
};
