# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

ARG BUN_VERSION=1.3.10

FROM oven/bun:${BUN_VERSION} AS dependencies

WORKDIR /app

# Copy Bun package metadata first to leverage Docker layer caching.
COPY package.json bun.lock ./

# Install project dependencies with a frozen lockfile for reproducible builds.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================

FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ============================================
# Stage 3: Run Next.js application
# ============================================

FROM oven/bun:${BUN_VERSION} AS runner

ARG GIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV APP_GIT_SHA=${GIT_SHA}
ENV APP_BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

EXPOSE 3000

COPY --from=builder --chown=bun:bun /app/public ./public

# Install git for marketplace clone/pull operations at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir .next && chown bun:bun .next

# Pre-create marketplace cache directory with correct ownership.
RUN mkdir -p /tmp/nexus-marketplaces && chown bun:bun /tmp/nexus-marketplaces

# Automatically leverage output traces to reduce image size.
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

# Persist the fetch cache generated during the build for faster cold starts.
COPY --from=builder --chown=bun:bun /app/.next/cache ./.next/cache

USER bun

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD bun --eval "fetch('http://localhost:3000/livez').then(r=>{if(!r.ok)throw 1})"

CMD ["bun", "server.js"]
