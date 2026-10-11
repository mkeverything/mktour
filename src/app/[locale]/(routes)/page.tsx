import Authorized from '@/app/[locale]/(routes)/authorized';
import Unauthorized from '@/app/[locale]/(routes)/unauthorized';
import Loading from '@/app/[locale]/(routes)/loading';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';

import '@/styles/cursor.css';
import { Suspense } from 'react';

async function HomeContent() {
  const user = await publicCaller.auth.info();

  if (!user) {
    return <Unauthorized />;
  }

  return <Authorized />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/',
    title: { absolute: t('homepage.title') },
    description: t('homepage.description'),
  });
}
