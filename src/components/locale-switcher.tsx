import { LoadingSpinner } from '@/app/[locale]/(routes)/loading';
import { Button } from '@/components/ui/button';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/locales';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const LocaleSwitcher = () => {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const handleClickLocale = () => {
    const nextLocale = locale === 'en' ? 'ru' : 'en';
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    // refresh also drops prefetches in the old locale; on /{locale}/... urls
    // the proxy redirects visitors with a saved choice to the unprefixed url
    startTransition(() => router.refresh());
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClickLocale}>
      {pending ? (
        <LoadingSpinner />
      ) : (
        <span>{locale === 'en' ? 'en' : 'рус'}</span>
      )}
    </Button>
  );
};

export default LocaleSwitcher;
