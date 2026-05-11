import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { clubsSelectSchema } from '@/server/zod/clubs';
import {
  gameResultEnum,
  roundNameEnum,
  tournamentFormatEnum,
  tournamentTypeEnum,
} from '@/server/zod/enums';
import { playersSelectSchema } from '@/server/zod/players';
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
const playerInUnitSchema = playersSelectSchema.pick({
  id: true,
  nickname: true,
  realname: true,
  rating: true,
  userId: true,
});

const gamePairSideSchema = z.tuple([playerInUnitSchema, playerInUnitSchema]);

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
    unitNickname: z.string(),
    players: z.array(playerInUnitSchema).min(1),
  });

export const preStartStateSchema = z.object({
  units: z.array(unitSchema),
  games: z.array(gameSchema),
});
export type PreStartStateModel = z.infer<typeof preStartStateSchema>;

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
      message: 'unit ids must be unique',
    }),
});
export const withdrawTournamentUnitInputSchema = z.object({
  tournamentId: z.string(),
  playerId: z.string(),
  userId: z.string(),
});
export const withdrawTournamentUnitResultSchema = z.object({
  roundsNumber: z.number().int().min(1).nullable(),
  roundsNumberAutoDecreased: z.boolean(),
});

/**
 * canonical mapping from legacy flat/dashboard names to physical tables:
 * - pairing_number → tournament_units.number
 * - team_nickname → tournament_units.nickname (multi-player units)
 * - number_in_team → players_to_units.number_in_unit
 * - wins / draws / losses / color_index / place / is_out → tournament_units
 * - new_rating / new_rating_deviation / new_volatility → players_to_units
 * - games.white_unit_id / black_unit_id → tournament_units.id
 */

// /** @deprecated use playerInUnitSchema instead */
// export const tournamentParticipantPairMemberSchema = z.object({
//   id: z.string(),
//   nickname: z.string(),
//   rating: z.number(),
// });

// /** @deprecated use unitSchema instead */
// export const tournamentParticipantRowSchema = z.object({
//   id: z.string(),
//   nickname: z.string(),
//   realname: z.string().nullable(),
//   rating: z.number(),
//   wins: z.number(),
//   draws: z.number(),
//   losses: z.number(),
//   colorIndex: z.number(),
//   isOut: z.boolean().nullable(),
//   place: z.number().nullable(),
//   pairingNumber: z.number().nullable(),
//   addedAt: z.union([z.date(), z.number()]).nullable(),
//   username: z.string().nullable(),
//   teamNickname: z.string().nullable(),
//   pairPlayers: z.array(tournamentParticipantPairMemberSchema).nullable(),
// });

// /** @deprecated use tournamentParticipantRowSchema */
// export const playerTournamentSchema = tournamentParticipantRowSchema;

// /** @deprecated use UnitModel instead */
// export type TournamentParticipantRowModel = z.infer<
//   typeof tournamentParticipantRowSchema
// >;

// /** @deprecated use preStartSchema instead */
// export const preStartPlayerOrderResultSchema = z.object({
//   players: z.array(tournamentParticipantRowSchema),
//   games: z.array(gameSchema),
// });

// /** @deprecated use UnitInsertModel instead -----
//  * insert shape for legacy players_to_tournaments view writes (until mutations use units). */
// export const playerToTournamentInsertSchema = z.object({
//   id: z.string(),
//   playerId: z.string(),
//   tournamentId: z.string(),
//   wins: z.number(),
//   losses: z.number(),
//   draws: z.number(),
//   colorIndex: z.number(),
//   place: z.number().nullable(),
//   isOut: z.boolean().nullable(),
//   pairingNumber: z.number(),
//   addedAt: z.date(),
//   newRating: z.number().nullable(),
//   newRatingDeviation: z.number().nullable(),
//   newVolatility: z.number().nullable(),
//   teamNickname: z.string().nullable().optional(),
//   numberInTeam: z.number().optional(),
// });

