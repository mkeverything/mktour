import { mock } from 'bun:test';

import { newid } from '@/lib/utils';
import { DatabaseClub } from '@/server/db/schema/clubs';
import { DatabaseTournament } from '@/server/db/schema/tournaments';
import { DatabaseUser } from '@/server/db/schema/users';
import { GameModel, PlayerModel, Result } from '@/types/tournaments';
import { faker } from '@faker-js/faker';
import assert from 'assert';

const INITIAL_WINS = 0;
const INITIAL_LOSSES = 0;
const INITIAL_DRAWS = 0;
export const INITIAL_ONGOING_ROUND = 1;
const INITIAL_COLOUR_INDEX = 0;

const DEFAULT_PLACE = null;
const DEFAULT_IS_EXITED = false;
const DEFAULT_FORMAT = 'round robin';
const DEFAULT_TYPE = 'solo';

const POSSIBLE_RESULTS: Result[] = ['0-1', '1-0', '1/2-1/2'];

const RATING_FAKEOPTS = {
  min: 500,
  max: 3000,
};

const generateDatabaseUser = mock<() => DatabaseUser>(() => {
  const randomId = newid();
  const randomNickname = faker.internet.username();
  const randomRealName = faker.person.fullName();
  const randomRating = faker.number.int(RATING_FAKEOPTS);
  const randomEmail = faker.internet.email();
  const randomClubName = faker.company.name();
  const randomCreationDate = faker.date.anytime();

  const randomUser: DatabaseUser = {
    id: randomId,
    username: randomNickname,
    name: randomRealName,
    email: randomEmail,
    rating: randomRating,
    selected_club: randomClubName,
    created_at: randomCreationDate,
  };
  return randomUser;
});

const generateRandomDatabaseClub = mock<() => DatabaseClub>(() => {
  const randomId = newid();
  const randomTitle = faker.animal.cat();
  const randomDescription = faker.food.description();
  const randomCreatedAt = faker.date.anytime();
  const randomLichessTeam = faker.book.title();
  const randomClub: DatabaseClub = {
    id: randomId,
    name: randomTitle,
    description: randomDescription,
    created_at: randomCreatedAt,
    lichess_team: randomLichessTeam,
  };
  return randomClub;
});

export const generateRandomDatabaseTournament = mock<() => DatabaseTournament>(
  () => {
    const randomDate = faker.date.anytime();
    const randomId = newid();
    const randomTitle = faker.music.songName();
    const randomCreationDate = faker.date.anytime();
    const randomClub = generateRandomDatabaseClub();
    const randomStartDate = faker.date.anytime();
    const randomEndDate = faker.date.anytime();
    const randomRoundsNumber = faker.number.int();
    const randomIsRated = faker.datatype.boolean();

    const randomTournament: DatabaseTournament = {
      date: randomDate.toDateString(),
      id: randomId,
      title: randomTitle,
      format: DEFAULT_FORMAT,
      type: DEFAULT_TYPE,
      created_at: randomCreationDate,
      club_id: randomClub.id,
      started_at: randomStartDate,
      closed_at: randomEndDate,
      rounds_number: randomRoundsNumber,
      ongoing_round: INITIAL_ONGOING_ROUND,
      rated: randomIsRated,
    };

    return randomTournament;
  },
);

export const fillRandomResult = mock(
  /**
   * This function takes an array of games, and sets random results there
   * @param gameScheduled , a Game model with a null-result
   * @returns
   */
  (gameScheduled: GameModel) => {
    assert(
      gameScheduled.result === null,
      'A game result here should be null, or something went wrong!',
    );
    // selecting random result
    const randomGameResult = faker.helpers.arrayElement(POSSIBLE_RESULTS);
    gameScheduled.result = randomGameResult;
    return gameScheduled;
  },
);
export const generatePlayerModel = mock(() => {
  const randomUser = generateDatabaseUser();

  const randomPlayer: PlayerModel = {
    id: randomUser.id,
    nickname: randomUser.username,
    wins: INITIAL_WINS,
    draws: INITIAL_DRAWS,
    losses: INITIAL_LOSSES,
    color_index: INITIAL_COLOUR_INDEX,
    realname: randomUser.name,
    rating: randomUser.rating ?? 0,
    is_out: DEFAULT_IS_EXITED,
    place: DEFAULT_PLACE,
    pairingNumber: null,
  };

  return randomPlayer;
});

