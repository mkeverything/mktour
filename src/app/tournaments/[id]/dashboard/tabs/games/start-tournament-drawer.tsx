'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import StartTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/start-tournament-button';
import FormattedMessage from '@/components/formatted-message';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { FC, useContext } from 'react';

const StartTournamentDrawer: FC<{
  startedAt: number | undefined;
}> = ({ startedAt }) => {
  const { selectedGameId, status } = useContext(DashboardContext);
  const open = !startedAt && !!selectedGameId && status === 'organizer';

  return (
    <Root open={open}>
      <Content className="z-10000">
        <Header>
          <Title>
            <FormattedMessage id="Tournament.Round.start tournament.title" />
          </Title>
          <Description>
            <FormattedMessage id="Tournament.Round.start tournament.description" />
          </Description>
        </Header>
        <StartTournamentButton />
        <Close asChild>
          <Button size="lg" variant="outline">
            <FormattedMessage id="Common.cancel" />
          </Button>
        </Close>
      </Content>
    </Root>
  );
};

export default StartTournamentDrawer;
