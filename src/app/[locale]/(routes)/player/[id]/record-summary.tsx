import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** a win-draw-loss record: the three counts under their shares of one bar */
const RecordSummary: FC<{ wins: number; draws: number; losses: number }> = ({
  wins,
  draws,
  losses,
}) => {
  const t = useTranslations('Player.Page');
  const parts = [
    [wins, t('won'), 'bg-foreground'],
    [draws, t('drawn'), 'bg-muted-foreground/60'],
    [losses, t('lost'), 'bg-muted-foreground/20'],
  ] as const;

  return (
    <>
      <div
        aria-hidden
        className="bg-muted flex h-1.5 gap-0.5 overflow-hidden rounded-full"
      >
        {parts.map(
          ([count, label, colour]) =>
            count !== 0 && (
              <span
                key={label}
                className={cn('rounded-full', colour)}
                style={{ flexGrow: count }}
              />
            ),
        )}
      </div>
      <dl className="grid grid-cols-3 gap-4">
        {parts.map(([count, label]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">
              {count}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
};

export default RecordSummary;
