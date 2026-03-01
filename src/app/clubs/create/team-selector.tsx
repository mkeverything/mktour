'use client';

import { NewClubForm } from '@/app/clubs/create/new-club-form';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function TeamSelector({ teams, form }: TeamSelectorProps) {
  const [state, setState] = useState<boolean>(false);
  const t = useTranslations('Club.New');
  if (teams.length === 0) {
    return (
      <FormField
        control={form.control}
        name="lichessTeam"
        render={({ field }) => (
          <FormItem>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value ?? undefined}
              disabled
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('no lichess teams')} />
                </SelectTrigger>
              </FormControl>
            </Select>
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={form.control}
      name="lichessTeam"
      key={Number(state)}
      render={({ field }) => (
        <FormItem>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value ? field.value : undefined}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={t('connect lichess team')} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem
                  key={team.value}
                  value={team.value}
                  className={`${form.getValues('lichessTeam') && 'text-muted-foreground'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {team.label}
                </SelectItem>
              ))}
              {form.getValues('lichessTeam') && (
                <Button
                  id="removeSelection"
                  className="h-[30px] w-full justify-start pl-8"
                  variant="ghost"
                  onClick={() => {
                    form.setValue('lichessTeam', null, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    setState(!state);
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  <X className="pr-2" />
                  <span className="text-bold">
                    {t('unselect lichess team')}
                  </span>
                </Button>
              )}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface TeamSelectorProps {
  form: NewClubForm;
  teams: Array<{ label: string; value: string }>;
}
