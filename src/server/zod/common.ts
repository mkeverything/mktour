import z from 'zod';

export const idSchema = z.string();

export const userIdInputSchema = z.object({
  userId: idSchema,
});

export const clubIdInputSchema = z.object({
  clubId: idSchema,
});

export const tournamentIdInputSchema = z.object({
  tournamentId: idSchema,
});

export const playerIdInputSchema = z.object({
  playerId: idSchema,
});

export const notificationIdInputSchema = z.object({
  notificationId: idSchema,
});

export const apiTokenIdInputSchema = z.object({
  id: idSchema,
});

export const paginatedInputSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.number().nullish(),
});
