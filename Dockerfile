FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm run build:db \
 && pnpm --filter @fdi/web --if-present run build
ENV NODE_ENV=production PORT=8080 DB_PATH=dist/data.db STATIC_DIR=apps/web/dist
EXPOSE 8080
CMD ["node", "apps/api/src/server.ts"]
