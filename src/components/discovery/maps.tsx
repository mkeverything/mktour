'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const MapSkeleton = () => (
  <Skeleton className="size-full min-h-64 rounded-md" />
);

export const ClubsMap = dynamic(
  () => import('@/components/discovery/clubs-map'),
  {
    ssr: false,
    loading: MapSkeleton,
  },
);

export const LocationPicker = dynamic(
  () => import('@/components/discovery/location-picker'),
  { ssr: false, loading: MapSkeleton },
);
