'use client';

import { ClubTabProps } from '@/app/[locale]/(routes)/clubs/my/tabMap';
import { InfoItem } from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/main';
import Empty from '@/components/empty';
import { useClubInfo } from '@/components/hooks/query-hooks/use-club-info';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BriefcaseBusiness, CalendarDays, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const ClubMain: FC<ClubTabProps> = ({ selectedClub }) => {
  const { data: club, isPending } = useClubInfo(selectedClub);
  const locale = useLocale();
  const t = useTranslations('Club');

  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (!club) return <Empty />;

  return (
    <HalfCard>
      <div className="gap-mk p-mk-2 flex">
        <div className="items-left m-auto flex grow flex-col gap-4">
          {club.description && (
            <InfoItem icon={Info} value={club.description} />
          )}
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <CalendarDays className="size-4" />
            {club.createdAt &&
              t('Page.createdAt', {
                date: club.createdAt.toLocaleDateString(locale, {
                  dateStyle: 'long',
                }),
              })}
          </div>
        </div>
        <Link href={`/clubs/${club.id}`}>
          <Button variant="outline">
            <BriefcaseBusiness />
            <span className="text-sm max-sm:hidden">{t('page')}</span>
          </Button>
        </Link>
      </div>
    </HalfCard>
  );
};

export default ClubMain;
