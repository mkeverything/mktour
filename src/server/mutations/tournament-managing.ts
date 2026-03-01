'use server';

import { validateRequest } from '@/lib/auth/lucia';
import {
  buildScoreMaps,
  hasSameStanding,
  sortPlayersByResults,
} from '@/lib/tournament-results';
import {
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
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { calculateAndApplyGlickoRatings } from './rating-calculation';

export const createTournament = async (
  values: Omit<NewTournamentFormModel, 'date'> & {
    date: string;
  },
) => {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const newTournamentID = newid();
  const newTournament = tournamentsInsertSchema.parse({
    ...values,
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
    getRawTournamentPlayers(id),
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
): Promise<Array<PlayerTournamentModel>> {
  const playersDb = await db
    .select()
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, id))
    .innerJoin(players, eq(players.id, players_to_tournaments.playerId))
    .leftJoin(users, eq(users.id, players.userId));

  return playersDb.map((each) => ({
    id: each.player.id,
    nickname: each.player.nickname,
    realname: each.player.realname,
    rating: each.player.rating,
    wins: each.players_to_tournaments.wins,
    draws: each.players_to_tournaments.draws,
    losses: each.players_to_tournaments.losses,
    colorIndex: each.players_to_tournaments.colorIndex,
    isOut: each.players_to_tournaments.isOut,
    place: each.players_to_tournaments.place,
    pairingNumber: each.players_to_tournaments.pairingNumber,
    username: each.user?.username ?? null,
  }));
}

// decided to keep using server action for this one not to face problems with dates serialization
export async function getTournamentInfo(
  id: string,
): Promise<TournamentInfoModel> {
  const tournamentInfo = (
    await db
      .select()
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
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
}) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');

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
    ratingChange: null,
    ratingDeviationChange: null,
    volatilityChange: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
}

// moved to API endpoint
export async function addExistingPlayer({
  tournamentId,
  player,
  userId,
}: {
  tournamentId: string;
  player: PlayerInsertModel;
  userId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
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
    ratingChange: null,
    ratingDeviationChange: null,
    volatilityChange: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
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
      roundName: games.roundName || null,
      whitePrevGameId: games.whitePrevGameId || null,
      blackPrevGameId: games.blackPrevGameId || null,
      result: games.result || null,
      finishedAt: games.finishedAt,
    })
    .from(games)
    .where(eq(games.tournamentId, tournamentId))
    .innerJoin(whitePlayer, eq(games.whiteId, whitePlayer.id))
    .innerJoin(blackPlayer, eq(games.blackId, blackPlayer.id));

  return gamesDb.sort((a, b) => a.gameNumber - b.gameNumber);
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

  return gamesDb.sort((a, b) => a.gameNumber - b.gameNumber);
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
    const { blackNickname, whiteNickname, ...newGame } = game;
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
  const queries = [
    db
      .update(tournaments)
      .set({
        startedAt: null,
        ongoingRound: 1,
        closedAt: null,
      })
      .where(
        and(eq(tournaments.id, tournamentId), isNotNull(tournaments.startedAt)),
      )
      .then((value) => {
        if (!value.rowsAffected) throw new Error('TOURNAMENT_ALREADY_RESET');
      }),

    db
      .delete(games)
      .where(
        and(eq(games.tournamentId, tournamentId), ne(games.roundNumber, 1)),
      ),
    db
      .update(players_to_tournaments)
      .set({
        wins: 0,
        draws: 0,
        losses: 0,
        colorIndex: 0,
        place: null,
      })
      .where(eq(players_to_tournaments.tournamentId, tournamentId)),
  ];
  await Promise.all(queries);
  await db
    .update(games)
    .set({ result: null })
    .where(eq(games.tournamentId, tournamentId));
}

