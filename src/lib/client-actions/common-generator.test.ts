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
