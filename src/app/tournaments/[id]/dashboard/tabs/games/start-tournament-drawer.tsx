'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import StartTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/start-tournament-button';
import FormattedMessage from '@/components/formatted-message';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { FC, useContext } from 'react';

const StartTournamentDrawer: FC<{
  startedAt: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ startedAt, open, onOpenChange }) => {
  const { status } = useContext(DashboardContext);
  const { isMobile } = useContext(MediaQueryContext);
  const visible = !startedAt && open && status === 'organizer';

  const body = (
    <>
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
    </>
  );

  return (
    <Root open={visible} onOpenChange={onOpenChange}>
      {isMobile ? (
        <Content>{body}</Content>
      ) : (
        <DialogPortal container={document.fullscreenElement ?? document.body}>
          <DialogOverlay />
          <DialogPrimitive.Content
            className={cn(
              'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 gap-mk fixed top-[50%] left-[50%] z-100 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
            )}
          >
            {body}
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </Root>
  );
};

export default StartTournamentDrawer;
