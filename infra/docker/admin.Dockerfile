# 우리아이 어드민(CMS) 프로덕션 이미지 — Next.js standalone 빌드 (LP-D)
# 빌드 컨텍스트는 저장소 루트: docker build -f infra/docker/admin.Dockerfile .
# 기본 배포는 오버레이로: docker-compose.admin.yml (docker-compose.prod.yml에 어드민은 없음 — 선택 사양)
#
# ⚠️ rewrites 프록시 타깃(ADMIN_API_PROXY_TARGET)은 **빌드 타임에** server.js 안으로
# 직렬화된다(Next standalone은 next.config.js를 빌드 시점에 구움 — apps/admin/next.config.js 주석 참조).
# 런타임 env로는 바꿀 수 없으므로 다른 타깃이 필요하면 --build-arg로 다시 빌드하라.
# 기본값 http://api:3000 은 docker-compose.admin.yml 오버레이의 api 서비스 내부 주소다.

# ---------- 1단계: 빌드 ----------
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

WORKDIR /app

# 워크스페이스 매니페스트 먼저 복사해 설치 레이어 캐시 활용 (api.Dockerfile과 동일 관례)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json tsconfig.scripts.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json

# 루트(typescript — next build의 타입 체크가 사용)와 admin 의존성만 설치
RUN pnpm install --frozen-lockfile --filter . --filter admin...

COPY apps/admin apps/admin
COPY scripts/build-admin.cjs scripts/build-admin.cjs

ARG ADMIN_API_PROXY_TARGET=http://api:3000
ENV ADMIN_API_PROXY_TARGET=$ADMIN_API_PROXY_TARGET
ENV NODE_ENV=production

RUN pnpm --filter admin build

# ---------- 2단계: 런타임 (standalone 산출물만 — pnpm/워크스페이스 불필요) ----------
FROM node:22-slim

ENV NODE_ENV=production

WORKDIR /app

# standalone은 모노레포 경로를 보존한다: server.js는 apps/admin/server.js
COPY --from=builder /app/apps/admin/.next/standalone ./
# 정적 자산과 public은 standalone에 포함되지 않으므로 서버 기준 경로에 직접 복사
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

USER node

ENV PORT=3001
ENV HOSTNAME=0.0.0.0
EXPOSE 3001

CMD ["node", "apps/admin/server.js"]
