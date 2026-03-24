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
