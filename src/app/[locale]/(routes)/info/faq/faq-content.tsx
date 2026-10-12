'use client';

import Center from '@/components/center';
import { useTranslations } from 'next-intl';

export default function FaqContent() {
  const t = useTranslations('Menu.Subs.Descriptions');
  const tSeo = useTranslations('Seo');
  return (
    <Center>
      <h1 className="sr-only">{tSeo('faq.title')}</h1>
      {t('FAQ')}
    </Center>
  );
}
