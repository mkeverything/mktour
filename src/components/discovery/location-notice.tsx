'use client';

import { useUserLocation } from '@/components/hooks/use-user-location';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

const LocationNotice: FC<{ radiusKm?: number }> = ({ radiusKm }) => {
  const t = useTranslations('Discovery');
  const { location } = useUserLocation();
  if (!radiusKm) return null;

  if (location.status === 'locating' || location.status === 'idle') {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <LoadingSpinner className="size-3.5" />
        {t('locating')}
      </p>
    );
  }
  if (location.status === 'denied' || location.status === 'unavailable') {
    return (
      <p className="text-muted-foreground text-xs">
        {t(
          location.status === 'denied'
            ? 'location denied'
            : 'location unavailable',
        )}
      </p>
    );
  }
  return null;
};

export default LocationNotice;
