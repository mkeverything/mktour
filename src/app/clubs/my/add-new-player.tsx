import { LoadingSpinner } from '@/app/loading';
import Fab from '@/components/fab';
import { usePlayerAddMutation } from '@/components/hooks/mutation-hooks/use-player-add';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useTRPC } from '@/components/trpc/client';
import SideDrawer from '@/components/ui-custom/side-drawer';
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
import { PlayerFormModel, playerFormSchema } from '@/server/db/zod/players';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';

const AddPlayerDrawer = () => {
  const [open, setOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useHotkeys(
    'shift+equal',
    (e) => {
      e.preventDefault();
      setOpen((prev) => !prev);
    },
    { enableOnFormTags: true },
  );
  useHotkeys(
    'control+shift+equal',
    (e) => {
      e.preventDefault();
      setOpen((prev) => !prev);
    },
    { enableOnFormTags: true },
  );

  const handleChange = (state: boolean) => {
    if (!isAnimating) {
      setOpen(state);
    }
  };

  return (
    <>
      <Fab
        container={open || isAnimating ? document.body : undefined}
        className={`${(open || isAnimating) && 'fixed z-100'}`}
        onClick={() => handleChange(!open)}
        icon={open ? X : UserPlus}
      />
      <SideDrawer
        open={open}
        setOpen={handleChange}
        setIsAnimating={setIsAnimating}
      >
        <AddNewPlayer />
      </SideDrawer>
    </>
  );
};

const AddNewPlayer = () => {
  const user = useAuth();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { mutate } = usePlayerAddMutation(queryClient);
  const t = useTranslations('Tournament.AddPlayer');

  const form = useForm<PlayerFormModel>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      nickname: '',
      rating: 1500,
      clubId: user.data?.selectedClub,
    },
    reValidateMode: 'onSubmit',
  });

  async function onSubmit(data: PlayerFormModel) {
    const validation = await queryClient.fetchQuery(
      trpc.auth.validatePlayerNickname.queryOptions({
        nickname: data.nickname,
        clubId: data.clubId,
      }),
    );
    if (!validation.valid) {
      form.setError('nickname', {
        type: 'manual',
        message: t('player exists error'),
      });
      return;
    }
    mutate(data, {
      onSuccess: () => {
        form.reset();
      },
    });
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
                  defaultValue={[value ?? 1500]}
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
          disabled={form.formState.isSubmitting || form.formState.isValidating}
        >
          {form.formState.isSubmitting || form.formState.isValidating ? (
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

export default AddPlayerDrawer;
