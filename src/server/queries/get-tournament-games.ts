import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { baselineUnitSort } from '@/lib/tournament-results';
import { db } from '@/server/db';
import {
  games,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import type { GameModel } from '@/server/zod/tournaments';
import { aliasedTable, and, eq, getTableColumns } from 'drizzle-orm';

function normalizeGames(rows: GameModel[]): GameModel[] {
  return rows.sort((a, b) => a.gameNumber - b.gameNumber);
}

async function getTournamentStartedAt(
  tournamentId: string,
  database: Pick<typeof db, 'select'>,
) {
  return await database
    .select({ startedAt: tournaments.startedAt })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows.at(0)?.startedAt);
}

export async function getPersistedTournamentGames(
  tournamentId: string,
  database: Pick<typeof db, 'select'>,
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

export async function getTournamentGames(
  tournamentId: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<GameModel[]> {
  const startedAt = await getTournamentStartedAt(tournamentId, database);
  if (!startedAt) return [];
  return await getPersistedTournamentGames(tournamentId, database);
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
  const startedAt = await getTournamentStartedAt(tournamentId, database);

  if (!startedAt) {
    if (roundNumber !== 1) return [];
    const units = (await getRawTournamentUnits(tournamentId, database)).sort(
      baselineUnitSort,
    );
    if (units.length < 2) return [];
    return generatePreStartRoundGames({ units, tournamentId });
  }

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
