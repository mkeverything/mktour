import { validateNewPlayer } from '@/lib/zod/new-player-validation-action';
import { affiliations, players } from '@/server/db/schema/players';
import { players_to_tournaments } from '@/server/db/schema/tournaments';
import { affiliationStatusEnum } from '@/server/db/zod/enums';
import { tournamentSchema } from '@/server/db/zod/tournaments';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import z from 'zod';

export const playersSelectSchema = createSelectSchema(players);
export const playersInsertSchema = createInsertSchema(players, {
  rating: (s) =>
    s
      .min(0, {
        error: 'min rating',
      })
      .max(3000, {
        error: 'max rating',
      }),
  ratingPeak: (s) =>
    s
      .min(0, {
        error: 'min peak rating',
      })
      .max(3000, {
        error: 'max peak rating',
      }),
  nickname: (s) =>
    s
      .min(3, {
        error: 'min nickname length',
      })
      .max(30, {
        error: 'max nickname length',
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

export const playerFormSchema = playersInsertSchema
  .omit({
    id: true,
    lastSeenAt: true,
    userId: true,
    ratingPeak: true,
  })
  .refine(
    async (data) => {
      return await validateNewPlayer(data);
    },
    { error: 'player exists error', path: ['nickname'] },
  );

export const playerEditSchema = playersUpdateSchema
  .extend({
    id: z.string(),
    clubId: z.string(),
    nickname: z
      .string()
      .min(3, {
        error: 'min nickname length',
      })
      .max(30, {
        error: 'max nickname length',
      })
      .optional(),
    rating: z
      .number()
      .min(0, {
        error: 'min rating',
      })
      .max(3000, {
        error: 'max rating',
      })
      .optional(),
    ratingPeak: z
      .number()
      .min(0, {
        error: 'min peak rating',
      })
      .max(3000, {
        error: 'max peak rating',
      })
      .optional(),
  })
  .omit({
    lastSeenAt: true,
    ratingPeak: true,
    ratingLastUpdateAt: true,
  });

export const playersToTournamentsSelectSchema = createSelectSchema(
  players_to_tournaments,
);

export const playerTournamentSchema = playersToTournamentsSelectSchema
  .pick({
    pairingNumber: true,
    wins: true,
    draws: true,
    losses: true,
    colorIndex: true,
    isOut: true,
    place: true,
  })
  .extend({
    id: playersSelectSchema.shape.id,
    nickname: playersSelectSchema.shape.nickname,
    realname: playersSelectSchema.shape.realname,
    rating: playersSelectSchema.shape.rating,
  });

export const playerStatsSchema = z.object({
  tournamentsPlayed: z.object({
    value: z.number(),
    rank: z.number(),
  }),
  gamesPlayed: z.object({
    value: z.number(),
    rank: z.number(),
  }),
  winRate: z.object({
    value: z.number(),
    rank: z.number(),
  }),
  ratingPeakRank: z.number(),
});

export const playerAuthStatsSchema = z.object({
  playerWins: z.number(),
  draws: z.number(),
  userWins: z.number(),
  userPlayerNickname: z.string(),
  lastTournament: tournamentSchema.nullable(),
});

export type PlayerTournamentModel = z.infer<typeof playerTournamentSchema>;

export type AffiliationModel = z.infer<typeof affiliationsSelectSchema>;
export type AffiliationInsertModel = z.infer<typeof affiliationsInsertSchema>;
export type AffiliationExtendedModel = z.infer<
  typeof affiliationExtendedSchema
>;
export type AffiliationMinimalModel = z.infer<typeof affiliationMinimalSchema>;
export type PlayerModel = z.infer<typeof playersSelectSchema>;
export type PlayerMinimalModel = z.infer<typeof playersMinimalSchema>;
export type PlayerFormModel = z.infer<typeof playerFormSchema>;
export type PlayerInsertModel = z.infer<typeof playersInsertSchema>;
export type PlayerUpdateModel = z.infer<typeof playersUpdateSchema>;
export type PlayerEditModel = z.infer<typeof playerEditSchema>;

export type PlayerStatsModel = z.infer<typeof playerStatsSchema>;
export type PlayerAuthStatsModel = z.infer<typeof playerAuthStatsSchema>;
