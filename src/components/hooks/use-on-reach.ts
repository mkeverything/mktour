import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';

const useOnReach = (handler: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const handlerRef = useRef(handler);
  const isInView = useInView(ref, { margin: '300px' });
  const wasInViewRef = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (isInView && !wasInViewRef.current) {
      handlerRef.current();
    }
    wasInViewRef.current = isInView;
  }, [isInView]);

  return ref;
};

export default useOnReach;
