import { playerRecordSchema, ratingEventSchema } from '@/server/zod/players';
import {
  playerUnitSelectSchema,
  saveRoundGameInputSchema,
  tournamentSchema,
  unitSelectSchema,
} from '@/server/zod/tournaments';
import z from 'zod';

export const legacyRatingStateSchema = playerRecordSchema.pick({
  rating: true,
  ratingDeviation: true,
  ratingVolatility: true,
});
export const legacySnapshotSchema = z.object({
  players: z.array(playerRecordSchema),
  tournaments: z.array(tournamentSchema),
  units: z.array(unitSelectSchema),
  participations: z.array(
    playerUnitSelectSchema.extend({
      newRating: z.number().int().nullable(),
      newRatingDeviation: z.number().int().nullable(),
      newVolatility: z.number().nullable(),
    }),
  ),
  games: z.array(saveRoundGameInputSchema),
});
export const legacyResultSchema = z.object({
  opponentRating: playerRecordSchema.shape.rating,
  opponentRatingDeviation: playerRecordSchema.shape.ratingDeviation,
  score: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
});
export const startingReconstructionSchema = playerRecordSchema
  .pick({
    id: true,
    clubId: true,
  })
  .extend({
    status: z.enum(['recovered', 'direct-baseline', 'skipped']),
    candidates: z.array(z.number()),
    reasons: z.array(z.string()),
    event: ratingEventSchema.omit({ id: true }).nullable(),
  });

export type LegacyRatingState = z.infer<typeof legacyRatingStateSchema>;
export type LegacySnapshot = z.infer<typeof legacySnapshotSchema>;
export type LegacyResult = z.infer<typeof legacyResultSchema>;
export type StartingReconstruction = z.infer<
  typeof startingReconstructionSchema
>;
