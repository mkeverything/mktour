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
  editTournamentLocation,
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
import getAllTournamentsInfinite, {
  getTournamentStatusCounts,
} from '@/server/queries/get-all-tournaments-infinite';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import {
  getTournamentGames,
  getTournamentRoundGames,
} from '@/server/queries/get-tournament-games';
import { getTournamentInfo } from '@/server/queries/get-tournament-info';
import { getTournamentPossiblePlayers } from '@/server/queries/get-tournament-possible-players';
import { getTournamentUnits } from '@/server/queries/get-tournament-units';
import { tournamentIdInputSchema } from '@/server/zod/common';
import {
  tournamentListItemSchema,
  tournamentsListFiltersSchema,
  tournamentsListInputSchema,
  tournamentStatusCountsSchema,
} from '@/server/zod/discovery';
import { tournamentFormatEnum } from '@/server/zod/enums';
import {
  playerFormSchema,
  playersWithUsernameSchema,
  playerWithUsernameOutputSchema,
} from '@/server/zod/players';
import {
  addDoublesUnitSchema,
  editDoublesUnitSchema,
  gameSchema,
  reorderTournamentUnitsInputSchema,
  saveRoundInputSchema,
  saveRoundOutputSchema,
  setGameResultInputSchema,
  tournamentAuthStatusSchema,
  tournamentCreateInputSchema,
  tournamentEditLocationInputSchema,
  tournamentFinishOutputSchema,
  tournamentInfoSchema,
  unitSchema,
  withdrawTournamentUnitInputSchema,
  withdrawTournamentUnitResultSchema,
} from '@/server/zod/tournaments';
import { dateToLocalDateString } from '@/lib/local-date';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;

// a day of slack so organisers in any timezone still see today's tournaments as upcoming
const getUpcomingFromDate = () =>
  dateToLocalDateString(new Date(Date.now() - DAY_MS));

const revalidateAllTournaments = () =>
  revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');

export const tournamentRouter = {
  create: clubAdminProcedure
    .meta(meta.tournamentsCreate)
    .input(tournamentCreateInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await createTournament(input);
      revalidateAllTournaments();
      return result;
    }),
  all: publicProcedure
    .input(tournamentsListInputSchema)
    .meta(meta.tournamentsAll)
    .output(
      z.object({
        tournaments: z.array(tournamentListItemSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return await getAllTournamentsInfinite({
        ...input,
        cursor: input.cursor ?? undefined,
        today: getUpcomingFromDate(),
      });
    }),
  statusCounts: publicProcedure
    .input(tournamentsListFiltersSchema)
    .output(tournamentStatusCountsSchema)
    .query(async ({ input }) => {
      return await getTournamentStatusCounts(input, getUpcomingFromDate());
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
    .output(z.array(playerWithUsernameOutputSchema))
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
      const result = await addSoloUnit(input);
      revalidateAllTournaments();
      return result;
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
      const result = await addNewSoloUnit(input);
      revalidateAllTournaments();
      return result;
    }),
  addDoublesUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.and(
        addDoublesUnitSchema.extend({ addedAt: z.date().optional() }),
      ),
    )
    .output(z.array(unitSchema))
    .mutation(async ({ input }) => {
      const result = await addDoublesUnit(input);
      revalidateAllTournaments();
      return result;
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
      const result = await removeUnit(input);
      revalidateAllTournaments();
      return result;
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
      const result = await withdrawUnit(input);
      revalidateAllTournaments();
      return result;
    }),
  setGameResult: protectedProcedure
    .meta(meta.tournamentsSetGameResult)
    .input(setGameResultInputSchema)
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await setTournamentGameResult(input, ctx.user.id);
    }),
  saveRound: tournamentAdminProcedure
    .input(saveRoundInputSchema)
    .output(saveRoundOutputSchema)
    .mutation(async (opts) => {
      return await saveRound(opts.input);
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
      const result = await startTournament(input);
      revalidateAllTournaments();
      return result;
    }),
  reset: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournament(input);
      revalidateAllTournaments();
    }),
  resetPlayers: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournamentUnits(input);
      revalidateAllTournaments();
    }),
  finish: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(tournamentFinishOutputSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await finishTournament(input);
      revalidateAllTournaments();
      return result;
    }),
  delete: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await deleteTournament(input);
      revalidateAllTournaments();
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
        title: z.string().trim(),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await editTournamentTitle(input);
      revalidateAllTournaments();
    }),
  editLocation: tournamentAdminProcedure
    .input(tournamentEditLocationInputSchema)
    .output(z.void())
    .mutation(async ({ input }) => {
      await editTournamentLocation(input);
      revalidateAllTournaments();
    }),
};
