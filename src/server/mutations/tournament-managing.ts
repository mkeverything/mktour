'use server';

import { validateRequest } from '@/lib/auth/lucia';
import {
  buildScoreMaps,
  hasSameStanding,
  sortPlayersByResults,
} from '@/lib/tournament-results';
import {
  getRoundRobinRoundsNumber,
  getSwissMaxRoundsNumber,
  getSwissRecommendedRoundsNumber,
  newid,
} from '@/lib/utils';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { GameResult, TournamentFormat } from '@/server/zod/enums';
import {
  PlayerFormModel,
  PlayerInsertModel,
  PlayerModel,
  PlayerTournamentModel,
} from '@/server/zod/players';
import {
  AddDoublesTeamModel,
  EditDoublesTeamModel,
  GameModel,
  NewTournamentFormModel,
  PlayerToTournamentInsertModel,
  TournamentInfoModel,
  TournamentModel,
  tournamentsInsertSchema,
} from '@/server/zod/tournaments';
import {
  aliasedTable,
  and,
  countDistinct,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { calculateAndApplyGlickoRatings } from './rating-calculation';
import { getPlayerResultDeltas } from './set-game-result-deltas';

function compareTeamMembers<
  T extends { numberInTeam: number | null; id: string },
>(a: T, b: T): number {
  if (a.numberInTeam === null && b.numberInTeam === null) {
    return a.id.localeCompare(b.id);
  }
  if (a.numberInTeam === null) return 1;
  if (b.numberInTeam === null) return -1;
  if (a.numberInTeam !== b.numberInTeam) {
    return a.numberInTeam - b.numberInTeam;
  }
  return a.id.localeCompare(b.id);
}

export const createTournament = async (
  values: Omit<NewTournamentFormModel, 'date'> & {
    date: string;
  },
) => {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const newTournamentID = newid();
  const resolvedRated = values.type === 'doubles' ? false : values.rated;
  const newTournament = tournamentsInsertSchema.parse({
    ...values,
    rated: resolvedRated,
    id: newTournamentID,
    createdAt: new Date(),
    closedAt: null,
    startedAt: null,
    roundsNumber: values.format === 'swiss' ? 1 : null,
    ongoingRound: 1,
  });

  await db.insert(tournaments).values(newTournament);
  return { id: newTournamentID };
};

// moved to API endpoint
export async function getTournamentPlayers(
  id: string,
): Promise<Array<PlayerTournamentModel>> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));

  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

  const [playerModels, allGames] = await Promise.all([
    getRawTournamentPlayers(id, tournament.type),
    getTournamentGames(id),
  ]);

  return sortPlayersByResults(playerModels, tournament, allGames);
}

/**
 * Fetches raw player models without sorting or additional queries.
 * Use this when the caller already has tournament/games data and will sort externally.
 */
async function getRawTournamentPlayers(
  id: string,
  tournamentType?: string,
): Promise<Array<PlayerTournamentModel>> {
  let type = tournamentType;
  if (!type) {
    const tournament = (
      await db
        .select({ type: tournaments.type })
        .from(tournaments)
        .where(eq(tournaments.id, id))
    ).at(0);

    if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
    type = tournament.type;
  }

  const playersDb = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      realname: players.realname,
      rating: players.rating,
      wins: players_to_tournaments.wins,
      draws: players_to_tournaments.draws,
      losses: players_to_tournaments.losses,
      colorIndex: players_to_tournaments.colorIndex,
      isOut: players_to_tournaments.isOut,
      place: players_to_tournaments.place,
      pairingNumber: players_to_tournaments.pairingNumber,
      addedAt: players_to_tournaments.addedAt,
      username: users.username,
      teamNickname: players_to_tournaments.teamNickname,
      numberInTeam: players_to_tournaments.numberInTeam,
    })
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, id))
    .innerJoin(players, eq(players.id, players_to_tournaments.playerId))
    .leftJoin(users, eq(users.id, players.userId));

  if (type !== 'doubles') {
    return playersDb.map(({ numberInTeam: _numberInTeam, ...rest }) => ({
      ...rest,
      pairPlayers: null,
    }));
  }

  const teamsMap = new Map<string, typeof playersDb>();
  playersDb.forEach((row) => {
    if (!row.teamNickname) return;
    const existingRows = teamsMap.get(row.teamNickname) ?? [];
    existingRows.push(row);
    teamsMap.set(row.teamNickname, existingRows);
  });

  return Array.from(teamsMap.entries()).map(([_teamNickname, members]) => {
    const sortedMembers = [...members].sort(compareTeamMembers);
    const leader = sortedMembers[0];
    const totalRating = sortedMembers.reduce(
      (acc, member) => acc + member.rating,
      0,
    );
    const rating = Math.round(totalRating / members.length);
    const {
      id,
      nickname,
      teamNickname,
      wins,
      draws,
      losses,
      colorIndex,
      isOut,
      place,
      pairingNumber,
      addedAt,
    } = leader;

    return {
      id,
      nickname: teamNickname ?? nickname,
      realname: null,
      rating,
      wins,
      draws,
      losses,
      colorIndex,
      isOut,
      place,
      pairingNumber,
      addedAt,
      teamNickname,
      username: null,
      pairPlayers: sortedMembers.map((member) => ({
        id: member.id,
        nickname: member.nickname,
        rating: member.rating,
      })),
    };
  });
}

