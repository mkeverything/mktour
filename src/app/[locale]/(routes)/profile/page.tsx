import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const UserPage = async () => {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/user');
  redirect(`/user/${user.username}`);
};

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/profile',
    title: t('profile.my.title'),
    description: t('profile.my.description'),
    robots: { index: false, follow: false },
  });
}

export default UserPage;
