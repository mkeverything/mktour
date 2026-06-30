import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { affiliations, players } from '@/server/db/schema/players';
import { affiliationStatusEnum } from '@/server/zod/enums';
import { tournamentSchema } from '@/server/zod/tournaments';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import z from 'zod';

export const playersSelectSchema = createSelectSchema(players);
export const playersWithUsernameSchema = createSelectSchema(players).extend({
  username: z.string().nullable(),
});
export const playersInsertSchema = createInsertSchema(players, {
  rating: (s) =>
    s
      .min(GLICKO2_CONSTANTS.MIN_STARTING_RATING, {
        error: 'MIN_STARTING_RATING',
      })
      .max(GLICKO2_CONSTANTS.MAX_STARTING_RATING, {
        error: 'MAX_STARTING_RATING',
      }),
  ratingPeak: (s) =>
    s
      .min(GLICKO2_CONSTANTS.MIN_RATING, {
        error: 'MIN_PEAK_RATING',
      })
      .max(GLICKO2_CONSTANTS.MAX_RATING, {
        error: 'MAX_PEAK_RATING',
      }),
  nickname: (s) =>
    s
      .trim()
      .min(2, {
        error: 'MIN_NICKNAME_LENGTH',
      })
      .max(30, {
        error: 'MAX_NICKNAME_LENGTH',
      }),
});
export const playersUpdateSchema = createUpdateSchema(players);
export const affiliationsSelectSchema = createSelectSchema(affiliations, {
  status: affiliationStatusEnum,
});
export const affiliationsInsertSchema = createInsertSchema(affiliations, {
  status: affiliationStatusEnum,
});
export const affiliationsUpdateSchema = createUpdateSchema(affiliations);

export const affiliationExtendedSchema = affiliationsSelectSchema
  .extend({
    player: playersSelectSchema,
  })
  .omit({ playerId: true, clubId: true });

export const affiliationMinimalSchema = affiliationsSelectSchema.omit({
  playerId: true,
  clubId: true,
  userId: true,
});

export const playersMinimalSchema = playersSelectSchema.omit({
  clubId: true,
});

export const playerFormSchema = playersInsertSchema.omit({
  id: true,
  lastSeenAt: true,
  userId: true,
  ratingPeak: true,
});

export const playerEditSchema = playersUpdateSchema
  .pick({ nickname: true, realname: true })
  .extend({
    playerId: z.string(),
    nickname: z
      .string()
      .trim()
      .min(2, { error: 'MIN_NICKNAME_LENGTH' })
      .max(30, { error: 'MAX_NICKNAME_LENGTH' })
      .optional(),
    realname: z.string().max(50).nullable().optional(),
  });

export const playerMergeInputSchema = z.object({
  basePlayerId: z.string(),
  mergedPlayerId: z.string(),
});

export const statItemSchema = z.object({
  value: z.number(),
  rank: z.number().nullable(),
});

export const playerStatsSchema = z.object({
  tournamentsPlayed: statItemSchema,
  gamesPlayed: statItemSchema,
  winRate: statItemSchema,
  ratingPeakRank: z.number().nullable(),
});

export const playerAuthStatsSchema = z.object({
  playerWins: z.number(),
  draws: z.number(),
  userWins: z.number(),
  userPlayerNickname: z.string(),
  lastTournament: tournamentSchema.nullable(),
});

export type AffiliationModel = z.infer<typeof affiliationsSelectSchema>;
export type AffiliationInsertModel = z.infer<typeof affiliationsInsertSchema>;
export type AffiliationExtendedModel = z.infer<
  typeof affiliationExtendedSchema
>;
export type AffiliationMinimalModel = z.infer<typeof affiliationMinimalSchema>;
export type PlayerModel = z.infer<typeof playersSelectSchema>;
export type PlayerWithUsernameModel = z.infer<typeof playersWithUsernameSchema>;
export type PlayerMinimalModel = z.infer<typeof playersMinimalSchema>;
export type PlayerFormModel = z.infer<typeof playerFormSchema>;
export type PlayerInsertModel = z.infer<typeof playersInsertSchema>;
export type PlayerUpdateModel = z.infer<typeof playersUpdateSchema>;
export type PlayerEditModel = z.infer<typeof playerEditSchema>;
export type PlayerMergeInputModel = z.infer<typeof playerMergeInputSchema>;

export const userPlayerClubSchema = z.object({
  club: z.object({ id: z.string(), name: z.string() }),
  player: playersSelectSchema.pick({
    id: true,
    nickname: true,
    rating: true,
    ratingDeviation: true,
    ratingPeak: true,
    lastSeenAt: true,
  }),
});

export type PlayerStatsModel = z.infer<typeof playerStatsSchema>;
export type PlayerAuthStatsModel = z.infer<typeof playerAuthStatsSchema>;
export type UserPlayerClubModel = z.infer<typeof userPlayerClubSchema>;
