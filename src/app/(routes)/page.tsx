import Authorized from '@/app/(routes)/authorized';
import Unauthorized from '@/app/(routes)/unauthorized';
import Loading from '@/app/loading';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import type { Metadata } from 'next';

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

export const metadata: Metadata = {
  alternates: { canonical: BASE_URL || 'https://mktour.org' },
};
