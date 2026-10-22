'use client';

import { usePlaceText } from '@/components/discovery/place-label';
import { LocationPicker } from '@/components/discovery/maps';
import { usePlace } from '@/components/discovery/use-place';
import useTournamentEditLocation from '@/components/hooks/mutation-hooks/use-tournament-edit-location';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import * as ComboModal from '@/components/ui-custom/combo-modal';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { Button } from '@/components/ui/button';
import {
  Coordinates,
  getClubCoordinates,
  getTournamentCoordinates,
  hasOwnLocation,
} from '@/lib/location';
import { MapPin, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useState } from 'react';

const TournamentLocation: FC<{
  tournamentId: string;
  isOrganizer: boolean;
}> = ({ tournamentId, isOrganizer }) => {
  const t = useTranslations('Discovery.Location');
  const placeText = usePlaceText();
  const { data } = useTournamentInfo(tournamentId);
  const coordinates = data
    ? getTournamentCoordinates(data.tournament, data.club)
    : null;
  const place = usePlace(coordinates);

  if (!data) return null;
  const atClub = !hasOwnLocation(data.tournament);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <MapPin className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate">
        {place ? placeText(place) : null}
        {atClub && (
          <span className="text-muted-foreground">
            {place && ' · '}
            {t('club location')}
          </span>
        )}
      </span>
      {isOrganizer && (
        <EditLocation
          tournamentId={tournamentId}
          initialValue={atClub ? null : coordinates}
          clubCenter={getClubCoordinates(data.club)}
        />
      )}
    </span>
  );
};

const EditLocation: FC<{
  tournamentId: string;
  initialValue: Coordinates | null;
  clubCenter: Coordinates;
}> = ({ tournamentId, initialValue, clubCenter }) => {
  const t = useTranslations('Discovery.Location');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const { mutate, isPending } = useTournamentEditLocation(tournamentId);

  return (
    <ComboModal.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(initialValue);
        setOpen(next);
      }}
    >
      <ComboModal.Trigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t('edit')}
          aria-label={t('edit')}
          className="text-muted-foreground hover:text-primary size-6 shrink-0"
        >
          <Pencil className="size-3.5" />
        </Button>
      </ComboModal.Trigger>
      <ComboModal.Content>
        <ComboModal.Header>
          <ComboModal.Title>{t('venue')}</ComboModal.Title>
          <ComboModal.Description>
            {t('venue description')}
          </ComboModal.Description>
        </ComboModal.Header>
        <div className="px-mk md:px-0">
          <LocationPicker
            value={value}
            onChange={setValue}
            fallbackCenter={clubCenter}
            emptyLabel={t('club location')}
            disabled={isPending}
          />
        </div>
        <ComboModal.Footer>
          <ComboModal.Close asChild>
            <Button variant="outline">{t('cancel')}</Button>
          </ComboModal.Close>
          <Button
            disabled={isPending}
            onClick={() =>
              mutate(
                {
                  tournamentId,
                  latitude: value?.latitude ?? null,
                  longitude: value?.longitude ?? null,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending && <LoadingSpinner />}
            {t('save')}
          </Button>
        </ComboModal.Footer>
      </ComboModal.Content>
    </ComboModal.Root>
  );
};

export default TournamentLocation;
