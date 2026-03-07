import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddNewPlayer } from '@/components/hooks/mutation-hooks/use-tournament-add-new-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { newid } from '@/lib/utils';
import {
  PlayerFormModel,
  playerFormSchema,
  PlayerWithUsernameModel,
} from '@/server/zod/players';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';

const AddNewPlayer = ({
  value,
  setValue,
  returnToNewPlayer,
  handleClose,
  onPlayerCreated,
}: AddNewPlayerProps) => {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournamentInfo(id);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const createPlayer = useMutation(trpc.player.create.mutationOptions());
  const { sendJsonMessage } = useContext(DashboardContext);
  const { mutate, isPending } = useTournamentAddNewPlayer(
    id,
    queryClient,
    sendJsonMessage,
    returnToNewPlayer,
  );
  const t = useTranslations('Tournament.AddPlayer');
  useHotkeys('escape', handleClose, { enableOnFormTags: true });

  const getDefaultValues = (nickname: string): PlayerFormModel => ({
    nickname,
    rating: 1500,
    clubId: tournament.data?.club?.id ?? '',
  });

  const form = useForm<PlayerFormModel>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: getDefaultValues(value),
    reValidateMode: 'onSubmit',
  });

  const nickname = form.watch('nickname');

  useEffect(() => {
    if (nickname === undefined) return;
    setValue(nickname);
  }, [nickname, setValue]);

  useEffect(() => {
    const clubId = tournament.data?.club?.id;
    if (!clubId) return;
    form.setValue('clubId', clubId, { shouldDirty: false });
  }, [form, tournament.data?.club?.id]);

  async function onSubmit(player: PlayerFormModel) {
    const validation = await queryClient.fetchQuery(
      trpc.auth.validatePlayerNickname.queryOptions({
        nickname: player.nickname,
        clubId: player.clubId,
      }),
    );
    if (!validation.valid) {
      form.setError('nickname', {
        type: 'manual',
        message: t('player exists error'),
      });
      return;
    }

    if (onPlayerCreated) {
      createPlayer.mutate(player, {
        onSuccess: (createdPlayer) => {
          const createdPlayerWithUsername: PlayerWithUsernameModel = {
            ...createdPlayer,
            username: null,
          };
          setValue('');
          form.reset();
          form.setFocus('nickname');
          onPlayerCreated(createdPlayerWithUsername);
          toast.success(t('player added', { name: createdPlayer.nickname }));
        },
      });
      return;
    }

    const playerWithId = { ...player, id: newid() };
    const addedAt = new Date();
    setValue('');
    form.reset(getDefaultValues(''), { keepDefaultValues: true });
    form.setFocus('nickname');
    mutate(
      { tournamentId: id, player: playerWithId, addedAt },
      {
        onError: () => {
          form.reset(player, { keepDefaultValues: true });
          form.setFocus('nickname');
        },
        onSuccess: () => {
          toast.success(t('player added', { name: player.nickname }));
        },
      },
    );
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-svh space-y-8">
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="drop-shadow-md"
                  placeholder={t('name')}
                  {...field}
                  autoComplete="off"
                  autoFocus
                  onKeyUp={() => {
                    form.clearErrors();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rating"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <legend>
                {t('estimated rating')}: {value}
              </legend>
              <FormControl>
                <Slider
                  data-vaul-no-drag
                  step={50}
                  min={0}
                  max={3000}
                  className="w-full"
                  value={[value ?? 1500]}
                  onValueChange={(vals) => {
                    onChange(vals[0]);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={
            form.formState.isSubmitting ||
            form.formState.isValidating ||
            isPending
          }
        >
          {form.formState.isSubmitting ||
          form.formState.isValidating ||
          isPending ? (
            <>
              <LoadingSpinner />
              {t('save')}
            </>
          ) : (
            <>
              <Save />
              {t('save')}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

interface AddNewPlayerProps extends DrawerProps {
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void;
  handleClose: () => void;
  onPlayerCreated?: (_player: PlayerWithUsernameModel) => void;
}

export default AddNewPlayer;
