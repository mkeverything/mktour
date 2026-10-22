'use client';

import FilterChip from '@/components/discovery/filter-chip';
import NearMeControl from '@/components/discovery/near-me-control';
import { DiscoveryParam, DiscoveryParams } from '@/lib/discovery-params';
import { cn } from '@/lib/utils';
import { tournamentFormatEnum, tournamentTypeEnum } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { FC, ReactNode } from 'react';

type SetParams = (
  patch: Partial<Record<DiscoveryParam, string | null>>,
) => void;

type Option = { value: string; label: string };

type Group = {
  param: DiscoveryParam;
  label: string;
  value: string | undefined;
  options: Option[];
};

const useFilterGroups = (params: DiscoveryParams): Group[] => {
  const t = useTranslations('Discovery');
  const tMake = useTranslations('MakeTournament');
  return [
    {
      param: 'format',
      label: t('format'),
      value: params.format,
      options: tournamentFormatEnum.options.map((format) => ({
        value: format,
        label: tMake(format),
      })),
    },
    {
      param: 'type',
      label: t('type'),
      value: params.type,
      options: tournamentTypeEnum.options.map((type) => ({
        value: type,
        label: tMake(`Types.${type}`),
      })),
    },
    {
      param: 'rated',
      label: t('rating'),
      value: params.rated === undefined ? undefined : String(params.rated),
      options: [
        { value: 'true', label: tMake('rated') },
        { value: 'false', label: tMake('unrated') },
      ],
    },
  ];
};

export const hasActiveFilters = (params: DiscoveryParams) =>
  Boolean(
    params.format ||
    params.type ||
    params.rated !== undefined ||
    params.search ||
    params.radiusKm,
  );

export const RESET_FILTERS = {
  format: null,
  type: null,
  rated: null,
  q: null,
  near: null,
} as const;

export const TournamentFilterChips: FC<{
  params: DiscoveryParams;
  setParams: SetParams;
}> = ({ params, setParams }) => {
  const groups = useFilterGroups(params);
  return (
    <div className="no-scrollbar -mx-mk px-mk flex gap-2 overflow-x-auto">
      <NearMeControl
        radiusKm={params.radiusKm}
        onChange={(radius) =>
          setParams({ near: radius ? String(radius) : null })
        }
      />
      {groups.flatMap(({ param, value, options }) =>
        options.map((option) => (
          <FilterChip
            key={`${param}-${option.value}`}
            active={value === option.value}
            onClick={() =>
              setParams({
                [param]: value === option.value ? null : option.value,
              })
            }
          >
            {option.label}
          </FilterChip>
        )),
      )}
    </div>
  );
};

export const TournamentFilterSidebar: FC<{
  params: DiscoveryParams;
  setParams: SetParams;
}> = ({ params, setParams }) => {
  const t = useTranslations('Discovery');
  const groups = useFilterGroups(params);
  return (
    <aside className="flex flex-col gap-5">
      <SidebarGroup label={t('where')}>
        <div className="flex">
          <NearMeControl
            radiusKm={params.radiusKm}
            onChange={(radius) =>
              setParams({ near: radius ? String(radius) : null })
            }
          />
        </div>
      </SidebarGroup>
      {groups.map(({ param, label, value, options }) => (
        <SidebarGroup key={param} label={label}>
          {[{ value: '', label: t('any') }, ...options].map((option) => {
            const active = (value ?? '') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setParams({ [param]: option.value || null })}
                className={cn(
                  'hover:bg-accent focus-visible:ring-ring/50 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px]',
                  active && 'bg-accent font-medium',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </SidebarGroup>
      ))}
      {hasActiveFilters(params) && (
        <button
          type="button"
          onClick={() => setParams(RESET_FILTERS)}
          className="text-muted-foreground hover:text-foreground w-fit px-2 text-xs underline underline-offset-2"
        >
          {t('reset filters')}
        </button>
      )}
    </aside>
  );
};

const SidebarGroup: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground px-2 text-xs font-medium">
      {label}
    </span>
    {children}
  </div>
);
