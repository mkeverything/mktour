import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import meta from '@/server/api/meta';
import {
  clubAdminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '@/server/api/trpc';
import getAllClubManagers, {
  addClubManager,
  changeClubNotificationStatus,
  createClub,
  deleteClub,
  deleteClubManager,
  editClub,
  getClubAffiliatedUsers,
  leaveClub,
} from '@/server/mutations/club-managing';
import {
  getClubInfo,
  getClubPlayers,
  getPublicPopularClubs,
  getUserClubPlayer,
} from '@/server/queries/club';
import getAllClubs from '@/server/queries/get-all-clubs';
import getClubNotifications from '@/server/queries/get-club-notifications';
import { getClubStats } from '@/server/queries/get-club-stats';
import { getClubTournaments } from '@/server/queries/get-club-tournaments';
import getStatusInClub from '@/server/queries/get-status-in-club';
import { getUserClubAffiliation } from '@/server/queries/get-user-club-affiliation';
import {
  clubManagersSchema,
  clubsEditSchema,
  clubsInsertSchema,
  clubsSelectSchema,
  clubStatsSchema,
  publicPopularClubSchema,
} from '@/server/zod/clubs';
import {
  clubIdInputSchema,
  notificationIdInputSchema,
  userIdInputSchema,
} from '@/server/zod/common';
import { clubNotificationExtendedSchema } from '@/server/zod/notifications';
import {
  affiliationExtendedSchema,
  playersSelectSchema,
} from '@/server/zod/players';
import { tournamentSchema } from '@/server/zod/tournaments';
import { usersSelectMinimalSchema } from '@/server/zod/users';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

export const clubRouter = createTRPCRouter({
  all: publicProcedure
    .meta(meta.clubsAll)
    .input(
      z.object({
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .output(
      z.object({
        clubs: z.array(clubsSelectSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return await getAllClubs({
        limit: input.limit,
        cursor: input.cursor ?? undefined,
      });
    }),
  publicPopular: publicProcedure // TODO: currently not used + not included in openapi. use or remove
    .input(
      z.object({
        limit: z.number().min(1).max(10).optional().default(5),
      }),
    )
    .output(z.array(publicPopularClubSchema))
    .query(async ({ input }) => {
      return await getPublicPopularClubs(input.limit);
    }),
  create: protectedProcedure
    .meta(meta.clubCreate)
    .input(clubsInsertSchema)
    .output(clubsSelectSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const newClub = await createClub(opts.ctx.user, input);
      revalidateTag(CACHE_TAGS.AUTH, 'max');
      revalidateTag(CACHE_TAGS.ALL_CLUBS, 'max');
      revalidateTag(`${CACHE_TAGS.USER_CLUBS}:${opts.ctx.user.id}`, 'max');
      return newClub;
    }),
  info: publicProcedure
    .meta(meta.clubInfo)
    .input(clubIdInputSchema)
    .output(clubsSelectSchema.nullable())
    .query(async (opts) => {
      return await getClubInfo(opts.input.clubId);
    }),
  stats: publicProcedure
    .input(clubIdInputSchema)
    .output(clubStatsSchema)
    .query(async (opts) => {
      return await getClubStats(opts.input.clubId);
    }),
  players: publicProcedure
    .meta(meta.clubPlayers)
    .input(
      z.object({
        clubId: clubIdInputSchema.shape.clubId,
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .output(
      z.object({
        players: z.array(playersSelectSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async (opts) => {
      return await getClubPlayers(
        opts.input.clubId,
        opts.input.limit,
        opts.input.cursor,
      );
    }),
  tournaments: publicProcedure
    .meta(meta.clubTournaments)
    .input(
      z.object({
        clubId: clubIdInputSchema.shape.clubId,
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .output(
      z.object({
        tournaments: z.array(tournamentSchema),
        nextCursor: z.number().nullable(),
      }),
    )
    .query(async (opts) => {
      return await getClubTournaments(
        opts.input.clubId,
        opts.input.limit,
        opts.input.cursor,
      );
    }),
  affiliatedUsers: publicProcedure
    .meta(meta.clubAffiliatedUsers)
    .input(clubIdInputSchema)
    .output(z.array(usersSelectMinimalSchema))
    .query(async (opts) => {
      return await getClubAffiliatedUsers(opts.input.clubId);
    }),
  authAffiliation: protectedProcedure
    .meta(meta.clubAuthAffiliation)
    .input(clubIdInputSchema)
    .output(affiliationExtendedSchema.nullable())
    .query(async (opts) => {
      return await getUserClubAffiliation(opts.ctx.user, opts.input.clubId);
    }),
  authPlayer: protectedProcedure
    .meta(meta.clubAuthPlayer)
    .input(clubIdInputSchema)
    .output(playersSelectSchema.nullable())
    .query(async (opts) => {
      return await getUserClubPlayer({
        clubId: opts.input.clubId,
        userId: opts.ctx.user.id,
      });
    }),
  authStatus: publicProcedure
    .meta(meta.clubAuthStatus)
    .input(clubIdInputSchema)
    .output(z.enum(['co-owner', 'admin']).nullable())
    .query(async (opts) => {
      if (!opts.ctx.user || !opts.ctx.clubs) {
        const { user } = await validateRequest();
        if (!user) return null;
        return await getStatusInClub({
          userId: user.id,
          clubId: opts.input.clubId,
        });
      }
      return opts.ctx.clubs && opts.ctx.clubs[opts.input.clubId];
    }),
  managers: createTRPCRouter({
    all: publicProcedure
      .meta(meta.clubManagers)
      .input(clubIdInputSchema)
      .output(z.array(clubManagersSchema))
      .query(async (opts) => {
        return await getAllClubManagers(opts.input.clubId);
      }),
    add: clubAdminProcedure
      .meta(meta.clubAddManager)
      .input(
        clubIdInputSchema.extend({
          userId: userIdInputSchema.shape.userId,
          status: z.enum(['co-owner', 'admin']),
        }),
      )
      .output(z.void())
      .mutation(async (opts) => {
        const { input } = opts;
        await addClubManager({ ...input, user: opts.ctx.user });
        revalidateTag(`${CACHE_TAGS.USER_CLUBS}:${input.userId}`, 'max');
      }),
    delete: clubAdminProcedure
      .meta(meta.clubDeleteManager)
      .input(
        clubIdInputSchema.extend({
          userId: userIdInputSchema.shape.userId,
        }),
      )
      .output(z.void())
      .mutation(async (opts) => {
        const { input, ctx } = opts;
        await deleteClubManager({ ...input, user: ctx.user });
        revalidateTag(`${CACHE_TAGS.USER_CLUBS}:${input.userId}`, 'max');
      }),
  }),
  notifications: {
    all: clubAdminProcedure
      .meta(meta.clubNotifications)
      .input(
        clubIdInputSchema.extend({
          limit: z.number().min(1).max(100).optional().default(20),
          cursor: z.number().nullable().default(0),
        }),
      )
      .output(
        z.object({
          notifications: z.array(clubNotificationExtendedSchema),
          nextCursor: z.number().nullable(),
        }),
      )
      .query(async ({ input }) => {
        return await getClubNotifications({
          ...input,
          cursor: input.cursor ?? 0,
        });
      }),
    toggleSeen: clubAdminProcedure
      .meta(meta.clubToggleSeen)
      .input(
        notificationIdInputSchema.extend({
          isSeen: z.boolean(),
        }),
      )
      .output(z.void())
      .mutation(async ({ input }) => {
        await changeClubNotificationStatus(input);
      }),
  },
  delete: clubAdminProcedure
    .meta(meta.clubDelete)
    .input(
      z.object({
        clubId: clubIdInputSchema.shape.clubId,
        userDeletion: z.boolean().default(false),
      }),
    )
    .output(z.void())
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      await deleteClub({ ...input, userId: ctx.user.id });
      revalidateTag(CACHE_TAGS.ALL_CLUBS, 'max');
      revalidateTag(CACHE_TAGS.AUTH, 'max');
      revalidateTag(`${CACHE_TAGS.USER_CLUBS}:${opts.ctx.user.id}`, 'max');
    }),
  edit: clubAdminProcedure
    .meta(meta.clubEdit)
    .input(z.object({ values: clubsEditSchema }))
    .output(clubsSelectSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const newClub = await editClub({
        ...input,
        username: opts.ctx.user.username,
      });
      if (!newClub) throw new Error('CLUB_NOT_FOUND');
      return newClub;
    }),
  leave: clubAdminProcedure
    .meta(meta.clubLeave)
    .input(clubIdInputSchema)
    .output(z.object({ clubs: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (Object.keys(ctx.clubs).length === 1)
        throw new Error('CANT_LEAVE_ONLY_CLUB');
      await leaveClub({ clubId: input.clubId, userId: ctx.user.id });

      revalidateTag(CACHE_TAGS.AUTH, 'max');
      revalidateTag(`${CACHE_TAGS.USER_CLUBS}:${ctx.user.id}`, 'max');
      const updatedClubs = Object.keys(ctx.clubs).filter(
        (id) => id !== input.clubId,
      );
      return { clubs: updatedClubs };
    }),
});
