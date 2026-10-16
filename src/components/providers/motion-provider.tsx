'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion';
import { PropsWithChildren } from 'react';

export default function MotionProvider({ children }: PropsWithChildren) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
