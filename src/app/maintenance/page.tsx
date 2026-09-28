import MaintenanceCard, {
  ExpectedBack,
} from '@/app/maintenance/maintenance-card';
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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <MaintenanceCard>
        <Suspense>
          <EndsAt searchParams={props.searchParams} />
        </Suspense>
      </MaintenanceCard>
    </main>
  );
}

async function EndsAt(props: { searchParams: SearchParams }) {
  const { endsAt } = await props.searchParams;
  if (typeof endsAt !== 'string') return null;

  const date = new Date(endsAt);
  return isNaN(date.getTime()) ? null : <ExpectedBack endsAt={date} />;
}
