import { TournamentModel } from '@/server/zod/tournaments';
import { useFormatter, useTranslations } from 'next-intl';

export const useTournamentFallbackTitle = (
  tournament: TournamentModel | null | undefined,
) => {
  const format = useFormatter();
  const t = useTranslations('MakeTournament');

  if (!tournament) return '';

  const formatText = t(tournament.format);
  const localizedDate = format.dateTime(new Date(tournament.date), {
    dateStyle: 'short',
  });

  return `${formatText} ${localizedDate}`;
};
