import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import {
  protectedProcedure,
  publicProcedure,
  tournamentAdminProcedure,
} from '@/server/api/trpc';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
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
  addDoublesTeam,
  addExistingPlayer,
  addNewPlayer,
  editDoublesTeam,
  removePlayer,
  reorderTournamentPlayers,
  resetTournamentPlayers,
  withdrawPlayer,
} from '@/server/mutations/tournament-players';
import getAllTournaments from '@/server/queries/get-all-tournaments';
import { getPublicFeaturedTournaments } from '@/server/queries/get-public-featured-tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import {
  getTournamentGames,
  getTournamentRoundGames,
} from '@/server/queries/get-tournament-games';
import { getTournamentInfo } from '@/server/queries/get-tournament-info';
import { getTournamentPlayers } from '@/server/queries/get-tournament-players';
import {
  playerIdInputSchema,
  tournamentIdInputSchema,
} from '@/server/zod/common';
import { gameResultEnum, TournamentFormat } from '@/server/zod/enums';
import {
  playerFormSchema,
  playersWithUsernameSchema,
  playerTournamentSchema,
  preStartPlayerOrderResultSchema,
} from '@/server/zod/players';
import {
  addDoublesTeamSchema,
  editDoublesTeamSchema,
  gameSchema,
  publicFeaturedTournamentSchema,
  reorderTournamentPlayersInputSchema,
  tournamentAuthStatusSchema,
  tournamentCreateInputSchema,
  tournamentInfoSchema,
  tournamentWithClubSchema,
  withdrawTournamentPlayerInputSchema,
  withdrawTournamentPlayerResultSchema,
} from '@/server/zod/tournaments';
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
    .input(
      z.object({
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .output(
      z.object({
        tournaments: z.array(tournamentWithClubSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return await getAllTournaments({
        limit: input.limit,
        cursor: input.cursor ?? undefined,
      });
    }),
  publicFeatured: publicProcedure // TODO: currently not used + not included in openapi. use or remove
    .input(
      z.object({
        limit: z.number().min(1).max(10).optional().default(5),
      }),
    )
    .output(z.array(publicFeaturedTournamentSchema))
    .query(async ({ input }) => {
      return await getPublicFeaturedTournaments(input.limit);
    }),
  info: publicProcedure
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
  playersIn: publicProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(playerTournamentSchema))
    .query(async (opts) => {
      return await getTournamentPlayers(opts.input.tournamentId);
    }),
  playersOut: tournamentAdminProcedure
    .input(tournamentIdInputSchema)
    .output(z.array(playersWithUsernameSchema))
    .query(async (opts) => {
      const { input } = opts;
      const tournament = await db
        .select({ clubId: tournaments.clubId })
        .from(tournaments)
        .where(eq(tournaments.id, input.tournamentId))
        .then((rows) => rows.at(0));

      if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

      return db
        .select({ ...getTableColumns(players), username: users.username })
        .from(players)
        .leftJoin(
          players_to_tournaments,
          and(
            eq(players.id, players_to_tournaments.playerId),
            eq(players_to_tournaments.tournamentId, input.tournamentId),
          ),
        )
        .leftJoin(users, eq(users.id, players.userId))
        .where(
          and(
            eq(players.clubId, tournament.clubId),
            isNull(players_to_tournaments.playerId),
          ),
        );
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
        player: playersWithUsernameSchema,
        userId: z.string(),
        addedAt: z.date().optional(),
      }),
    )
    .output(preStartPlayerOrderResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await addExistingPlayer(input);
    }),
  addNewPlayer: tournamentAdminProcedure
    .input(
      z.object({
        player: playerFormSchema.and(z.object({ id: z.string().optional() })),
        addedAt: z.date().optional(),
      }),
    )
    .output(preStartPlayerOrderResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await addNewPlayer(input);
    }),
  addPairTeam: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.and(
        addDoublesTeamSchema.extend({ addedAt: z.date().optional() }),
      ),
    )
    .output(preStartPlayerOrderResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await addDoublesTeam(input);
    }),
  editPairTeam: tournamentAdminProcedure
    .input(tournamentIdInputSchema.and(editDoublesTeamSchema))
    .output(z.void())
    .mutation(async (opts) => {
      const { input } = opts;
      await editDoublesTeam(input);
    }),
  removePlayer: tournamentAdminProcedure
    .input(
      tournamentIdInputSchema.extend({
        playerId: playerIdInputSchema.shape.playerId,
        userId: z.string(),
      }),
    )
    .output(preStartPlayerOrderResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await removePlayer(input);
    }),
  reorderPlayers: tournamentAdminProcedure
    .input(reorderTournamentPlayersInputSchema)
    .output(preStartPlayerOrderResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await reorderTournamentPlayers(input);
    }),
  withdrawPlayer: tournamentAdminProcedure
    .input(withdrawTournamentPlayerInputSchema)
    .output(withdrawTournamentPlayerResultSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await withdrawPlayer(input);
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
