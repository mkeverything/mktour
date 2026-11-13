'use client';

import LinkIcon from '@/components/ui-custom/link-icon';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  GLOBE_ICON_PATH,
  MAX_CLUB_LINKS,
  withEmptyLink,
} from '@/lib/club-links';
import { cn } from '@/lib/utils';
import { ClubFormModel, ClubInfoModel } from '@/server/zod/clubs';
import { isSortable } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ComponentProps, FC } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';

export const LinksField: FC<{
  form: UseFormReturn<ClubFormModel>;
  savedLinks: ClubInfoModel['links'];
  disabled: boolean;
}> = ({ form, savedLinks, disabled }) => {
  const t = useTranslations('Club.Dashboard.Settings');
  const { fields, append, move, replace } = useFieldArray({
    control: form.control,
    name: 'links',
  });
  const links = useWatch({ control: form.control, name: 'links' }) ?? [];
  const savedPaths = new Map(savedLinks.map(({ url, path }) => [url, path]));

  const handleDragEnd: ComponentProps<typeof DragDropProvider>['onDragEnd'] = (
    event,
  ) => {
    const { source } = event.operation;
    if (event.canceled || !source || !isSortable(source)) return;
    const { initialIndex, index } = source.sortable;
    if (initialIndex !== index) move(initialIndex, index);
  };

  const handleType = (index: number, value: string) => {
    if (index === fields.length - 1 && value && fields.length < MAX_CLUB_LINKS)
      append({ url: '' }, { shouldFocus: false });
  };

  const handleRemove = (index: number) =>
    replace(withEmptyLink(links.filter((_, i) => i !== index)));

  return (
    <FormField
      control={form.control}
      name="links"
      render={() => (
        <FormItem>
          <FormLabel className="pl-4">{t('links')}</FormLabel>
          <DragDropProvider onDragEnd={handleDragEnd}>
            <ul className="flex flex-col gap-2">
              {fields.map((field, index) => {
                const url = links[index]?.url ?? '';
                return (
                  <LinkRow
                    key={field.id}
                    id={field.id}
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
          </DragDropProvider>
        </FormItem>
      )}
    />
  );
};

const LinkRow: FC<{
  id: string;
  index: number;
  form: UseFormReturn<ClubFormModel>;
  path: string;
  isEmptyLast: boolean;
  disabled: boolean;
  onType: (value: string) => void;
  onRemove: () => void;
}> = ({ id, index, form, path, isEmptyLast, disabled, onType, onRemove }) => {
  const t = useTranslations('Club.Dashboard.Settings');
  const { ref, handleRef, isDragSource } = useSortable({
    id,
    index,
    disabled: isEmptyLast || disabled,
  });

  return (
    <li
      ref={ref}
      className={cn('flex items-start gap-2', isDragSource && 'opacity-50')}
    >
      <button
        type="button"
        ref={handleRef}
        aria-label={t('move link')}
        className={cn(
          'text-muted-foreground flex h-9 cursor-grab touch-none items-center',
          isEmptyLast && 'invisible',
        )}
      >
        <GripVertical className="size-4" />
      </button>
      <LinkIcon path={path} className="text-muted-foreground mt-2.25" />
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
