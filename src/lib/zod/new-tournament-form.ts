import {
  tournamentFormatEnum,
  tournamentTypeEnum,
} from '@/server/db/zod/enums';
import * as z from 'zod';

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 * This ensures consistent date comparison regardless of timezone
 */
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert Date object to YYYY-MM-DD string in local timezone
 * Avoids timezone shifts that occur with toISOString()
 */
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

export type NewTournamentFormType = z.infer<typeof newTournamentFormSchema>;
