'use client';

import PathIcon from '@/components/ui-custom/path-icon';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GLOBE_ICON_PATH,
  MAX_CLUB_LINKS,
  withEmptyLink,
} from '@/lib/club-links';
import { cn } from '@/lib/utils';
import { ClubFormModel, ClubInfoModel } from '@/server/zod/clubs';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';

export const LinksField: FC<{
  form: UseFormReturn<ClubFormModel>;
  savedLinks: ClubInfoModel['links'];
  disabled: boolean;
}> = ({ form, savedLinks, disabled }) => {
  const t = useTranslations('Club.Dashboard.Settings');
  const { fields, append, replace } = useFieldArray({
    control: form.control,
    name: 'links',
  });
  const links = useWatch({ control: form.control, name: 'links' }) ?? [];
  const savedPaths = new Map(savedLinks.map(({ url, path }) => [url, path]));

  const handleType = (index: number, value: string) => {
    if (index === fields.length - 1 && value && fields.length < MAX_CLUB_LINKS)
      append({ url: '' }, { shouldFocus: false });
  };

  const handleRemove = (index: number) =>
    replace(withEmptyLink(links.filter((_, i) => i !== index)));

  return (
    <fieldset className="space-y-2">
      <Label asChild>
        <legend className="pl-4">{t('links')}</legend>
      </Label>
      <ul className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const url = links[index]?.url ?? '';
          return (
            <LinkRow
              key={field.id}
              index={index}
              form={form}
              path={savedPaths.get(url) ?? GLOBE_ICON_PATH}
              isEmptyLast={index === fields.length - 1 && !url}
              disabled={disabled}
              onType={(value) => handleType(index, value)}
              onRemove={() => handleRemove(index)}
            />
          );
        })}
      </ul>
    </fieldset>
  );
};

const LinkRow: FC<{
  index: number;
  form: UseFormReturn<ClubFormModel>;
  path: string;
  isEmptyLast: boolean;
  disabled: boolean;
  onType: (value: string) => void;
  onRemove: () => void;
}> = ({ index, form, path, isEmptyLast, disabled, onType, onRemove }) => {
  const t = useTranslations('Club.Dashboard.Settings');

  return (
    <li className="flex items-start gap-2">
      <PathIcon path={path} className="text-muted-foreground mt-2.25" />
      <FormField
        control={form.control}
        name={`links.${index}.url`}
        render={({ field }) => (
          <FormItem className="min-w-0 flex-1">
            <FormLabel className="sr-only">
              {t('link', { number: index + 1 })}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  onType(event.target.value);
                }}
                disabled={disabled}
                placeholder={isEmptyLast ? t('paste a link') : undefined}
                inputMode="url"
                autoComplete="off"
                className="px-4"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('remove link')}
        onClick={onRemove}
        disabled={disabled}
        className={cn('text-muted-foreground', isEmptyLast && 'invisible')}
      >
        <X />
      </Button>
    </li>
  );
};
