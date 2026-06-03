'use client';

import { NewClubForm } from '@/app/clubs/create/new-club-form';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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

export function TeamSelector({ teams, form }: TeamSelectorProps) {
  const t = useTranslations('Club.New');

  return (
    <FormField
      control={form.control}
      name="lichessTeam"
      render={({ field }) => {
        const placeholder = teams.length
          ? t('connect lichess team')
          : t('no lichess teams');

        return (
          <FormItem>
            <FormLabel className="sr-only">
              {t('connect lichess team')}
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value ?? ''}
              disabled={teams.length === 0}
            >
              <FormControl>
                <SelectTrigger className="m-0">
                  <div className="flex flex-row items-center">
                    {field.value && <LichessLogo className="mr-2 size-3" />}
                    <SelectValue placeholder={placeholder} />
                  </div>
                </SelectTrigger>
              </FormControl>
              {teams.length > 0 && (
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem
                      key={team.value}
                      value={team.value}
                      className={`${field.value && 'text-muted-foreground'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {team.label}
                    </SelectItem>
                  ))}
                  {field.value && (
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
              )}
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

interface TeamSelectorProps {
  form: NewClubForm;
  teams: Array<{ label: string; value: string }>;
}
