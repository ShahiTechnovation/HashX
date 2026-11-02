# HashX backend — build from the REPOSITORY ROOT (the backend compiles ../shared):
#   docker build -f server/Dockerfile -t hashx-backend .
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile
COPY shared ./shared
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN cd server && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
RUN corepack enable && apk add --no-cache curl
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/server/dist ./server/dist
COPY server/migrations ./server/migrations
WORKDIR /app/server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fsS http://localhost:8080/health || exit 1
# Migrations are applied explicitly (db:migrate:prod) before starting; the server refuses to start with pending migrations.
CMD ["node", "dist/server/src/server.js"]
