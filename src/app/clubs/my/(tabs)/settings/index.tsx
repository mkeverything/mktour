import ClubDelete from '@/app/clubs/my/(tabs)/settings/delete-club';
import ClubManagersList from '@/app/clubs/my/(tabs)/settings/managers';
import ClubSettingsForm from '@/app/clubs/my/(tabs)/settings/settings-form';
import { ClubTabProps } from '@/app/clubs/my/tabMap';
import { LoadingSpinner } from '@/app/loading';
import { useClubLeaveMutation } from '@/components/hooks/mutation-hooks/use-club-leave';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DoorOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';

export default function ClubSettings({ selectedClub, userId }: ClubTabProps) {
  const t = useTranslations('Club.Dashboard.Settings');
  const { mutate, isPending } = useClubLeaveMutation();
  const { isDesktop } = useContext(MediaQueryContext);

  const dangerZone = (
    <div className="flex flex-col gap-2">
      <label htmlFor="danger-zone">
        <h2 className="pb-mk pl-4 text-sm">{t('danger zone')}</h2>
      </label>
      <Card
        key="danger-zone"
        className={
          isDesktop
            ? 'border-destructive/40'
            : 'bg-background sm:bg-card border-none shadow-none sm:border-solid sm:shadow'
        }
      >
        <CardContent
          className={
            isDesktop
              ? 'flex flex-col gap-2 p-4 sm:flex-row sm:justify-end'
              : 'flex flex-col gap-2 max-sm:p-0 sm:py-8'
          }
        >
          <Button
            variant="destructive"
            className={isDesktop ? 'sm:w-48' : 'w-full'}
            onClick={() => mutate({ clubId: selectedClub })}
            disabled={isPending}
          >
            {isPending ? <LoadingSpinner /> : <DoorOpen />}
            {t('leave club')}
          </Button>
          <div className={isDesktop ? 'sm:w-48' : 'contents'}>
            <ClubDelete id={selectedClub} userId={userId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isDesktop)
    return (
      <div className="gap-mk-2 p-mk-2 flex min-h-full flex-col pt-0">
        <div className="gap-mk-2 grid auto-rows-min grid-cols-1 lg:grid-cols-2">
          <ClubSettingsForm selectedClub={selectedClub} userId={userId} />
          <ClubManagersList clubId={selectedClub} userId={userId} />
        </div>
        <div className="pt-mk-2 mt-auto">{dangerZone}</div>
      </div>
    );
  return (
    <div className="m-auto flex max-w-[min(640px,100%)] flex-col gap-8 pb-16">
      <ClubSettingsForm selectedClub={selectedClub} userId={userId} />
      <ClubManagersList clubId={selectedClub} userId={userId} />
      {dangerZone}
    </div>
  );
}
