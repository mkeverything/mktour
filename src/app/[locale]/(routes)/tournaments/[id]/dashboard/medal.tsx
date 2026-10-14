import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { ComponentProps, FC } from 'react';

export const PLACE_LABEL_KEYS = [
  'first place',
  'second place',
  'third place',
] as const;

const MEDAL_COLOURS = ['bg-amber-300', 'bg-gray-300', 'bg-amber-700'];

const Medal: FC<ComponentProps<'div'> & { place: number }> = ({
  place,
  className,
  ...props
}) => {
  const t = useTranslations('Tournament.Main');

  return (
    <div
      className={cn(
        'aspect-square rounded-full',
        MEDAL_COLOURS[place - 1],
        className,
      )}
      {...props}
    >
      <span className="sr-only">{t(PLACE_LABEL_KEYS[place - 1])}</span>
    </div>
  );
};

export default Medal;
