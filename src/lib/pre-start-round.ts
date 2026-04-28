import { generateConsecutiveRoundGames } from '@/lib/pairing-generators/consecutive-pairs-generator';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { shuffle } from '@/lib/utils';
import type { PlayerTournamentModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';

type PreStartRoundProps = {
  players: PlayerTournamentModel[];
  tournamentId: string;
};

type PreStartRoundPairings = {
  players: PlayerTournamentModel[];
  games: GameModel[];
};

export function assignPairingNumbers<T extends PlayerTournamentModel>(
  players: T[],
): Array<T & { pairingNumber: number }> {
  return players.map((player, index) => ({
    ...player,
    pairingNumber: index,
  }));
}

export function buildPreStartRoundPairings({
  players,
  tournamentId,
}: PreStartRoundProps): PreStartRoundPairings {
  const orderedPlayers = assignPairingNumbers(
    [...players].sort(baselinePlayerSort),
  );

  const games = generateConsecutiveRoundGames({
    players: orderedPlayers,
    games: [],
    roundNumber: 1,
    tournamentId,
  });

  return { players: orderedPlayers, games };
}

export function generatePreStartRoundGames(
  props: PreStartRoundProps,
): GameModel[] {
  return buildPreStartRoundPairings(props).games;
}

export function buildShuffledPreStartRoundPairings({
  players,
  tournamentId,
}: PreStartRoundProps): PreStartRoundPairings {
  const shuffledPlayers = assignPairingNumbers(shuffle(players));

  const games = generateConsecutiveRoundGames({
    players: shuffledPlayers,
    games: [],
    roundNumber: 1,
    tournamentId,
  });

  return { players: shuffledPlayers, games };
}

export function generateShuffledPreStartRoundGames(
  props: PreStartRoundProps,
): GameModel[] {
  return buildShuffledPreStartRoundPairings(props).games;
}
