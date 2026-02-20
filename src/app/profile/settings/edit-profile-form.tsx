'use client';

import { LoadingSpinner } from '@/app/loading';
import useEditUserMutation from '@/components/hooks/mutation-hooks/use-user-edit';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { shallowEqual } from '@/lib/utils';
import {
  EditProfileFormModel,
  editProfileFormSchema,
} from '@/server/db/zod/users';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

export default function EditProfileForm() {
  const queryClient = useQueryClient();
  const userQuery = useAuth();
  const editUserMutation = useEditUserMutation(queryClient);

  const defaultValues = {
    name: userQuery.data?.name || '',
  };

  const form = useForm<EditProfileFormModel>({
    resolver: zodResolver(editProfileFormSchema),
    values: defaultValues,
  });
  const handleSubmit = (data: EditProfileFormModel) =>
    editUserMutation.mutate(data);
  const t = useTranslations('UserSettings');

  if (userQuery.isLoading) return <Skeleton className="m-4 w-full" />;

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4 pt-2">
        <h2 className="pl-4">{t('edit profile')}</h2>
        <HalfCard className="w-full">
          <CardContent className="p-2 sm:p-8">
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col gap-8"
              name="new-tournament-form"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                disabled={
                  shallowEqual(form.getValues(), defaultValues) ||
                  editUserMutation.isPending ||
                  userQuery.isFetching
                }
                type="submit"
                className="w-full"
              >
                {editUserMutation.isPending ? <LoadingSpinner /> : <Save />}
                {t('save')}
              </Button>
            </form>
          </CardContent>
        </HalfCard>
      </div>
    </Form>
  );
}
