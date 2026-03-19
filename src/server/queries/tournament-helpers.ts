import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { GameModel } from '@/server/zod/tournaments';
import {
  and,
  countDistinct,
  eq,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';

export function compareTeamMembers<
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

export async function getTournamentById(tournamentId: string) {
  return (
    await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
  ).at(0);
}

export async function getTournamentPlayersCount(
  tournamentId: string,
  tournamentType?: string,
  options?: { excludeOut?: boolean },
): Promise<number> {
  const type =
    tournamentType ??
    (await getTournamentById(tournamentId).then((t) => {
      if (!t) throw new Error('TOURNAMENT NOT FOUND');
      return t.type;
    }));

  const activePlayersCondition = options?.excludeOut
    ? or(
        isNull(players_to_tournaments.isOut),
        eq(players_to_tournaments.isOut, false),
      )
    : undefined;

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
          ...(activePlayersCondition ? [activePlayersCondition] : []),
        ),
      );

    return Number(result?.playersCount ?? 0);
  }

  const [result] = await db
    .select({ playersCount: sql<number>`count(*)` })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        ...(activePlayersCondition ? [activePlayersCondition] : []),
      ),
    );

  return Number(result?.playersCount ?? 0);
}

export type DoublesTeamMembersMap = {
  teamByPlayerId: Map<string, string>;
  membersByTeam: Map<
    string,
    Array<{ id: string; nickname: string; numberInTeam: number | null }>
  >;
};

export async function getDoublesTeamMembers(
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

export function enrichGamesWithDoublesInfo(
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
