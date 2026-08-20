# 우리아이 API 프로덕션 이미지 (Day 1 배포 — docs/5차/day1-deploy-runbook.md)
# 빌드 컨텍스트는 저장소 루트: docker build -f infra/docker/api.Dockerfile .
# api는 tsc 빌드 산출물 없이 tsx로 구동되므로(패키지 스크립트 참조) 루트 devDependencies(tsx)를 포함해 설치한다.
FROM node:22-slim

# Prisma 엔진 구동에 openssl 필요
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

WORKDIR /app

# 워크스페이스 매니페스트 먼저 복사해 설치 레이어 캐시 활용
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json tsconfig.scripts.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json

# 루트(tsx)와 api 및 그 워크스페이스 의존성만 설치 — mobile/admin 의존성 제외로 이미지 경량화
RUN pnpm install --frozen-lockfile --filter . --filter api...

# 소스 복사 (불필요 경로는 .dockerignore로 제외)
COPY apps/api apps/api
COPY packages packages
COPY scripts scripts

RUN pnpm --filter api prisma:generate

ENV NODE_ENV=production
EXPOSE 3000

# 마이그레이션은 배포 파이프라인의 release 단계에서 실행 (fly.toml release_command 참조)
CMD ["pnpm", "--filter", "api", "exec", "tsx", "src/main.ts"]
