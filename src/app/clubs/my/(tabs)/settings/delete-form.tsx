'use client';

import { LoadingSpinner } from '@/app/loading';
import useDeleteClubMutation from '@/components/hooks/mutation-hooks/use-club-delete';
import { useClubInfo } from '@/components/hooks/query-hooks/use-club-info';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  deleteClubFormSchema,
  DeleteClubFormType,
} from '@/lib/zod/delete-club-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { Dispatch, SetStateAction } from 'react';
import { useForm, useWatch } from 'react-hook-form';

export default function DeleteConfirmationForm({
  className,
  id,
  setOpenAction,
}: DeleteConfirmationFormProps) {
  const queryClient = useQueryClient();
  const { data, isFetching } = useClubInfo(id);
  const { isPending, mutate } = useDeleteClubMutation(
    queryClient,
    setOpenAction,
  );
  const form = useForm<DeleteClubFormType>({
    resolver: zodResolver(deleteClubFormSchema),
    values: { name: '', id },
  });
  const t = useTranslations('Club.Dashboard.Settings');

  const watchedName = useWatch({
    control: form.control,
    name: 'name',
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          mutate(
            {
              clubId: data.id,
              userDeletion: false,
            },
            {
              onSuccess: () => {
                posthog.capture('club_deleted', { club_id: data.id });
              },
            },
          );
        })}
        className={cn('grid items-start gap-6 py-0', className)}
        name="delete-club-form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} disabled={isPending} autoComplete="off" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField control={form.control} name="id" render={() => <></>} />

        <Button
          disabled={
            data?.name !== watchedName || !data || isPending || isFetching
          }
          variant="destructive"
        >
          {isPending ? <LoadingSpinner /> : <Trash2 />}
          {t('delete club')}
        </Button>
      </form>
    </Form>
  );
}

interface DeleteConfirmationFormProps {
  className?: string;
  id: string;
  setOpenAction: Dispatch<SetStateAction<boolean>>;
}
