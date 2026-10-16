import { NewClubForm } from '@/app/[locale]/(routes)/clubs/create/new-club-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';

export default function ClubDescription({ form }: ClubDescriptionProps) {
  const t = useTranslations('Club.New');
  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('description')}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={t('description placeholder')}
              {...field}
              value={field.value ?? undefined}
              className="field-sizing-content min-h-26"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface ClubDescriptionProps {
  form: NewClubForm;
}
