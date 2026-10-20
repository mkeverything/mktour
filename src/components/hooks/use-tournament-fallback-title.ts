import { TournamentModel } from '@/server/zod/tournaments';
import { useFormatDate } from '@/components/hooks/use-format-date';
import { useTranslations } from 'next-intl';

export const useTournamentFallbackTitle = (
  tournament: TournamentModel | null | undefined,
) => {
  const formatDate = useFormatDate();
  const t = useTranslations('MakeTournament');

  if (!tournament) return '';

  const formatText = t(tournament.format);
  return `${formatText} ${formatDate(tournament.date, 'short')}`;
};
