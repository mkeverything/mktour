import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { games } from '@/server/db/schema/tournaments';
import { GameModel } from '@/server/zod/tournaments';
import {
  getDoublesTeamMembers,
  getTournamentById,
  enrichGamesWithDoublesInfo,
} from './tournament-helpers';
import { aliasedTable, and, eq, getTableColumns } from 'drizzle-orm';

export async function getTournamentGames(
  tournamentId: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<GameModel[]> {
  const whitePlayer = aliasedTable(players, 'white_player');
  const blackPlayer = aliasedTable(players, 'black_player');
  const gamesDb = await database
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
  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament || tournament.type !== 'doubles') return sortedGames;

  const doublesTeamMembers = await getDoublesTeamMembers(
    tournamentId,
    database,
  );
  return enrichGamesWithDoublesInfo(sortedGames, doublesTeamMembers);
}

export async function getTournamentRoundGames({
  tournamentId,
  roundNumber,
  database = db,
}: {
  tournamentId: string;
  roundNumber: number;
  database?: Pick<typeof db, 'select'>;
}): Promise<GameModel[]> {
  const whitePlayer = aliasedTable(players, 'white_player');
  const blackPlayer = aliasedTable(players, 'black_player');
  const gamesDb = await database
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
  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament || tournament.type !== 'doubles') return sortedGames;

  const doublesTeamMembers = await getDoublesTeamMembers(
    tournamentId,
    database,
  );
  return enrichGamesWithDoublesInfo(sortedGames, doublesTeamMembers);
}