// decided to keep using server action for this one not to face problems with dates serialization
export async function getTournamentInfo(
  id: string,
): Promise<TournamentInfoModel> {
  const tournamentInfo = (
    await db
      .select({
        tournament: getTableColumns(tournaments),
        club: getTableColumns(clubs),
      })
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
  ).at(0);
  if (!tournamentInfo) throw new Error('TOURNAMENT NOT FOUND');
  if (!tournamentInfo.club) throw new Error('ORGANIZER CLUB NOT FOUND');
  return tournamentInfo;
}

// moved to API endpoint
export async function getTournamentPossiblePlayers(
  id: string,
): Promise<Array<PlayerModel>> {
  const result = (await db.all(sql`
    SELECT p.*
    FROM ${players} p
    LEFT JOIN ${players_to_tournaments} pt
      ON p.id = pt.player_id AND pt.tournament_id = ${id}
    WHERE p.club_id = (
      SELECT t.club_id
      FROM ${tournaments} t
      WHERE t.id = ${id}
    )
    AND pt.player_id IS NULL;
  `)) as Array<PlayerModel>;
  return result;
}

export async function removePlayer({
  tournamentId,
  playerId,
  userId,
}: {
  tournamentId: string;
  playerId: string;
  userId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');

  if (tournament.type === 'doubles') {
    const participant = await db
      .select({ teamNickname: players_to_tournaments.teamNickname })
      .from(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, playerId),
        ),
      )
      .then((rows) => rows.at(0));
    if (!participant) throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');

    await db.transaction(async (tx) => {
      await tx
        .delete(games)
        .where(
          and(
            eq(games.tournamentId, tournamentId),
            or(eq(games.whiteId, playerId), eq(games.blackId, playerId)),
          ),
        );

      if (participant.teamNickname) {
        await tx
          .delete(players_to_tournaments)
          .where(
            and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.teamNickname, participant.teamNickname),
            ),
          );
      } else {
        await tx
          .delete(players_to_tournaments)
          .where(
            and(
              eq(players_to_tournaments.playerId, playerId),
              eq(players_to_tournaments.tournamentId, tournamentId),
            ),
          );
      }
    });
    await normalizeSwissRoundsNumber(tournamentId);
    return;
  }

  await db
    .delete(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.playerId, playerId),
        eq(players_to_tournaments.tournamentId, tournamentId),
      ),
    );
  await normalizeSwissRoundsNumber(tournamentId);
}

export async function addNewPlayer({
  tournamentId,
  player,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
  addedAt?: Date;
}) {
  const now = addedAt ?? new Date();
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }

  const playerId = player.id ?? newid();
  await db
    .insert(players)
    .values({ ...player, lastSeenAt: new Date(), id: playerId });
  const playerToTournament: PlayerToTournamentInsertModel = {
    playerId,
    tournamentId,
    id: `${playerId}=${tournamentId}`,
    wins: 0,
    losses: 0,
    draws: 0,
    colorIndex: 0,
    place: null,
    isOut: null,
    pairingNumber: null,
    addedAt: now,
    newRating: null,
    newRatingDeviation: null,
    newVolatility: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
}

// moved to API endpoint
export async function addExistingPlayer({
  tournamentId,
  player,
  userId,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerInsertModel;
  userId: string;
  addedAt?: Date;
}) {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status === 'viewer') throw new Error('NOT_ADMIN');

  const playerToTournament: PlayerToTournamentInsertModel = {
    playerId: player.id,
    tournamentId: tournamentId,
    id: `${player.id}=${tournamentId}`,
    wins: 0,
    losses: 0,
    draws: 0,
    colorIndex: 0,
    place: null,
    isOut: null,
    pairingNumber: null,
    addedAt: now,
    newRating: null,
    newRatingDeviation: null,
    newVolatility: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
}

