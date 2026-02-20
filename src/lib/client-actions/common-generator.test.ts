import { mock } from 'bun:test';

import { countPlayerResults } from '@/lib/client-actions/common-generator';
import { newid } from '@/lib/utils';
import { GameResult } from '@/server/db/zod/enums';
import { ClubModel } from '@/server/db/zod/clubs';
import { GameModel, TournamentModel } from '@/server/db/zod/tournaments';
import { UserModel } from '@/server/db/zod/users';
import type { PlayerTournamentModel } from '@/server/db/zod/players';
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

const POSSIBLE_RESULTS: GameResult[] = ['0-1', '1-0', '1/2-1/2'];

const RATING_FAKEOPTS = {
  min: 500,
  max: 3000,
};

const generateUserModel = mock<() => UserModel>(() => {
  const randomId = newid();
  const randomNickname = faker.internet.username();
  const randomRealName = faker.person.fullName();
  const randomRating = faker.number.int(RATING_FAKEOPTS);
  const randomEmail = faker.internet.email();
  const randomClubName = faker.company.name();
  const randomCreationDate = faker.date.anytime();

  const randomUser: UserModel = {
    id: randomId,
    username: randomNickname,
    name: randomRealName,
    email: randomEmail,
    rating: randomRating,
    selectedClub: randomClubName,
    createdAt: randomCreationDate,
  };
  return randomUser;
});

const generateRandomClubModel = mock<() => ClubModel>(() => {
  const randomId = newid();
  const randomTitle = faker.animal.cat();
  const randomDescription = faker.food.description();
  const randomCreatedAt = faker.date.anytime();
  const randomLichessTeam = faker.book.title();
  const randomClub: ClubModel = {
    id: randomId,
    name: randomTitle,
    description: randomDescription,
    createdAt: randomCreatedAt,
    lichessTeam: randomLichessTeam,
  };
  return randomClub;
});

export const generateRandomDatabaseTournament = mock<() => TournamentModel>(
  () => {
    const randomDate = faker.date.anytime();
    const randomId = newid();
    const randomTitle = faker.music.songName();
    const randomCreationDate = faker.date.anytime();
    const randomClub = generateRandomClubModel();
    const randomStartDate = faker.date.anytime();
    const randomEndDate = faker.date.anytime();
    const randomRoundsNumber = faker.number.int();
    const randomIsRated = faker.datatype.boolean();

    const randomTournament: TournamentModel = {
      date: randomDate.toDateString(),
      id: randomId,
      title: randomTitle,
      format: DEFAULT_FORMAT,
      type: DEFAULT_TYPE,
      createdAt: randomCreationDate,
      clubId: randomClub.id,
      startedAt: randomStartDate,
      closedAt: randomEndDate,
      roundsNumber: randomRoundsNumber,
      ongoingRound: INITIAL_ONGOING_ROUND,
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
  const randomUser = generateUserModel();

  const randomPlayer: PlayerTournamentModel = {
    id: randomUser.id,
    nickname: randomUser.username,
    wins: INITIAL_WINS,
    draws: INITIAL_DRAWS,
    losses: INITIAL_LOSSES,
    colorIndex: INITIAL_COLOUR_INDEX,
    realname: randomUser.name,
    rating: randomUser.rating ?? 0,
    isOut: DEFAULT_IS_EXITED,
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
 * Checks if a game involves a specific player (as white or black)
 * @param game - Game to check
 * @param playerId - Player ID to match
 * @returns true if player participated in the game
 */
function isPlayerInGame(game: GameModel, playerId: string): boolean {
  return game.whiteId === playerId || game.blackId === playerId;
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
  const maxRoundNumber = Math.max(...allGames.map((game) => game.roundNumber));

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
  player: PlayerTournamentModel,
  games: GameModel[],
): PlayerTournamentModel {
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
  (
    players: PlayerTournamentModel[],
    games: GameModel[],
  ): PlayerTournamentModel[] => {
    return players.map((player) => updateSinglePlayerScore(player, games));
  },
);
