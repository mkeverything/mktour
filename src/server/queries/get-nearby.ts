import { distanceKm } from '@/lib/geo';
import { Coordinates, getClubCoordinates } from '@/lib/location';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { isNotNull } from 'drizzle-orm';

export type NearFilter = {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

export type Nearby = { point: Coordinates; radiusKm: number };

export const toNearby = ({
  latitude,
  longitude,
  radiusKm,
}: NearFilter): Nearby | null =>
  latitude === undefined || longitude === undefined || !radiusKm
    ? null
    : { point: { latitude, longitude }, radiusKm };

// distances are computed in js because clubs without a location fall back to
// mock coordinates; with real data only this becomes a bounding-box query
export async function getNearbyClubDistances({ point, radiusKm }: Nearby) {
  const rows = await db
    .select({
      id: clubs.id,
      latitude: clubs.latitude,
      longitude: clubs.longitude,
    })
    .from(clubs);
  return new Map(
    rows
      .map(
        (club) =>
          [club.id, distanceKm(point, getClubCoordinates(club))] as const,
      )
      .filter(([, distance]) => distance <= radiusKm)
      .toSorted(([, a], [, b]) => a - b),
  );
}

export async function getNearbyTournamentIds({ point, radiusKm }: Nearby) {
  const rows = await db
    .select({
      id: tournaments.id,
      latitude: tournaments.latitude,
      longitude: tournaments.longitude,
    })
    .from(tournaments)
    .where(isNotNull(tournaments.latitude));
  return rows
    .filter(
      ({ latitude, longitude }) =>
        distanceKm(point, { latitude: latitude!, longitude: longitude! }) <=
        radiusKm,
    )
    .map(({ id }) => id);
}
