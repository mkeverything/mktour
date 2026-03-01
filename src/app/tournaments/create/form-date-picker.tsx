import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format, Locale } from 'date-fns';

import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NewTournamentFormModel } from '@/server/zod/tournaments';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { enUS, ru } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { ControllerRenderProps } from 'react-hook-form';

interface FormDatePickerProps {
  field: ControllerRenderProps<NewTournamentFormModel, 'date'>;
}

export default function FormDatePicker({ field }: FormDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const localeMap: { [key: string]: Locale } = {
    en: enUS,
    ru: ru,
  };

  return (
    <>
      <FormItem>
        <FormControl>
          <div className="flex flex-col gap-3">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !field.value && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (
                    format(field.value, 'PPP', { locale: localeMap[locale] })
                  ) : (
                    <span>pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="top-0 w-auto overflow-hidden p-0"
                align="center"
                side="top"
                avoidCollisions={false}
              >
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  reverseYears
                  locale={localeMap[locale]}
                />
              </PopoverContent>
            </Popover>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    </>
  );
}
