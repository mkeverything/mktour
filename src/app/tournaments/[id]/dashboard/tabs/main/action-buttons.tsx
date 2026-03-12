import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import DeleteTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/delete-tournament-button';
import ResetTournamentPButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-players-button';
import ResetTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-tournament-button';
import StartTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/start-tournament-button';
import ComboModal from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { TournamentAuthStatus } from '@/server/zod/enums';
import { TournamentModel } from '@/server/zod/tournaments';
import { MoreVertical } from 'lucide-react';
import { FC } from 'react';

export const DestructiveTournamentButtons: FC<{
  tournament: TournamentModel;
}> = ({ tournament }) => {
  const { closedAt, startedAt } = tournament;

  if (closedAt) {
    return (
      <>
        <ResetTournamentButton />
        <DeleteTournamentButton />
      </>
    );
  }

  if (startedAt) {
    return <ResetTournamentButton />;
  }

  return (
    <>
      <DeleteTournamentButton />
      <ResetTournamentPButton />
    </>
  );
};

export const DestructiveTournamentButtonsComboModal: FC<{
  tournament: TournamentModel;
  className?: string;
}> = ({ tournament, className }) => {
  return (
    <ComboModal.Root>
      <ComboModal.Trigger className={className} asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="tournament destructive actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </ComboModal.Trigger>
      <ComboModal.Content>
        <DialogTitle className="hidden" />
        <div className="flex flex-col gap-1 p-1">
          <DestructiveTournamentButtons tournament={tournament} />
        </div>
      </ComboModal.Content>
    </ComboModal.Root>
  );
};

const ActionButtonsRoot: FC<{
  status: TournamentAuthStatus;
  tournament: TournamentModel;
}> = ({ status, tournament }) => {
  if (status !== 'organizer') return null;

  const { closedAt, roundsNumber, ongoingRound, startedAt } = tournament;

  if (closedAt) {
    return null;
  }

  if (startedAt && roundsNumber === ongoingRound) {
    return <FinishTournamentButton lastRoundNumber={roundsNumber} />;
  }

  if (!startedAt) {
    return <StartTournamentButton />;
  }

  return null;
};

const ActionButtons: FC<{
  status: TournamentAuthStatus;
  tournament: TournamentModel;
}> = (props) => (
  <div className="flex flex-col gap-2 px-2 max-md:w-full md:max-w-md md:flex-row md:items-center">
    <ActionButtonsRoot {...props} />
  </div>
);

export default ActionButtons;
