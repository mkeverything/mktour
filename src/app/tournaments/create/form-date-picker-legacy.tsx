import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NewTournamentFormModel } from '@/server/zod/tournaments';
import { format } from 'date-fns';
import { enUS, Locale, ru } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { useLocale } from 'next-intl';

import { ControllerRenderProps } from 'react-hook-form';

interface FormDatePickerProps {
  field: ControllerRenderProps<NewTournamentFormModel, 'date'>;
}

export default function FormDatePicker({ field }: FormDatePickerProps) {
  const locale = useLocale();
  const localeMap: { [key: string]: Locale } = {
    en: enUS,
    ru: ru,
  };

  return (
    <>
      <FormItem>
        <FormControl>
          <Popover>
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
            <PopoverContent className="w-auto p-0">
              <Calendar
                required
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                initialFocus
                locale={localeMap[locale]}
              />
            </PopoverContent>
          </Popover>
        </FormControl>
        <FormMessage />
      </FormItem>
    </>
  );
}
