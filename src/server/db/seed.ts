import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { db } from '@/server/db/index';
import * as schema from '@/server/db/schema';
import { buildClubPlayerStats } from '@/server/mutations/player-stats';
import type { GameResult } from '@/server/zod/enums';
import { reset } from 'drizzle-seed';
import type { User } from 'lucia';

import { verifyTestDatabase } from '@/lib/config/urls';

const SEEDED_AT = new Date();

type SeedPlayer = ReturnType<typeof playerRows>[number];
type SeedTournament = Pick<
  typeof schema.tournaments.$inferInsert,
  'id' | 'clubId' | 'type' | 'rated' | 'roundsNumber' | 'ongoingRound'
> & {
  closed?: boolean;
  units: { players: SeedPlayer[]; place?: number }[];
  games: [
    round: number,
    white: number,
    black: number,
    result: GameResult | null,
    players?: [white: SeedPlayer, black: SeedPlayer],
  ][];
};
type SeedClub = {
  clubId: string;
  createdAt: Date;
  players: SeedPlayer[];
  tournaments: SeedTournament[];
};

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
const unitIds = ({ id, units }: SeedTournament) =>
  units.map((_, i) => `${id}-unit-${i}`);
const gameIds = ({ id, games }: SeedTournament) =>
  games.map((_, i) => `${id}-game-${i}`);

/** a new user, like sign-up makes: co-owner of a club of their own */
const userRow = (id: string): User => ({
  id,
  username: id,
  name: id,
  email: `${id}@mktour.test`,
  rating: 1500,
  selectedClub: `${id}-club`,
  createdAt: SEEDED_AT,
});

const playerRows = (clubId: string, count: number) =>
  ids(`${clubId}-player`, count).map((id) => ({
    id,
    clubId,
    nickname: id,
    userId: null as string | null,
    rating: 1500,
    ratingDeviation: GLICKO2_CONSTANTS.DEFAULT_RD,
    ratingLastUpdateAt: SEEDED_AT,
    lastSeenAt: SEEDED_AT,
  }));

/** one swiss round, paired in order; with an odd count the last player has a bye */
const soloRound = (
  id: string,
  clubId: string,
  players: SeedPlayer[],
  results: (GameResult | null)[],
): SeedTournament => ({
  id,
  clubId,
  type: 'solo',
  rated: true,
  roundsNumber: 1,
  ongoingRound: 1,
  units: players.map((player) => ({ players: [player] })),
  games: results.map((result, i) => [
    1,
    2 * i,
    2 * i + 1,
    result,
    [players[2 * i], players[2 * i + 1]],
  ]),
});

/** six new players; with results the first five play one round, the fifth on a bye */
const newClub = (clubId: string, results?: (GameResult | null)[]): SeedClub => {
  const players = playerRows(clubId, 6);
  return {
    clubId,
    createdAt: SEEDED_AT,
    players,
    tournaments: results
      ? [soloRound(`${clubId}-round`, clubId, players.slice(0, 5), results)]
      : [],
  };
};

const ORGANIZER = userRow('organizer');
const MEMBER = userRow('club-member');
const USERS = ids('user', 4).map(userRow);

const CLUBS = ids('club', 4).map((id) => newClub(id));
const READY = ids('ready', 20).map((id) => newClub(id, ['1-0', '1-0']));
const ONGOING = ids('ongoing', 4).map((id) => newClub(id, ['1-0', null]));

// founded on one date, so club lists tie. the first of four players is rated
// 1600, the others 1500, last seen in order; the second beats the fourth in
// three finished rounds that share one date too
const HISTORY: SeedClub[] = ids('history', 3).map((clubId) => {
  const players = playerRows(clubId, 4).map((player, i) => ({
    ...player,
    nickname: `${i % 2 ? 'Player' : 'player'} ${i}`,
    rating: i === 0 ? 1600 : 1500,
    lastSeenAt: new Date(Date.UTC(2026, 0, i + 1)),
  }));
  return {
    clubId,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    players,
    tournaments: ids(`${clubId}-round`, 3).map((id) => ({
      ...soloRound(id, clubId, [players[1], players[3]], ['1-0']),
      rated: false,
      closed: true,
    })),
  };
});
// the member plays in two of them
for (const { players } of HISTORY.slice(1)) players[0].userId = MEMBER.id;

// pairs a, b and c. closed: a and b draw a team game and share first; c, after
// a bye, beats a in a game naming its players. open: a beats b
const DOUBLES: SeedClub = (() => {
  const clubId = 'doubles';
  const players = playerRows(clubId, 6);
  const [a, b, c] = [0, 2, 4].map((i) => players.slice(i, i + 2));
  const doubles = {
    clubId,
    type: 'doubles',
    rated: false,
    roundsNumber: 2,
  } as const;
  return {
    clubId,
    createdAt: SEEDED_AT,
    players,
    tournaments: [
      {
        ...doubles,
        id: 'doubles-closed',
        ongoingRound: 2,
        closed: true,
        units: [
          { players: a, place: 1 },
          { players: b, place: 1 },
          { players: c, place: 3 },
        ],
        games: [
          [1, 0, 1, '1/2-1/2'],
          [2, 2, 0, '1-0', [c[0], a[0]]],
        ],
      },
      {
        ...doubles,
        id: 'doubles-open',
        ongoingRound: 1,
        units: [{ players: a }, { players: b }],
        games: [[1, 0, 1, '1-0']],
      },
    ],
  };
})();

