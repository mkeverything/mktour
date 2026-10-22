// temporary: clubs have no location columns yet, so each club gets a stable
// spot near one of these cities, derived from its id
const MOCK_CITIES = [
  { latitude: 55.7963, longitude: 49.1088 }, // kazan
  { latitude: 55.7558, longitude: 37.6173 }, // moscow
  { latitude: 59.9343, longitude: 30.3351 }, // saint petersburg
  { latitude: 56.8389, longitude: 60.6057 }, // yekaterinburg
  { latitude: 40.1872, longitude: 44.5152 }, // yerevan
  { latitude: 41.7151, longitude: 44.8271 }, // tbilisi
  { latitude: 52.52, longitude: 13.405 }, // berlin
  { latitude: 51.5072, longitude: -0.1276 }, // london
  { latitude: 40.7128, longitude: -74.006 }, // new york
  { latitude: 13.0827, longitude: 80.2707 }, // chennai
];

// about 5 km in each direction
const MAX_OFFSET_DEGREES = 0.05;
const HASH_MODULO = 1_000_003;

const hash = (value: string, seed: number) =>
  [...value].reduce(
    (result, char) => (result * 31 + char.charCodeAt(0)) % HASH_MODULO,
    seed,
  );

const offset = (value: string, seed: number) =>
  ((hash(value, seed) / HASH_MODULO) * 2 - 1) * MAX_OFFSET_DEGREES;

export const getMockClubCoordinates = (clubId: string) => {
  const city = MOCK_CITIES[hash(clubId, 7) % MOCK_CITIES.length];
  return {
    latitude: Number((city.latitude + offset(clubId, 11)).toFixed(6)),
    longitude: Number((city.longitude + offset(clubId, 13)).toFixed(6)),
  };
};
