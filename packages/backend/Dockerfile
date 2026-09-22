# Monorepo-aware backend image. Build context is the repo root (see railway.json
# / docker-compose). .dockerignore keeps node_modules, .env and build artifacts out.
#
# Debian slim (not alpine) so Prisma's engine finds libssl/openssl cleanly.
FROM node:20-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY . .

# Install only the backend and its workspace deps (pulls in @agent-lottery/common)
RUN pnpm install --filter @agent-lottery/backend... --frozen-lockfile

# Build the shared package, generate the Prisma client, then build the backend
RUN pnpm --filter @agent-lottery/common run build \
 && pnpm --filter @agent-lottery/backend exec prisma generate \
 && pnpm --filter @agent-lottery/backend run build

WORKDIR /app/packages/backend

EXPOSE 3001

# db push creates/updates the schema on the (fresh) database without migration
# files, then the server starts (REST + WebSocket + indexer on $PORT).
CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate && node dist/server.js"]
