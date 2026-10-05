'use client';

import Center from '@/components/center';
import { useTranslations } from 'next-intl';

export default function FaqContent() {
  const t = useTranslations('Menu.Subs.Descriptions');
  return <Center>{t('FAQ')}</Center>;
}
