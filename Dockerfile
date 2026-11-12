# syntax=docker/dockerfile:1

# Single base for build + runtime so the pnpm store layout matches.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/bin \
    CI=1
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /app

# Dependencies first: this layer is cached until a package.json or the lockfile changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json               apps/web/package.json
COPY packages/contracts/package.json     packages/contracts/package.json
COPY packages/engine/package.json        packages/engine/package.json
COPY packages/fixtures/package.json      packages/fixtures/package.json
RUN pnpm install --frozen-lockfile

# Build the Next.js app. Workspace packages are transpiled from source
# (transpilePackages in apps/web/next.config.mjs), so no separate build step.
FROM deps AS build
COPY . .
RUN pnpm --filter @unsheet/web build

# Runtime: same node_modules, no dev tooling needed beyond what pnpm start uses.
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/web
EXPOSE 3000
# Call next directly: pnpm 10's verify-deps-before-run hook fails inside the
# runtime image (prod node_modules, no registry access) and warns on every boot.
CMD ["./node_modules/.bin/next", "start"]
