import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';

const useOnReach = (handler: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { margin: '300px' });

  useEffect(() => {
    if (isInView) handler();
  });

  return ref;
};

export default useOnReach;
