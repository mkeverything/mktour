'use client';

import DeleteConfirmationForm from '@/app/[locale]/(routes)/clubs/my/(tabs)/settings/delete-form';
import { useClubManagers } from '@/components/hooks/query-hooks/use-club-managers';
import { useTRPC } from '@/components/trpc/client';
import * as ComboModal from '@/components/ui-custom/combo-modal';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { Button } from '@/components/ui/button';
import { useIsMutating } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function ClubDelete({ id, userId }: ClubDeleteProps) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('Club.Dashboard.Settings');
  const trpc = useTRPC();
  const mutating = useIsMutating();
  const deleting = useIsMutating({
    mutationKey: trpc.club.delete.mutationKey(),
  });
  const { data: managers } = useClubManagers(id);
  const authStatus = managers?.find((admin) => admin.userId === userId)?.status;
  if (!authStatus || authStatus !== 'co-owner') return null;
  const isThereOtherCoOwner = managers?.some(
    (admin) => admin.status === 'co-owner' && admin.userId !== userId,
  );
  if (isThereOtherCoOwner) return null;

  return (
    <ComboModal.Root open={open} onOpenChange={setOpen}>
      <ComboModal.Trigger asChild>
        <Button
          variant="destructive"
          className="w-full md:w-48"
          disabled={mutating !== 0}
        >
          {deleting !== 0 ? <LoadingSpinner /> : <Trash2 />}
          {t('delete club')}
        </Button>
      </ComboModal.Trigger>
      <ComboModal.Content>
        <ComboModal.Header>
          <ComboModal.Title>{t('confirmation title')}</ComboModal.Title>
          <ComboModal.Description>
            {t('confirmation body')}
          </ComboModal.Description>
        </ComboModal.Header>
        <DeleteConfirmationForm id={id} setOpenAction={setOpen} />
        <ComboModal.Close asChild>
          <Button variant="outline" className="w-full">
            {t('cancel')}
          </Button>
        </ComboModal.Close>
      </ComboModal.Content>
    </ComboModal.Root>
  );
}

interface ClubDeleteProps {
  className?: string;
  id: string;
  userId: string;
}
