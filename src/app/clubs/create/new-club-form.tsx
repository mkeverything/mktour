'use client';

import ClubDescription from '@/app/clubs/create/description';
import { TeamSelector } from '@/app/clubs/create/team-selector';
import { turboPascal } from '@/app/fonts';
import { LoadingSpinner } from '@/app/loading';
import { useClubCreate } from '@/components/hooks/query-hooks/use-club-create';
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
import { ClubFormModel, clubsInsertSchema } from '@/server/db/zod/clubs';
import { UserModel } from '@/server/db/zod/users';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

export default function NewClubForm({ teams }: NewClubFormProps) {
  const form = useForm<ClubFormModel>({
    resolver: zodResolver(clubsInsertSchema),
    defaultValues: {
      name: '',
      description: undefined,
      lichessTeam: undefined,
    },
  });

  const t = useTranslations('Club.New');
  const { mutate, isPending: isMutating } = useClubCreate();
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const isPending = isMutating || isNavigating || form.formState.isSubmitting;

  const handleSubmit = (data: ClubFormModel) => {
    const dataWithDate = {
      ...data,
      createdAt: new Date(),
    };

    mutate(dataWithDate, {
      onSuccess: () => {
        startNavigation(() => {
          form.reset();
          router.push('/clubs/my');
        });
      },
      onError: (e) => {
        console.error(e);
        toast.error(t('club not created'));
      },
    });
  };

  return (
    <Form {...form}>
      <h2
        className={`m-2 text-center text-4xl font-bold ${turboPascal.className}`}
      >
        {t('new club')}
      </h2>
      <Card className="bg-background sm:bg-card mx-auto max-w-[min(600px,98%)] border-none shadow-none sm:border-solid sm:shadow-2xs">
        <CardContent className="p-mk sm:p-mk-2 pt-2">
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-8"
            name="new-tournament-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ClubDescription form={form} />
            <TeamSelector teams={teams} form={form} />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <LoadingSpinner />
                  {t('making')}
                </>
              ) : (
                t('make new club')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Form>
  );
}

interface NewClubFormProps {
  user: UserModel;
  teams: {
    label: string;
    value: string;
  }[];
}

export type NewClubForm = UseFormReturn<ClubFormModel>;
