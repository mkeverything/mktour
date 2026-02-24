'use client';

import {
  FC,
  PropsWithChildren,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

type PortalWrapperProps = {
  portalled: boolean;
  exitDuration?: number;
} & PropsWithChildren;

const PortalWrapper: FC<PortalWrapperProps> = ({
  portalled,
  exitDuration = 500,
  children,
}) => {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<DOMRect | null>(null);
  const [shouldPortal, setShouldPortal] = useState(portalled);

  const updateCoords = () => {
    if (!placeholderRef.current) return;
    const rect = placeholderRef.current.getBoundingClientRect();
    setCoords(
      new DOMRect(
        rect.left + window.scrollX,
        rect.top + window.scrollY,
        rect.width,
        rect.height,
      ),
    );
  };

  useLayoutEffect(() => {
    if (portalled) {
      updateCoords();
      queueMicrotask(() => setShouldPortal(true));
    } else {
      const timeout = setTimeout(() => setShouldPortal(false), exitDuration);
      return () => clearTimeout(timeout);
    }
  }, [portalled, exitDuration]);

  if (shouldPortal && coords) {
    return (
      <>
        <div
          ref={placeholderRef}
          style={{ width: coords.width, height: coords.height }}
        />
        {createPortal(
          <div
            style={{
              position: 'absolute',
              top: coords.y,
              left: coords.x,
              width: coords.width,
              height: coords.height,
              zIndex: 50,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
      </>
    );
  }

  return <div ref={placeholderRef}>{children}</div>;
};

export default PortalWrapper;
