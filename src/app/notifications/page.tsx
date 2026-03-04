import Loading from '@/app/loading';
import UserNotifications from '@/app/notifications/notifications';
import { getQueryClient, trpc } from '@/components/trpc/server';
import { BASE_URL } from '@/lib/config/urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
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

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/notifications`;
  const previous = await parent;

  return {
    title: t('notifications.title'),
    description: t('notifications.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('notifications.title'),
      description: t('notifications.description'),
      url,
    },
  };
}

export default Page;
