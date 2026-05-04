import type { ClassValue } from 'clsx';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// import { Link } from 'next-view-transitions';

type MakeTournamentButtonProps = {
  className?: ClassValue;
};

export default async function MakeTournamentButton({
  className,
}: MakeTournamentButtonProps) {
  const t = await getTranslations();
  return (
    <Button
      className={cn(
        'm-auto flex h-28 min-h-28 w-full max-w-md flex-col gap-2 font-bold',
        className,
      )}
      variant="default"
      asChild
    >
      <Link href="/tournaments/create" className="m-auto w-full">
        <span className="text-2xl font-light min-[320px]:text-3xl">
          {t('Home.make tournament')}
        </span>
      </Link>
    </Button>
  );
}
