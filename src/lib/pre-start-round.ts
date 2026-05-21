import { generateConsecutiveRoundGames } from '@/lib/pairing-generators/consecutive-pairs-generator';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';

type PreStartRoundProps = {
  units: UnitModel[];
  tournamentId: string;
};

function assignUnitNumbers<T extends UnitModel>(units: T[]): T[] {
  return units.map((unit, index) => ({
    ...unit,
    number: index,
  }));
}

/**
 * builds round-1 games from a unit list whose order is already canonical.
 * unit numbers are reassigned 0..n-1 in input order before generation.
 */
export function generatePreStartRoundGames({
  units,
  tournamentId,
}: PreStartRoundProps): GameModel[] {
  return generateConsecutiveRoundGames({
    players: assignUnitNumbers(units),
    games: [],
    roundNumber: 1,
    tournamentId,
  });
}
