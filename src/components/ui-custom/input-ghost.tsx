'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function InputGhost({
  className,
  type,
  ...props
}: React.ComponentProps<'input'>) {
  const length =
    props?.value?.toString().length || props.placeholder?.toString().length;
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-primary selection:bg-primary selection:text-primary-foreground dark:bg-background max-w-full min-w-0 shrink rounded-md bg-transparent text-ellipsis whitespace-pre shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
      style={{
        width: `clamp(1ch, ${length}ch, 100%)`,
      }}
    />
  );
}

export { InputGhost };
