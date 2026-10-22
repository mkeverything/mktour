import { mock } from 'bun:test';

import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { newid } from '@/lib/utils';
import { ClubModel } from '@/server/zod/clubs';
import { GameResult } from '@/server/zod/enums';
import type { UnitModel } from '@/server/zod/tournaments';
import { GameModel, TournamentModel } from '@/server/zod/tournaments';
import { UserModel } from '@/server/zod/users';
import { faker } from '@faker-js/faker';
import assert from 'assert';

const INITIAL_WINS = 0;
const INITIAL_LOSSES = 0;
const INITIAL_DRAWS = 0;
export const INITIAL_ONGOING_ROUND = 1;
const INITIAL_COLOUR_INDEX = 0;

/** a seeded game has no earlier result for the deltas to replace. */
const NO_PREVIOUS_RESULT = null;

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
    allowPlayersSetResults: true,
    latitude: null,
    longitude: null,
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
      latitude: null,
      longitude: null,
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

  const randomPlayer: UnitModel = {
    id: randomUser.id,
    size: 1,
    wins: INITIAL_WINS,
    draws: INITIAL_DRAWS,
    losses: INITIAL_LOSSES,
    colorIndex: INITIAL_COLOUR_INDEX,

    isOut: DEFAULT_IS_EXITED,
    place: DEFAULT_PLACE,
    number: null,
    addedAt: null,
    unitNickname: randomUser.username,
    players: [
      {
        id: randomUser.id,
        nickname: randomUser.username,
        realname: randomUser.name,
        rating: randomUser.rating ?? 0,
        userId: randomUser.id,
        username: randomUser.username,
      },
    ],
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
export function isPlayerInGame(game: GameModel, playerId: string): boolean {
  return game.whiteUnitId === playerId || game.blackUnitId === playerId;
}

/**
 * Collects every game a player took part in, with either colour.
 * @param games - Games to search
 * @param playerId - Player ID to match
 * @returns the subset of games involving this player
 */
export function getPlayerGames(
  games: GameModel[],
  playerId: string,
): GameModel[] {
  return games.filter((game) => isPlayerInGame(game, playerId));
}

/**
 * Collects every game in which two players faced each other, with either
 * colour split. In a valid round robin this is exactly one game per pair.
 * @param games - Games to search
 * @param playerIdA - First player ID
 * @param playerIdB - Second player ID
 * @returns the subset of games between exactly these two players
 */
export function getGamesBetweenPlayers(
  games: GameModel[],
  playerIdA: string,
  playerIdB: string,
): GameModel[] {
  return games.filter(
    (game) =>
      isPlayerInGame(game, playerIdA) && isPlayerInGame(game, playerIdB),
  );
}

/** a unit's wins, draws, losses and colour index — production's ResultStats shape. */
type ResultStats = ReturnType<typeof getUnitResultDeltas>['white'];

const INITIAL_RESULT_STATS: ResultStats = {
  wins: INITIAL_WINS,
  draws: INITIAL_DRAWS,
  losses: INITIAL_LOSSES,
  colorIndex: INITIAL_COLOUR_INDEX,
};

/**
 * adds one game to a unit's stats, with the same deltas production applies.
 *
 * @param stats - the unit's stats before this game
 * @param game - a game the unit played
 * @param unitId - the unit whose side of the game to take
 * @returns the stats after this game
 */
function addGameToStats(
  stats: ResultStats,
  game: GameModel,
  unitId: UnitModel['id'],
): ResultStats {
  const deltas = getUnitResultDeltas(NO_PREVIOUS_RESULT, game.result);
  const isWhite = game.whiteUnitId === unitId;
  const unitDeltas = isWhite ? deltas.white : deltas.black;

  return {
    wins: stats.wins + unitDeltas.wins,
    draws: stats.draws + unitDeltas.draws,
    losses: stats.losses + unitDeltas.losses,
    colorIndex: stats.colorIndex + unitDeltas.colorIndex,
  };
}

/**
 * rebuilds a unit's results and colour index from its games.
 *
 * uses the same per-game deltas the server and the client apply, so seeded
 * units match production. a bye adds nothing here: the engine infers byes
 * from the game history itself, and adding one here counted it twice.
 *
 * @param player - unit to update
 * @param games - all games played so far
 * @returns the unit with wins, draws, losses and colour index rebuilt
 */
function updateSinglePlayerScore(
  player: UnitModel,
  games: GameModel[],
): UnitModel {
  const playerGames = getPlayerGames(games, player.id);

  let stats = INITIAL_RESULT_STATS;
  for (const game of playerGames) {
    stats = addGameToStats(stats, game, player.id);
  }

  return { ...player, ...stats };
}

/**
 * rebuilds every unit's wins, draws, losses and colour index from the games so far.
 *
 * swiss tests call this between rounds so the engine sees the state production would.
 *
 * @param units - units to update
 * @param games - all games played so far
 * @returns the units with results and colour index rebuilt
 */
export const updatePlayerScores = mock(
  (units: UnitModel[], games: GameModel[]): UnitModel[] => {
    return units.map((unit) => updateSinglePlayerScore(unit, games));
  },
);
