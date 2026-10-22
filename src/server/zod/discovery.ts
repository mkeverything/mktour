import { tournament_units } from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/zod/clubs';
import { paginatedInputSchema } from '@/server/zod/common';
import {
  tournamentFormatEnum,
  tournamentStatusEnum,
  tournamentTypeEnum,
} from '@/server/zod/enums';
import {
  tournamentSchema,
  tournamentWithClubSchema,
} from '@/server/zod/tournaments';
import { latitudeSchema, longitudeSchema } from '@/server/zod/location';
import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

const MAX_RADIUS_KM = 500;

export const clubLocationsInputSchema = z.object({
  search: z.string().trim().max(100).optional(),
});

const discoveryFiltersSchema = clubLocationsInputSchema
  .extend({
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    radiusKm: z.number().min(1).max(MAX_RADIUS_KM).optional(),
  })
  .superRefine(({ latitude, longitude, radiusKm }, ctx) => {
    const given = [latitude, longitude, radiusKm].filter(
      (value) => value !== undefined,
    ).length;
    if (given === 0 || given === 3) return;
    ctx.addIssue({
      code: 'custom',
      path: ['radiusKm'],
      message: 'INCOMPLETE_LOCATION_FILTER',
    });
  });

const placeSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  cityName: z.string().nullable(),
  countryIso2: z.string().nullable(),
});

export const clubsListInputSchema = discoveryFiltersSchema.safeExtend(
  paginatedInputSchema.shape,
);

export const clubListItemSchema = clubsSelectSchema.extend({
  place: placeSchema.nullable(),
  distanceKm: z.number().nullable(),
  playersCount: z.number(),
  tournamentsCount: z.number(),
  averageRating: z.number().nullable(),
  liveTournamentsCount: z.number(),
  isNew: z.boolean(),
  nextTournament: tournamentSchema
    .pick({ id: true, title: true, date: true, format: true, type: true })
    .nullable(),
});

export const clubLocationSchema = clubsSelectSchema
  .pick({ id: true, name: true })
  .extend(placeSchema.shape);

export const tournamentsListFiltersSchema = discoveryFiltersSchema.safeExtend({
  format: tournamentFormatEnum.optional(),
  type: tournamentTypeEnum.optional(),
  rated: z.boolean().optional(),
});

export const tournamentsListInputSchema =
  tournamentsListFiltersSchema.safeExtend({
    status: tournamentStatusEnum.optional(),
    cursor: z.number().nullish(),
    limit: z.number().min(1).max(100).optional().default(10),
  });

const podiumUnitSchema = createSelectSchema(tournament_units)
  .pick({ id: true, nickname: true })
  .extend({ place: z.number(), score: z.number() });

export const tournamentListItemSchema = tournamentWithClubSchema.extend({
  playersCount: z.number(),
  podium: z.array(podiumUnitSchema),
  place: placeSchema.nullable(),
  distanceKm: z.number().nullable(),
});

export const tournamentStatusCountsSchema = z.object({
  upcoming: z.number(),
  live: z.number(),
  finished: z.number(),
});

export type PlaceModel = z.infer<typeof placeSchema>;
export type ClubsListInputModel = z.input<typeof clubsListInputSchema>;
export type ClubListItemModel = z.infer<typeof clubListItemSchema>;
export type ClubLocationModel = z.infer<typeof clubLocationSchema>;
export type TournamentsListFiltersModel = z.infer<
  typeof tournamentsListFiltersSchema
>;
export type TournamentsListInputModel = z.input<
  typeof tournamentsListInputSchema
>;
export type TournamentListItemModel = z.infer<typeof tournamentListItemSchema>;
export type TournamentStatusCountsModel = z.infer<
  typeof tournamentStatusCountsSchema
>;
