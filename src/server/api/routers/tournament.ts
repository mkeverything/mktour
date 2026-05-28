import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import meta from '@/server/api/meta';
import {
  clubAdminProcedure,
  protectedProcedure,
  publicProcedure,
  tournamentAdminProcedure,
} from '@/server/api/trpc';
import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import {
  saveRound,
  setTournamentGameResult,
} from '@/server/mutations/tournament-games';
import {
  createTournament,
  deleteTournament,
  editTournamentTitle,
  finishTournament,
  resetTournament,
  startTournament,
  updateSwissRoundsNumber,
} from '@/server/mutations/tournament-lifecycle';
import {
  addNewSoloUnit,
  addSoloUnit,
} from '@/server/mutations/tournament-players';
import {
  addDoublesUnit,
  editDoublesUnit,
  removeUnit,
  reorderTournamentUnits,
  resetTournamentUnits,
  withdrawUnit,
} from '@/server/mutations/tournament-units';
import getAllTournamentsInfinite from '@/server/queries/get-all-tournaments-infinite';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import {
  getTournamentGames,
  getTournamentRoundGames,
} from '@/server/queries/get-tournament-games';
import { getTournamentInfo } from '@/server/queries/get-tournament-info';
import { getTournamentPossiblePlayers } from '@/server/queries/get-tournament-possible-players';
import { getTournamentUnits } from '@/server/queries/get-tournament-units';
import { tournamentIdInputSchema } from '@/server/zod/common';
import { gameResultEnum, tournamentFormatEnum } from '@/server/zod/enums';
import {
  playerFormSchema,
  playersWithUsernameSchema,
} from '@/server/zod/players';
import {
  addDoublesUnitSchema,
  editDoublesUnitSchema,
  gameSchema,
  reorderTournamentUnitsInputSchema,
  tournamentAuthStatusSchema,
  tournamentCreateInputSchema,
  tournamentInfoSchema,
  tournamentWithClubSchema,
  unitSchema,
  withdrawTournamentUnitInputSchema,
  withdrawTournamentUnitResultSchema,
} from '@/server/zod/tournaments';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

export const tournamentRouter = {
  create: clubAdminProcedure
    .meta(meta.tournamentsCreate)
    .input(tournamentCreateInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await createTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
      return result;
    }),
  all: publicProcedure
    .input(
      z.object({
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .meta(meta.tournamentsAll)
    .output(
      z.object({
        tournaments: z.array(tournamentWithClubSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return await getAllTournamentsInfinite({
        limit: input.limit,
        cursor: input.cursor ?? undefined,
      });
    }),
  info: publicProcedure
    .meta(meta.tournamentsInfo)
    .input(tournamentIdInputSchema)
    .output(tournamentInfoSchema)
    .query(async (opts) => {
      const { input } = opts;
      const tournamentInfo = await getTournamentInfo(input.tournamentId);
      if (
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
  units: publicProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(unitSchema))
    .query(async (opts) => {
      return await getTournamentUnits(opts.input.tournamentId);
    }),
  playersOut: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(playersWithUsernameSchema))
    .query(async (opts) => {
      return await getTournamentPossiblePlayers(opts.input.tournamentId);
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
  addSoloUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        player: playersWithUsernameSchema,
        userId: z.string(),
        unitId: unitSchema.shape.id.optional(),
        addedAt: z.date().optional(),
      }),
    )
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await addSoloUnit(input);
    }),
  addNewSoloUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        player: playerFormSchema.and(z.object({ id: z.string().optional() })),
        unitId: unitSchema.shape.id.optional(),
        addedAt: z.date().optional(),
      }),
    )
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await addNewSoloUnit(input);
    }),
  addDoublesUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.and(
        addDoublesUnitSchema.extend({ addedAt: z.date().optional() }),
      ),
    )
    .output(z.array(unitSchema))
    .mutation(async ({ input }) => {
      return await addDoublesUnit(input);
    }),
  editDoublesUnit: tournamentAdminProcedure
    .input(tournamentIdInputSchema.and(editDoublesUnitSchema))
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await editDoublesUnit(input);
    }),
  removeUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        unitId: unitSchema.shape.id,
        userId: z.string(),
      }),
    )
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await removeUnit(input);
    }),
  reorderUnits: tournamentAdminProcedure
    .input(reorderTournamentUnitsInputSchema)
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await reorderTournamentUnits(input);
    }),
  withdrawUnit: tournamentAdminProcedure
    .input(withdrawTournamentUnitInputSchema)
    .output(withdrawTournamentUnitResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await withdrawUnit(input);
    }),
  setGameResult: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        whiteUnitId: unitSchema.shape.id,
        blackUnitId: unitSchema.shape.id,
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
        format: tournamentFormatEnum,
        roundsNumber: z.number().int().min(1).nullable(),
      }),
    )
    .output(z.array(gameSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      return await startTournament(input);
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
      await resetTournamentUnits(input);
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
      if (!user) return { status: 'viewer' as const, unitId: null };
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
  editTitle: tournamentAdminProcedure
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
