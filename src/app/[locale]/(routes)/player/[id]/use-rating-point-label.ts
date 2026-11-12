import { useFormatDate } from '@/components/hooks/use-format-date';
import { useTournamentTitle } from '@/components/hooks/use-tournament-fallback-title';
import type { RatingPoint } from '@/lib/rating-chart';
import { useTranslations } from 'next-intl';

/** names the moment a rating was published: its tournament and the date */
export const useRatingPointLabel = () => {
  const t = useTranslations('Player.Page');
  const formatDate = useFormatDate();
  const getTitle = useTournamentTitle();

  return ({ tournament, isStarting, publishedAt }: RatingPoint) => {
    // an untitled tournament is already named after its date
    if (tournament && !tournament.title) return getTitle(tournament);
    return [
      tournament?.title ?? (isStarting && t('starting')),
      formatDate(publishedAt, 'short'),
    ]
      .filter(Boolean)
      .join(' · ');
  };
};
