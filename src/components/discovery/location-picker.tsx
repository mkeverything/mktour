'use client';

import 'leaflet/dist/leaflet.css';

import MapTiles from '@/components/discovery/map-tiles';
import { usePlaceText } from '@/components/discovery/place-label';
import { usePlace } from '@/components/discovery/use-place';
import { useUserLocation } from '@/components/hooks/use-user-location';
import { Button } from '@/components/ui/button';
import { Coordinates } from '@/lib/location';
import L from 'leaflet';
import { LocateFixed, MapPinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useEffect, useState } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';

const WORLD_CENTER: L.LatLngTuple = [30, 10];
const WORLD_ZOOM = 2;
const PLACE_ZOOM = 14;
const COORDINATE_DIGITS = 6;

const PIN_ICON = L.divIcon({
  className: 'mk-map-pin mk-map-pin-active',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const round = (value: number) => Number(value.toFixed(COORDINATE_DIGITS));

const LocationPicker: FC<{
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  disabled?: boolean;
  // where the map opens when no location is picked yet
  fallbackCenter?: Coordinates;
  emptyLabel?: string;
}> = ({ value, onChange, disabled, fallbackCenter, emptyLabel }) => {
  const t = useTranslations('Discovery.Location');
  const placeText = usePlaceText();
  const { location, requestLocation } = useUserLocation();
  const [awaitingLocation, setAwaitingLocation] = useState(false);
  const place = usePlace(value);
  const center = value ?? fallbackCenter;

  const select = (latitude: number, longitude: number) =>
    onChange({ latitude: round(latitude), longitude: round(longitude) });

  if (awaitingLocation && location.status !== 'locating') {
    setAwaitingLocation(false);
    if (location.status === 'ready') {
      select(location.latitude, location.longitude);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        data-vaul-no-drag
        className="h-64 overflow-hidden rounded-md border md:h-80"
      >
        <MapContainer
          center={center ? [center.latitude, center.longitude] : WORLD_CENTER}
          zoom={center ? PLACE_ZOOM : WORLD_ZOOM}
          worldCopyJump
          className="mk-map size-full"
        >
          <MapTiles />
          <PickOnClick disabled={disabled} onPick={select} />
          <FollowValue value={center ?? null} />
          {value && (
            <Marker
              position={[value.latitude, value.longitude]}
              icon={PIN_ICON}
              draggable={!disabled}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker)
                    .getLatLng()
                    .wrap();
                  select(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-muted-foreground px-4 text-xs">
        {value ? placeText(place) : (emptyLabel ?? t('not set'))}
        {value && (
          <span className="ml-2 font-mono">
            {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
          </span>
        )}
      </p>
      <p className="text-muted-foreground px-4 text-xs">{t('pick on map')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || location.status === 'locating'}
          onClick={() => {
            if (location.status === 'ready') {
              select(location.latitude, location.longitude);
              return;
            }
            setAwaitingLocation(true);
            requestLocation();
          }}
        >
          <LocateFixed />
          {t('use my location')}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <MapPinOff />
            {t('remove')}
          </Button>
        )}
      </div>
    </div>
  );
};

const PickOnClick: FC<{
  disabled?: boolean;
  onPick: (latitude: number, longitude: number) => void;
}> = ({ disabled, onPick }) => {
  useMapEvents({
    click: (e) => {
      if (!disabled) onPick(e.latlng.lat, e.latlng.wrap().lng);
    },
  });
  return null;
};

const FollowValue: FC<{ value: Coordinates | null }> = ({ value }) => {
  const map = useMap();
  const { latitude, longitude } = value ?? {};
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    if (map.getBounds().contains([latitude, longitude])) return;
    map.setView([latitude, longitude], Math.max(map.getZoom(), PLACE_ZOOM));
  }, [map, latitude, longitude]);
  return null;
};

export default LocationPicker;
