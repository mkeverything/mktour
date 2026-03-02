'use client';

import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentDelete from '@/components/hooks/mutation-hooks/use-tournament-delete';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext, useState } from 'react';

export default function DeleteTournamentButton() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useTournamentDelete(
    queryClient,
    sendJsonMessage,
    setOpen,
  );
  const t = useTranslations('Tournament.Main');

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <div>
          <Button
            variant="destructive"
            size="icon-lg"
            className="max-md:hidden"
          >
            <CircleX />
          </Button>
          <Button variant="destructive" className="w-full md:hidden">
            <CircleX />
            {t('Delete.title')}
          </Button>
        </div>
      </Trigger>
      <Content>
        <Header>
          <Title>{t('Delete.confirmation header')}</Title>
          <Description className="text-balance">
            {t.rich('Delete.confirmation body')}
          </Description>
        </Header>
        <Button
          variant={'destructive'}
          className="w-full"
          onClick={() => {
            mutate({ tournamentId });
          }}
          disabled={isPending}
        >
          {isPending ? <LoadingSpinner /> : <CircleX />}
          {t('Delete.confirm')}
        </Button>
        <Close asChild>
          <Button className="w-full" variant="outline">
            {t('cancel')}
          </Button>
        </Close>
      </Content>
    </Root>
  );
}
