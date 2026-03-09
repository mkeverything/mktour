'use client';

import { Button } from '@/components/ui/button';
import { Loader2, LucideIcon } from 'lucide-react';
import { FC, MouseEventHandler, PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

const Fab: FC<FabProps> = ({
  onClick,
  icon: Icon,
  disabled,
  container,
  className,
  buttonProps,
}) => {
  return (
    <PortalWrapper container={container}>
      <Button
        {...buttonProps}
        className={`pointer-events-auto absolute right-4 bottom-4 z-40 size-16 rounded-full ${className} ${buttonProps?.className ?? ''}`}
        variant="secondary"
        size="icon"
        onClick={onClick}
        disabled={disabled}
      >
        <Icon className={`${Icon === Loader2 && 'animate-spin'} size-5`} />
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

type FabProps = {
  onClick?: MouseEventHandler;
  icon: LucideIcon;
  disabled?: boolean;
  container?: HTMLElement | null;
  className?: React.ComponentProps<'button'>['className'];
  buttonProps?: Omit<
    React.ComponentProps<typeof Button>,
    'onClick' | 'disabled' | 'size' | 'variant'
  >;
};

export default Fab;
