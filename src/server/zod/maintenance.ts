import z from 'zod';

const timestampSchema = z
  .string()
  .transform((value) => Date.parse(value))
  .refine(Number.isFinite)
  .nullish();

export const maintenanceConfigSchema = z.object({
  enabled: z.boolean().optional(),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
});

export const maintenanceStartsAtSchema = z.date().nullable();

export type MaintenanceStartsAt = z.infer<typeof maintenanceStartsAtSchema>;
