// no imports here: the proxy and client components read these too
export const COOKIES = {
  SESSION: 'auth_session',
  LOCALE: 'NEXT_LOCALE',
  AUTH_FROM: 'auth_from',
  OAUTH_STATE: 'lichess_oauth_state',
  OAUTH_CODE_VERIFIER: 'lichess_oauth_code_validation',
} as const;