export async function addDoublesTeam({
  tournamentId,
  nickname,
  firstPlayerId,
  secondPlayerId,
  addedAt,
}: AddDoublesTeamModel & {
  tournamentId: string;
  addedAt?: Date;
}): Promise<PlayerTournamentModel> {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'doubles') throw new Error('NOT_DOUBLES_TOURNAMENT');

  const selectedPlayers = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      rating: players.rating,
    })
    .from(players)
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        or(eq(players.id, firstPlayerId), eq(players.id, secondPlayerId)),
      ),
    );

  if (selectedPlayers.length !== 2) {
    throw new Error('PAIR_PLAYERS_NOT_FOUND');
  }

  const existingPair = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        or(
          eq(players_to_tournaments.playerId, firstPlayerId),
          eq(players_to_tournaments.playerId, secondPlayerId),
        ),
      ),
    )
    .limit(1);

  if (existingPair.length > 0) {
    throw new Error('PLAYER_ALREADY_IN_PAIR');
  }

  const existingNickname = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(
          sql<string>`lower(${players_to_tournaments.teamNickname})`,
          nickname.toLowerCase(),
        ),
      ),
    )
    .limit(1);

  if (existingNickname.length > 0) {
    throw new Error('PAIR_NICKNAME_TAKEN');
  }

  const selectedPlayersById = new Map(
    selectedPlayers.map((each) => [each.id, each]),
  );
  const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
    const player = selectedPlayersById.get(id);
    if (!player) throw new Error('PAIR_PLAYERS_NOT_FOUND');
    return player;
  });
  const leaderPlayerId = firstPlayerId;

  const teamRating = Math.round(
    orderedPlayers.reduce((acc, player) => acc + player.rating, 0) /
      orderedPlayers.length,
  );

  const teamMembers: PlayerToTournamentInsertModel[] = [
    {
      playerId: firstPlayerId,
      tournamentId,
      id: `${firstPlayerId}=${tournamentId}`,
      wins: 0,
      losses: 0,
      draws: 0,
      colorIndex: 0,
      place: null,
      isOut: null,
      pairingNumber: null,
      teamNickname: nickname,
      numberInTeam: 1,
      addedAt: now,
      newRating: null,
      newRatingDeviation: null,
      newVolatility: null,
    },
    {
      playerId: secondPlayerId,
      tournamentId,
      id: `${secondPlayerId}=${tournamentId}`,
      wins: 0,
      losses: 0,
      draws: 0,
      colorIndex: 0,
      place: null,
      isOut: null,
      pairingNumber: null,
      teamNickname: nickname,
      numberInTeam: 2,
      addedAt: now,
      newRating: null,
      newRatingDeviation: null,
      newVolatility: null,
    },
  ];

  await db.insert(players_to_tournaments).values(teamMembers);

  await normalizeSwissRoundsNumber(tournamentId);

  return {
    id: leaderPlayerId,
    nickname,
    realname: null,
    rating: teamRating,
    wins: 0,
    draws: 0,
    losses: 0,
    colorIndex: 0,
    isOut: null,
    place: null,
    pairingNumber: null,
    addedAt: now,
    teamNickname: nickname,
    username: null,
    pairPlayers: orderedPlayers.map((player) => ({
      id: player.id,
      nickname: player.nickname,
    })),
  };
}

