export const CACHE_TAGS = {
  AUTH: 'auth',
  USER_CLUBS: 'user-clubs',
  ALL_TOURNAMENTS: 'all-tournaments',
  ALL_CLUBS: 'all-clubs',
  USER_PUBLIC_PROFILE: 'user-public-profile', //requires adding username after colon
} as const;

export function userPublicProfileTag(username: string): string {
  return `${CACHE_TAGS.USER_PUBLIC_PROFILE}:${username.toLowerCase()}`;
}

export type CacheTag = keyof typeof CACHE_TAGS;
