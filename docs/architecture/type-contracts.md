# trpc + zod type contracts

this document defines mandatory architecture rules for product/domain code.

## non-negotiable rules

1. all product/domain data operations must go through tRPC.
2. `src/server/db/zod/` is the only source of truth for domain schemas and types.
3. all client domain types must be inferred/imported from canonical zod schemas.
4. tRPC `.input()` and `.output()` must reference canonical schemas from `src/server/db/zod/`.
5. zod schemas should be derived from db schema definitions where possible.

## allowed exceptions

these are infra-only and are not part of product/domain contract:

- oauth callback/login route handlers
- cron and migration endpoints
- websocket transport channels

## implementation guidelines

- prefer table-derived schemas in `src/server/db/zod/*`.
- for non-table domain payloads (filters, views, command payloads), define dedicated zod schemas in `src/server/db/zod/*` and export inferred types.
- if ui needs adapter schemas, derive them from canonical server schemas. do not duplicate domain shapes in `src/lib/zod/*`.
- do not import types from router files in client code.
- avoid inline ad-hoc `z.object(...)` in routers when the schema is reused or represents domain contracts.

## review checklist

- are all domain requests/mutations routed via tRPC?
- do router inputs/outputs import schemas from `src/server/db/zod/`?
- are client domain types imported from canonical zod-inferred types?
- are there any duplicated domain interfaces/types that mirror zod models?
- are any server actions used as hidden rpc for domain validation or mutation?
