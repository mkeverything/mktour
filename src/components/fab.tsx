'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, LucideIcon } from 'lucide-react';
import { ComponentProps, FC, PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

const Fab: FC<FabProps> = ({
  icon: Icon,
  container,
  safeArea,
  className,
  ...props
}) => {
  return (
    <PortalWrapper container={container}>
      <Button
        className={cn(
          'pointer-events-auto absolute right-4 z-40 size-16 rounded-full',
          safeArea
            ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'bottom-4',
          className,
        )}
        variant="secondary"
        size="icon"
        {...props}
      >
        <Icon className={cn('size-5', Icon === Loader2 && 'animate-spin')} />
      </Button>
    </PortalWrapper>
  );
};

const PortalWrapper: FC<PropsWithChildren & Pick<FabProps, 'container'>> = ({
  children,
  container,
}) => {
  if (container) return createPortal(children, container);
  return children;
};

type FabProps = ComponentProps<typeof Button> & {
  icon: LucideIcon;
  container?: HTMLElement | null;
  safeArea?: boolean;
};

export default Fab;
