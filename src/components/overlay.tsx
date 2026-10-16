'use client';

import { AnimatePresence } from 'framer-motion';
import * as m from 'framer-motion/m';
import { FC } from 'react';
import { createPortal } from 'react-dom';

const Overlay: FC<{ open: boolean }> = ({ open }) => {
  if (typeof window === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed top-0 z-50 h-full w-full bg-black/25 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>,
    document.fullscreenElement ?? document.body,
  );
};
export default Overlay;
