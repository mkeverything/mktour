## mktour - agent guidelines

tournament management web app. users sign in via lichess, create clubs, manage players, run tournaments (swiss, round robin, single/double elimination), and track ratings (glicko-2).

production: https://mktour.org

## architecture

- next.js 16 app router with react 19, bun runtime
- database: turso (libsql) via drizzle orm — sqlite dialect
- auth: lucia + arctic (lichess oauth), session cookies, api tokens (`mktour_<id>_<secret>`)
- api: trpc v11 with superjson transformer and openapi generation (trpc-to-openapi)
- client state: tanstack react-query via `@trpc/tanstack-react-query`
- real-time: websockets (react-use-websocket) for tournament dashboards and global events
- i18n: next-intl, locales in `src/messages/` (en, ru)
- styling: tailwind css v4, shadcn/ui, class-variance-authority
- pwa: next-pwa, service worker in `public/`
- caching: next.js `"use cache"` directives with `cacheLife()` and `cacheTag()` (see `src/lib/cache-tags.ts`)
- hosting: vercel with cron jobs (`vercel.json`)

## domain model

clubs → tournaments → players → games

- **users**: lichess-authenticated accounts, each has a selectedClub
- **clubs**: organizations that own tournaments and players. managers have status admin/co-owner (`clubs_to_users`)
- **players**: belong to a club, have glicko-2 ratings (rating, ratingDeviation, ratingVolatility). a user can be affiliated to a player via `affiliations`
- **tournaments**: belong to a club, formats: swiss / round robin / single elimination / double elimination. types: solo / doubles / team
- **games**: belong to a tournament round, white/black player ids, result (1-0, 0-1, 1/2-1/2)
- **notifications**: club-level and user-level event notifications

schema source of truth: `src/server/db/schema/` — zod models in `src/server/db/zod/`

### player-user relationships

players have a direct `userId` field that links them to users. this is the primary relationship.

the `affiliations` table is for affiliation requests/management (pending, active, rejected statuses). it's not the primary way to query player-user relationships.

**when querying players for a user**: use `players.userId` directly. do not over-complicate with joins to the affiliations table unless specifically dealing with affiliation status/requests.

## key directories

```
src/
├── app/                   # next.js routes and api
│   ├── (routes)/          # auth-conditional layout
│   ├── api/[...trpc]/     # trpc http handler
│   ├── api/auth/          # lichess oauth + session cleanup cron
│   ├── api/db/migrate/    # production migration endpoint
│   ├── clubs/[id]/        # club dashboard
│   └── tournaments/[id]/  # tournament dashboard
├── components/
│   ├── hooks/
│   │   ├── mutation-hooks/  # trpc mutation wrappers with optimistic updates
│   │   └── query-hooks/     # trpc query wrappers
│   ├── trpc/              # client.tsx (TRPCReactProvider), server.tsx, query-client.ts
│   ├── ui/                # shadcn components (DO NOT EDIT)
│   └── ui-custom/         # extended/custom components
├── lib/
│   ├── auth/lucia.ts      # lucia setup, validateRequest (cached), lichess oauth
│   ├── cache-tags.ts      # cache tag constants (AUTH, USER_CLUBS, ALL_TOURNAMENTS, ALL_CLUBS)
│   ├── config/            # urls.ts (base url, socket url, db url), constants.ts
│   ├── pairing-generators/ # swiss, round-robin, random pairs algorithms
│   └── zod/               # form validation schemas
├── server/
│   ├── api/
│   │   ├── trpc.ts        # context, procedures (public, protected, auth, clubAdmin, tournamentAdmin)
│   │   ├── index.ts       # appRouter, publicCaller, makeProtectedCaller
│   │   └── routers/       # auth, club, player, search, tournament, user
│   ├── db/
│   │   ├── schema/        # drizzle table definitions (clubs, users, tournaments, players, notifications)
│   │   ├── zod/           # zod models inferred from schema + enums
│   │   ├── migrations/    # drizzle migration files
│   │   └── seed.ts        # test data seeding
│   ├── mutations/         # server-side mutation logic by domain
│   └── queries/           # server-side query logic by domain
├── tests/
│   ├── setup/
│   │   ├── preload.ts     # sets NODE_ENV=test, verifies test db, seeds data
│   │   └── utils.ts       # createAuthenticatedCaller, cleanupTestDb, helpers
│   └── *.test.ts
└── types/                 # global type declarations
```

## trpc procedures

five procedure levels in `src/server/api/trpc.ts`:

- `publicProcedure` — no auth required
- `authProcedure` — attaches user if logged in but does not enforce
- `protectedProcedure` — requires valid session, throws UNAUTHORIZED
- `clubAdminProcedure` — extends protected, requires user to be admin/co-owner of the club
- `tournamentAdminProcedure` — extends protected, requires user to be organizer of the tournament

routers: `auth`, `club`, `player`, `search`, `tournament`, `user` (in `src/server/api/routers/`)

server-side callers: `publicCaller` and `makeProtectedCaller()` in `src/server/api/index.ts`

## openapi spec generation

**CRITICAL**: openapi spec is ALWAYS auto-generated by trpc-to-openapi. NEVER edit `src/app/api/spec/openapi-spec.json` manually.

workflow for adding new endpoints to openapi:

