'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FC } from 'react';
import { createPortal } from 'react-dom';

const Overlay: FC<{ open: boolean }> = ({ open }) => {
  if (!document) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed top-0 z-50 h-full w-full bg-black/25 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
};
export default Overlay;
