import { MAX_CLUB_LINKS } from '@/lib/club-links';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { clubIdInputSchema } from '@/server/zod/common';
import { usersSelectSchema } from '@/server/zod/users';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

const LINK_SCHEME = /^[a-z][a-z\d+.-]*:/i;

const toLinkHref = (value: string) => {
  try {
    const url = new URL(LINK_SCHEME.test(value) ? value : `https://${value}`);
    const isWebUrl = url.protocol === 'http:' || url.protocol === 'https:';
    return isWebUrl && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
};

export const clubLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, { error: 'LONG_LINK' })
    .transform((value, ctx) => {
      const href = toLinkHref(value);
      if (href) return href;
      ctx.addIssue({ code: 'custom', message: 'INVALID_LINK' });
      return z.NEVER;
    }),
  icon: z.string().nullable(),
});

const clubLinksInputSchema = z
  .array(clubLinkSchema.pick({ url: true }))
  .max(MAX_CLUB_LINKS, { error: 'TOO_MANY_LINKS' })
  .superRefine((links, ctx) => {
    links.forEach(({ url }, index) => {
      if (links.findIndex((link) => link.url === url) === index) return;
      ctx.addIssue({
        code: 'custom',
        path: [index, 'url'],
        message: 'DUPLICATE_LINK',
      });
    });
  });

export const clubsSelectSchema = createSelectSchema(clubs).omit({
  links: true,
});

export const clubInfoLinkSchema = clubLinkSchema
  .pick({ url: true })
  .extend({ path: z.string() });

export const clubInfoSchema = clubsSelectSchema.extend({
  links: z.array(clubInfoLinkSchema),
});

export const publicPopularClubSchema = clubsSelectSchema.pick({
  id: true,
  name: true,
  description: true,
  createdAt: true,
  lichessTeam: true,
});

export const clubsToUsersSelectSchema = createSelectSchema(clubs_to_users);

export const clubsInsertSchema = createInsertSchema(clubs, {
  name: (s) =>
    s
      .trim()
      .min(3, { error: 'SHORT_CLUB_NAME' })
      .max(100, { error: 'LONG_CLUB_NAME' }),
  lichessTeam: () => z.string().trim().min(1).nullish(),
  description: z.string().nullish(),
  links: () => clubLinksInputSchema,
}).omit({ id: true, createdAt: true });

export const clubsEditSchema = clubIdInputSchema.extend(
  clubsInsertSchema.partial().shape,
);

export const clubManagerSchema = clubsToUsersSelectSchema
  .pick({
    userId: true,
    status: true,
    promotedAt: true,
  })
  .extend({ username: usersSelectSchema.shape.username });

export const clubStatsSchema = z.object({
  playersCount: z.number(),
  tournamentsCount: z.number(),
});

export type ClubManagerModel = z.infer<typeof clubManagerSchema>;
export type ClubEditModel = z.infer<typeof clubsEditSchema>;
export type ClubFormModel = z.infer<typeof clubsInsertSchema>;
export type ClubStatsModel = z.infer<typeof clubStatsSchema>;

export type ClubModel = z.infer<typeof clubsSelectSchema>;
export type ClubInfoModel = z.infer<typeof clubInfoSchema>;
export type ClubLinkModel = z.infer<typeof clubLinkSchema>;
export type ClubUpdateModel = z.infer<typeof clubsEditSchema>;
export type ClubInsertModel = z.infer<typeof clubsInsertSchema>;

export type ClubToUserModel = z.infer<typeof clubsToUsersSelectSchema>;
export type ClubToUserInsertModel = z.infer<typeof clubsToUsersSelectSchema>;
