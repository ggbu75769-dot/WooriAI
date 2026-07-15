FROM node:20-alpine AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/main.cjs"]