export async function setTournamentGameResult({
  gameId,
  whiteId,
  blackId,
  result,
  prevResult,
  tournamentId,
}: {
  tournamentId: string;
  gameId: string;
  whiteId: string;
  blackId: string;
  result: GameResult;
  prevResult: GameResult | null;
  roundNumber: number;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const authStatus = await getStatusInTournament(user.id, tournamentId);
  if (authStatus.status === 'viewer') throw new Error('NOT_AUTHORIZED');
  // players can only set results for their own games
  if (authStatus.status === 'player') {
    const isPlayerInGame =
      authStatus.playerId === whiteId || authStatus.playerId === blackId;
    if (!isPlayerInGame) throw new Error('NOT_YOUR_GAME');
  }
  const tournament = (
    await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
  ).at(0);
  if (tournament?.startedAt === null) return 'TOURNAMENT_NOT_STARTED';
  if (result === prevResult) {
    await Promise.all([
      handleResultReset(whiteId, blackId, tournamentId, prevResult),
      db
        .update(games)
        .set({ result: null, finishedAt: null })
        .where(eq(games.id, gameId)),
    ]);
    return;
  }
  let handler;
  if (result === '1-0') {
    handler = handleWhiteWin(whiteId, blackId, tournamentId, prevResult);
  }
  if (result === '0-1') {
    handler = handleBlackWin(whiteId, blackId, tournamentId, prevResult);
  }
  if (result === '1/2-1/2') {
    handler = handleDraw(whiteId, blackId, tournamentId, prevResult);
  }
  await Promise.all([
    handler,
    db
      .update(games)
      .set({ result, finishedAt: new Date() })
      .where(eq(games.id, gameId)),
  ]);
}

async function handleWhiteWin(
  whiteId: string,
  blackId: string,
  tournamentId: string,
  prevResult?: GameResult | null,
) {
  if (!prevResult) {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({ losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1` })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '0-1') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '1/2-1/2') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1`,
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
}

async function handleBlackWin(
  whiteId: string,
  blackId: string,
  tournamentId: string,
  prevResult?: GameResult | null,
) {
  if (!prevResult) {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({ wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1` })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '1-0') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '1/2-1/2') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + 1`,
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
}

async function handleDraw(
  whiteId: string,
  blackId: string,
  tournamentId: string,
  prevResult?: GameResult | null,
) {
  if (!prevResult) {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) + 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({ draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1` })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '1-0') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1`,
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '0-1') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1`,
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + 1`,
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
}

async function handleResultReset(
  whiteId: string,
  blackId: string,
  tournamentId: string,
  prevResult: GameResult,
) {
  if (prevResult === '1-0') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '0-1') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          losses: sql`COALESCE(${players_to_tournaments.losses}, 0) - 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          wins: sql`COALESCE(${players_to_tournaments.wins}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  if (prevResult === '1/2-1/2') {
    await Promise.all([
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
          colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, whiteId),
          ),
        ),
      db
        .update(players_to_tournaments)
        .set({
          draws: sql`COALESCE(${players_to_tournaments.draws}, 0) - 1`,
        })
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, blackId),
          ),
        ),
    ]);
  }
  return 'RESULT_RESET';
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

  if (closedAt) {
    await db
      .update(tournaments)
      .set({ closedAt })
      .where(
        and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)),
      )
      .then((value) => {
        if (!value.rowsAffected) throw new Error('TOURNAMENT_ALREADY_FINISHED');
      });
  }

  const tournament = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows[0]);

  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

  const allGames = await getTournamentGames(tournamentId);
  const playersUnsorted = await getRawTournamentPlayers(tournamentId);
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

  const pttUpdates = sortedPlayers.map((player) =>
    db
      .update(players_to_tournaments)
      .set({ place: player.place })
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, player.id),
        ),
      ),
  );

  const playersUpdates = sortedPlayers.map((player) =>
    db
      .update(players)
      .set({ lastSeenAt: closedAt })
      .where(eq(players.id, player.id)),
  );

  const updates = [...pttUpdates, ...playersUpdates];
  await Promise.all(updates);

  if (tournament.rated) {
    await calculateAndApplyGlickoRatings(tournamentId);
  }
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
  await db
    .delete(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));
}

async function updatePairingNumbers(tournamentId: string) {
  const games = await getTournamentGames(tournamentId);
  if (games.length === 0) throw new Error('NO_GAMES_TO_START');
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

  const playerCount = await getTournamentPlayersCount(tournamentId);
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
): Promise<number> {
  const [result] = await db
    .select({ playersCount: sql<number>`count(*)` })
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));

  return Number(result?.playersCount ?? 0);
}

async function normalizeSwissRoundsNumber(tournamentId: string) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.format !== 'swiss') return;

  const playerCount = await getTournamentPlayersCount(tournamentId);
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
    if (players.length < 2) throw new Error('NOT_ENOUGH_PLAYERS');
    return players.length % 2 === 0 ? players.length : players.length - 1;
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
