import { PlayerTournamentModel } from '@/server/zod/players';

import type { StandingsGroup } from '@/app/tournaments/[id]/dashboard/tabs/table/table-types';

/**
 * Builds mock groups from existing players for render only.
 * Real grouped format will supply groups from elsewhere (e.g. tournament format / API).
 */
export function generateMockGroups(
  players: PlayerTournamentModel[],
): StandingsGroup[] {
  const count = players.length > 1 ? players.length / 2 : 1;
  return players.reduce<StandingsGroup[]>((acc, player, index) => {
    const groupIndex = Math.floor(index / count);
    if (!acc[groupIndex]) {
      acc[groupIndex] = {
        id: groupIndex.toString(),
        name: `Group ${groupIndex + 1}`,
        players: [],
        games: [],
      };
    }
    acc[groupIndex].players.push(player);
    return acc;
  }, []);
}
