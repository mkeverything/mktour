import { getUserLichessTeams } from '@/lib/api/lichess';
import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { getEncryptedAuthSession } from '@/lib/get-encrypted-auth-session';
import { newid, timeout } from '@/lib/utils';
import meta from '@/server/api/meta';
import {
  authProcedure,
  protectedProcedure,
  publicProcedure,
} from '@/server/api/trpc';
import { players } from '@/server/db/schema/players';
import { apiTokens } from '@/server/db/schema/users';
import selectClub from '@/server/mutations/club-select';
import { logout } from '@/server/mutations/logout';
import {
  changeNotificationStatus,
  markAllNotificationsAsSeen,
} from '@/server/mutations/notifications';
import { deleteUser, editUser } from '@/server/mutations/profile-managing';
import { getClubByLichessTeam } from '@/server/queries/get-club-by-lichess-team';
import { getEmptyClub } from '@/server/queries/get-empty-club';
import getTournamentsToUserClubsQuery from '@/server/queries/get-tournaments-to-user-clubs-query';
import { getUserClubs } from '@/server/queries/get-user-clubs';
import {
  getAuthNotifications,
  getNotificationsCounter,
} from '@/server/queries/get-user-notifications';
import { playerExistsInClub } from '@/server/queries/player-exists-in-club';
import { clubsSelectSchema } from '@/server/zod/clubs';
import {
  apiTokenIdInputSchema,
  clubIdInputSchema,
  notificationIdInputSchema,
  paginatedInputSchema,
  userIdInputSchema,
} from '@/server/zod/common';
import { playersSelectSchema } from '@/server/zod/players';
import { tournamentWithClubSchema } from '@/server/zod/tournaments';
import {
  apiToken,
  editProfileFormSchema,
  usersSelectPublicSchema,
  usersSelectSchema,
} from '@/server/zod/users';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import z from 'zod';

export const authRouter = {
  info: publicProcedure
    .meta(meta.authInfo)
    .output(usersSelectSchema.nullish())
    .query(async ({ ctx }) => {
      let { user } = ctx;
      if (!user) {
        const result = await validateRequest();
        user = result.user ?? null;
      }
      return user || null;
    }),
  encryptedSession: publicProcedure.query(async () => {
    return await getEncryptedAuthSession();
  }),
  signOut: publicProcedure.mutation(async () => {
    await logout();
    revalidateTag(CACHE_TAGS.AUTH, 'max');
  }),
  notifications: {
    infinite: protectedProcedure
      .input(paginatedInputSchema)
      .query(async ({ input, ctx }) => {
        return await getAuthNotifications({
          limit: input.limit,
          offset: input.cursor ?? 0,
          userId: ctx.user.id,
        });
      }),
    counter: publicProcedure.query(async () => {
      const { user } = await validateRequest();
      if (!user) return 0;
      return await getNotificationsCounter(user.id);
    }),
    changeStatus: protectedProcedure
      .input(notificationIdInputSchema.extend({ seen: z.boolean() }))
      .mutation(async ({ input }) => {
        await changeNotificationStatus(input);
      }),
    markAllAsSeen: protectedProcedure.mutation(async (opts) => {
      await markAllNotificationsAsSeen(opts.ctx.user.id);
    }),
  },
  clubs: protectedProcedure
    .meta(meta.authClubs)
    .output(z.array(clubsSelectSchema))
    .query(async ({ ctx }) => {
      return await getUserClubs({ userId: ctx.user.id });
    }),
  emptyClub: protectedProcedure
    .output(clubsSelectSchema.nullable())
    .query(async ({ ctx }) => {
      return await getEmptyClub({ userId: ctx.user.id });
    }),
  myTournaments: protectedProcedure
    .output(z.array(tournamentWithClubSchema))
    .query(async ({ ctx }) => {
      return await getTournamentsToUserClubsQuery({ userId: ctx.user.id });
    }),
  validatePlayerNickname: protectedProcedure
    .input(z.object({ nickname: z.string(), clubId: z.string() }))
    .output(z.object({ valid: z.boolean() }))
    .query(async ({ input }) => {
      const player = await playerExistsInClub(input);
      return { valid: !player };
    }),
  validateLichessTeam: protectedProcedure
    .input(z.object({ lichessTeam: z.string().optional().nullable() }))
    .output(clubsSelectSchema.nullable())
    .query(async ({ input }) => {
      const club = await getClubByLichessTeam(input);
      return club ?? null;
    }),
  lichessTeams: protectedProcedure
    .output(z.array(z.object({ label: z.string(), value: z.string() })))
    .query(async ({ ctx }) => {
      const teams = await getUserLichessTeams(ctx.user.username);
      return teams.map((team) => ({
        label: team.name.toLowerCase(),
        value: team.id,
      }));
    }),
  selectClub: protectedProcedure
    .meta(meta.authSelectClub)
    .output(z.string())
    .input(clubIdInputSchema)
    .mutation(async (opts) => {
      const { input } = opts;
      const { selectedClub } = await selectClub(input);
      await timeout(1000);
      revalidateTag(CACHE_TAGS.AUTH, 'max');
      return selectedClub;
    }),
  delete: protectedProcedure.input(userIdInputSchema).mutation(async (opts) => {
    const { input } = opts;
    await deleteUser(input);
    revalidateTag(CACHE_TAGS.AUTH, 'max');
    revalidateTag(CACHE_TAGS.USER_CLUBS, 'max');
  }),
  edit: protectedProcedure
    .meta(meta.authEdit)
    .input(editProfileFormSchema)
    .output(usersSelectPublicSchema)
    .mutation(async ({ ctx, input }) => {
      return await editUser(ctx.user.id, input);
    }),
  apiToken: {
    list: protectedProcedure
      .output(z.array(apiToken))
      .query(async ({ ctx }) => {
        const tokens = await ctx.db.query.apiTokens.findMany({
          where: eq(apiTokens.userId, ctx.user.id),
          orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
        });
        return tokens;
      }),

    generate: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const id = newid();
        const secret = newid(32);
        const token = `mktour_${id}_${secret}`;
        const tokenHash = crypto
          .createHash('sha256')
          .update(secret)
          .digest('hex');

        await ctx.db.insert(apiTokens).values({
          id,
          tokenHash,
          userId: ctx.user.id,
          name: input.name,
          createdAt: new Date(),
        });

        return { token };
      }),

    revoke: protectedProcedure
      .input(apiTokenIdInputSchema)
      .mutation(async ({ ctx, input }) => {
        const token = await ctx.db.query.apiTokens.findFirst({
          where: eq(apiTokens.id, input.id),
        });

        if (!token) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Token not found',
          });
        }

        if (token.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your token' });
        }

        await ctx.db.delete(apiTokens).where(eq(apiTokens.id, input.id));
      }),
  },
  affiliationInClub: authProcedure
    .input(clubIdInputSchema)
    .output(playersSelectSchema.nullish())
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      return await ctx.db.query.players.findFirst({
        where: and(
          eq(players.userId, ctx.user.id),
          eq(players.clubId, input.clubId),
        ),
      });
    }),
};
