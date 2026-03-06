import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPlayerDrawerContent from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-player-drawer-content';
import PairPlayerCard, {
  PairPlayerCardPlayer,
} from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/pair-player-card';

import type { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddPairTeam } from '@/components/hooks/mutation-hooks/use-tournament-add-pair-team';
import { useTRPC } from '@/components/trpc/client';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PlayerWithUsernameModel } from '@/server/zod/players';
import {
  AddDoublesTeamModel,
  addDoublesTeamSchema,
} from '@/server/zod/tournaments';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';

type PairSlot = 'first' | 'second';

type PairPlayersState = {
  first: PairPlayerCardPlayer | null;
  second: PairPlayerCardPlayer | null;
};

export type PairTeamInitialValues = {
  nickname: string;
  firstPlayer: PairPlayerCardPlayer;
  secondPlayer: PairPlayerCardPlayer;
};

const toPairCardPlayer = (
  player: Pick<
    PlayerWithUsernameModel,
    'id' | 'nickname' | 'rating' | 'username'
  >,
): PairPlayerCardPlayer => ({
  id: player.id,
  nickname: player.nickname,
  rating: player.rating,
  username: player.username,
});

const AddPairTeam = ({
  handleClose,
  initialValues,
  submitLabel,
  onSubmitValues,
  isSubmitting,
}: Pick<DrawerProps, 'handleClose'> & {
  initialValues?: PairTeamInitialValues;
  submitLabel?: string;
  onSubmitValues?: (
    _values: AddDoublesTeamModel,
    _helpers: { reset: () => void },
  ) => void;
  isSubmitting?: boolean;
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Tournament.AddPlayer');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const addPairTeam = useTournamentAddPairTeam(
    tournamentId,
    queryClient,
    sendJsonMessage,
  );
  const [activeSlot, setActiveSlot] = useState<PairSlot | null>(null);
  const [selectorValue, setSelectorValue] = useState('');
  const [selectorAddingNewPlayer, setSelectorAddingNewPlayer] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<PairPlayersState>({
    first: initialValues?.firstPlayer ?? null,
    second: initialValues?.secondPlayer ?? null,
  });

  const form = useForm<AddDoublesTeamModel>({
    resolver: zodResolver(addDoublesTeamSchema),
    defaultValues: {
      nickname: initialValues?.nickname ?? '',
      firstPlayerId: initialValues?.firstPlayer.id ?? '',
      secondPlayerId: initialValues?.secondPlayer.id ?? '',
    },
  });

  const getSlotLabel = (slot: PairSlot) =>
    slot === 'first' ? t('first player') : t('second player');
  const getSlotPlaceholder = (slot: PairSlot) =>
    slot === 'first' ? t('select first player') : t('select second player');
  const getSlotField = (slot: PairSlot) =>
    slot === 'first' ? 'firstPlayerId' : 'secondPlayerId';
  const getOppositeSlot = (slot: PairSlot): PairSlot =>
    slot === 'first' ? 'second' : 'first';

  const openSelector = (slot: PairSlot) => {
    setActiveSlot(slot);
    setSelectorValue('');
    setSelectorAddingNewPlayer(false);
  };

  const closeSelector = () => {
    setActiveSlot(null);
    setSelectorValue('');
    setSelectorAddingNewPlayer(false);
  };

  useHotkeys(
    'escape',
    () => {
      if (activeSlot) {
        closeSelector();
        return;
      }
      handleClose();
    },
    { enableOnFormTags: true },
    [activeSlot, handleClose],
  );

  const applySelectedPlayer = (
    slot: PairSlot,
    player: PlayerWithUsernameModel,
  ) => {
    const oppositeSlot = getOppositeSlot(slot);
    const oppositeField = getSlotField(oppositeSlot);
    const slotField = getSlotField(slot);

    form.setValue(slotField, player.id, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (selectedPlayers[oppositeSlot]?.id === player.id) {
      form.setValue(oppositeField, '', {
        shouldDirty: true,
        shouldValidate: true,
      });
      setSelectedPlayers((prev) => ({
        ...prev,
        [oppositeSlot]: null,
      }));
    }

    setSelectedPlayers((prev) => ({
      ...prev,
      [slot]: toPairCardPlayer(player),
    }));
    closeSelector();
  };

  const handlePlayerSelected = (player: PlayerWithUsernameModel) => {
    if (!activeSlot) return;
    applySelectedPlayer(activeSlot, player);
  };

  const handlePlayerCreated = (player: PlayerWithUsernameModel) => {
    queryClient.setQueryData(
      trpc.tournament.playersOut.queryKey({ tournamentId }),
      (cache: PlayerWithUsernameModel[] | undefined) => {
        if (!cache) return [player];
        if (cache.some((each) => each.id === player.id)) return cache;
        return [player, ...cache];
      },
    );
    handlePlayerSelected(player);
  };

  const resetState = () => {
    setSelectedPlayers({
      first: initialValues?.firstPlayer ?? null,
      second: initialValues?.secondPlayer ?? null,
    });
    form.reset({
      nickname: initialValues?.nickname ?? '',
      firstPlayerId: initialValues?.firstPlayer.id ?? '',
      secondPlayerId: initialValues?.secondPlayer.id ?? '',
    });
  };

  const onSubmit = (values: AddDoublesTeamModel) => {
    if (onSubmitValues) {
      handleClose();
      onSubmitValues(values, { reset: resetState });
      return;
    }

    addPairTeam.mutate(
      {
        tournamentId,
        ...values,
      },
      {
        onSuccess: () => {
          form.reset({
            nickname: '',
            firstPlayerId: '',
            secondPlayerId: '',
          });
          form.setFocus('nickname');
          setSelectedPlayers({ first: null, second: null });
        },
      },
    );
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="h-svh space-y-5"
        >
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('team nickname')}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <PairPlayerCard
              label={getSlotLabel('first')}
              player={selectedPlayers.first}
              placeholder={getSlotPlaceholder('first')}
              onClick={() => openSelector('first')}
            />
            <PairPlayerCard
              label={getSlotLabel('second')}
              player={selectedPlayers.second}
              placeholder={getSlotPlaceholder('second')}
              onClick={() => openSelector('second')}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              (isSubmitting ?? addPairTeam.isPending) ||
              !selectedPlayers.first ||
              !selectedPlayers.second
            }
          >
            <Save />
            {submitLabel ?? t('create team')}
          </Button>
        </form>
      </Form>

      <SideDrawer
        open={activeSlot !== null}
        setOpen={(open) => {
          if (!open) closeSelector();
        }}
      >
        <p className="text-muted-foreground text-sm">
          {activeSlot ? getSlotLabel(activeSlot) : ''}
        </p>

        <AddPlayerDrawerContent
          value={selectorValue}
          setValue={setSelectorValue}
          addingNewPlayer={selectorAddingNewPlayer}
          setAddingNewPlayer={setSelectorAddingNewPlayer}
          handleClose={closeSelector}
          onPlayerSelected={handlePlayerSelected}
          onPlayerCreated={handlePlayerCreated}
          showFakerButton={false}
        />
      </SideDrawer>
    </>
  );
};

export default AddPairTeam;