export const PLAYER_NUMBER_FAKEOPTS = {
  min: 2,
  max: 5,
};

export const RANDOM_TOURNAMENTS_COUNT = 5;

/**
 * Interface for player score results
 */
interface PlayerScoreResults {
  wins: number;
  draws: number;
  losses: number;
}

/**
 * Checks if a game involves a specific player (as white or black)
 * @param game - Game to check
 * @param playerId - Player ID to match
 * @returns true if player participated in the game
 */
function isPlayerInGame(game: GameModel, playerId: string): boolean {
  return game.white_id === playerId || game.black_id === playerId;
}

/**
 * Counts wins/draws/losses for a player from their game history
 * @param playerId - Player ID to count for
 * @param playerGames - Games the player participated in
 * @returns Object with wins, draws, losses counts
 */
function countPlayerResults(
  playerId: string,
  playerGames: GameModel[],
): PlayerScoreResults {
  let wins = 0;
  let draws = 0;
  let losses = 0;

  for (const game of playerGames) {
    // Skip games without results
    if (!game.result) {
      continue;
    }

    const isWhite = game.white_id === playerId;

    // Count based on result and player colour
    switch (game.result) {
      case '1-0':
        isWhite ? wins++ : losses++;
        break;

      case '0-1':
        isWhite ? losses++ : wins++;
        break;

      case '1/2-1/2':
        draws++;
        break;

      default:
        throw new Error(`Invalid game result: ${game.result}`);
    }
  }

  return { wins, draws, losses };
}

/**
 * Calculates the number of byes (PAB) a player has received
 *
 * A player receives a bye when they don't play in a round that others did.
 * Per FIDE rules, bye recipients receive 1 full point (counted as a win).
 *
 * @param playerGamesCount - Number of games this player participated in
 * @param allGames - All games played so far in the tournament
 * @returns Number of byes the player received
 */
function calculateByeCount(
  playerGamesCount: number,
  allGames: GameModel[],
): number {
  // If no games exist yet, no byes possible
  if (allGames.length === 0) {
    return 0;
  }

  // Find the maximum round number to determine how many rounds have been played
  const maxRoundNumber = Math.max(...allGames.map((game) => game.round_number));

  // Byes = rounds played by others minus games this player participated in
  const byeCount = maxRoundNumber - playerGamesCount;

  return byeCount;
}

/**
 * Updates a single player's score based on game history
 *
 * Includes PAB (bye) points: per FIDE rules, bye recipients receive 1 full point.
 *
 * @param player - Player to update
 * @param games - All games played so far
 * @returns Updated player with recalculated wins/draws/losses
 */
function updateSinglePlayerScore(
  player: PlayerModel,
  games: GameModel[],
): PlayerModel {
  // Filter games involving this player
  const playerGames = games.filter((game) => isPlayerInGame(game, player.id));

  // Count results from player's games
  const results = countPlayerResults(player.id, playerGames);

  // Calculate byes: per FIDE rules, each bye counts as 1 full point (win)
  const byeCount = calculateByeCount(playerGames.length, games);

  // Return updated player with new scores (including bye points)
  return {
    ...player,
    wins: results.wins + byeCount,
    draws: results.draws,
    losses: results.losses,
  };
}

/**
 * Updates all players' win/draw/loss counts based on game results
 * Essential for Swiss testing where scores must be updated between rounds
 * @param players - Array of players to update
 * @param games - All games played so far
 * @returns Updated players with recalculated wins/draws/losses
 */
export const updatePlayerScores = mock(
  (players: PlayerModel[], games: GameModel[]): PlayerModel[] => {
    return players.map((player) => updateSinglePlayerScore(player, games));
  },
);
