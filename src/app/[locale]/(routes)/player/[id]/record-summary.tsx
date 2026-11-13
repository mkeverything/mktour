import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** a win-draw-loss record as one bar, each share over its count, written the way crosstables write them */
const RecordSummary: FC<{ wins: number; draws: number; losses: number }> = (
  record,
) => {
  const t = useTranslations('Player.Page');
  const parts = [
    ['+', record.wins, t('won'), 'bg-foreground'],
    ['=', record.draws, t('drawn'), 'bg-muted-foreground'],
    ['−', record.losses, t('lost'), 'bg-muted'],
  ] as const;

  return (
    <div className="flex gap-0.5 tabular-nums">
      {parts.map(([sign, count, name, colour]) => (
        // a share never gets narrower than its count, so a rare outcome stays readable
        <div
          key={sign}
          className="flex min-w-fit basis-0 flex-col gap-2"
          style={{ flexGrow: count }}
        >
          <span
            aria-hidden
            className={cn('h-1.5 rounded-full', count ? colour : 'bg-muted')}
          />
          <abbr title={name} className="pr-2 text-sm font-medium no-underline">
            {sign}
            {count}
          </abbr>
        </div>
      ))}
    </div>
  );
};

export default RecordSummary;
