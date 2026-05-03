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
const pairMemberSchema = z.object({
  id: z.string(),
  nickname: z.string(),
});

const gamePairSideSchema = z.tuple([pairMemberSchema, pairMemberSchema]);

export const gamePairMembersSchema = z.object({
  white: gamePairSideSchema,
  black: gamePairSideSchema,
});

export const gameSchema = createSelectSchema(games).extend({
  whiteNickname: z.string(),
  blackNickname: z.string(),
  pairMembers: gamePairMembersSchema.nullable(),
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
export const playerTournamentOrderSchema = playerTournamentSelectSchema
  .pick({
    teamNickname: true,
    numberInTeam: true,
    pairingNumber: true,
    addedAt: true,
  })
  .extend({
    id: playerTournamentSelectSchema.shape.playerId,
  });

export const withdrawTournamentPlayerInputSchema = z.object({
  tournamentId: z.string(),
  playerId: z.string(),
  userId: z.string(),
});
export const reorderTournamentPlayersInputSchema = z.object({
  tournamentId: z.string(),
  playerIds: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'player ids must be unique',
    }),
});
export const withdrawTournamentPlayerResultSchema = z.object({
  roundsNumber: z.number().int().min(1).nullable(),
  roundsNumberAutoDecreased: z.boolean(),
});

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

export const publicFeaturedTournamentSchema = z.object({
  tournament: tournamentSchema.pick({
    id: true,
    title: true,
    format: true,
    type: true,
    date: true,
    rated: true,
  }),
  club: clubsSelectSchema.pick({ id: true, name: true }),
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

export const addDoublesTeamSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, { error: 'min nickname length' })
      .max(30, { error: 'max nickname length' }),
    firstPlayerId: z.string(),
    secondPlayerId: z.string(),
  })
  .refine((value) => value.firstPlayerId !== value.secondPlayerId, {
    path: ['secondPlayerId'],
    message: 'team players should be different',
  });

export const editDoublesTeamSchema = z
  .object({
    currentTeamPlayerId: z.string(),
    nickname: z
      .string()
      .trim()
      .min(2, { error: 'min nickname length' })
      .max(30, { error: 'max nickname length' }),
    firstPlayerId: z.string(),
    secondPlayerId: z.string(),
  })
  .refine((value) => value.firstPlayerId !== value.secondPlayerId, {
    path: ['secondPlayerId'],
    message: 'team players should be different',
  });

/** form schema: nickname optional (derive on submit when empty). api still requires min(2). */
export const addDoublesTeamFormSchema = addDoublesTeamSchema.safeExtend({
  nickname: z.string().trim().max(30, { error: 'max nickname length' }),
});

export const editDoublesTeamFormSchema = editDoublesTeamSchema.safeExtend({
  nickname: z.string().trim().max(30, { error: 'max nickname length' }),
});

export type TournamentInfoModel = z.infer<typeof tournamentInfoSchema>;
export type TournamentWithClubModel = z.infer<typeof tournamentWithClubSchema>;
export type PublicFeaturedTournamentModel = z.infer<
  typeof publicFeaturedTournamentSchema
>;
export type TournamentAuthStatusModel = z.infer<
  typeof tournamentAuthStatusSchema
>;
export type ReorderTournamentPlayersInputModel = z.infer<
  typeof reorderTournamentPlayersInputSchema
>;
export type TournamentModel = z.infer<typeof tournamentSchema>;
export type TournamentInsertModel = z.infer<typeof tournamentsInsertSchema>;
export type TournamentUpdateModel = z.infer<typeof tournamentsUpdateSchema>;
export type NewTournamentFormModel = z.infer<typeof newTournamentFormSchema>;
export type TournamentCreateInputModel = z.infer<
  typeof tournamentCreateInputSchema
>;

export type GameModel = z.infer<typeof gameSchema>;
export type GamePairMembersModel = z.infer<typeof gamePairMembersSchema>;
export type GameInsertModel = z.infer<typeof gamesInsertSchema>;
export type GameUpdateModel = z.infer<typeof gamesUpdateSchema>;
export type AddDoublesTeamModel = z.infer<typeof addDoublesTeamSchema>;
export type EditDoublesTeamModel = z.infer<typeof editDoublesTeamSchema>;

export type PlayerToTournamentModel = z.infer<typeof playerToTournamentSchema>;
export type PlayerToTournamentInsertModel = z.infer<
  typeof playerTournamentInsertSchema
>;
export type PlayerToTournamentUpdateModel = z.infer<
  typeof playerTournamentUpdateSchema
>;
export type PlayerTournamentOrderModel = z.infer<
  typeof playerTournamentOrderSchema
>;
