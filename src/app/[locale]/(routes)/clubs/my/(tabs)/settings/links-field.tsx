'use client';

import PathIcon from '@/components/ui-custom/path-icon';
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
    <li>
      <FormField
        control={form.control}
        name={`links.${index}.url`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">
              {t('link', { number: index + 1 })}
            </FormLabel>
            <div className="relative">
              <PathIcon
                path={path}
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              />
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
                  className="pr-9 pl-9.5"
                />
              </FormControl>
              {!isEmptyLast && (
                <button
                  type="button"
                  aria-label={t('remove link')}
                  onClick={onRemove}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </li>
  );
};
