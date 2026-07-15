FROM node:20-alpine AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN NEXT_STANDALONE=1 pnpm --filter admin build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=builder /workspace/apps/admin/.next/standalone ./
COPY --from=builder /workspace/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3001
USER node
CMD ["node", "apps/admin/server.js"]
