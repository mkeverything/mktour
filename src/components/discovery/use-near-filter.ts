import { useUserLocation } from '@/components/hooks/use-user-location';
import { useEffect } from 'react';

// about a kilometre: enough for distances, and nearby visitors share cache entries
const COORDINATE_PRECISION = 100;

const round = (value: number) =>
  Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;

export const useNearFilter = (radiusKm?: number) => {
  const { location, requestLocation } = useUserLocation();

  useEffect(() => {
    if (radiusKm) requestLocation();
  }, [radiusKm, requestLocation]);

  if (!radiusKm) return { near: {}, ready: true, location };
  if (location.status === 'ready') {
    return {
      near: {
        latitude: round(location.latitude),
        longitude: round(location.longitude),
        radiusKm,
      },
      ready: true,
      location,
    };
  }
  const ready =
    location.status === 'denied' || location.status === 'unavailable';
  return { near: {}, ready, location };
};