export async function editDoublesTeam({
  tournamentId,
  currentTeamPlayerId,
  nickname,
  firstPlayerId,
  secondPlayerId,
}: EditDoublesTeamModel & {
  tournamentId: string;
}): Promise<void> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'doubles') throw new Error('NOT_DOUBLES_TOURNAMENT');

  const participant = await db
    .select({
      teamNickname: players_to_tournaments.teamNickname,
      addedAt: players_to_tournaments.addedAt,
    })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(players_to_tournaments.playerId, currentTeamPlayerId),
      ),
    )
    .then((rows) => rows.at(0));

  if (!participant?.teamNickname) {
    throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
  }
  const currentTeamNickname = participant.teamNickname;
  const preservedAddedAt = participant.addedAt ?? new Date();

  const selectedPlayers = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      rating: players.rating,
    })
    .from(players)
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        or(eq(players.id, firstPlayerId), eq(players.id, secondPlayerId)),
      ),
    );

  if (selectedPlayers.length !== 2) {
    throw new Error('PAIR_PLAYERS_NOT_FOUND');
  }

  const currentTeamMembers = await db
    .select({ playerId: players_to_tournaments.playerId })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(players_to_tournaments.teamNickname, currentTeamNickname),
      ),
    );

  const currentTeamMemberIds = new Set(
    currentTeamMembers.map((member) => member.playerId),
  );

  const occupiedPlayers = await db
    .select({
      playerId: players_to_tournaments.playerId,
      teamNickname: players_to_tournaments.teamNickname,
    })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        inArray(players_to_tournaments.playerId, [
          firstPlayerId,
          secondPlayerId,
        ]),
      ),
    );

  const hasOtherTeamMember = occupiedPlayers.some(
    (row) =>
      !currentTeamMemberIds.has(row.playerId) &&
      row.teamNickname !== currentTeamNickname,
  );
  if (hasOtherTeamMember) {
    throw new Error('PLAYER_ALREADY_IN_PAIR');
  }

  const existingNickname = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(
          sql<string>`lower(${players_to_tournaments.teamNickname})`,
          nickname.toLowerCase(),
        ),
        ne(players_to_tournaments.teamNickname, currentTeamNickname),
      ),
    )
    .limit(1);

  if (existingNickname.length > 0) {
    throw new Error('PAIR_NICKNAME_TAKEN');
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.teamNickname, currentTeamNickname),
        ),
      );

    const selectedPlayersById = new Map(
      selectedPlayers.map((each) => [each.id, each]),
    );
    const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
      const player = selectedPlayersById.get(id);
      if (!player) throw new Error('PAIR_PLAYERS_NOT_FOUND');
      return player;
    });

    const [firstPlayer, secondPlayer] = orderedPlayers;

    await tx.insert(players_to_tournaments).values([
      {
        playerId: firstPlayer.id,
        tournamentId,
        id: `${firstPlayer.id}=${tournamentId}`,
        wins: 0,
        losses: 0,
        draws: 0,
        colorIndex: 0,
        place: null,
        isOut: null,
        pairingNumber: null,
        teamNickname: nickname,
        numberInTeam: 1,
        addedAt: preservedAddedAt,
        newRating: null,
        newRatingDeviation: null,
        newVolatility: null,
      },
      {
        playerId: secondPlayer.id,
        tournamentId,
        id: `${secondPlayer.id}=${tournamentId}`,
        wins: 0,
        losses: 0,
        draws: 0,
        colorIndex: 0,
        place: null,
        isOut: null,
        pairingNumber: null,
        teamNickname: nickname,
        numberInTeam: 2,
        addedAt: preservedAddedAt,
        newRating: null,
        newRatingDeviation: null,
        newVolatility: null,
      },
    ]);
  });

  await normalizeSwissRoundsNumber(tournamentId);
}

type DoublesTeamMembersMap = {
  teamByPlayerId: Map<string, string>;
  membersByTeam: Map<
    string,
    Array<{ id: string; nickname: string; numberInTeam: number | null }>
  >;
};

async function getDoublesTeamMembers(
  tournamentId: string,
): Promise<DoublesTeamMembersMap> {
  const rows = await db
    .select({
      playerId: players_to_tournaments.playerId,
      teamNickname: players_to_tournaments.teamNickname,
      nickname: players.nickname,
      numberInTeam: players_to_tournaments.numberInTeam,
    })
    .from(players_to_tournaments)
    .innerJoin(players, eq(players.id, players_to_tournaments.playerId))
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        isNotNull(players_to_tournaments.teamNickname),
      ),
    );

  const teamByPlayerId = new Map<string, string>();
  const membersByTeam = new Map<
    string,
    Array<{ id: string; nickname: string; numberInTeam: number | null }>
  >();

  rows.forEach((row) => {
    if (!row.teamNickname) return;
    teamByPlayerId.set(row.playerId, row.teamNickname);
    const members = membersByTeam.get(row.teamNickname) ?? [];
    members.push({
      id: row.playerId,
      nickname: row.nickname,
      numberInTeam: row.numberInTeam,
    });
    membersByTeam.set(row.teamNickname, members);
  });

  membersByTeam.forEach((members) => {
    members.sort((a, b) =>
      compareTeamMembers(
        { numberInTeam: a.numberInTeam, id: a.id },
        { numberInTeam: b.numberInTeam, id: b.id },
      ),
    );
  });

  return { teamByPlayerId, membersByTeam };
}

function enrichGamesWithDoublesInfo(
  sortedGames: GameModel[],
  doublesTeamMembers: DoublesTeamMembersMap,
): GameModel[] {
  const { teamByPlayerId, membersByTeam } = doublesTeamMembers;
  return sortedGames.map((game) => {
    const whiteTeam = teamByPlayerId.get(game.whiteId);
    const blackTeam = teamByPlayerId.get(game.blackId);
    const whiteMembers = whiteTeam ? (membersByTeam.get(whiteTeam) ?? []) : [];
    const blackMembers = blackTeam ? (membersByTeam.get(blackTeam) ?? []) : [];

    if (whiteMembers.length < 2 || blackMembers.length < 2) {
      return {
        ...game,
        whiteNickname: whiteTeam ?? game.whiteNickname,
        blackNickname: blackTeam ?? game.blackNickname,
      };
    }

    return {
      ...game,
      whiteNickname: whiteTeam ?? game.whiteNickname,
      blackNickname: blackTeam ?? game.blackNickname,
      pairMembers: {
        white: [whiteMembers[0], whiteMembers[1]],
        black: [blackMembers[0], blackMembers[1]],
      },
    };
  });
}

