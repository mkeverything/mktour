import {
  sortPlayersByResults,
  baselinePlayerSort,
} from '@/lib/tournament-results';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerTournamentModel } from '@/server/zod/players';
import { compareTeamMembers } from './tournament-helpers';
import { getTournamentGames } from './get-tournament-games';
import { eq } from 'drizzle-orm';

/**
 * Fetches raw player models without sorting or additional queries.
 * Use this when the caller already has tournament/games data and will sort externally.
 */
export async function getRawTournamentPlayers(
  id: string,
  tournamentType?: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<Array<PlayerTournamentModel>> {
  let type = tournamentType;
  if (!type) {
    const tournament = (
      await database
        .select({ type: tournaments.type })
        .from(tournaments)
        .where(eq(tournaments.id, id))
    ).at(0);

    if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
    type = tournament.type;
  }

  const playersDb = await database
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

export async function getTournamentPlayers(
  id: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<Array<PlayerTournamentModel>> {
  const [tournament] = await database
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));

  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

  const [playerModels, allGames] = await Promise.all([
    getRawTournamentPlayers(id, tournament.type, database),
    tournament.startedAt
      ? getTournamentGames(id, database)
      : Promise.resolve([]),
  ]);

  if (!tournament.startedAt) {
    return playerModels.sort(baselinePlayerSort);
  }

  return sortPlayersByResults(playerModels, tournament, allGames);
}
