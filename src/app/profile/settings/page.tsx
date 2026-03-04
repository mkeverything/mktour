import { turboPascal } from '@/app/fonts';
import ApiTokens from '@/app/profile/settings/api-tokens';
import DeleteUser from '@/app/profile/settings/delete-user';
import EditProfileForm from '@/app/profile/settings/edit-profile-form';
import { getQueryClient, trpc } from '@/components/trpc/server';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function EditUserPage() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in/?from=/user/edit');
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.auth.info.queryOptions());

  const t = await getTranslations('UserSettings');
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h2
        className={`m-2 text-center text-4xl font-bold ${turboPascal.className}`}
      >
        {t('header')}
      </h2>
      <div className="mx-auto flex max-w-[min(600px,98%)] flex-col gap-6">
        <EditProfileForm />
        <ApiTokens />
        <DeleteUser userId={user.id} />
      </div>
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/profile/settings`;
  const previous = await parent;

  return {
    title: t('profile.settings.title'),
    description: t('profile.settings.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('profile.settings.title'),
      description: t('profile.settings.description'),
      url,
    },
  };
}