const clubHandle = ({ clubId, players }: SeedClub) => ({
  clubId,
  playerIds: players.map((player) => player.id),
});
const roundHandle = (club: SeedClub) => {
  const [round] = club.tournaments;
  return {
    ...clubHandle(club),
    tournamentId: round.id,
    unitIds: unitIds(round),
    gameIds: gameIds(round),
  };
};

/**
 * everything tests use, inserted once by the seed. generators hand out rows no
 * other test has touched: ready rounds have both games decided, ongoing ones
 * leave the second open. organizer manages every club below
 */
export const fixtures = {
  organizer: ORGANIZER,
  member: MEMBER,
  users: USERS.values(),
  clubs: CLUBS.map(clubHandle).values(),
  ready: READY.map(roundHandle).values(),
  ongoing: ONGOING.map(roundHandle).values(),
  history: HISTORY.map(clubHandle),
  doubles: clubHandle(DOUBLES),
};

const tournamentRows = (tournament: SeedTournament, createdAt: Date) => {
  const { id, closed, units, games, ...columns } = tournament;
  const unitRows = unitIds(tournament).map((unitId, i) => ({
    id: unitId,
    tournamentId: id,
    size: units[i].players.length,
    number: i + 1,
    place: units[i].place,
    nickname: units[i].players.map((player) => player.nickname).join(' & '),
    wins: 0,
    draws: 0,
    losses: 0,
    colorIndex: 0,
  }));
  for (const [, white, black, result] of games) {
    const deltas = getUnitResultDeltas(null, result);
    for (const [unit, delta] of [
      [unitRows[white], deltas.white],
      [unitRows[black], deltas.black],
    ] as const) {
      unit.wins += delta.wins;
      unit.draws += delta.draws;
      unit.losses += delta.losses;
      unit.colorIndex += delta.colorIndex;
    }
  }
  return {
    tournament: {
      ...columns,
      id,
      format: 'swiss' as const,
      date: createdAt.toISOString().slice(0, 10),
      createdAt,
      startedAt: createdAt,
      closedAt: closed ? createdAt : null,
    },
    units: unitRows,
    playersToUnits: units.flatMap(({ players }, i) =>
      players.map((player, n) => ({
        id: `${player.id}_${unitRows[i].id}`,
        playerId: player.id,
        unitId: unitRows[i].id,
        numberInUnit: n + 1,
      })),
    ),
    games: gameIds(tournament).map((gameId, i) => {
      const [round, white, black, result, players] = games[i];
      return {
        id: gameId,
        tournamentId: id,
        gameNumber: i + 1,
        roundNumber: round,
        whiteUnitId: unitRows[white].id,
        blackUnitId: unitRows[black].id,
        whitePlayerId: players?.[0].id,
        blackPlayerId: players?.[1].id,
        result,
        finishedAt: result ? createdAt : null,
      };
    }),
  };
};

export const seedComprehensiveTestData = async () => {
  if (verifyTestDatabase()) {
    await reset(db, schema);

    const users = [ORGANIZER, MEMBER, ...USERS];
    const managed = [...CLUBS, ...READY, ...ONGOING, ...HISTORY, DOUBLES];
    const clubs = [
      ...users.map((user) => ({
        clubId: user.selectedClub,
        createdAt: SEEDED_AT,
        players: [],
        tournaments: [],
      })),
      ...managed,
    ];
    const players = clubs.flatMap((club) => club.players);
    const tournaments = clubs.flatMap((club) =>
      club.tournaments.map((tournament) =>
        tournamentRows(tournament, club.createdAt),
      ),
    );

    // one insert per table: each statement is a round trip to the test db
    await db.insert(schema.clubs).values(
      clubs.map(({ clubId, createdAt }) => ({
        id: clubId,
        name: clubId,
        createdAt,
      })),
    );
    await db.insert(schema.users).values(users);
    await db.insert(schema.clubs_to_users).values([
      ...users.map((user) => ({
        id: `${user.selectedClub}_${user.id}`,
        clubId: user.selectedClub,
        userId: user.id,
        status: 'co-owner' as const,
      })),
      ...managed.map(({ clubId }) => ({
        id: `${clubId}_${ORGANIZER.id}`,
        clubId,
        userId: ORGANIZER.id,
        status: 'admin' as const,
      })),
    ]);
    await db.insert(schema.players).values(players);
    await db.insert(schema.rating_events).values(
      players.map((player) => ({
        id: `${player.id}-starting`,
        playerId: player.id,
        publishedAt: player.ratingLastUpdateAt,
        rating: player.rating,
        ratingDeviation: player.ratingDeviation,
        isStarting: true,
      })),
    );
    await db
      .insert(schema.tournaments)
      .values(tournaments.map((rows) => rows.tournament));
    await db
      .insert(schema.tournament_units)
      .values(tournaments.flatMap((rows) => rows.units));
    await db
      .insert(schema.players_to_units)
      .values(tournaments.flatMap((rows) => rows.playersToUnits));
    await db
      .insert(schema.games)
      .values(tournaments.flatMap((rows) => rows.games));
    await db
      .insert(schema.player_stats)
      .values(
        (
          await Promise.all(
            managed.map((club) => buildClubPlayerStats(db, club.clubId)),
          )
        ).flat(),
      );
  }
};
