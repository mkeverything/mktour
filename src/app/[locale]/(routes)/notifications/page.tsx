import Loading from '@/app/[locale]/(routes)/loading';
import UserNotifications from '@/app/[locale]/(routes)/notifications/notifications';
import { getQueryClient, trpc } from '@/server/api/query-client';
import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { connection } from 'next/server';
import { Suspense } from 'react';

const InboxPage = async () => {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: trpc.auth.notifications.infinite.queryKey(),
  });

  return <UserNotifications />;
};

const Page = async () => {
  return (
    <Suspense fallback={<Loading />}>
      <InboxPage />
    </Suspense>
  );
};

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/notifications',
    title: t('notifications.title'),
    description: t('notifications.description'),
    robots: { index: false, follow: false },
  });
}

export default Page;
