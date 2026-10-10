import MaintenanceScreen, {
  Countdown,
} from '@/app/[locale]/maintenance/maintenance-screen';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Maintenance');

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function MaintenancePage(props: { searchParams: SearchParams }) {
  return (
    <MaintenanceScreen>
      <Suspense>
        <EndsAt searchParams={props.searchParams} />
      </Suspense>
    </MaintenanceScreen>
  );
}

async function EndsAt(props: { searchParams: SearchParams }) {
  const { endsAt } = await props.searchParams;
  if (typeof endsAt !== 'string') return null;

  const date = new Date(endsAt);
  return isNaN(date.getTime()) ? null : <Countdown endsAt={date} />;
}
