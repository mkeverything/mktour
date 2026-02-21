## mktour - agent guidelines

this file describes how to operate as an agent inside this repo. it covers build, lint, test workflows, and code style expectations so agents can work consistently and safely.

## commands

- development
- bun dev # start development server
- bun dev:test # run with test environment
- bun dev:local # offline/local database mode
- bun opt # enable optimizations

- building & production
- bun run build # production build
- bun start # start production server
- bun analyze # analyze bundle size

- code quality
- bun check # typecheck, lint, tests
- bun format # prettier formatting
- bun knip # find unused dependencies/exports

- testing
- bun test # run all tests
- bun test path/to/file # run a single test file (e.g. bun test src/tests/foo.test.ts)
- bun test path/to/file -t "name" # run a single test by name (where supported)
- bun test path/to/file -- -t "name" # alternative passthrough form for test name filtering

- database
- bun db:push # generate and run migrations
- bun db:drop # drop database
- bun db:studio # open drizzle studio
- bun db:check # check database schema
- bun localdb:\* # offline development commands (aliases)

- migrating production database
  curl -X POST https://mktour.org/api/db/migrate \
   -H "authorization: Bearer <CRON_SECRET>"

- other
- bun generate-erd # generate entity-relationship diagram
- bun generate-openapi # generate openapi specification

> notes:

- always run tests and lint before pushing; use single-file test when validating changes.
- if a test name pattern is used, ensure the pattern matches an existing test description.

## code style & conventions

- ui & formatting rules
- no capital letters in ui text at all
- no capital letters in comments
- no unnecessary comments in code
- write everything in lowercase unless technically required

- file structure
- use 'src/' as the base directory
- follow next.js 13+ app router conventions
- components in 'src/components/' (subdirectories for categories)
- pages in 'src/app/[route]/page.tsx'
- api routes in 'src/app/api/[...] /route.ts'
- database schema in 'src/server/db/schema/'
- utilities in 'src/lib/'

- component organization
- 'src/components/ui/' only for default shadcn components
- all customized components go in 'src/components/ui-custom/'
- never modify shadcn components directly, extend them in ui-custom

- import style
- use absolute imports with '@/ prefix: 'import { button } from '@/components/ui/button''
- order: react → third-party → internal (blank lines between groups)
- use 'import type' for type-only imports
- consolidate import paths when possible (vs code organize imports)

- naming conventions
- files: kebab-case ('user-profile.tsx')
- components: PascalCase ('UserProfile')
- variables/functions: camelCase ('getUserData')
- constants: lower_snake_case ('api_base_url')
- interfaces/types: PascalCase ('UserData')

- typescript & typing
- strict typing; follow a single source of truth where possible
- all types relate to the database schema when feasible
- schema/types prefixed with 'database' (e.g. 'DatabaseUser')
- models defined in 'server/db/zod/' and inferred from schema
- avoid defining ad-hoc types outside the canonical folder
- types exported from the schema should be used by api boundaries
- use zod for input/output validation in APIs

- react components
- prefer functional components with hooks
- server components by default; add 'use client' only for interactive parts
- use cn() for conditional tailwind classes
- use class-variance-authority (cva) for component variants

- styling
- tailwind css as primary styling solution
- mobile-first responsive design
- extend shadcn/ui components via 'ui-custom/'; avoid editing upstream files
- css-in-js only when absolutely necessary

- database & api
- drizzle orm with zod schemas for type safety
- tRPC for API endpoints with auto-generated types
- separate router files by domain (e.g. 'user.ts', 'club.ts')
- implement optimistic UI updates where appropriate
- proper error handling and http status codes; avoid leaking sensitive data

- error handling
- use react-error-boundary for react components
- api routes should use try/catch and return clear errors
- log errors with context; avoid exposing secrets

## optimistic updates

use react-query optimistic updates when the UI needs to feel instant (e.g. counters, toggles, quick actions). follow this pattern to handle concurrent mutations without flicker:

- onMutate: cancel queries, save previous state, optimistically update cache
- onSuccess: broadcast changes via WebSocket if multi-client sync needed
- onError: rollback to previous state
- onSettled / onSuccess: use `isMutating() === 1` check - invalidation only runs after the final mutation, preventing flicker during rapid clicks

### when to use isMutating() === 1 check

the check is required ONLY for updates (onMutate with manual cache update). these mutations create mutations that use optimistic a gap between client and server state, so we must wait for all concurrent mutations to complete before invalidating.

pattern:

```typescript
// with mutationKey (recommended - more specific)
onSettled: () => {
  if (
    queryClient.isMutating({
      mutationKey: trpc.tournament.addNewPlayer.mutationKey(),
    }) === 1
  ) {
    queryClient.invalidateQueries({ queryKey: ... });
  }
},

// or without mutationKey (checks all mutations)
onSettled: () => {
  if (queryClient.isMutating() === 1) {
  }
},
```

## testing

- bun test runner; tests end with '.test.ts' or '.test.tsx'
- place tests under 'src/tests/'
- share utilities under 'tests/setup/utils.ts'
- use mocks from 'bun:test'
- test both success and failure paths
- focus tests to a single file when validating changes

- internationalization
- next-intl for translations
- translation bundles in 'messages/' per locale
- use structured text components (no hard-coded strings)
- format dates with date-fns

- performance
- caching and memoization where appropriate
- avoid unnecessary re-renders; use React.memo
- suspense for data loading states
- optimize images; use framework image components when possible
- run bundle analysis with 'bun analyze'

- git & commits
- follow conventional commits (feat, impr, fix, docs, style, ref, perf, test, build, ci, chore, revert)
- subject line <= 100 characters; imperative mood
- body wrapped at ~100 characters; explain why the change matters
- small, focused commits; avoid large rewrites
- avoid amend unless explicitly requested and safe
- do not push to remote without user approval
- syncing branches: to make beta identical to main without merge commits: `git checkout beta && git reset --hard origin/main && git push --force origin beta`

- code quality tools
- eslint with next.js ts config
- prettier with tailwind plugin
- husky pre-commit hooks
- knip for unused code detection
- semantic release for versioning

- environment
- use '.env.local' for local development
- separate test environment with 'node_env=test'
- database URLs configured per environment; env vars validated via schemas
- secrets should never be committed

## cursor rules and copilot guidance

- cursor rules: not configured in this repo; follow editor and team conventions
- copilot instructions: see .github/copilot-instructions.md for full policy
- summary: edits should be patch-based (apply_patch); avoid destructive git commands unless asked
- always run tests and lint locally; report failures and fix before prs
- ensure no secrets are introduced by generated code
- when in doubt, craft small, reviewable changes and add tests

## copilot guidelines (summary)

- follow repository conventions when generating code
- prefer patch-based edits; avoid large rewrites without review
- validate changes with tests locally
- guard against leaking sensitive data in generated patches
- consult .github/copilot-instructions.md for full policy

## closing

- this file should be kept up to date with repository practices
- if cursor rules exist later, append them here
- aim for clear, actionable guidance that agents can follow without extra context

```

```
