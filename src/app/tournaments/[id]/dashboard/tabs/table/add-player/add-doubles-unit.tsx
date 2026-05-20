import AddUnitDrawerContent from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-unit-drawer-content';
import PairPlayerCard, {
  PairPlayerCardPlayer,
} from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/pair-player-card';

import type { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddDoublesUnit } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-add-doubles-unit';
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
import { deriveTeamNickname } from '@/lib/tournament-dashboard';
import { newid } from '@/lib/utils';
import { PlayerWithUsernameModel } from '@/server/zod/players';
import {
  AddDoublesUnitModel,
  addDoublesUnitFormSchema,
} from '@/server/zod/tournaments';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';

type PairSlot = 'first' | 'second';

type PairPlayersState = {
  first: PairPlayerCardPlayer | null;
  second: PairPlayerCardPlayer | null;
};

export type DoublesUnitInitialValues = {
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

const AddDoublesUnit = ({
  handleClose,
  initialValues,
  submitLabel,
  onSubmitValues,
  isSubmitting,
}: Pick<DrawerProps, 'handleClose'> & {
  initialValues?: DoublesUnitInitialValues;
  submitLabel?: string;
  onSubmitValues?: (
    _values: AddDoublesUnitModel,
    _helpers: { reset: () => void },
  ) => void;
  isSubmitting?: boolean;
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Tournament.AddPlayer');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const addDoublesUnit = useTournamentAddDoublesUnit(tournamentId);
  const [activeSlot, setActiveSlot] = useState<PairSlot | null>(null);
  const [selectorValue, setSelectorValue] = useState('');
  const [selectorAddingNewPlayer, setSelectorAddingNewPlayer] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<PairPlayersState>({
    first: initialValues?.firstPlayer ?? null,
    second: initialValues?.secondPlayer ?? null,
  });

  const form = useForm<AddDoublesUnitModel>({
    resolver: zodResolver(addDoublesUnitFormSchema),
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

    if (selectedUnits[oppositeSlot]?.id === player.id) {
      form.setValue(oppositeField, '', {
        shouldDirty: true,
        shouldValidate: true,
      });
      setSelectedUnits((prev) => ({
        ...prev,
        [oppositeSlot]: null,
      }));
    }

    setSelectedUnits((prev) => ({
      ...prev,
      [slot]: toPairCardPlayer(player),
    }));

    const otherSlot = getOppositeSlot(slot);
    if (!selectedUnits[otherSlot]) {
      setActiveSlot(otherSlot);
      setSelectorValue('');
      setSelectorAddingNewPlayer(false);
    } else {
      closeSelector();
    }
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
    setSelectedUnits({
      first: initialValues?.firstPlayer ?? null,
      second: initialValues?.secondPlayer ?? null,
    });
    form.reset({
      nickname: initialValues?.nickname ?? '',
      firstPlayerId: initialValues?.firstPlayer.id ?? '',
      secondPlayerId: initialValues?.secondPlayer.id ?? '',
    });
  };

  const onSubmit = (values: AddDoublesUnitModel) => {
    const nickname =
      (values.nickname ?? '').trim() ||
      (selectedUnits.first && selectedUnits.second
        ? deriveTeamNickname(
            selectedUnits.first.nickname,
            selectedUnits.second.nickname,
          )
        : (values.nickname ?? ''));
    const payload = { ...values, nickname };

    if (onSubmitValues) {
      handleClose();
      onSubmitValues(payload, { reset: resetState });
      return;
    }

    form.reset({
      nickname: '',
      firstPlayerId: '',
      secondPlayerId: '',
    });
    setSelectedUnits({ first: null, second: null });
    setTimeout(() => form.setFocus('nickname'), 0);

    const addedAt = new Date();
    addDoublesUnit.mutate({
      tournamentId,
      ...payload,
      unitId: newid(),
      addedAt,
    });
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
              player={selectedUnits.first}
              placeholder={getSlotPlaceholder('first')}
              onClick={() => openSelector('first')}
            />
            <PairPlayerCard
              label={getSlotLabel('second')}
              player={selectedUnits.second}
              placeholder={getSlotPlaceholder('second')}
              onClick={() => openSelector('second')}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              (isSubmitting ?? addDoublesUnit.isPending) ||
              !selectedUnits.first ||
              !selectedUnits.second
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
        <h3 className="text-sm font-semibold">
          {activeSlot ? getSlotLabel(activeSlot) : ''}
        </h3>

        <AddUnitDrawerContent
          value={selectorValue}
          setValue={setSelectorValue}
          addingNewPlayer={selectorAddingNewPlayer}
          setAddingNewPlayer={setSelectorAddingNewPlayer}
          handleClose={closeSelector}
          onPlayerSelected={handlePlayerSelected}
          onPlayerCreated={handlePlayerCreated}
          showFakerButton={false}
          excludePlayerIds={[
            selectedUnits.first?.id,
            selectedUnits.second?.id,
          ].filter((id): id is string => id != null)}
        />
      </SideDrawer>
    </>
  );
};

export default AddDoublesUnit;
