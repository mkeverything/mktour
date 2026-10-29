import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import meta from '@/server/api/meta';
import {
  clubAdminProcedure,
  protectedProcedure,
  publicProcedure,
  tournamentAdminProcedure,
} from '@/server/api/trpc';
import { listen, publishTournamentEvent } from '@/server/events';
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
  tournamentFinishOutputSchema,
  tournamentInfoSchema,
  tournamentStartInputSchema,
  tournamentWithClubSchema,
  unitSchema,
  withdrawTournamentUnitInputSchema,
  withdrawTournamentUnitResultSchema,
} from '@/server/zod/tournaments';
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
      return await getTournamentInfo(opts.input.tournamentId);
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
      const units = await addSoloUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
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
      const units = await addNewSoloUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
    }),
  addDoublesUnit: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.and(
        addDoublesUnitSchema.extend({ addedAt: z.date().optional() }),
      ),
    )
    .output(z.array(unitSchema))
    .mutation(async ({ input }) => {
      const units = await addDoublesUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
    }),
  editDoublesUnit: tournamentAdminProcedure
    .input(tournamentIdInputSchema.and(editDoublesUnitSchema))
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      const units = await editDoublesUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
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
      const units = await removeUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
    }),
  reorderUnits: tournamentAdminProcedure
    .input(reorderTournamentUnitsInputSchema)
    .output(z.array(unitSchema))
    .mutation(async (opts) => {
      const { input } = opts;
      const units = await reorderTournamentUnits(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'prestart-units-updated',
        units,
      });
      return units;
    }),
  withdrawUnit: tournamentAdminProcedure
    .input(withdrawTournamentUnitInputSchema)
    .output(withdrawTournamentUnitResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await withdrawUnit(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'withdraw-unit',
        id: input.unitId,
      });
      if (result.roundsNumberAutoDecreased) {
        publishTournamentEvent(input.tournamentId, {
          event: 'swiss-new-rounds-number',
          roundsNumber: result.roundsNumber,
        });
      }
      return result;
    }),
  setGameResult: protectedProcedure
    .meta(meta.tournamentsSetGameResult)
    .input(setGameResultInputSchema)
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { tournamentId, roundNumber } = await setTournamentGameResult(
        input,
        ctx.user.id,
      );
      publishTournamentEvent(tournamentId, {
        event: 'set-game-result',
        ...input,
        roundNumber,
      });
    }),
  saveRound: tournamentAdminProcedure
    .input(saveRoundInputSchema)
    .output(saveRoundOutputSchema)
    .mutation(async ({ input }) => {
      const games = await saveRound(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'new-round',
        roundNumber: input.roundNumber,
        newGames: games,
      });
      return games;
    }),
  start: tournamentAdminProcedure
    .input(tournamentStartInputSchema)
    .output(z.array(gameSchema))
    .mutation(async ({ input }) => {
      const games = await startTournament(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'start-tournament',
        startedAt: input.startedAt,
        games,
      });
      return games;
    }),
  reset: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournament(input);
      publishTournamentEvent(input.tournamentId, { event: 'reset-tournament' });
    }),
  resetPlayers: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await resetTournamentUnits(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'reset-tournament-players',
      });
    }),
  finish: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(tournamentFinishOutputSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const result = await finishTournament(input);
      publishTournamentEvent(input.tournamentId, {
        event: 'finish-tournament',
        ...result,
      });
      return result;
    }),
  delete: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await deleteTournament(input);
      revalidateTag(CACHE_TAGS.ALL_TOURNAMENTS, 'max');
      publishTournamentEvent(input.tournamentId, {
        event: 'delete-tournament',
      });
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
      publishTournamentEvent(input.tournamentId, {
        event: 'swiss-new-rounds-number',
        roundsNumber: input.roundsNumber,
      });
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
      publishTournamentEvent(input.tournamentId, {
        event: 'tournament-title-changed',
        title: input.title,
      });
    }),
  events: publicProcedure
    .input(tournamentIdInputSchema)
    .subscription(({ input, signal }) =>
      listen(`tournament:${input.tournamentId}`, signal),
    ),
};
