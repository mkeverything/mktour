import { generateConsecutiveRoundGames } from '@/lib/pairing-generators/consecutive-pairs-generator';
import type { PlayerTournamentModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';

type PreStartRoundProps = {
  players: PlayerTournamentModel[];
  tournamentId: string;
};

function assignPairingNumbers<T extends PlayerTournamentModel>(
  players: T[],
): Array<T & { pairingNumber: number }> {
  return players.map((player, index) => ({
    ...player,
    pairingNumber: index,
  }));
}

/**
 * builds round-1 games from a player list whose order is already canonical.
 * pairing numbers are reassigned 0..n-1 in input order before generation.
 */
export function generatePreStartRoundGames({
  players,
  tournamentId,
}: PreStartRoundProps): GameModel[] {
  return generateConsecutiveRoundGames({
    players: assignPairingNumbers(players),
    games: [],
    roundNumber: 1,
    tournamentId,
  });
}
