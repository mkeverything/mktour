'use client';

import { turboPascal } from '@/app/fonts';
import { LoadingSpinner } from '@/app/loading';
import FormDatePicker from '@/app/tournaments/create/form-date-picker';
import { useTournamentCreate } from '@/components/hooks/mutation-hooks/use-tournament-create';
import TypeCard from '@/components/ui-custom/type-card';
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
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  NewTournamentFormType,
  newTournamentFormSchema,
} from '@/lib/zod/new-tournament-form';
import { ClubModel } from '@/server/db/zod/clubs';
import { UserModel } from '@/server/db/zod/users';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function NewTournamentForm({
  clubs,
  user,
}: NewTournamentFormProps) {
  const form = useForm<NewTournamentFormType>({
    resolver: zodResolver(newTournamentFormSchema),
    defaultValues: {
      title: undefined,
      format: undefined,
      date: new Date(),
      timestamp: 0,
      type: 'solo',
      rated: true,
    },
  });
  const t = useTranslations('MakeTournament');
  const { mutate, isPending: isMutating } = useTournamentCreate();
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();
  const isPending = isMutating || isNavigating;

  const handleSubmit = (data: NewTournamentFormType) => {
    mutate(
      {
        ...data,
        date: data.date.toISOString().slice(0, 10),
      },
      {
        onSuccess: (result) => {
          startNavigation(() => {
            router.push(`/tournaments/${result.id}`);
            form.reset();
          });
        },
        onError: (e) => {
          console.error(e);
          toast.error(t('error'));
        },
      },
    );
  };

  return (
    <Form {...form}>
      <h2
        className={`m-2 text-center text-4xl font-bold ${turboPascal.className}`}
      >
        {t('new tournament')}
      </h2>
      <Card className="bg-background sm:bg-card mx-auto max-w-[min(600px,98%)] border-none shadow-none sm:border-solid sm:shadow-2xs">
        <CardContent className="p-4 sm:p-8">
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-8"
            name="new-tournament-form"
          >
            <FormField
              control={form.control}
              name="clubId"
              defaultValue={user.selectedClub}
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      ref={(ref) => {
                        if (!ref) return;
                        // ref.ontouchstart = (e) => e.preventDefault();
                      }}
                    >
                      <SelectGroup>
                        {clubs.map((club: Pick<ClubModel, 'id' | 'name'>) => (
                          <SelectItem key={club.id} value={club.id}>
                            {club.name}
                          </SelectItem>
                        ))}
                        <SelectGroup>
                          <Link
                            href="/clubs/create"
                            className="m-0 box-border h-[30px] w-full p-0"
                          >
                            <Button
                              variant="ghost"
                              className="text-muted-foreground flex h-[30px] w-full flex-row justify-end gap-2 pl-7 font-extrabold"
                            >
                              <PlusIcon fontStyle="bold" /> {t('new club')}
                            </Button>
                          </Link>
                        </SelectGroup>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
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
            <FormField
              control={form.control}
              name="format"
              defaultValue="round robin"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="choose a format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      ref={(ref) => {
                        if (!ref) return;
                        // ref.ontouchstart = (e) => e.preventDefault();
                      }}
                    >
                      <SelectGroup>
                        <SelectItem value="round robin">
                          {t('round robin')}
                        </SelectItem>
                        <SelectItem value="swiss" disabled>
                          {t('swiss')}
                        </SelectItem>
                        <SelectItem value="single elimination" disabled>
                          {t('single elimination')}
                        </SelectItem>
                        <SelectItem value="double elimination" disabled>
                          {t('double elimination')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-3 gap-2 sm:gap-4"
                  >
                    <TypeCard name="solo" />
                    <TypeCard name="doubles" disabled />
                    <TypeCard name="team" disabled />
                  </RadioGroup>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => <FormDatePicker field={field} />}
            />
            <FormField
              control={form.control}
              name="rated"
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Label htmlFor="rated" className="text-muted-foreground">
                    {t('rated')}
                  </Label>
                  <Switch
                    id="rated"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <LoadingSpinner />
                  {t('making')}
                </>
              ) : (
                t('make tournament')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Form>
  );
}

interface NewTournamentFormProps {
  clubs: Array<Pick<ClubModel, 'id' | 'name'>>;
  user: UserModel;
}
