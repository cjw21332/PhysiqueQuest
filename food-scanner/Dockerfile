# syntax=docker/dockerfile:1

# =============================================================================
# Build stage
# =============================================================================
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install with the lockfile first so dependency layers cache across code edits.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

COPY server ./server
RUN npm --workspace server run build

# =============================================================================
# Runtime stage
# =============================================================================
FROM node:22-bookworm-slim AS runtime

# dumb-init gives us correct PID 1 signal handling, so SIGTERM from the
# orchestrator reaches Node and the graceful shutdown path actually runs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Production dependencies only. The client workspace is installed because npm
# workspaces resolves the whole tree, but no client source is copied.
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY server/package.json ./server/package.json

# Run unprivileged. node:22-slim already provides a `node` user (uid 1000).
USER node

EXPOSE 3001

# The liveness probe is deliberately unauthenticated and returns only
# { "status": "ok" } - see server/src/app.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/livez').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/index.js"]
