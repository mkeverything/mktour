# see all versions at https://hub.docker.com/r/oven/bun/tags
# keep in sync with packageManager in package.json and bun-version in .github/workflows/ci.yml
FROM oven/bun:1.4.2-slim AS base
WORKDIR /app

# "prepare" installs husky's git hooks, which the image has no use for
FROM base AS install
COPY package.json bun.lock ./
COPY patches patches
RUN HUSKY=0 bun install --frozen-lockfile

FROM base AS build
COPY --from=install /app/node_modules node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined and DEPLOY_ENV decides prerendered pages like robots.txt,
# so every environment gets its own image
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_API_HOST
ARG NEXT_PUBLIC_POSTHOG_UI_HOST
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG DEPLOY_ENV
# the commit: clients of an older build reload instead of requesting assets that are gone
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
# the build runs no queries, but the database client is created on import and needs a valid url
RUN DATABASE_URL=libsql://build.invalid bun run build

# only the traced server, its static assets and public files: no sources, secrets or dev tooling
FROM base AS release
LABEL org.opencontainers.image.source=https://github.com/mkeverything/mktour
ARG DEPLOY_ENV
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DEPLOY_ENV=$DEPLOY_ENV HOSTNAME=0.0.0.0 PORT=3000
# next writes regenerated pages and its cache under .next at runtime
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build /app/.next/static .next/static
COPY --from=build /app/public public

# a uid no host account has, so host users can neither read the environment nor signal the server
USER 10001:10001
EXPOSE 3000/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=1s --retries=3 \
  CMD ["bun", "--eval", "const res = await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`); process.exit(res.ok ? 0 : 1)"]

ENTRYPOINT ["bun", "server.js"]