export async function getTournamentGames(
  tournamentId: string,
): Promise<GameModel[]> {
  const whitePlayer = aliasedTable(players, 'white_player');
  const blackPlayer = aliasedTable(players, 'black_player');
  const gamesDb = await db
    .select({
      id: games.id,
      tournamentId: games.tournamentId,
      blackId: games.blackId,
      whiteId: games.whiteId,
      blackNickname: blackPlayer.nickname,
      whiteNickname: whitePlayer.nickname,
      roundNumber: games.roundNumber,
      gameNumber: games.gameNumber,
      roundName: games.roundName,
      whitePrevGameId: games.whitePrevGameId,
      blackPrevGameId: games.blackPrevGameId,
      result: games.result,
      finishedAt: games.finishedAt,
    })
    .from(games)
    .where(eq(games.tournamentId, tournamentId))
    .innerJoin(whitePlayer, eq(games.whiteId, whitePlayer.id))
    .innerJoin(blackPlayer, eq(games.blackId, blackPlayer.id));

  const sortedGames: GameModel[] = gamesDb
    .map((g) => ({ ...g, pairMembers: null }))
    .sort((a, b) => a.gameNumber - b.gameNumber);
  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.type !== 'doubles') return sortedGames;

  const doublesTeamMembers = await getDoublesTeamMembers(tournamentId);
  return enrichGamesWithDoublesInfo(sortedGames, doublesTeamMembers);
}

// moved to API endpoint
export async function getTournamentRoundGames({
  tournamentId,
  roundNumber,
}: {
  tournamentId: string;
  roundNumber: number;
}): Promise<GameModel[]> {
  const whitePlayer = aliasedTable(players, 'white_player');
  const blackPlayer = aliasedTable(players, 'black_player');
  const gamesDb = await db
    .select({
      ...getTableColumns(games),
      blackNickname: blackPlayer.nickname,
      whiteNickname: whitePlayer.nickname,
    })
    .from(games)
    .where(
      and(
        eq(games.tournamentId, tournamentId),
        eq(games.roundNumber, roundNumber),
      ),
    )
    .innerJoin(whitePlayer, eq(games.whiteId, whitePlayer.id))
    .innerJoin(blackPlayer, eq(games.blackId, blackPlayer.id));

  const sortedGames: GameModel[] = gamesDb
    .map((g) => ({ ...g, pairMembers: null }))
    .sort((a, b) => a.gameNumber - b.gameNumber);
  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.type !== 'doubles') return sortedGames;

  const doublesTeamMembers = await getDoublesTeamMembers(tournamentId);
  return enrichGamesWithDoublesInfo(sortedGames, doublesTeamMembers);
}

export async function saveRound({
  tournamentId,
  roundNumber,
  newGames,
}: {
  tournamentId: string;
  roundNumber: number;
  newGames: GameModel[];
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status === 'viewer') throw new Error('NOT_ADMIN');
  const existingDecidedGames = await db
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.tournamentId, tournamentId),
        eq(games.roundNumber, roundNumber),
        isNotNull(games.result),
      ),
    )
    .limit(1);
  if (existingDecidedGames.length > 0) {
    throw new Error('ROUND_ALREADY_HAS_RESULTS');
  }
  const cleanupPromises = [
    db
      .delete(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          eq(games.roundNumber, roundNumber),
        ),
      ),
    db
      .update(tournaments)
      .set({ ongoingRound: roundNumber })
      .where(eq(tournaments.id, tournamentId)),
  ];

  await Promise.all(cleanupPromises);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPromises: Promise<any>[] = []; // FIXME any
  newGames.forEach((game) => {
    const { blackNickname, whiteNickname, pairMembers, ...newGame } = game;
    insertPromises.push(db.insert(games).values(newGame));
  });

  await Promise.all(insertPromises);
}

