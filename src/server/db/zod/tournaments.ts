import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/db/zod/clubs';
import {
  gameResultEnum,
  roundNameEnum,
  tournamentFormatEnum,
  tournamentTypeEnum,
} from '@/server/db/zod/enums';
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
  club: clubsSelectSchema,
});

export type TournamentInfoModel = z.infer<typeof tournamentInfoSchema>;
export type TournamentModel = z.infer<typeof tournamentSchema>;
export type TournamentInsertModel = z.infer<typeof tournamentsInsertSchema>;
export type TournamentUpdateModel = z.infer<typeof tournamentsUpdateSchema>;

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
