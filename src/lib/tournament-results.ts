import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel, TournamentModel } from '@/server/zod/tournaments';

export interface SortedPlayersResult {
  players: PlayerTournamentModel[];
  playerScoresMap: Map<string, number>;
  tiebreakScoresMap: Map<string, number>;
}

export const hasSameStanding = (
  player: PlayerTournamentModel,
  previousPlayer: PlayerTournamentModel,
  playerScoresMap: Map<string, number>,
  tiebreakScoresMap: Map<string, number>,
): boolean => {
  const score = playerScoresMap.get(player.id) ?? 0;
  const previousScore = playerScoresMap.get(previousPlayer.id) ?? 0;
  if (score !== previousScore) return false;

  const tiebreakScore = tiebreakScoresMap.get(player.id) ?? 0;
  const previousTiebreakScore = tiebreakScoresMap.get(previousPlayer.id) ?? 0;
  if (tiebreakScore !== previousTiebreakScore) return false;

  return player.wins === previousPlayer.wins;
};

export const calculatePlayerScore = (
  player: PlayerTournamentModel,
  roundNumber: number,
  playerGames: GameModel[],
): number => {
  const wins = player.wins;
  const draws = player.draws * 0.5;

  const byes = Math.max(0, roundNumber - playerGames.length);

  return wins + draws + byes;
};

export const calculateBuchholzCut1 = (
  player: PlayerTournamentModel,
  roundNumber: number,
  allGames: GameModel[],
  playerScoresMap: Map<string, number>,
): number => {
  // For bye rounds (no opponent), use the player's own score as virtual opponent score
  // (standard FIDE Buchholz convention for unplayed games / byes)
  const playerTotalScore = playerScoresMap.get(player.id) ?? 0;
  const opponentScores: number[] = [];
  const opponentsByRound = new Map<number, string>();

  for (const game of allGames) {
    let opponentId: string | null = null;
    if (game.whiteId === player.id) {
      opponentId = game.blackId;
    } else if (game.blackId === player.id) {
      opponentId = game.whiteId;
    }

    if (opponentId) {
      opponentsByRound.set(game.roundNumber, opponentId);
    }
  }

  for (let r = 1; r <= roundNumber; r++) {
    const opponentId = opponentsByRound.get(r);
    if (opponentId) {
      opponentScores.push(playerScoresMap.get(opponentId) ?? 0);
    } else {
      opponentScores.push(playerTotalScore);
    }
  }

  if (opponentScores.length === 0) return 0;
  const sum = opponentScores.reduce((a, b) => a + b, 0);
  const minScore = Math.min(...opponentScores);
  return sum - minScore;
};

export const calculateBerger = (
  player: PlayerTournamentModel,
  allGames: GameModel[],
  playerScoresMap: Map<string, number>,
): number => {
  let berger = 0;
  for (const game of allGames) {
    if (!game.result) continue;

    let opponentId: string | null = null;
    let playerWon = false;
    let isDraw = false;

    if (game.whiteId === player.id) {
      opponentId = game.blackId;
      if (game.result === '1-0') playerWon = true;
      else if (game.result === '1/2-1/2') isDraw = true;
    } else if (game.blackId === player.id) {
      opponentId = game.whiteId;
      if (game.result === '0-1') playerWon = true;
      else if (game.result === '1/2-1/2') isDraw = true;
    }

    if (opponentId) {
      const opponentScore = playerScoresMap.get(opponentId) ?? 0;
      if (playerWon) {
        berger += opponentScore;
      } else if (isDraw) {
        berger += opponentScore * 0.5;
      }
    }
  }
  return berger;
};

/**
 * Builds player score and tiebreak maps without sorting.
 * Useful when callers need the maps for display purposes.
 */
export const buildScoreMaps = (
  players: PlayerTournamentModel[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): {
  playerScoresMap: Map<string, number>;
  tiebreakScoresMap: Map<string, number>;
} => {
  const roundNumber = tournament.ongoingRound ?? 0;

  const playerScoresMap = new Map<string, number>();
  for (const p of players) {
    const playerGames = allGames.filter(
      (g) => g.whiteId === p.id || g.blackId === p.id,
    );
    playerScoresMap.set(
      p.id,
      calculatePlayerScore(p, roundNumber, playerGames),
    );
  }

  const tiebreakScoresMap = new Map<string, number>();
  for (const p of players) {
    const score =
      tournament.format === 'swiss'
        ? calculateBuchholzCut1(p, roundNumber, allGames, playerScoresMap)
        : calculateBerger(p, allGames, playerScoresMap);
    tiebreakScoresMap.set(p.id, score);
  }

  return { playerScoresMap, tiebreakScoresMap };
};

/**
 * Sorts players by score → tiebreak → wins and returns the sorted array
 * along with the computed score maps.
 */
function makePlayerComparator(
  playerScoresMap: Map<string, number>,
  tiebreakScoresMap: Map<string, number>,
) {
  return (a: PlayerTournamentModel, b: PlayerTournamentModel): number => {
    const scoreA = playerScoresMap.get(a.id) ?? 0;
    const scoreB = playerScoresMap.get(b.id) ?? 0;

    if (scoreB !== scoreA) return scoreB - scoreA;

    const tbA = tiebreakScoresMap.get(a.id) ?? 0;
    const tbB = tiebreakScoresMap.get(b.id) ?? 0;

    if (tbB !== tbA) return tbB - tbA;

    if (b.wins !== a.wins) return b.wins - a.wins;

    const addedAtA = a.addedAt?.getTime() ?? 0;
    const addedAtB = b.addedAt?.getTime() ?? 0;
    if (addedAtA !== addedAtB) return addedAtA - addedAtB;

    return 0;
  };
}

export const sortPlayersByResults = (
  players: PlayerTournamentModel[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): PlayerTournamentModel[] => {
  const { playerScoresMap, tiebreakScoresMap } = buildScoreMaps(
    players,
    tournament,
    allGames,
  );

  return [...players].sort(
    makePlayerComparator(playerScoresMap, tiebreakScoresMap),
  );
};

/**
 * Sorts players and returns both the sorted array and score maps.
 * Use this when you need the maps for display (e.g., in the tournament table UI).
 */
export const sortPlayersByResultsWithMaps = (
  players: PlayerTournamentModel[],
  tournament: Pick<TournamentModel, 'format' | 'ongoingRound'>,
  allGames: GameModel[],
): SortedPlayersResult => {
  const { playerScoresMap, tiebreakScoresMap } = buildScoreMaps(
    players,
    tournament,
    allGames,
  );

  const sorted = [...players].sort(
    makePlayerComparator(playerScoresMap, tiebreakScoresMap),
  );

  return { players: sorted, playerScoresMap, tiebreakScoresMap };
};
