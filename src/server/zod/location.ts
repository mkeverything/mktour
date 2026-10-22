import z from 'zod';

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const coordinatesInputShape = {
  latitude: latitudeSchema.nullish(),
  longitude: longitudeSchema.nullish(),
};

// a location is either complete or absent: both set, both null, or both omitted
export function validateCoordinates(
  {
    latitude,
    longitude,
  }: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx,
) {
  if (typeof latitude === typeof longitude) return;
  ctx.addIssue({
    code: 'custom',
    path: ['latitude'],
    message: 'INCOMPLETE_LOCATION',
  });
}
