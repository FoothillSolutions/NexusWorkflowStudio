# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

ARG BUN_VERSION=1.3.10
ARG GIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown

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

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ============================================
# Stage 3: Run Next.js application
# ============================================

FROM oven/bun:${BUN_VERSION} AS runner

ARG GIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV APP_GIT_SHA=${GIT_SHA}
ENV APP_BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

EXPOSE 3000

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the run time.
# ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=bun:bun /app/public ./public

RUN mkdir .next && chown bun:bun .next

# Automatically leverage output traces to reduce image size.
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

# If you want to persist the fetch cache generated during the build so that
# cached responses are available immediately on startup, uncomment this line:
# COPY --from=builder --chown=bun:bun /app/.next/cache ./.next/cache

USER bun

CMD ["bun", "server.js"]
