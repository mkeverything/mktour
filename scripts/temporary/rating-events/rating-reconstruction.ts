import { playersSelectSchema, ratingEventSchema } from '@/server/zod/players';
import {
  playerUnitSelectSchema,
  saveRoundGameInputSchema,
  tournamentSchema,
  unitSelectSchema,
} from '@/server/zod/tournaments';
import z from 'zod';

export const legacyRatingStateSchema = playersSelectSchema.pick({
  rating: true,
  ratingDeviation: true,
  ratingVolatility: true,
});
export const legacySnapshotSchema = z.object({
  players: z.array(playersSelectSchema),
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
  opponentRating: playersSelectSchema.shape.rating,
  opponentRatingDeviation: playersSelectSchema.shape.ratingDeviation,
  score: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
});
export const ratingEventImportSchema = ratingEventSchema.omit({ id: true });
export type RatingEventImport = z.infer<typeof ratingEventImportSchema>;
export const legacyOutcomeEventSchema = ratingEventImportSchema.extend({
  originalRating:
    legacySnapshotSchema.shape.participations.element.shape.newRating.unwrap(),
});
export type LegacyOutcomeEvent = z.infer<typeof legacyOutcomeEventSchema>;

export const startingReconstructionSchema = playersSelectSchema
  .pick({
    id: true,
    clubId: true,
  })
  .extend({
    status: z.enum(['recovered', 'direct-baseline', 'skipped']),
    candidates: z.array(z.number()),
    reasons: z.array(z.string()),
    event: ratingEventImportSchema.nullable(),
  });

export type LegacyRatingState = z.infer<typeof legacyRatingStateSchema>;
export type LegacySnapshot = z.infer<typeof legacySnapshotSchema>;
export type LegacyResult = z.infer<typeof legacyResultSchema>;
export type StartingReconstruction = z.infer<
  typeof startingReconstructionSchema
>;
