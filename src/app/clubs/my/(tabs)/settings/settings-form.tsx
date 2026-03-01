'use client';

import { TeamSelector } from '@/app/clubs/create/team-selector';
import { ClubTabProps } from '@/app/clubs/my/tabMap';
import { LoadingSpinner } from '@/app/loading';
import useEditClubMutation from '@/components/hooks/mutation-hooks/use-club-edit';
import { useClubInfo } from '@/components/hooks/query-hooks/use-club-info';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { shallowEqual } from '@/lib/utils';
import { ClubFormModel, clubsInsertSchema } from '@/server/zod/clubs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';

const clubSettingsSchema = clubsInsertSchema
  .omit({ lichessTeam: true })
  .extend({ lichessTeam: z.string().optional().nullable() });

const ClubSettingsForm: FC<ClubTabProps & PropsWithChildren> = ({
  selectedClub,
  children,
}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { data, isFetching } = useClubInfo(selectedClub);
  const { data: teams = [], isFetching: isFetchingLichessTeams } = useQuery(
    trpc.auth.lichessTeams.queryOptions(),
  );
  const clubSettingsMutation = useEditClubMutation(queryClient);

  const defaultValues = {
    name: '',
    description: null,
    lichessTeam: null,
    allowPlayersSetResults: true,
  };
  const initialValues = data
    ? {
        name: data.name,
        description: data.description,
        lichessTeam: data.lichessTeam,
        allowPlayersSetResults: data.allowPlayersSetResults,
      }
    : defaultValues;

  const form = useForm<ClubFormModel>({
    resolver: zodResolver(clubSettingsSchema),
    values: initialValues,
  });

  const t = useTranslations('Club.Dashboard.Settings');

  if (!data && isFetching) return <SkeletonList length={1} />;
  if (!data && children) return children;
  return (
    <div className="gap-mk-2 flex flex-col">
      <h2 className="pl-4 text-sm">{t('club settings')}</h2>
      <Form {...form}>
        <Card className="bg-background sm:bg-card border-none shadow-none sm:border-solid sm:shadow">
          <CardContent className="p-0 sm:px-6 sm:py-6">
            <form
              onSubmit={form.handleSubmit(async (data) => {
                form.clearErrors('lichessTeam');
                try {
                  await clubSettingsMutation.mutateAsync({
                    clubId: selectedClub,
                    values: data,
                  });
                } catch (error) {
                  const teamErrorMessage =
                    getLichessTeamLinkErrorMessage(error);
                  if (!teamErrorMessage) return;
                  form.setError('lichessTeam', {
                    type: 'custom',
                    message: teamErrorMessage,
                  });
                }
              })}
              className="flex flex-col gap-4"
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
              {isFetchingLichessTeams ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <TeamSelector teams={teams} form={form} />
              )}
              <FormField
                control={form.control}
                name="allowPlayersSetResults"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <FormLabel>{t('allow players set results')}</FormLabel>
                        <FormDescription>
                          {t('allow players set results description')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isFetching || isFetchingLichessTeams}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={
                  shallowEqual(form.getValues(), initialValues) ||
                  clubSettingsMutation.isPending ||
                  isFetching ||
                  isFetchingLichessTeams
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

function getLichessTeamLinkErrorMessage(error: unknown): string | null {
  const messagePattern =
    /LINK_TEAM_ERROR@%!!\(&[^"'\]\}\s]+@%!!\(&[^"'\]\}\s]+/;

  if (typeof error === 'string') {
    const matched = error.match(messagePattern);
    return matched ? matched[0] : null;
  }

  if (!error || typeof error !== 'object') return null;

  const possibleZodErrors = [
    (
      error as {
        data?: {
          zodError?: {
            issues?: Array<{
              path?: unknown[];
              message?: string;
            }>;
          };
        };
      }
    ).data?.zodError,
    (
      error as {
        shape?: {
          data?: {
            zodError?: {
              issues?: Array<{
                path?: unknown[];
                message?: string;
              }>;
            };
          };
        };
      }
    ).shape?.data?.zodError,
  ];

  for (const zodError of possibleZodErrors) {
    if (!zodError?.issues?.length) continue;

    const linkTeamIssue = zodError.issues.find((issue) => {
      if (!issue?.message?.startsWith('LINK_TEAM_ERROR')) return false;
      if (!issue.path?.length) return true;
      return issue.path.join('.') === 'values.lichessTeam';
    });
    if (linkTeamIssue?.message) return linkTeamIssue.message;
  }

  const errorMessage = (error as { message?: string }).message;
  if (typeof errorMessage === 'string') {
    const matched = errorMessage.match(messagePattern);
    if (matched) return matched[0];
  }

  const serializedError = JSON.stringify(error);
  const serializedMatch = serializedError.match(messagePattern);
  return serializedMatch ? serializedMatch[0] : null;
}
