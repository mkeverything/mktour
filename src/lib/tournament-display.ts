import { TournamentModel } from '@/server/db/zod/tournaments';

export const getTournamentDisplayName = (
  tournament: TournamentModel | null | undefined,
  t: (key: string) => string,
  format: {
    dateTime: (date: Date, options: { dateStyle?: 'short' }) => string;
  },
) => {
  if (!tournament) return '';

  if (tournament.title) return tournament.title;

  const formatText = t(tournament.format);
  const localizedDate = format.dateTime(new Date(tournament.date), {
    dateStyle: 'short',
  });

  return `${formatText} ${localizedDate}`;
};