export async function startTournament({
  tournamentId,
  startedAt,
  format,
  roundsNumber,
}: Pick<TournamentModel, 'format' | 'roundsNumber' | 'startedAt'> & {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');

  const finalRoundsNumber = await resolveTournamentRoundsNumber({
    tournamentId,
    format,
    roundsNumber,
  });

  await Promise.all([
    db
      .update(tournaments)
      .set({ startedAt, roundsNumber: finalRoundsNumber })
      .where(
        and(eq(tournaments.id, tournamentId), isNull(tournaments.startedAt)),
      )
      .then((value) => {
        if (!value.rowsAffected) throw new Error('TOURNAMENT_ALREADY_GOING');
      }),
    updatePairingNumbers(tournamentId),
  ]);
}

export async function resetTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');
  await db.transaction(async (tx) => {
    const tournamentUpdate = await tx
      .update(tournaments)
      .set({
        startedAt: null,
        ongoingRound: 1,
        closedAt: null,
      })
      .where(
        and(eq(tournaments.id, tournamentId), isNotNull(tournaments.startedAt)),
      );
    if (!tournamentUpdate.rowsAffected)
      throw new Error('TOURNAMENT_ALREADY_RESET');

    await tx
      .delete(games)
      .where(
        and(eq(games.tournamentId, tournamentId), ne(games.roundNumber, 1)),
      );

    await tx
      .update(players_to_tournaments)
      .set({
        wins: 0,
        draws: 0,
        losses: 0,
        colorIndex: 0,
        place: null,
      })
      .where(eq(players_to_tournaments.tournamentId, tournamentId));

    await tx
      .update(games)
      .set({ result: null, finishedAt: null })
      .where(eq(games.tournamentId, tournamentId));
  });
}

