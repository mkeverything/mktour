import meta from '@/server/api/meta';
import {
  authProcedure,
  clubAdminProcedure,
  protectedProcedure,
  publicProcedure,
} from '@/server/api/trpc';
import { clubsSelectSchema } from '@/server/db/zod/clubs';
import {
  playerAuthStatsSchema,
  playerEditSchema,
  playerFormSchema,
  playersSelectSchema,
  playerStatsSchema,
} from '@/server/db/zod/players';
import { playerToTournamentSchema } from '@/server/db/zod/tournaments';
import { usersSelectMinimalSchema } from '@/server/db/zod/users';
import {
  createPlayer,
  deletePlayer,
  editPlayer,
} from '@/server/mutations/club-managing';
import {
  abortAffiliationRequest,
  acceptAffiliation,
  affiliateUser,
  cancelAffiliationByUser,
  rejectAffiliation,
  requestAffiliation,
} from '@/server/mutations/player-affiliation';
import getPlayer from '@/server/queries/get-player';
import { getUserClubIds } from '@/server/queries/get-user-clubs';
import {
  getPlayerAuthStats,
  getPlayerStats,
  getPlayersTournaments,
} from '@/server/queries/player';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const playerRouter = {
  info: publicProcedure
    .meta(meta.playerInfo)
    .input(z.object({ playerId: z.string() }))
    .output(
      playersSelectSchema
        .extend({
          user: usersSelectMinimalSchema.nullable(),
          club: clubsSelectSchema,
        })
        .nullable(),
    )
    .query(async (opts) => {
      const { input } = opts;
      return await getPlayer(input.playerId);
    }),
  create: clubAdminProcedure
    .meta(meta.playersCreate)
    .input(playerFormSchema)
    .output(playersSelectSchema)
    .mutation(async (opts) => {
      const { input: player } = opts;
      return await createPlayer(player);
    }),
  lastTournaments: publicProcedure
    .meta(meta.playersLastTournaments)
    .input(z.object({ playerId: z.string() }))
    .output(z.array(playerToTournamentSchema))
    .query(async (opts) => {
      const { input } = opts;
      return await getPlayersTournaments(input.playerId);
    }),
  affiliation: {
    request: protectedProcedure
      .input(
        z.object({
          playerId: z.string(),
          userId: z.string(),
          clubId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const { input } = opts;
        await requestAffiliation(input);
      }),
    accept: clubAdminProcedure
      .input(
        z.object({
          clubId: z.string(),
          affiliationId: z.string(),
          notificationId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const { input } = opts;
        const { affiliationId, notificationId } = input;
        await acceptAffiliation({ affiliationId, notificationId });
      }),
    reject: clubAdminProcedure
      .input(
        z.object({
          clubId: z.string(),
          affiliationId: z.string(),
          notificationId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const { input } = opts;
        const { affiliationId, notificationId } = input;
        await rejectAffiliation({ affiliationId, notificationId });
      }),
    abortRequest: protectedProcedure
      .input(
        z.object({
          userId: z.string(),
          affiliationId: z.string(),
          playerId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const { input } = opts;
        await abortAffiliationRequest(input);
      }),
    affiliateAuth: clubAdminProcedure
      .input(
        z.object({
          playerId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const {
          input,
          ctx: { user, clubId },
        } = opts;
        const { playerId } = input;
        await affiliateUser({ playerId, user, clubId });
      }),
    cancelByUser: protectedProcedure
      .input(
        z.object({
          playerId: z.string(),
        }),
      )
      .mutation(async (opts) => {
        const { input } = opts;
        await cancelAffiliationByUser({ userId: opts.ctx.user.id, ...input });
      }),
  },
  delete: protectedProcedure
    .meta(meta.playersDelete)
    .input(
      z.object({
        playerId: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const clubs = await getUserClubIds({ userId: ctx.user.id });
      const player = await getPlayer(input.playerId);
      const isAdmin = Object.keys(clubs).find(
        (clubId) => clubId === player.clubId,
      );
      if (!isAdmin) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await deletePlayer(input);
    }),
  edit: clubAdminProcedure
    .meta(meta.playersEdit)
    .input(playerEditSchema)
    .output(playersSelectSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      return await editPlayer({ values: input, user: opts.ctx.user });
    }),
  stats: {
    public: publicProcedure
      .meta(meta.playersPublicStats)
      .input(z.object({ playerId: z.string() }))
      .output(playerStatsSchema)
      .query(async (opts) => {
        const { input } = opts;
        return await getPlayerStats(input.playerId);
      }),
    auth: authProcedure
      .meta(meta.playersAuthStats)
      .input(z.object({ playerId: z.string() }))
      .output(playerAuthStatsSchema.nullable())
      .query(async ({ input, ctx }) => {
        if (!ctx.user) return null;
        return await getPlayerAuthStats({
          playerId: input.playerId,
          userId: ctx.user.id,
        });
      }),
  },
};