// /** @deprecated use UnitInsertModel instead */
// export type PlayerToTournamentInsertModel = z.infer<
//   typeof playerToTournamentInsertSchema
// >;

// /** @deprecated use reorderTournamentUnitsInputSchema instead */
// export const reorderTournamentPlayersInputSchema = z.object({
//   tournamentId: z.string(),
//   playerIds: z.array(z.string()),
// });

// /** @deprecated use reorderTournamentUnitsInputSchema instead */
// export type ReorderTournamentPlayersInputModel = z.infer<
//   typeof reorderTournamentPlayersInputSchema
// >;

// /** @deprecated use withdrawTournamentUnitInputSchema instead */
// export const withdrawTournamentPlayerInputSchema = z.object({
//   tournamentId: z.string(),
//   playerId: z.string(),
//   userId: z.string(),
// });

// /** @deprecated use withdrawTournamentUnitInputSchema instead */
// export type WithdrawTournamentPlayerInputModel = z.infer<
//   typeof withdrawTournamentPlayerInputSchema
// >;

// /** @deprecated use withdrawTournamentUnitResultSchema instead */
// export const withdrawTournamentPlayerResultSchema =
//   withdrawTournamentUnitResultSchema;

// /** @deprecated use withdrawTournamentUnitResultSchema instead */
// export type WithdrawTournamentPlayerResultModel = z.infer<
//   typeof withdrawTournamentPlayerResultSchema
// >;

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

export const addDoublesUnitSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, { error: 'min nickname length' })
      .max(30, { error: 'max nickname length' }),
    firstPlayerId: playersSelectSchema.shape.id,
    secondPlayerId: playersSelectSchema.shape.id,
  })
  .refine((value) => value.firstPlayerId !== value.secondPlayerId, {
    path: ['secondPlayerId'],
    message: 'team players should be different',
  });

export const editDoublesUnitSchema = addDoublesUnitSchema.extend({
  currentUnitPlayerId: z.string(),
});

/** form schema: nickname optional (derive on submit when empty). api still requires min(2). */
export const addDoublesUnitFormSchema = addDoublesUnitSchema.safeExtend({
  nickname: z.string().trim().max(30, { error: 'max nickname length' }),
});

// /** @deprecated use addPairUnitFormSchema */
// export const addDoublesTeamFormSchema = addPairUnitFormSchema;

// export const editPairUnitFormSchema = editDoublesUnitSchema.safeExtend({
//   nickname: z.string().trim().max(30, { error: 'max nickname length' }),
// });

// /** @deprecated use addDoublesUnitSchema */
// export const addDoublesTeamSchema = addDoublesUnitSchema;

// /** @deprecated use editDoublesUnitSchema */
// export const editDoublesTeamSchema = editDoublesUnitSchema;

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
export type GamePairMembersModel = z.infer<typeof gamePairMembersSchema>;
export type GameInsertModel = z.infer<typeof gamesInsertSchema>;
export type GameUpdateModel = z.infer<typeof gamesUpdateSchema>;
export type AddDoublesUnitModel = z.infer<typeof addDoublesUnitSchema>;
export type EditDoublesUnitModel = z.infer<typeof editDoublesUnitSchema>;
export type PlayerUnitModel = z.infer<typeof playerUnitSelectSchema>;
export type PlayerUnitInsertModel = z.infer<typeof playerUnitInsertSchema>;
export type PlayerUnitUpdateModel = z.infer<typeof playerUnitUpdateSchema>;
export type UnitModel = z.infer<typeof unitSchema>;
export type UnitSelectModel = z.infer<typeof unitSelectSchema>;
export type UnitInsertModel = z.infer<typeof unitInsertSchema>;
export type UnitUpdateModel = z.infer<typeof unitUpdateSchema>;
export type UnitOrderModel = z.infer<typeof unitOrderSchema>;
