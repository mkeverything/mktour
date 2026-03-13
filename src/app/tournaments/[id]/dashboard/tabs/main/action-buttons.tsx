import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import DeleteTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/delete-tournament-button';
import ResetTournamentPButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-players-button';
import ResetTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-tournament-button';
import StartTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/start-tournament-button';
import ComboModal from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { TournamentModel } from '@/server/zod/tournaments';
import { MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Tournament.Main');
  return (
    <ComboModal.Root>
      <ComboModal.Trigger className={className} asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="tournament settings"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </ComboModal.Trigger>
      <ComboModal.Content>
        <ComboModal.Header>
          <ComboModal.Title>{t('settings')}</ComboModal.Title>
        </ComboModal.Header>
        <div className="flex flex-col gap-1 pt-4">
          <DestructiveTournamentButtons tournament={tournament} />
        </div>
      </ComboModal.Content>
    </ComboModal.Root>
  );
};

const ActionButtonsRoot: FC<{
  tournament: TournamentModel;
}> = ({ tournament }) => {
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
  tournament: TournamentModel;
}> = (props) => (
  <div className="flex flex-col gap-2 max-md:w-full md:max-w-md md:flex-row md:items-center md:px-2">
    <ActionButtonsRoot {...props} />
  </div>
);

export default ActionButtons;
