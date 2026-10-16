import { turboPascal } from '@/app/fonts';
import ApiTokens from '@/app/[locale]/(routes)/profile/settings/api-tokens';
import DeleteUser from '@/app/[locale]/(routes)/profile/settings/delete-user';
import EditProfileForm from '@/app/[locale]/(routes)/profile/settings/edit-profile-form';
import { getQueryClient, trpc } from '@/server/api/query-client';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
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

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  // signed-out visitors are redirected by the page, so the empty name never shows
  const user = await publicCaller.auth.info();
  return getPageMetadata(parent, {
    path: '/profile/settings',
    title: t('profile.settings.title', { username: user?.username ?? '' }),
    description: t('profile.settings.description'),
    robots: { index: false, follow: false },
  });
}
