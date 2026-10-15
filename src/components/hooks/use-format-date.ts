import { formatDate } from '@/lib/local-date';
import { useLocale } from 'next-intl';

export const useFormatDate = () => {
  const locale = useLocale();

  return (date: Date | string, month: 'short' | 'long') =>
    formatDate(date, locale, month);
};
