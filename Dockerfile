# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# 1. Build the React client (Vite + Tailwind).
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS client

WORKDIR /app/client

# Install with the committed lockfile first so source edits don't bust the cache.
COPY client/package.json client/bun.lock ./
RUN bun install --frozen-lockfile

COPY client/ ./
RUN bun run build


# ─────────────────────────────────────────────────────────────────────────────
# 2. Runtime dependencies for the Bun gateway.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps

WORKDIR /app/server

COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production


# ─────────────────────────────────────────────────────────────────────────────
# 3. Final image — Bun runs the TypeScript gateway directly and serves
#    client/dist from ../../client/dist relative to server/src.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime

WORKDIR /app/server

ENV NODE_ENV=production \
    PORT=3008 \
    DATA_DIR=/app/data

COPY --from=deps /app/server/node_modules ./node_modules
COPY server/package.json server/tsconfig.json ./
COPY server/src ./src
COPY --from=client /app/client/dist /app/client/dist

# SQLite lives on a volume; make it writable by the unprivileged user.
RUN mkdir -p /app/data && chown -R bun:bun /app/data

USER bun

EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health > /dev/null 2>&1 || exit 1

CMD ["bun", "src/index.ts"]