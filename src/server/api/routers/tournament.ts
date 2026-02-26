import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { newTournamentFormSchemaConfig } from '@/lib/zod/new-tournament-form';
import {
  protectedProcedure,
  publicProcedure,
  tournamentAdminProcedure,
} from '@/server/api/trpc';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/db/zod/clubs';
import { gameResultEnum, TournamentFormat } from '@/server/db/zod/enums';
import {
  playerFormSchema,
  playersSelectSchema,
  PlayerTournamentModel,
} from '@/server/db/zod/players';
import { gameSchema, tournamentSchema } from '@/server/db/zod/tournaments';
import {
  addExistingPlayer,
  addNewPlayer,
  createTournament,
  deleteTournament,
  editTournamentTitle,
  finishTournament,
  getTournamentGames,
  getTournamentRoundGames,
  removePlayer,
  resetTournament,
  resetTournamentPlayers,
  saveRound,
  setTournamentGameResult,
  startTournament,
  updateSwissRoundsNumber,
} from '@/server/mutations/tournament-managing';
import getAllTournaments from '@/server/queries/get-all-tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

export const tournamentRouter = {
  create: protectedProcedure
    .input(z.object({ ...newTournamentFormSchemaConfig, date: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await createTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
      return result;
    }),
  all: publicProcedure.query(async () => {
    return await getAllTournaments();
  }),
  info: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .output(
      z.object({
        tournament: tournamentSchema,
        club: clubsSelectSchema,
      }),
    )
    .query(async (opts) => {
      const { input } = opts;
      const [tournamentInfo] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, input.tournamentId))
        .innerJoin(clubs, eq(tournaments.clubId, clubs.id));
      if (!tournamentInfo) throw new Error('TOURNAMENT NOT FOUND');
      return tournamentInfo;
    }),
  playersIn: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      const playersDb = await db
        .select()
        .from(players_to_tournaments)
        .where(eq(players_to_tournaments.tournamentId, input.tournamentId))
        .innerJoin(players, eq(players.id, players_to_tournaments.playerId));

      const playerModels: PlayerTournamentModel[] = playersDb.map((each) => ({
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
      }));

      return playerModels.sort(
        (a, b) => b.wins + b.draws / 2 - (a.wins + a.draws / 2),
      );
    }),
  playersOut: tournamentAdminProcedure
    .input(z.object({ tournamentId: z.string() }))
    .output(z.array(playersSelectSchema))
    .query(async (opts) => {
      const { input } = opts;
      const result = await db
        .select(getTableColumns(players))
        .from(players)
        .innerJoin(
          tournaments,
          and(
            eq(tournaments.id, input.tournamentId),
            eq(players.clubId, tournaments.clubId),
          ),
        )
        .leftJoin(
          players_to_tournaments,
          and(
            eq(players.id, players_to_tournaments.playerId),
            eq(players_to_tournaments.tournamentId, input.tournamentId),
          ),
        )
        .where(isNull(players_to_tournaments.playerId));

      return result;
    }),
  roundGames: publicProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        roundNumber: z.number(),
      }),
    )
    .query(async (opts) => {
      const { input } = opts;
      const result = await getTournamentRoundGames(input);
      return result;
    }),
  allGames: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      const result = await getTournamentGames(input.tournamentId);
      return result;
    }),
  addExistingPlayer: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        player: playersSelectSchema,
        userId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await addExistingPlayer(input);
    }),
  addNewPlayer: tournamentAdminProcedure
    .input(
      z.object({
        player: playerFormSchema.and(z.object({ id: z.string().optional() })),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await addNewPlayer(input);
    }),
  removePlayer: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        playerId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await removePlayer(input);
    }),
  setGameResult: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        whiteId: z.string(),
        blackId: z.string(),
        result: gameResultEnum,
        prevResult: gameResultEnum.nullable(),
        roundNumber: z.number(),
        userId: z.string(),
        tournamentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await setTournamentGameResult(input);
    }),
  saveRound: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        roundNumber: z.number(),
        newGames: z.array(gameSchema),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await saveRound(input);
    }),
  start: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        startedAt: z.date(),
        format: z.custom<TournamentFormat>(),
        roundsNumber: z.number().nullable(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await startTournament(input);
    }),
  reset: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournament(input);
    }),
  resetPlayers: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournamentPlayers(input);
    }),
  finish: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        closedAt: z.date(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await finishTournament(input);
    }),
  delete: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await deleteTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
    }),
  authStatus: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async (opts) => {
      const { user } = await validateRequest();
      if (!user) return { status: 'viewer' as const };
      return await getStatusInTournament(user.id, opts.input.tournamentId);
    }),
  updateSwissRoundsNumber: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        roundsNumber: z.number(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await updateSwissRoundsNumber(input);
    }),
  editTournamentTitle: tournamentAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        title: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { input } = opts;
      await editTournamentTitle(input);
    }),
};
