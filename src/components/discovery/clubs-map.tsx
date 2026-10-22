'use client';

import 'leaflet/dist/leaflet.css';

import MapTiles from '@/components/discovery/map-tiles';
import { usePlaceText } from '@/components/discovery/place-label';
import { useUserLocation } from '@/components/hooks/use-user-location';
import { ClubLocationModel } from '@/server/zod/discovery';
import L from 'leaflet';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';

const WORLD_CENTER: L.LatLngTuple = [30, 10];
const WORLD_ZOOM = 2;
const NEARBY_ZOOM = 11;
const MAX_FIT_ZOOM = 13;

const PIN_ICON = L.divIcon({
  className: 'mk-map-pin',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

const ClubsMap: FC<{ clubs: ClubLocationModel[] }> = ({ clubs }) => {
  const t = useTranslations('Discovery');
  const placeText = usePlaceText();
  const { location } = useUserLocation();
  const userPoint =
    location.status === 'ready'
      ? ([location.latitude, location.longitude] as L.LatLngTuple)
      : null;

  return (
    <MapContainer
      center={WORLD_CENTER}
      zoom={WORLD_ZOOM}
      worldCopyJump
      className="mk-map size-full"
    >
      <MapTiles />
      <FitView clubs={clubs} userPoint={userPoint} />
      {userPoint && (
        <CircleMarker
          center={userPoint}
          radius={7}
          pathOptions={{ className: 'mk-map-user' }}
        />
      )}
      {clubs.map((club) => (
        <Marker
          key={club.id}
          position={[club.latitude, club.longitude]}
          icon={PIN_ICON}
          title={club.name}
        >
          <Popup>
            <div className="flex min-w-40 flex-col gap-1">
              <span className="text-sm font-semibold">{club.name}</span>
              <span className="text-muted-foreground text-xs">
                {placeText(club)}
              </span>
              <Link
                href={`/clubs/${club.id}`}
                className="text-primary text-xs font-medium underline underline-offset-2"
              >
                {t('open club')}
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

const FitView: FC<{
  clubs: ClubLocationModel[];
  userPoint: L.LatLngTuple | null;
}> = ({ clubs, userPoint }) => {
  const map = useMap();
  const [userLatitude, userLongitude] = userPoint ?? [];

  useEffect(() => {
    if (userLatitude !== undefined && userLongitude !== undefined) {
      map.setView([userLatitude, userLongitude], NEARBY_ZOOM);
      return;
    }
    if (!clubs.length) return;
    map.fitBounds(
      L.latLngBounds(
        clubs.map(({ latitude, longitude }) => [latitude, longitude]),
      ),
      { padding: [32, 32], maxZoom: MAX_FIT_ZOOM },
    );
  }, [map, clubs, userLatitude, userLongitude]);

  return null;
};

export default ClubsMap;
