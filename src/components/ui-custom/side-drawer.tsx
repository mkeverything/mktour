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
        <Drawer.Overlay className="fixed inset-0 top-0 z-50 bg-black/80" />
        <Drawer.Content
          onInteractOutside={() => setOpen(false)}
          className="bg-background border-secondary fixed top-0 right-0 bottom-0 z-50 flex h-screen w-auto flex-1 flex-col gap-3 overflow-hidden rounded-l-[15px] border border-t-0 border-r-0 border-b-0 p-4 py-6 outline-hidden max-sm:left-[5rem] sm:left-auto sm:w-sm"
        >
          <Drawer.Title hidden />
          <Drawer.Description hidden />
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
