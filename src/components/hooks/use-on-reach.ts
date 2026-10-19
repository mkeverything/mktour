import { useInView } from 'framer-motion';
import { RefObject, useEffect, useRef } from 'react';

const useOnReach = (handler: () => void, root?: RefObject<Element | null>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const handlerRef = useRef(handler);
  const isInView = useInView(ref, { root, margin: '300px' });
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
