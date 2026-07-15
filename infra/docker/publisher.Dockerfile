FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY node_modules ./node_modules
COPY apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
CMD ["node", "dist/publisher.cjs"]
