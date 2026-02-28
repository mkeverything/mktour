'use client';

import { useCarousel } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { FC, useEffect, useState } from 'react';

const CarouselDots: FC<{
  count: number;
  className?: string;
}> = ({ count, className }) => {
  const { api } = useCarousel();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  if (count <= 1) return null;

  return (
    <div className={cn('flex justify-center gap-1.5 pt-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          className={cn(
            'h-1 rounded-full transition-all',
            i === selected ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-4',
          )}
          onClick={() => api?.scrollTo(i)}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
};

export default CarouselDots;
