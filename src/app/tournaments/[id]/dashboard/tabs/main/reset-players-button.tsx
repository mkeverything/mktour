'use client';

import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentResetPlayers from '@/components/hooks/mutation-hooks/use-tournament-reset-players';
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
import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext, useState } from 'react';

export default function ResetTournamentPButton() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { sendJsonMessage, setRoundInView } = useContext(DashboardContext);
  const { mutate, isPending } = useTournamentResetPlayers(
    queryClient,
    sendJsonMessage,
    setRoundInView,
  );
  const [open, setOpen] = useState(false);
  const t = useTranslations('Tournament.Main');

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <div>
          <Button variant="outline" className="w-full">
            <RotateCcw />
            {t('reset players')}
          </Button>
        </div>
      </Trigger>
      <Content>
        <Header>
          <Title>{t('confirmation header')}</Title>
          <Description>{t.rich('confirmation body')}</Description>
        </Header>
        <Button
          variant={'destructive'}
          className="w-full"
          onClick={() => mutate({ tournamentId })}
          disabled={isPending}
        >
          {isPending ? <LoadingSpinner /> : <RotateCcw />}
          {t('reset players')}
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
