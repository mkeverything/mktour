import { TournamentModel } from '@/server/zod/tournaments';
import { useFormatDate } from '@/components/hooks/use-format-date';
import { useTranslations } from 'next-intl';

/** reads a tournament's title, falling back to its format and date when it has none */
export const useTournamentTitle = () => {
  const formatDate = useFormatDate();
  const t = useTranslations('MakeTournament');

  return ({
    title,
    format,
    date,
  }: Pick<TournamentModel, 'title' | 'format' | 'date'>) =>
    title || `${t(format)} ${formatDate(date, 'short')}`;
};

export const useTournamentFallbackTitle = (
  tournament: TournamentModel | null | undefined,
) => {
  const getTitle = useTournamentTitle();

  return tournament ? getTitle({ ...tournament, title: null }) : '';
};
