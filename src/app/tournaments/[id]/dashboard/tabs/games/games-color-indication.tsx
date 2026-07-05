import {
  getGamesGridClassName,
  shouldUseFullWidthGameItems,
  shouldUseThreeGameColumns,
} from '@/app/tournaments/[id]/dashboard/tabs/games/games-grid';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';
import { FC } from 'react';

const ColorHint: FC<{ className?: string }> = ({ className }) => (
  <div className={cn('gap-mk flex min-w-0', className)}>
    <Card className="h-mk dark:bg-primary bg-secondary min-w-0 flex-1 rounded-lg" />
    <Card className="h-mk dark:bg-secondary bg-primary min-w-0 flex-1 rounded-lg" />
  </div>
);

export function GamesColorIndication({ units }: { units?: UnitModel[] }) {
  const fullWidth = shouldUseFullWidthGameItems(units);
  const threeColumns = shouldUseThreeGameColumns(units);

  return (
    <div className={getGamesGridClassName(units)}>
      <ColorHint />
      <ColorHint className={fullWidth ? 'max-lg:@max-3xl:hidden' : undefined} />
      {threeColumns ? <ColorHint className="hidden lg:flex" /> : null}
    </div>
  );
}
