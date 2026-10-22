import { useSyncExternalStore } from 'react';

type UserLocation =
  | { status: 'idle' | 'locating' | 'denied' | 'unavailable' }
  | { status: 'ready'; latitude: number; longitude: number };

const listeners = new Set<() => void>();
let location: UserLocation = { status: 'idle' };

const setLocation = (next: UserLocation) => {
  location = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const requestLocation = () => {
  if (location.status === 'locating' || location.status === 'ready') return;
  if (!('geolocation' in navigator)) {
    setLocation({ status: 'unavailable' });
    return;
  }
  setLocation({ status: 'locating' });
  navigator.geolocation.getCurrentPosition(
    ({ coords }) =>
      setLocation({
        status: 'ready',
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    (error) =>
      setLocation({
        status:
          error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
      }),
    { maximumAge: 10 * 60 * 1000, timeout: 15 * 1000 },
  );
};

const SERVER_LOCATION: UserLocation = { status: 'idle' };

export const useUserLocation = () => {
  const current = useSyncExternalStore(
    subscribe,
    () => location,
    () => SERVER_LOCATION,
  );
  return { location: current, requestLocation };
};
