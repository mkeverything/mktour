import type { PlaceModel } from '@/server/zod/discovery';
import { getNearestCity } from 'offline-geocode-city';

export const getPlace = (latitude: number, longitude: number): PlaceModel => {
  const city = getNearestCity(latitude, longitude);
  return {
    latitude,
    longitude,
    cityName: city.cityName || null,
    countryIso2: city.countryIso2 || null,
  };
};
