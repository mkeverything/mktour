import { cn } from '@/lib/utils';
import { ComponentProps, FC } from 'react';

const FilterChip: FC<ComponentProps<'button'> & { active?: boolean }> = ({
  active,
  className,
  children,
  ...props
}) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      'focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] [&_svg]:size-3.5',
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background hover:bg-accent',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export default FilterChip;
