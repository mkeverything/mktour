import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddDoublesUnit, {
  type DoublesUnitInitialValues,
} from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-doubles-unit';
import PairPlayerCard from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/pair-player-card';
import {
  DeleteButton,
  WithdrawButtonWithConfirmation,
} from '@/app/tournaments/[id]/dashboard/tabs/table/destructive-buttons';
import FormattedMessage from '@/components/formatted-message';
import { useTournamentEditDoublesUnit } from '@/components/hooks/mutation-hooks/use-tournament-edit-doubles-unit';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
} from '@/components/ui-custom/combo-modal';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { playerPublicProfileHref } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';
import { TournamentFormat } from '@/server/zod/enums';
import { Pencil, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FC, useContext, useState } from 'react';

const UnitDrawer: FC<{
  unit: UnitModel;
  setSelectedUnit: (_arg: null) => void;
  handleDelete: () => void;
  handleWithdraw: () => void;
  hasEnded: boolean;
  hasStarted: boolean;
  format: TournamentFormat;
}> = ({
  unit,
  setSelectedUnit,
  hasEnded,
  hasStarted,
  handleDelete,
  handleWithdraw,
  format,
}) => {
  const open = !!unit;
  const { status, sendJsonMessage } = useContext(DashboardContext);
  const t = useTranslations('Tournament.AddPlayer');
  const { id: tournamentId } = useParams<{ id: string }>();
  const editDoublesUnit = useTournamentEditDoublesUnit(
    tournamentId,
    sendJsonMessage,
  );
  const isDoublesUnit = unit.players.length === 2;
  const [isEditingUnit, setIsEditingUnit] = useState(false);

  const closeDrawer = () => setSelectedUnit(null);
  const comboOpen = open && !isEditingUnit;
  const canEditUnit =
    status === 'organizer' && !hasStarted && !hasEnded && isDoublesUnit;
  const editInitialValues: DoublesUnitInitialValues | null =
    unit.players.length === 2
      ? {
          nickname: unit.unitNickname,
          firstPlayer: unit.players[0],
          secondPlayer: unit.players[1],
        }
      : null;

  return (
    <Root
      open={comboOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isEditingUnit) closeDrawer();
      }}
    >
      <Content>
        <Header>
          <div className="flex items-center justify-start gap-4">
            <Title className="flex items-baseline gap-2">
              {unit.unitNickname}
              {!isDoublesUnit && unit.players[0]?.rating != null && (
                <span className="text-muted-foreground text-sm font-normal">
                  {unit.players[0].rating}
                </span>
              )}
            </Title>
            {canEditUnit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingUnit(true)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
          <Description>
            {unit.players.map((member) => member.nickname).join(', ')}
          </Description>
        </Header>
        <>
          {isDoublesUnit ? (
            <>
              <div className="space-y-2">
                {unit.players.map((player, index) => (
                  <PairPlayerCard
                    key={player.id}
                    player={player}
                    label={`#${index + 1}`}
                    href={playerPublicProfileHref(player)}
                  />
                ))}
              </div>
            </>
          ) : (
            <Button className="flex w-full gap-2" size="lg" asChild>
              <Link href={playerPublicProfileHref(unit.players[0]!)}>
                <UserRound />
                <FormattedMessage id="Tournament.Table.Player.profile" />
              </Link>
            </Button>
          )}

          {status === 'organizer' && (
            <DestructiveButton
              hasEnded={hasEnded}
              hasStarted={hasStarted}
              unit={unit}
              format={format}
              handleDelete={handleDelete}
              handleWithdraw={handleWithdraw}
              closeDrawer={closeDrawer}
            />
          )}

          <Close asChild>
            <Button size="lg" variant="outline">
              <FormattedMessage id="Common.close" />
            </Button>
          </Close>
        </>
      </Content>

      {canEditUnit && editInitialValues && (
        <SideDrawer
          open={isEditingUnit}
          setOpen={(nextOpen) => {
            setIsEditingUnit(nextOpen);
            if (!nextOpen) {
              closeDrawer();
            }
          }}
        >
          <AddDoublesUnit
            handleClose={() => setIsEditingUnit(false)}
            initialValues={editInitialValues}
            submitLabel={t('save')}
            isSubmitting={editDoublesUnit.isPending}
            onSubmitValues={(values) => {
              setIsEditingUnit(false);
              closeDrawer();
              editDoublesUnit.mutate({
                tournamentId,
                currentUnitPlayerId: unit.id,
                ...values,
              });
            }}
          />
        </SideDrawer>
      )}
    </Root>
  );
};

const DestructiveButton = ({
  hasEnded,
  hasStarted,
  handleDelete,
  handleWithdraw,
  closeDrawer,
  unit,
  format,
}: {
  hasEnded: boolean;
  hasStarted: boolean;
  handleDelete: () => void;
  handleWithdraw: () => void;
  closeDrawer: () => void;
  unit: UnitModel;
  format: TournamentFormat;
}) => {
  if (hasEnded) return null;
  if (hasStarted && format === 'swiss' && !unit.isOut) {
    return (
      <WithdrawButtonWithConfirmation
        selectedUnit={unit}
        handleWithdraw={() => {
          closeDrawer();
          handleWithdraw();
        }}
      />
    );
  }
  if (hasStarted) return null;
  return (
    <DeleteButton
      handleDelete={() => {
        closeDrawer();
        handleDelete();
      }}
    />
  );
};

export default UnitDrawer;
