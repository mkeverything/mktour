'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TournamentStatus, tournamentStatusEnum } from '@/server/zod/enums';
import { TournamentStatusCountsModel } from '@/server/zod/discovery';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

const ALL = 'all';
const TRIGGER_CLASS = 'h-full px-1 text-xs sm:px-3 sm:text-sm';

const TournamentStatusTabs: FC<{
  status?: TournamentStatus;
  counts?: TournamentStatusCountsModel;
  onChange: (status: TournamentStatus | null) => void;
  className?: string;
}> = ({ status, counts, onChange, className }) => {
  const t = useTranslations('Discovery');
  return (
    <Tabs
      value={status ?? ALL}
      onValueChange={(value) =>
        onChange(tournamentStatusEnum.safeParse(value).data ?? null)
      }
      className={className}
    >
      <TabsList className="grid h-10 w-full grid-cols-4 px-1">
        <TabsTrigger value={ALL} className={TRIGGER_CLASS}>
          {t('all')}
        </TabsTrigger>
        {tournamentStatusEnum.options.map((option) => (
          <TabsTrigger
            key={option}
            value={option}
            className={`gap-1 ${TRIGGER_CLASS}`}
          >
            {option === 'live' && Boolean(counts?.live) && (
              <span className="bg-destructive size-1.5 rounded-full" />
            )}
            {t(option)}
            {counts && (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {counts[option]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default TournamentStatusTabs;
