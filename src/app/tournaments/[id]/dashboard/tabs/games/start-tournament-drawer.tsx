'use client';

import {
  DashboardContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
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
  const { status } = useContext(DashboardContext);
  const { selectedGameId } = useContext(SelectedGameContext);
  const open = !startedAt && !!selectedGameId && status === 'organizer';

  return (
    <Root open={open}>
      <Content>
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
          <Button size="lg" variant="outline" className="col-span-2">
            <FormattedMessage id="Common.cancel" />
          </Button>
        </Close>
      </Content>
    </Root>
  );
};

export default StartTournamentDrawer;
