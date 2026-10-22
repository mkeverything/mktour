import {
  tournamentFormatEnum,
  TournamentStatus,
  tournamentStatusEnum,
  tournamentTypeEnum,
} from '@/server/zod/enums';

export const RADIUS_OPTIONS_KM = [10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 25;

const DISCOVERY_PARAMS = {
  STATUS: 'status',
  FORMAT: 'format',
  TYPE: 'type',
  RATED: 'rated',
  SEARCH: 'q',
  RADIUS: 'near',
  VIEW: 'view',
} as const;

export type DiscoveryParam =
  (typeof DISCOVERY_PARAMS)[keyof typeof DISCOVERY_PARAMS];

export type DiscoveryView = 'list' | 'map';

type ParamsSource = { get: (key: string) => string | null };

const parseRadius = (value: string | null) => {
  const radius = Number(value);
  return RADIUS_OPTIONS_KM.find((option) => option === radius);
};

const parseRated = (value: string | null) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

export const parseDiscoveryParams = (params: ParamsSource) => ({
  status: tournamentStatusEnum.safeParse(params.get(DISCOVERY_PARAMS.STATUS))
    .data,
  format: tournamentFormatEnum.safeParse(params.get(DISCOVERY_PARAMS.FORMAT))
    .data,
  type: tournamentTypeEnum.safeParse(params.get(DISCOVERY_PARAMS.TYPE)).data,
  rated: parseRated(params.get(DISCOVERY_PARAMS.RATED)),
  search:
    params.get(DISCOVERY_PARAMS.SEARCH)?.trim().slice(0, 100) || undefined,
  radiusKm: parseRadius(params.get(DISCOVERY_PARAMS.RADIUS)),
  view: (params.get(DISCOVERY_PARAMS.VIEW) === 'map'
    ? 'map'
    : 'list') as DiscoveryView,
});

export type DiscoveryParams = ReturnType<typeof parseDiscoveryParams>;

export const toParamsSource = (
  searchParams: Record<string, string | string[] | undefined>,
): ParamsSource => ({
  get: (key) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ?? null;
  },
});

export const getTournamentStatus = (tournament: {
  startedAt: Date | null;
  closedAt: Date | null;
}): TournamentStatus => {
  if (tournament.closedAt) return 'finished';
  if (tournament.startedAt) return 'live';
  return 'upcoming';
};
