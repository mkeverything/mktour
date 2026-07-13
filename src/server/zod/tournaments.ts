import {
  dateToLocalDateString,
  getLocalDateStringValidationError,
} from '@/lib/local-date';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/zod/clubs';
import { tournamentIdInputSchema } from '@/server/zod/common';
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
export const playerInUnitSchema = createSelectSchema(players)
  .pick({
    id: true,
    nickname: true,
    realname: true,
    rating: true,
    userId: true,
  })
  .extend({
    username: z.string().nullable(),
  });

const gamePairSideSchema = z.tuple([playerInUnitSchema, playerInUnitSchema]);

export const gamePairMembersSchema = z.object({
  white: gamePairSideSchema,
  black: gamePairSideSchema,
});

export const gameSchema = createSelectSchema(games).extend({
  whiteNickname: z.string(),
  blackNickname: z.string(),
  roundName: roundNameEnum.nullable(),
  result: gameResultEnum.nullable(),
});

export const saveRoundInputSchema = tournamentIdInputSchema.extend({
  roundNumber: z.number().int().min(1),
  newGames: z
    .array(gameSchema)
    .min(1)
    .superRefine((newGames, ctx) => {
      if (
        newGames.some(
          (game) => game.result !== null || game.finishedAt !== null,
        )
      ) {
        ctx.addIssue({ code: 'custom', message: 'ROUND_PROJECTION_MISMATCH' });
      }
    }),
});
export const saveRoundOutputSchema = z.array(gameSchema);

export const tournamentsInsertSchema = createInsertSchema(tournaments, {
  format: tournamentFormatEnum,
  type: tournamentTypeEnum,
});
export const gamesInsertSchema = createInsertSchema(games);
export const tournamentsUpdateSchema = createUpdateSchema(tournaments);
export const gamesUpdateSchema = createUpdateSchema(games);
export const playerUnitSelectSchema = createSelectSchema(players_to_units);
export const playerUnitInsertSchema = createInsertSchema(players_to_units);
export const playerUnitUpdateSchema = createUpdateSchema(players_to_units);

export const unitSelectSchema = createSelectSchema(tournament_units);
export const unitInsertSchema = createInsertSchema(tournament_units);
export const unitUpdateSchema = createUpdateSchema(tournament_units);

export const unitSchema = unitSelectSchema
  .omit({
    tournamentId: true,
    nickname: true,
  })
  .extend({
    unitNickname: unitSelectSchema.shape.nickname,
    players: z.array(playerInUnitSchema).min(1),
  });

export const unitOrderSchema = unitSelectSchema.pick({
  nickname: true,
  number: true,
  addedAt: true,
});

export const reorderTournamentUnitsInputSchema = z.object({
  tournamentId: z.string(),
  unitIds: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'TOURNAMENT_UNIT_IDS_NOT_UNIQUE',
    }),
});
export const withdrawTournamentUnitInputSchema = z.object({
  tournamentId: z.string(),
  unitId: unitSchema.shape.id,
  userId: z.string(),
});
export const withdrawTournamentUnitResultSchema = z.object({
  roundsNumber: z.number().int().min(1).nullable(),
  roundsNumberAutoDecreased: z.boolean(),
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
  z.object({ status: z.literal('organizer'), unitId: z.null() }),
  z.object({ status: z.literal('viewer'), unitId: z.null() }),
  z
    .object({
      status: z.literal('player'),
      unitId: unitSelectSchema.shape.id,
    })
    .transform((row) => ({
      status: 'player' as const,
      unitId: row.unitId,
    })),
]);

const localDateStringSchema = z.string().superRefine((value, ctx) => {
  const error = getLocalDateStringValidationError(value);
  if (error) {
    ctx.addIssue({ code: 'custom', message: error });
  }
});

const newTournamentFormSchemaConfig = {
  title: z.string().optional(),
  date: z.date().superRefine((date, ctx) => {
    const error = getLocalDateStringValidationError(
      dateToLocalDateString(date),
    );
    if (error) {
      ctx.addIssue({ code: 'custom', message: error });
    }
  }),
  format: tournamentFormatEnum,
  type: tournamentTypeEnum,
  clubId: z.string(),
  rated: z.boolean(),
};

export const newTournamentFormSchema = z.object(newTournamentFormSchemaConfig);
export const tournamentCreateInputSchema = z.object({
  ...newTournamentFormSchemaConfig,
  date: localDateStringSchema,
});

export const addDoublesUnitSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, { error: 'MIN_NICKNAME_LENGTH' })
      .max(30, { error: 'MAX_NICKNAME_LENGTH' }),
    unitId: unitSchema.shape.id.optional(),
    firstPlayerId: playerInUnitSchema.shape.id,
    secondPlayerId: playerInUnitSchema.shape.id,
  })
  .refine((value) => value.firstPlayerId !== value.secondPlayerId, {
    path: ['secondPlayerId'],
    message: 'TEAM_PLAYERS_SHOULD_BE_DIFFERENT',
  });

export const editDoublesUnitSchema = addDoublesUnitSchema.required({
  unitId: true,
});

/** form schema: nickname optional (derive on submit when empty). api still requires min(2). */
export const addDoublesUnitFormSchema = addDoublesUnitSchema.safeExtend({
  nickname: z.string().trim().max(30, { error: 'MAX_NICKNAME_LENGTH' }),
});

export type TournamentInfoModel = z.infer<typeof tournamentInfoSchema>;
export type TournamentWithClubModel = z.infer<typeof tournamentWithClubSchema>;
export type TournamentAuthStatusModel = z.infer<
  typeof tournamentAuthStatusSchema
>;
export type ReorderTournamentUnitsInputModel = z.infer<
  typeof reorderTournamentUnitsInputSchema
>;
export type WithdrawTournamentUnitInputModel = z.infer<
  typeof withdrawTournamentUnitInputSchema
>;
export type WithdrawTournamentUnitResultModel = z.infer<
  typeof withdrawTournamentUnitResultSchema
>;
export type TournamentModel = z.infer<typeof tournamentSchema>;
export type TournamentInsertModel = z.infer<typeof tournamentsInsertSchema>;
export type TournamentUpdateModel = z.infer<typeof tournamentsUpdateSchema>;
export type NewTournamentFormModel = z.infer<typeof newTournamentFormSchema>;
export type TournamentCreateInputModel = z.infer<
  typeof tournamentCreateInputSchema
>;
export type GameModel = z.infer<typeof gameSchema>;
export type SaveRoundInputModel = z.infer<typeof saveRoundInputSchema>;
export type GameInsertModel = z.infer<typeof gamesInsertSchema>;
export type GameUpdateModel = z.infer<typeof gamesUpdateSchema>;
export type AddDoublesUnitModel = z.infer<typeof addDoublesUnitSchema>;
export type EditDoublesUnitModel = z.infer<typeof editDoublesUnitSchema>;
export type PlayerUnitModel = z.infer<typeof playerUnitSelectSchema>;
export type PlayerUnitInsertModel = z.infer<typeof playerUnitInsertSchema>;
export type PlayerUnitUpdateModel = z.infer<typeof playerUnitUpdateSchema>;
export type PlayerInUnitModel = z.infer<typeof playerInUnitSchema>;
export type UnitModel = z.infer<typeof unitSchema>;
export type UnitSelectModel = z.infer<typeof unitSelectSchema>;
export type UnitInsertModel = z.infer<typeof unitInsertSchema>;
export type UnitUpdateModel = z.infer<typeof unitUpdateSchema>;
export type UnitOrderModel = z.infer<typeof unitOrderSchema>;
