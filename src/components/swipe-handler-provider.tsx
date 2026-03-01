'use client';

import { FC, PropsWithChildren, TouchEvent, useRef } from 'react';

const SwipeHandlerProvider: FC<SwipeDetectorProps & PropsWithChildren> = ({
  handleSwipe,
  children,
}) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const SWIPE_THRESHOLD = 30; // Minimum distance for a valid swipe
  const VERTICAL_FILTER_RATIO = 2; // Vertical movement must be less than half the horizontal movement

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    event.stopPropagation();
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    event.stopPropagation();
    touchEndX.current = event.touches[0].clientX;
    touchEndY.current = event.touches[0].clientY;
  }

  function handleTouchEnd() {
    if (
      touchStartX.current !== null &&
      touchStartY.current !== null &&
      touchEndX.current !== null &&
      touchEndY.current !== null
    ) {
      const deltaX = touchEndX.current - touchStartX.current;
      const deltaY = touchEndY.current - touchStartY.current;

      // Check if the swipe is horizontal
      if (
        Math.abs(deltaX) > SWIPE_THRESHOLD &&
        Math.abs(deltaY) < Math.abs(deltaX) / VERTICAL_FILTER_RATIO
      ) {
        if (deltaX > 0) {
          handleSwipe('right');
        } else {
          handleSwipe('left');
        }
      }
    }

    // Reset touch positions
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
  }

  return (
    <div
      className="size-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
};

interface SwipeDetectorProps {
  handleSwipe: (_dir: string) => void;
}

export default SwipeHandlerProvider;
