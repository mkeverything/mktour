'use client';

import DeleteUserForm from '@/app/profile/settings/delete-user-form';
import RichText from '@/components/rich-text';
import ComboModal, {
  Close,
  Content,
  Header,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function DeleteUser({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('UserSettings');
  return (
    <div className="flex flex-col gap-4">
      <h2 className="pl-4">{t('danger zone')}</h2>
      <HalfCard className="w-full">
        <CardContent className="p-mk flex flex-col gap-4 sm:p-8">
          <ComboModal.Root open={open} onOpenChange={setOpen}>
            <Trigger asChild>
              <Button variant="destructive">{t('delete profile')}</Button>
            </Trigger>
            <Content>
              <Header>
                <Title>{t('confirmation header')}</Title>
                <div className="text-muted-foreground text-sm">
                  <RichText>
                    {(tags) => t.rich('confirmation body', tags)}
                  </RichText>
                </div>
              </Header>
              <DeleteUserForm userId={userId} setOpen={setOpen} />
              <Close asChild>
                <Button variant="outline">{t('cancel')}</Button>
              </Close>
            </Content>
          </ComboModal.Root>
        </CardContent>
      </HalfCard>
    </div>
  );
}
