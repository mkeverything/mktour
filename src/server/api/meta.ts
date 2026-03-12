import { OpenApiMeta } from 'trpc-to-openapi';
import { authMeta } from './meta/auth';
import { clubMeta } from './meta/club';
import { playerMeta } from './meta/player';
import { searchMeta } from './meta/search';
import { tournamentMeta } from './meta/tournament';
import { userMeta } from './meta/user';

const meta = {
  ...authMeta,
  ...userMeta,
  ...clubMeta,
  ...tournamentMeta,
  ...playerMeta,
  ...searchMeta,
} as const satisfies Record<string, OpenApiMeta>;

export default meta;
