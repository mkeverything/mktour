import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const UserPage = async () => {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/user');
  redirect(`/user/${user.username}`);
};

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/profile`;
  const previous = await parent;

  return {
    title: t('profile.my.title'),
    description: t('profile.my.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('profile.my.title'),
      description: t('profile.my.description'),
      url,
    },
  };
}

export default UserPage;
