import { aliasedTable, and, eq, getTableColumns } from 'drizzle-orm';

import { db } from '@/server/db';
import { games, tournament_units } from '@/server/db/schema/tournaments';
import type { GameModel } from '@/server/zod/tournaments';

function normalizeGames(rows: GameModel[]): GameModel[] {
  return rows.sort((a, b) => a.gameNumber - b.gameNumber);
}

export async function getTournamentGames(
  tournamentId: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<GameModel[]> {
  const whiteUnit = aliasedTable(tournament_units, 'white_unit');
  const blackUnit = aliasedTable(tournament_units, 'black_unit');
  return await database
    .select({
      ...getTableColumns(games),
      whiteNickname: whiteUnit.nickname,
      blackNickname: blackUnit.nickname,
    })
    .from(games)
    .where(eq(games.tournamentId, tournamentId))
    .innerJoin(whiteUnit, eq(games.whiteUnitId, whiteUnit.id))
    .innerJoin(blackUnit, eq(games.blackUnitId, blackUnit.id))
    .orderBy(games.gameNumber);
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
  const whiteUnit = aliasedTable(tournament_units, 'white_unit');
  const blackUnit = aliasedTable(tournament_units, 'black_unit');
  const gamesDb = await database
    .select({
      ...getTableColumns(games),
      whiteNickname: whiteUnit.nickname,
      blackNickname: blackUnit.nickname,
    })
    .from(games)
    .where(
      and(
        eq(games.tournamentId, tournamentId),
        eq(games.roundNumber, roundNumber),
      ),
    )
    .innerJoin(whiteUnit, eq(games.whiteUnitId, whiteUnit.id))
    .innerJoin(blackUnit, eq(games.blackUnitId, blackUnit.id));

  return normalizeGames(gamesDb);
}
