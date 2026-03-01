import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
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
import {
  playerIdInputSchema,
  tournamentIdInputSchema,
} from '@/server/db/zod/common';
import { gameResultEnum, TournamentFormat } from '@/server/db/zod/enums';
import { playerFormSchema, playersSelectSchema } from '@/server/db/zod/players';
import {
  gameSchema,
  tournamentWithClubSchema,
  tournamentAuthStatusSchema,
  tournamentCreateInputSchema,
  tournamentInfoSchema,
} from '@/server/db/zod/tournaments';
import { playerTournamentSchema } from '@/server/db/zod/players';
import {
  addExistingPlayer,
  addNewPlayer,
  createTournament,
  deleteTournament,
  editTournamentTitle,
  finishTournament,
  getTournamentGames,
  getTournamentPlayers,
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
    .input(tournamentCreateInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await createTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
      return result;
    }),
  all: publicProcedure
    .output(z.array(tournamentWithClubSchema))
    .query(async () => {
      return await getAllTournaments();
    }),
  info: publicProcedure
    .input(tournamentIdInputSchema)
    .output(tournamentInfoSchema)
    .query(async (opts) => {
      const { input } = opts;
      const [tournamentInfo] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, input.tournamentId))
        .innerJoin(clubs, eq(tournaments.clubId, clubs.id));
      if (!tournamentInfo) throw new Error('TOURNAMENT NOT FOUND');
      if (
        // FIXME looks like weird shit but useful not to make decision rn about making roundsNUmber notNull() in the db lines 48-57
        tournamentInfo.tournament.format === 'swiss' &&
        tournamentInfo.tournament.roundsNumber === null
      ) {
        await db
          .update(tournaments)
          .set({ roundsNumber: 1 })
          .where(eq(tournaments.id, input.tournamentId));
        tournamentInfo.tournament.roundsNumber = 1;
      }
      return tournamentInfo;
    }),
  playersIn: publicProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(playerTournamentSchema))
    .query(async (opts) => {
      return await getTournamentPlayers(opts.input.tournamentId);
    }),
  playersOut: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
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
      tournamentIdInputSchema.extend({
        roundNumber: z.number(),
      }),
    )
    .output(z.array(gameSchema))
    .query(async (opts) => {
      const { input } = opts;
      const result = await getTournamentRoundGames(input);
      return result;
    }),
  allGames: publicProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(gameSchema))
    .query(async (opts) => {
      const { input } = opts;
      const result = await getTournamentGames(input.tournamentId);
      return result;
    }),
  addExistingPlayer: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        player: playersSelectSchema,
        userId: z.string(),
      }),
    )
    .output(z.void())
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
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await addNewPlayer(input);
    }),
  removePlayer: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        playerId: playerIdInputSchema.shape.playerId,
        userId: z.string(),
      }),
    )
    .output(z.void())
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
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await setTournamentGameResult(input);
    }),
  saveRound: protectedProcedure
    .input(
      tournamentIdInputSchema.extend({
        roundNumber: z.number(),
        newGames: z.array(gameSchema),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await saveRound(input);
    }),
  start: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        startedAt: z.date(),
        format: z.custom<TournamentFormat>(),
        roundsNumber: z.number().int().min(1).nullable(),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await startTournament(input);
    }),
  reset: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournament(input);
    }),
  resetPlayers: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournamentPlayers(input);
    }),
  finish: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        closedAt: z.date(),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await finishTournament(input);
    }),
  delete: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await deleteTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
    }),
  authStatus: publicProcedure
    .input(tournamentIdInputSchema)
    .output(tournamentAuthStatusSchema)
    .query(async (opts) => {
      const { user } = await validateRequest();
      if (!user) return { status: 'viewer' as const };
      return await getStatusInTournament(user.id, opts.input.tournamentId);
    }),
  updateSwissRoundsNumber: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        roundsNumber: z.number().int().min(1),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await updateSwissRoundsNumber(input);
    }),
  editTournamentTitle: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        title: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await editTournamentTitle(input);
    }),
};
