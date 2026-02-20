'use client';

import { ClubTabProps } from '@/app/clubs/my/tabMap';
import { LoadingSpinner } from '@/app/loading';
import useEditClubMutation from '@/components/hooks/mutation-hooks/use-club-edit';
import { useClubInfo } from '@/components/hooks/query-hooks/use-club-info';
import SkeletonList from '@/components/skeleton-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { shallowEqual } from '@/lib/utils';
import { ClubFormModel, clubsInsertSchema } from '@/server/db/zod/clubs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';

const ClubSettingsForm: FC<ClubTabProps & PropsWithChildren> = ({
  selectedClub,
  children,
}) => {
  const queryClient = useQueryClient();
  const { data, isFetching } = useClubInfo(selectedClub);
  const clubSettingsMutation = useEditClubMutation(queryClient);

  const defaultValues = {
    name: '',
    description: '',
    lichessTeam: '',
  };

  const form = useForm<ClubFormModel>({
    resolver: zodResolver(clubsInsertSchema),
    values: data
      ? {
          name: data.name,
          description: data.description,
          lichessTeam: data.lichessTeam,
        }
      : defaultValues,
  });

  const t = useTranslations('Club.Dashboard.Settings');

  if (!data && isFetching) return <SkeletonList length={1} />;
  if (!data && children) return children;
  return (
    <div className="gap-mk-2 flex flex-col">
      <h2 className="pl-4 text-sm">{t('club settings')}</h2>
      <Form {...form}>
        <Card className="bg-background sm:bg-card border-none shadow-none sm:border-solid sm:shadow">
          <CardContent className="p-0 sm:p-6">
            <form
              onSubmit={form.handleSubmit((data) =>
                clubSettingsMutation.mutate({
                  clubId: selectedClub,
                  values: data,
                }),
              )}
              className="flex flex-col gap-2"
              name="edit-club-form"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="pl-4">{t('name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isFetching}
                        autoComplete="off"
                        className="px-4"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={
                  shallowEqual(form.getValues(), defaultValues) ||
                  clubSettingsMutation.isPending ||
                  isFetching
                }
                className="w-full"
              >
                {clubSettingsMutation.isPending ? <LoadingSpinner /> : <Save />}
                {t('save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};

export default ClubSettingsForm;
