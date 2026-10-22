import { getMockClubCoordinates } from '@/lib/mock-club-coordinates';

export type Coordinates = { latitude: number; longitude: number };

type Located = { latitude: number | null; longitude: number | null };

const toCoordinates = ({ latitude, longitude }: Located): Coordinates | null =>
  latitude !== null && longitude !== null ? { latitude, longitude } : null;

// TODO: drop the mock fallback once clubs have real locations after the migration
export const getClubCoordinates = (club: Located & { id: string }) =>
  toCoordinates(club) ?? getMockClubCoordinates(club.id);

// a tournament is played at its own venue when set, otherwise at its club
export const getTournamentCoordinates = (
  tournament: Located,
  club: Located & { id: string },
) => toCoordinates(tournament) ?? getClubCoordinates(club);

export const hasOwnLocation = (value: Located) => toCoordinates(value) !== null;