1. add openapi metadata to `src/server/api/meta.ts` (method, path, summary, tags)
2. attach `.meta(meta.yourEndpoint)` to the trpc procedure
3. run `bun generate-openapi` to regenerate the spec file

the spec file is generated from trpc router definitions and should never be manually modified.

## query design principles

- **keep queries simple**: use the most direct path to get data. avoid unnecessary joins or complex logic
- **respect the domain model**: understand the primary relationships (e.g., `players.userId` is the primary user-player link, not `affiliations`)
- **avoid over-engineering**: if a simple query with one join works, don't add multiple queries and deduplication logic
- **read existing patterns**: before implementing, check similar queries in the codebase to follow established patterns

## commands

```
bun dev                      # start dev server
bun dev:test                 # dev with test database (MKTOURTEST=true)
bun dev:local                # offline mode (OFFLINE=true, local sqld at :8080)
bun run build                # production build
bun start                    # start production server
bun check                    # typecheck + lint + tests (run before pushing)
bun format                   # prettier formatting
bun knip                     # find unused deps/exports
bun test                     # run all tests (with db seed)
bun test path/to/file        # run single test file (with db seed)
bun test:noseed path/to/file # run test without db seed (fast for non-db tests)
SKIP_SEED=1 bun test ...     # alternative: skip seed via env var
bun analyze                  # bundle analysis
bun db:push                  # generate + run migrations
bun db:studio                # open drizzle studio
bun generate-erd             # generate entity-relationship diagram
bun generate-openapi         # generate openapi spec
```

always run `bun check` before pushing. use single-file test when validating changes.

## code style

- **no capital letters** in ui text, comments, or prose — write everything lowercase unless technically required
- no unnecessary comments in code
- files: kebab-case (`user-profile.tsx`), components: PascalCase, variables: camelCase, constants: UPPER_SNAKE_CASE, types: PascalCase
- absolute imports: `@/` prefix (maps to `src/`)
- import order: react → third-party → internal (blank lines between groups), use `import type` for type-only
- server components by default; add `'use client'` only for interactive parts
- `cn()` for conditional tailwind classes, cva for component variants
- `src/components/ui/` = untouched shadcn components; extend in `src/components/ui-custom/`

## typescript & types

- strict typing; schema is the single source of truth
- types prefixed with `Database` (e.g. `DatabaseUser`) live in `src/server/db/zod/`
- enums defined via zod in `src/server/db/zod/enums.ts`, inferred as typescript types
- use zod for all api input/output validation
- avoid ad-hoc types outside canonical folders

## optimistic updates

use react-query optimistic updates when the ui needs to feel instant. pattern:

- onMutate: cancel queries, save previous state, optimistically update cache
- onSuccess: broadcast via websocket if multi-client sync needed
- onError: rollback to previous state
- onSettled: use `isMutating() === 1` check — invalidation only runs after the final concurrent mutation completes, preventing flicker during rapid clicks

the `isMutating() === 1` check is required ONLY for mutations that do optimistic cache updates (onMutate with manual cache set). these create a gap between client and server state.

```typescript
onSettled: () => {
  if (
    queryClient.isMutating({
      mutationKey: trpc.tournament.addNewPlayer.mutationKey(),
    }) === 1
  ) {
    queryClient.invalidateQueries({ queryKey: ... });
  }
},
```

## testing

- bun test runner; test files end with `.test.ts` or `.test.tsx`
- tests live under `src/tests/`, some colocated in `src/lib/` (e.g. pairing generators)
- `bunfig.toml` preloads `src/tests/setup/preload.ts` which sets NODE_ENV=test, verifies the test database url contains "test", cleans and seeds data
- test utilities: `src/tests/setup/utils.ts` — `createAuthenticatedCaller()`, `createUnauthenticatedCaller()`, `cleanupTestDb()`, `getSeededTestData()`
- use mocks from `bun:test`
- test both success and failure paths

### skipping database seed

for tests that don't need database (e.g. pure logic tests like glicko-2, pairing generators), skip seeding to run tests instantly:

```bash
bun test:noseed path/to/test.ts  # using npm script
SKIP_SEED=1 bun test path/to/test.ts  # using env var directly
```

this reduces test time from ~15s to ~20ms for non-db tests.

## i18n

- next-intl, configured at `src/components/i18n.ts`
- translation files: `src/messages/en.json`, `src/messages/ru.json`
- no hard-coded user-facing strings; use translation keys
- format dates with date-fns

## git & commits

- conventional commits: feat, impr, fix, docs, style, ref, perf, test, build, ci, chore, revert
- subject line ≤ 100 chars, imperative mood
- body wrapped at ~100 chars; explain why
- small, focused commits; avoid large rewrites
- do not push to remote without user approval
- do not amend unless explicitly requested
- syncing beta to main: `git checkout beta && git reset --hard origin/main && git push --force origin beta`

## environment

- `.env.local` for local development
- test env: `NODE_ENV=test` + `TEST_DATABASE_URL` / `TEST_DATABASE_AUTH_TOKEN`
- offline/local mode: `OFFLINE=true` uses local sqld at `http://localhost:8080`
- websocket server at `ws://localhost:7070` in dev, `NEXT_PUBLIC_SOCKET_URL` in prod
- secrets must never be committed
