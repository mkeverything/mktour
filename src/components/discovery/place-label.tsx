'use client';

import { PlaceModel } from '@/server/zod/discovery';
import { useLocale, useTranslations } from 'next-intl';
import { FC } from 'react';

const useCountryName = () => {
  const locale = useLocale();
  return (countryIso2: string | null) => {
    if (!countryIso2) return null;
    try {
      return (
        new Intl.DisplayNames(locale, { type: 'region' })
          .of(countryIso2)
          ?.toLocaleLowerCase(locale) ?? null
      );
    } catch {
      return null;
    }
  };
};

export const usePlaceText = () => {
  const t = useTranslations('Discovery');
  const countryName = useCountryName();
  return (place: PlaceModel | null, distanceKm?: number | null) =>
    [
      place?.cityName?.toLocaleLowerCase(),
      countryName(place?.countryIso2 ?? null),
      distanceKm != null &&
        t('distance', { distance: formatDistance(distanceKm) }),
    ]
      .filter(Boolean)
      .join(' · ');
};

const formatDistance = (distanceKm: number) =>
  distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm);

const PlaceLabel: FC<{
  place: PlaceModel | null;
  distanceKm?: number | null;
  className?: string;
}> = ({ place, distanceKm, className }) => {
  const placeText = usePlaceText();
  const text = placeText(place, distanceKm);
  if (!text) return null;
  return <span className={className}>{text}</span>;
};

export default PlaceLabel;