export async function setTournamentGameResult({
  gameId,
  result,
  tournamentId,
}: {
  tournamentId: string;
  gameId: string;
  result: GameResult;
  whiteId: string;
  blackId: string;
  prevResult: GameResult | null;
  roundNumber: number;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const authStatus = await getStatusInTournament(user.id, tournamentId);
  if (authStatus.status === 'viewer') throw new Error('NOT_AUTHORIZED');

  const tournamentWithClub = (
    await db
      .select({
        startedAt: tournaments.startedAt,
        closedAt: tournaments.closedAt,
        allowPlayersSetResults: clubs.allowPlayersSetResults,
      })
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(eq(tournaments.id, tournamentId))
  ).at(0);
  if (!tournamentWithClub) throw new Error('TOURNAMENT NOT FOUND');
  if (tournamentWithClub.startedAt === null)
    throw new Error('TOURNAMENT_NOT_STARTED');
  if (tournamentWithClub.closedAt !== null) {
    throw new Error('TOURNAMENT_ALREADY_FINISHED');
  }

  await db.transaction(async (tx) => {
    const game = (
      await tx
        .select({
          whiteId: games.whiteId,
          blackId: games.blackId,
          result: games.result,
        })
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.tournamentId, tournamentId)))
    ).at(0);
    if (!game) throw new Error('GAME_NOT_FOUND');

    const [whiteParticipant, blackParticipant] = await Promise.all([
      tx
        .select({ teamNickname: players_to_tournaments.teamNickname })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, game.whiteId),
          ),
        )
        .then((rows) => rows.at(0)),
      tx
        .select({ teamNickname: players_to_tournaments.teamNickname })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, game.blackId),
          ),
        )
        .then((rows) => rows.at(0)),
    ]);

    if (authStatus.status === 'player') {
      if (!tournamentWithClub.allowPlayersSetResults) {
        throw new Error('PLAYER_RESULT_SETTING_DISABLED');
      }
      const authParticipant = await tx
        .select({
          playerId: players_to_tournaments.playerId,
          teamNickname: players_to_tournaments.teamNickname,
        })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, authStatus.playerId),
          ),
        )
        .then((rows) => rows.at(0));

      const isPlayerInGame =
        authStatus.playerId === game.whiteId ||
        authStatus.playerId === game.blackId ||
        (!!authParticipant?.teamNickname &&
          (authParticipant.teamNickname === whiteParticipant?.teamNickname ||
            authParticipant.teamNickname === blackParticipant?.teamNickname));
      if (!isPlayerInGame) throw new Error('NOT_YOUR_GAME');
    }

    const nextResult: GameResult | null =
      game.result === result ? null : result;
    const deltas = getPlayerResultDeltas(game.result, nextResult);

    const whitePlayerUpdate = await tx
      .update(players_to_tournaments)
      .set({
        wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + ${deltas.white.wins}`,
        draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + ${deltas.white.draws}`,
        losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + ${deltas.white.losses}`,
        colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) + ${deltas.white.colorIndex}`,
      })
      .where(
        whiteParticipant?.teamNickname
          ? and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(
                players_to_tournaments.teamNickname,
                whiteParticipant.teamNickname,
              ),
            )
          : and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.playerId, game.whiteId),
            ),
      );
    if (!whitePlayerUpdate.rowsAffected) {
      throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
    }

    const blackPlayerUpdate = await tx
      .update(players_to_tournaments)
      .set({
        wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + ${deltas.black.wins}`,
        draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + ${deltas.black.draws}`,
        losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + ${deltas.black.losses}`,
      })
      .where(
        blackParticipant?.teamNickname
          ? and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(
                players_to_tournaments.teamNickname,
                blackParticipant.teamNickname,
              ),
            )
          : and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.playerId, game.blackId),
            ),
      );
    if (!blackPlayerUpdate.rowsAffected) {
      throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
    }

    const currentResultCondition =
      game.result === null
        ? isNull(games.result)
        : eq(games.result, game.result);
    const gameUpdate = await tx
      .update(games)
      .set({
        result: nextResult,
        finishedAt: nextResult ? new Date() : null,
      })
      .where(
        and(
          eq(games.id, gameId),
          eq(games.tournamentId, tournamentId),
          currentResultCondition,
        ),
      );
    if (!gameUpdate.rowsAffected)
      throw new Error('CONCURRENT_GAME_RESULT_UPDATE');
  });
}

export async function finishTournament({
  tournamentId,
  closedAt,
}: {
  tournamentId: string;
  closedAt: Date;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');

  // Read-only data needed for placement calculation (fetched before the transaction)
  const allGames = await getTournamentGames(tournamentId);
  const playersUnsorted = await getRawTournamentPlayers(tournamentId);

  await db.transaction(async (tx) => {
    // Mark tournament as closed (atomic guard against double-finish)
    if (closedAt) {
      const result = await tx
        .update(tournaments)
        .set({ closedAt })
        .where(
          and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)),
        );
      if (!result.rowsAffected) throw new Error('TOURNAMENT_ALREADY_FINISHED');
    }

    const tournament = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .then((rows) => rows[0]);

    if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

    const sortedPlayers = sortPlayersByResults(
      playersUnsorted,
      tournament,
      allGames,
    );
    const { playerScoresMap, tiebreakScoresMap } = buildScoreMaps(
      sortedPlayers,
      tournament,
      allGames,
    );

    sortedPlayers.forEach((player, i) => {
      if (i === 0) {
        player.place = 1;
      } else {
        const prevPlayer = sortedPlayers[i - 1];
        player.place = hasSameStanding(
          player,
          prevPlayer,
          playerScoresMap,
          tiebreakScoresMap,
        )
          ? prevPlayer.place
          : i + 1;
      }
    });

    await Promise.all(
      sortedPlayers.flatMap((player) => {
        const playerIds =
          player.pairPlayers && player.pairPlayers.length > 0
            ? player.pairPlayers.map((pairPlayer) => pairPlayer.id)
            : [player.id];

        return [
          tx
            .update(players_to_tournaments)
            .set({ place: player.place })
            .where(
              and(
                eq(players_to_tournaments.tournamentId, tournamentId),
                inArray(players_to_tournaments.playerId, playerIds),
              ),
            ),
          tx
            .update(players)
            .set({ lastSeenAt: closedAt })
            .where(inArray(players.id, playerIds)),
        ];
      }),
    );

    if (tournament.rated) {
      await calculateAndApplyGlickoRatings(tournamentId, tx);
    }
  });
}

export async function deleteTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');
  const queries = [
    db.delete(games).where(eq(games.tournamentId, tournamentId)),
    db
      .delete(players_to_tournaments)
      .where(eq(players_to_tournaments.tournamentId, tournamentId)),
  ];
  await Promise.all(queries);
  await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
}

export async function resetTournamentPlayers({
  tournamentId,
}: {
  tournamentId: string;
}) {
  await db.delete(games).where(eq(games.tournamentId, tournamentId));
  await db
    .delete(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));
}

async function updatePairingNumbers(tournamentId: string) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  const games = await getTournamentGames(tournamentId);
  if (games.length === 0) throw new Error('NO_GAMES_TO_START');

  if (tournament.type === 'doubles') {
    const participants = await db
      .select({
        playerId: players_to_tournaments.playerId,
        teamNickname: players_to_tournaments.teamNickname,
      })
      .from(players_to_tournaments)
      .where(eq(players_to_tournaments.tournamentId, tournamentId));

    const teamByPlayerId = new Map<string, string>();
    const allTeams = new Set<string>();
    participants.forEach((participant) => {
      if (!participant.teamNickname) return;
      teamByPlayerId.set(participant.playerId, participant.teamNickname);
      allTeams.add(participant.teamNickname);
    });

    const orderedTeams: string[] = [];
    const pushTeam = (teamNickname: string | undefined) => {
      if (!teamNickname || orderedTeams.includes(teamNickname)) return;
      orderedTeams.push(teamNickname);
    };

    games.forEach((game) => {
      pushTeam(teamByPlayerId.get(game.whiteId));
      pushTeam(teamByPlayerId.get(game.blackId));
    });

    allTeams.forEach((teamNickname) => pushTeam(teamNickname));

    await Promise.all(
      orderedTeams.map((teamNickname, index) =>
        db
          .update(players_to_tournaments)
          .set({ pairingNumber: index })
          .where(
            and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.teamNickname, teamNickname),
            ),
          ),
      ),
    );
    return;
  }

  const playerIds = games.reduce((acc, game) => {
    if (game.result) throw new Error('RESULTS_PRESENT_BEFORE_TMT_START');
    if (game.roundNumber !== 1) throw new Error('ROUND_NOT_FIRST_BEFORE_START');
    acc.unshift(game.whiteId);
    acc.push(game.blackId);
    return acc;
  }, [] as string[]);

  const oddPlayerId = await db
    .select({ playerId: players_to_tournaments.playerId })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        notInArray(players_to_tournaments.playerId, playerIds),
      ),
    );
  if (oddPlayerId.length === 1) {
    playerIds.unshift(oddPlayerId[0].playerId);
  }

  const promises = playerIds.map((playerId, i) => {
    return db
      .update(players_to_tournaments)
      .set({ pairingNumber: i })
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, playerId),
        ),
      );
  });

  await Promise.all(promises);
}

export async function updateSwissRoundsNumber({
  tournamentId,
  roundsNumber,
}: {
  tournamentId: string;
  roundsNumber: number;
}) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.format !== 'swiss') throw new Error('NOT_SWISS_TOURNAMENT');
  if (tournament.closedAt) throw new Error('TOURNAMENT_ALREADY_FINISHED');

  const playerCount = await getTournamentPlayersCount(
    tournamentId,
    tournament.type,
  );
  const maxRounds = getSwissMaxRoundsNumber(playerCount);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (roundsNumber < minRounds) throw new Error('INVALID_ROUNDS_NUMBER');
  if (roundsNumber > maxRounds) throw new Error('INVALID_ROUNDS_NUMBER');

  await db
    .update(tournaments)
    .set({ roundsNumber })
    .where(eq(tournaments.id, tournamentId));
}

async function getTournamentById(tournamentId: string) {
  return (
    await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
  ).at(0);
}

async function getTournamentPlayersCount(
  tournamentId: string,
  tournamentType?: string,
): Promise<number> {
  const type =
    tournamentType ??
    (await getTournamentById(tournamentId).then((t) => {
      if (!t) throw new Error('TOURNAMENT NOT FOUND');
      return t.type;
    }));

  if (type === 'doubles') {
    const [result] = await db
      .select({
        playersCount: countDistinct(players_to_tournaments.teamNickname),
      })
      .from(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          isNotNull(players_to_tournaments.teamNickname),
        ),
      );

    return Number(result?.playersCount ?? 0);
  }

  const [result] = await db
    .select({ playersCount: sql<number>`count(*)` })
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));

  return Number(result?.playersCount ?? 0);
}

async function normalizeSwissRoundsNumber(tournamentId: string) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.format !== 'swiss') return;

  const playerCount = await getTournamentPlayersCount(
    tournamentId,
    tournament.type,
  );
  const maxRounds = getSwissMaxRoundsNumber(playerCount);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (minRounds > maxRounds) throw new Error('INVALID_SWISS_ROUNDS_BOUNDS');

  const normalizedRounds = Math.min(
    Math.max(tournament.roundsNumber ?? minRounds, minRounds),
    maxRounds,
  );

  await db
    .update(tournaments)
    .set({ roundsNumber: normalizedRounds })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        or(
          isNull(tournaments.roundsNumber),
          ne(tournaments.roundsNumber, normalizedRounds),
        ),
      ),
    );
}

async function resolveTournamentRoundsNumber({
  tournamentId,
  format,
  roundsNumber,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roundsNumber: number | null;
}) {
  if (format === 'swiss') {
    const playerCount = await getTournamentPlayersCount(tournamentId);
    if (playerCount < 2) throw new Error('NOT_ENOUGH_PLAYERS');

    const maxRounds = getSwissMaxRoundsNumber(playerCount);
    const resolvedRounds =
      roundsNumber ?? getSwissRecommendedRoundsNumber(playerCount);

    if (resolvedRounds < 1 || resolvedRounds > maxRounds) {
      throw new Error('INVALID_ROUNDS_NUMBER');
    }

    return resolvedRounds;
  }
  if (format === 'round robin') {
    const players = await getTournamentPlayers(tournamentId);
    return getRoundRobinRoundsNumber(players.length);
  }
  throw new Error('UNSUPPORTED_TOURNAMENT_FORMAT');
}

export async function editTournamentTitle({
  tournamentId,
  title,
}: {
  tournamentId: string;
  title: string;
}) {
  await db
    .update(tournaments)
    .set({ title })
    .where(eq(tournaments.id, tournamentId));
}
