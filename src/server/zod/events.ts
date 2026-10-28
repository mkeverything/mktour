import { clubsSelectSchema } from '@/server/zod/clubs';
import {
  gameSchema,
  tournamentFinishOutputSchema,
  tournamentSchema,
  unitSchema,
} from '@/server/zod/tournaments';
import z from 'zod';

export const tournamentEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('prestart-units-updated'),
    units: z.array(unitSchema),
  }),
  z.object({ event: z.literal('withdraw-unit'), id: unitSchema.shape.id }),
  z.object({
    event: z.literal('set-game-result'),
    gameId: gameSchema.shape.id,
    result: gameSchema.shape.result,
    roundNumber: gameSchema.shape.roundNumber,
  }),
  z.object({
    event: z.literal('start-tournament'),
    startedAt: z.date(),
    games: z.array(gameSchema),
  }),
  z.object({ event: z.literal('reset-tournament') }),
  z.object({ event: z.literal('reset-tournament-players') }),
  z.object({
    event: z.literal('new-round'),
    roundNumber: gameSchema.shape.roundNumber,
    newGames: z.array(gameSchema),
  }),
  tournamentFinishOutputSchema.extend({
    event: z.literal('finish-tournament'),
  }),
  z.object({
    event: z.literal('swiss-new-rounds-number'),
    roundsNumber: tournamentSchema.shape.roundsNumber,
  }),
  z.object({
    event: z.literal('tournament-title-changed'),
    title: tournamentSchema.shape.title,
  }),
]);

export const userEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('user-notification') }),
  z.object({
    event: z.literal('club-notification'),
    clubId: clubsSelectSchema.shape.id,
  }),
]);

export type TournamentEventModel = z.infer<typeof tournamentEventSchema>;
export type UserEventModel = z.infer<typeof userEventSchema>;
