'use client';

import FilterChip from '@/components/discovery/filter-chip';
import { useUserLocation } from '@/components/hooks/use-user-location';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM } from '@/lib/discovery-params';
import { ChevronDown, LocateFixed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

const NearMeControl: FC<{
  radiusKm?: number;
  onChange: (radiusKm: number | null) => void;
}> = ({ radiusKm, onChange }) => {
  const t = useTranslations('Discovery');
  const { requestLocation } = useUserLocation();

  if (!radiusKm) {
    return (
      <FilterChip
        onClick={() => {
          requestLocation();
          onChange(DEFAULT_RADIUS_KM);
        }}
      >
        <LocateFixed />
        {t('near me')}
      </FilterChip>
    );
  }

  return (
    <div className="flex shrink-0">
      <FilterChip
        active
        className="rounded-r-none border-r-0 pr-2"
        onClick={() => onChange(null)}
      >
        <LocateFixed />
        {t('near me')}
      </FilterChip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterChip
            active
            className="border-primary-foreground/30 rounded-l-none border-l pl-2"
            aria-label={t('radius')}
          >
            {t('distance', { distance: radiusKm })}
            <ChevronDown />
          </FilterChip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            {t('radius')}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(radiusKm)}
            onValueChange={(value) => onChange(Number(value))}
          >
            {RADIUS_OPTIONS_KM.map((option) => (
              <DropdownMenuRadioItem key={option} value={String(option)}>
                {t('within', { radius: option })}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default NearMeControl;
