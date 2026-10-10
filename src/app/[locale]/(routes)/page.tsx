import Authorized from '@/app/[locale]/(routes)/authorized';
import Unauthorized from '@/app/[locale]/(routes)/unauthorized';
import Loading from '@/app/[locale]/(routes)/loading';
import { getPageUrls } from '@/lib/page-urls';
import { publicCaller } from '@/server/api';
import type { Metadata, ResolvingMetadata } from 'next';

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

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { url, alternates } = await getPageUrls('/');
  const previous = await parent;

  return {
    alternates,
    openGraph: { ...previous.openGraph, url },
  };
}
