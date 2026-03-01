import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/zod/clubs';
import {
  gameResultEnum,
  roundNameEnum,
  tournamentFormatEnum,
  tournamentTypeEnum,
} from '@/server/zod/enums';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import z from 'zod';

export const tournamentSchema = createSelectSchema(tournaments, {
  format: tournamentFormatEnum,
  type: tournamentTypeEnum,
});
export const gameSchema = createSelectSchema(games).extend({
  whiteNickname: z.string(),
  blackNickname: z.string(),
  roundName: roundNameEnum.nullable(),
  result: gameResultEnum.nullable(),
});
export const tournamentsInsertSchema = createInsertSchema(tournaments, {
  format: tournamentFormatEnum,
  type: tournamentTypeEnum,
});
export const gamesInsertSchema = createInsertSchema(games);
export const tournamentsUpdateSchema = createUpdateSchema(tournaments);
export const gamesUpdateSchema = createUpdateSchema(games);
export const playerTournamentSelectSchema = createSelectSchema(
  players_to_tournaments,
);
export const playerTournamentInsertSchema = createInsertSchema(
  players_to_tournaments,
);
export const playerTournamentUpdateSchema = createUpdateSchema(
  players_to_tournaments,
);

export const playerToTournamentSchema = playerTournamentSelectSchema
  .extend({
    tournament: tournamentSchema,
  })
  .omit({
    playerId: true,
    tournamentId: true,
    id: true,
  });

export const tournamentInfoSchema = z.object({
  tournament: tournamentSchema,
  club: clubsSelectSchema.pick({
    allowPlayersSetResults: true,
    id: true,
    name: true,
  }),
});
export const tournamentWithClubSchema = z.object({
  tournament: tournamentSchema,
  club: clubsSelectSchema,
});

export const tournamentAuthStatusSchema = z.union([
  z.object({ status: z.literal('organizer') }),
  z.object({ status: z.literal('viewer') }),
  z.object({ status: z.literal('player'), playerId: z.string() }),
]);

const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const dateToLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const newTournamentFormSchemaConfig = {
  title: z.string().optional(),
  date: z.date().refine(
    (date) => {
      const dateString = dateToLocalDateString(date);
      const todayString = getTodayDateString();
      return dateString >= todayString;
    },
    {
      message: 'time travel',
    },
  ),
  format: tournamentFormatEnum,
  type: tournamentTypeEnum,
  timestamp: z.number(),
  clubId: z.string(),
  rated: z.boolean(),
};

export const newTournamentFormSchema = z.object(newTournamentFormSchemaConfig);
export const tournamentCreateInputSchema = z.object({
  ...newTournamentFormSchemaConfig,
  date: z.string(),
});

export type TournamentInfoModel = z.infer<typeof tournamentInfoSchema>;
export type TournamentWithClubModel = z.infer<typeof tournamentWithClubSchema>;
export type TournamentAuthStatusModel = z.infer<
  typeof tournamentAuthStatusSchema
>;
export type TournamentModel = z.infer<typeof tournamentSchema>;
export type TournamentInsertModel = z.infer<typeof tournamentsInsertSchema>;
export type TournamentUpdateModel = z.infer<typeof tournamentsUpdateSchema>;
export type NewTournamentFormModel = z.infer<typeof newTournamentFormSchema>;
export type TournamentCreateInputModel = z.infer<
  typeof tournamentCreateInputSchema
>;

export type GameModel = z.infer<typeof gameSchema>;
export type GameInsertModel = z.infer<typeof gamesInsertSchema>;
export type GameUpdateModel = z.infer<typeof gamesUpdateSchema>;

export type PlayerToTournamentModel = z.infer<typeof playerToTournamentSchema>;
export type PlayerToTournamentInsertModel = z.infer<
  typeof playerTournamentInsertSchema
>;
export type PlayerToTournamentUpdateModel = z.infer<
  typeof playerTournamentUpdateSchema
>;
