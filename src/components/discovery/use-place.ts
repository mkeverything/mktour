import { Coordinates } from '@/lib/location';
import { PlaceModel } from '@/server/zod/discovery';
import { useEffect, useState } from 'react';

// the geocoder data is large, so it only loads where a place is shown client-side
export const usePlace = (coordinates: Coordinates | null) => {
  const [place, setPlace] = useState<PlaceModel | null>(null);
  const { latitude, longitude } = coordinates ?? {};

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let cancelled = false;
    import('@/lib/geo-place').then(({ getPlace }) => {
      if (!cancelled) setPlace(getPlace(latitude, longitude));
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return coordinates ? place : null;
};
