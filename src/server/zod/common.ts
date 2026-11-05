import z from 'zod';

export const userIdInputSchema = z.object({
  userId: z.string(),
});

export const clubIdInputSchema = z.object({
  clubId: z.string(),
});

export const tournamentIdInputSchema = z.object({
  tournamentId: z.string(),
});

export const playerIdInputSchema = z.object({
  playerId: z.string(),
});

export const notificationIdInputSchema = z.object({
  notificationId: z.string(),
});

export const apiTokenIdInputSchema = z.object({
  id: z.string(),
});

export const paginatedInputSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.number().nullish(),
});

export const clubPaginatedInputSchema = paginatedInputSchema.extend(
  clubIdInputSchema.shape,
);
