'use client';

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { cn } from '@/lib/utils';

type ScrollAreaSizeStyle = React.CSSProperties & {
  '--scroll-area-scrollbar-size'?: string;
};

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  hideThumb?: boolean;
  scrollbarSize?: number | string;
};

type ScrollBarProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.ScrollAreaScrollbar
> & {
  hideThumb?: boolean;
  scrollbarSize?: number | string;
};

const formatScrollbarSize = (scrollbarSize: number | string) => {
  return typeof scrollbarSize === 'number'
    ? `${scrollbarSize}px`
    : scrollbarSize;
};

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      hideThumb = false,
      scrollbarSize = '0.375rem',
      style,
      ...props
    },
    ref,
  ) => (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      style={
        {
          '--scroll-area-scrollbar-size': formatScrollbarSize(scrollbarSize),
          ...style,
        } as ScrollAreaSizeStyle
      }
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar hideThumb={hideThumb} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ScrollBarProps
>(
  (
    {
      className,
      orientation = 'vertical',
      hideThumb = false,
      scrollbarSize,
      style,
      ...props
    },
    ref,
  ) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none transition-colors select-none',
        orientation === 'vertical' &&
          'h-full w-(--scroll-area-scrollbar-size) border-l border-l-transparent p-px',
        orientation === 'horizontal' &&
          'h-(--scroll-area-scrollbar-size) flex-col border-t border-t-transparent p-px',
        className,
      )}
      style={
        scrollbarSize === undefined
          ? style
          : ({
              '--scroll-area-scrollbar-size':
                formatScrollbarSize(scrollbarSize),
              ...style,
            } as ScrollAreaSizeStyle)
      }
      {...props}
    >
      {!hideThumb && (
        <ScrollAreaPrimitive.ScrollAreaThumb className="bg-border relative flex-1 rounded-full" />
      )}
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  ),
);
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
