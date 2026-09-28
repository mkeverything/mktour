import Authorized from '@/app/(routes)/authorized';
import Unauthorized from '@/app/(routes)/unauthorized';
import Loading from '@/app/loading';
import { publicCaller } from '@/server/api';

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
