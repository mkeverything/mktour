import { cn } from '@/lib/utils';
import { FC } from 'react';

const HUE_STEPS = 360;

const hueFromId = (id: string) =>
  [...id].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % HUE_STEPS,
    7,
  );

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0])
    .join('')
    .toLocaleUpperCase();

const ClubCrest: FC<{ id: string; name: string; className?: string }> = ({
  id,
  name,
  className,
}) => (
  <span
    aria-hidden
    className={cn(
      'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white',
      className,
    )}
    style={{ backgroundColor: `oklch(0.52 0.11 ${hueFromId(id)})` }}
  >
    {initials(name)}
  </span>
);

export default ClubCrest;
