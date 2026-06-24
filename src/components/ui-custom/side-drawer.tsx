'use client';

import { FC, PropsWithChildren, useEffect } from 'react';
import { Drawer } from 'vaul';

const SideDrawer: FC<DrawerProps> = ({
  open,
  setOpen,
  setIsAnimating,
  children,
}) => {
  useEffect(() => {
    // NB this HOOK is to disable buggy fruquent open/close state change
    if (!setIsAnimating) return;

    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);

    return () => clearTimeout(timer);
  }, [open, setIsAnimating]);

  return (
    <Drawer.Root
      direction="right"
      noBodyStyles
      onOpenChange={(state) => setOpen(state)}
      open={open}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 top-0 z-50 bg-black/60 backdrop-blur-[calc(var(--blur-xs)/3)]" />
        <Drawer.Content
          onInteractOutside={() => setOpen(false)}
          className="bg-background border-l-muted fixed top-0 right-0 bottom-0 z-50 h-dvh max-h-dvh w-auto gap-3 rounded-l-3xl border-0 border-l-[.5px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:left-[5rem] sm:w-sm"
        >
          <Drawer.Title hidden />
          <Drawer.Description hidden />
          <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

type DrawerProps = PropsWithChildren & {
  open: boolean;
  setOpen: (arg: boolean) => void;
  setIsAnimating?: (arg: boolean) => void;
};

export default SideDrawer;
