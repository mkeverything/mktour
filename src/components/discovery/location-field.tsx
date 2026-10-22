'use client';

import { LocationPicker } from '@/components/discovery/maps';
import { Coordinates } from '@/lib/location';
import { FC } from 'react';

const LocationField: FC<{
  label: string;
  description: string;
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  disabled?: boolean;
  fallbackCenter?: Coordinates;
  emptyLabel?: string;
  labelClassName?: string;
}> = ({ label, description, labelClassName, ...picker }) => (
  <div className="flex flex-col gap-2">
    <span
      className={`text-sm leading-none font-medium ${labelClassName ?? ''}`}
    >
      {label}
    </span>
    <p className={`text-muted-foreground text-sm ${labelClassName ?? ''}`}>
      {description}
    </p>
    <LocationPicker {...picker} />
  </div>
);

export default LocationField;
