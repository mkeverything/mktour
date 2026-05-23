## mktour

tournament management web app. users sign in via lichess, create clubs, manage players, run tournaments (swiss, round robin — implemented, eliminations — projected), and track ratings (glicko-2).

## critical architecture rules

- all product/domain data operations go through tRPC procedures; do not add alternate domain rpc paths
- `src/server/zod/` is the only canonical source for domain schemas and domain types
- tRPC `.input()` and `.output()` contracts must use canonical schemas from `src/server/zod/`
- client-side domain types must be inferred/imported from canonical server zod schemas; do not redeclare domain shapes manually
- zod schemas should be derived from drizzle db schemas where possible
- allowed non-domain route exceptions: oauth, cron/migration, websocket transport

## domain rules that are easy to get wrong

- clubs own tournaments and players; tournaments own rounds/games
- players link directly to users via `players.userId`; use this for normal user-player queries
- `affiliations` is for affiliation request/status flows, not general user-player lookup

## api and data patterns

- keep queries direct; avoid unnecessary joins, extra queries, or deduplication logic
- prefer typed drizzle query builder APIs over raw `sql``; use raw sql only when drizzle has no typed equivalent

- when adding openapi endpoints: add metadata in `src/server/api/meta.ts`, attach `.meta(...)`

## errors and i18n

- canonical error catalog: `src/lib/errors.ts`
- never throw native `Error` for app/domain failures; throw `new AppError(ERRORS.SOME_CODE)`
- never hard-code user-facing error messages; add an `ERRORS` code and translations in every locale
- client error ui should translate error codes via `getAppErrorCode`, `useIntlError()`, or `useTranslations('Errors')`
- keep `src/messages/en.json` and `src/messages/ru.json` structurally aligned
- no hard-coded user-facing strings; use translation keys
- when adding/changing error codes, run `bun test:noseed src/tests/errors.test.ts src/tests/messages.test.ts`

## optimistic updates

- for mutations with manual optimistic cache writes, guard invalidation with `queryClient.isMutating({ mutationKey }) === 1`
- do not add custom mutation queues, debounces, refs, or tanstack `scope` serialization for rapid interactions unless explicitly requested

## codebase conventions

- ui text, comments, and prose should be lowercase unless technically required
- no unnecessary comments in code
- preserve `/** @deprecated ... */` / `/** deprecated */` markers on exports unless asked to remove them
- files: kebab-case; components/types: PascalCase; variables: camelCase; constants: UPPER_SNAKE_CASE
- absolute imports use `@/`
- `src/components/ui/` is shadcn code; never edit it
- extend/customize ui in `src/components/ui-custom/`
- oxford english spelling required

## commands

- runtime/package manager: bun
- `bun check` - typecheck + lint + tests
- `bun test path/to/file` - run one test file with db seed
- `bun test:noseed path/to/file` - fast tests without db seed
- mobile dev setup: `bash .cursor/skills/mobile-dev/scripts/setup-mobile-dev.sh`

## development flow

- feature/project prs target `beta`; only `beta` prs into `main`
- if asked to open a feature pr against `main`, confirm first
- do not push to remote without user approval
- do not amend commits unless explicitly requested
- syncing beta to main: `git checkout beta && git reset --hard origin/main && git push --force origin beta`
