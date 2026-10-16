'use client';

import { TypeAnimation } from 'react-type-animation';

export default function ClientTypeAnimation() {
  return (
    <TypeAnimation
      sequence={[
        'page not found',
        400,
        (el) => {
          el?.classList.add('cursor-animation');
        },
      ]}
      wrapper="h2"
      cursor={false}
      className={'custom-cursor w-full text-3xl'}
      repeat={0}
    />
  );
}
