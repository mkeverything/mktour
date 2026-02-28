import { LoadingSpinner } from '@/app/loading';
import DeletePlayer from '@/app/player/[id]/delete-button';
import FormattedMessage from '@/components/formatted-message';
import useEditPlayerMutation from '@/components/hooks/mutation-hooks/use-player-edit';
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
import { StatusInClub } from '@/server/db/zod/enums';
import { PlayerEditModel } from '@/server/db/zod/players';
import { Save } from 'lucide-react';
import { MessageKeys, NestedKeyOf } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dispatch, FC, SetStateAction } from 'react';
import { ControllerRenderProps, useForm, UseFormReturn } from 'react-hook-form';

const EditPlayerForm: FC<{
  clubId: string;
  player: PlayerEditModel;
  status: StatusInClub | null | undefined;
  setOpen: Dispatch<SetStateAction<boolean>>;
  canEditRealname?: boolean;
}> = ({
  player: { id, nickname, realname },
  clubId,
  status,
  setOpen,
  canEditRealname = true,
}) => {
  const editPlayerMutation = useEditPlayerMutation();
  const router = useRouter();
  const form = useForm<PlayerEditModel>({
    defaultValues: {
      id,
      nickname,
      realname,
    },
  });

  const onSubmit = (values: PlayerEditModel) => {
    const payload: PlayerEditModel = { id };
    if (form.formState.dirtyFields.nickname) payload.nickname = values.nickname;
    if (form.formState.dirtyFields.realname) payload.realname = values.realname;

    editPlayerMutation.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="gap-mk pb-mk flex flex-col"
      >
        <Field name="nickname" placeholder={nickname} form={form} />
        {canEditRealname && (
          <Field name="realname" placeholder={realname || ''} form={form} />
        )}
        <div className="gap-mk mt-mk flex flex-col">
          <Button
            type="submit"
            className="w-full"
            disabled={editPlayerMutation.isPending}
          >
            {editPlayerMutation.isPending ? <LoadingSpinner /> : <Save />}
            <FormattedMessage id="Common.save" />
          </Button>
          {status && <DeletePlayer clubId={clubId} />}
        </div>
      </form>
    </Form>
  );
};

const Field: FC<FieldProps> = ({ name, CustomInput, form, placeholder }) => (
  <FormField
    name={name}
    control={form.control}
    render={({ field }) => (
      <FormItem>
        <FormLabel className="text-muted-foreground pl-3 font-light">
          {/* FIXME this is dirty as hell: */}
          <FormattedMessage
            id={
              `Player.${name}` as MessageKeys<
                IntlMessages,
                NestedKeyOf<IntlMessages>
              >
            }
          />
        </FormLabel>
        <FormControl>
          {CustomInput ? (
            <CustomInput {...field} />
          ) : (
            <Input
              placeholder={placeholder}
              {...field}
              value={field.value ?? ''}
            />
          )}
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

type FieldProps = {
  name: keyof PlayerEditModel;
  CustomInput?: FC<
    ControllerRenderProps<PlayerEditModel, keyof PlayerEditModel>
  >;
  form: UseFormReturn<PlayerEditModel>;
  placeholder?: string | undefined;
};

export default EditPlayerForm;
