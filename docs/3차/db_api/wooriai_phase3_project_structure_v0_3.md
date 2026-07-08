# 우리아이 프로젝트 폴더 구조 v0.3

> 고정 스택: React Native + Expo, NestJS, PostgreSQL + Prisma, Next.js Admin, TypeScript Monorepo

```text
wooriai/
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ .env.example
├─ apps/
│  ├─ mobile/                         # React Native + Expo
│  │  ├─ app/                          # Expo Router
│  │  │  ├─ _layout.tsx
│  │  │  ├─ (auth)/
│  │  │  │  ├─ login.tsx               # AUTH-001
│  │  │  │  └─ terms.tsx
│  │  │  ├─ (onboarding)/
│  │  │  │  ├─ child-status.tsx        # ONB-001
│  │  │  │  ├─ child-profile.tsx       # ONB-002
│  │  │  │  ├─ prepared-items.tsx      # ONB-003
│  │  │  │  └─ budget.tsx              # ONB-004
│  │  │  ├─ (tabs)/
│  │  │  │  ├─ _layout.tsx
│  │  │  │  ├─ home.tsx                # HOME-001
│  │  │  │  ├─ expenses.tsx            # EXP-004
│  │  │  │  ├─ items.tsx               # ITEM-001
│  │  │  │  └─ reports.tsx             # REP-001
│  │  │  ├─ expense/
│  │  │  │  ├─ create.tsx              # EXP-001
│  │  │  │  └─ [expenseId].tsx         # EXP-003
│  │  │  ├─ item/
│  │  │  │  └─ [itemTemplateId].tsx    # ITEM-002
│  │  │  ├─ family/
│  │  │  │  ├─ index.tsx               # FAM-001
│  │  │  │  └─ invite.tsx              # FAM-002
│  │  │  ├─ import/
│  │  │  │  ├─ index.tsx               # IMP-001
│  │  │  │  └─ [importJobId].tsx       # IMP-003
│  │  │  └─ settings/
│  │  │     ├─ index.tsx               # SET-001
│  │  │     └─ privacy.tsx             # SET-003/004
│  │  ├─ src/
│  │  │  ├─ api/                       # generated client + fetch wrapper
│  │  │  ├─ components/
│  │  │  │  ├─ base/
│  │  │  │  ├─ expense/
│  │  │  │  ├─ item/
│  │  │  │  ├─ report/
│  │  │  │  └─ feedback/
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ onboarding/
│  │  │  │  ├─ home/
│  │  │  │  ├─ expenses/
│  │  │  │  ├─ budgets/
│  │  │  │  ├─ items/
│  │  │  │  ├─ reports/
│  │  │  │  ├─ family/
│  │  │  │  ├─ imports/
│  │  │  │  └─ settings/
│  │  │  ├─ hooks/
│  │  │  ├─ navigation/
│  │  │  ├─ stores/                    # Zustand stores
│  │  │  ├─ theme/                     # design tokens
│  │  │  ├─ utils/
│  │  │  └─ validation/                # Zod schemas
│  │  ├─ assets/
│  │  ├─ app.json
│  │  └─ tsconfig.json
│  ├─ api/                             # NestJS
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ common/
│  │  │  │  ├─ guards/
│  │  │  │  ├─ decorators/
│  │  │  │  ├─ filters/
│  │  │  │  ├─ interceptors/
│  │  │  │  └─ utils/
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ users/
│  │  │  │  ├─ households/
│  │  │  │  ├─ children/
│  │  │  │  ├─ expenses/
│  │  │  │  ├─ budgets/
│  │  │  │  ├─ reports/
│  │  │  │  ├─ items/
│  │  │  │  ├─ commerce/
│  │  │  │  ├─ imports/
│  │  │  │  ├─ consents/
│  │  │  │  └─ admin/
│  │  │  ├─ prisma/
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ prisma.service.ts
│  │  │  └─ workers/
│  │  │     └─ import-analysis.worker.ts
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts
│  │  ├─ test/
│  │  └─ tsconfig.json
│  └─ admin/                           # Next.js Admin CMS
│     ├─ app/
│     ├─ src/
│     │  ├─ features/
│     │  │  ├─ item-templates/
│     │  │  ├─ product-links/
│     │  │  ├─ disclosures/
│     │  │  └─ analytics/
│     │  ├─ components/
│     │  └─ lib/
│     └─ tsconfig.json
├─ packages/
│  ├─ contracts/                       # OpenAPI generated types, shared DTOs
│  ├─ domain/                          # enums, business rules, stage calculator
│  ├─ ui/                              # design tokens + shared RN components
│  ├─ config/                          # eslint, tsconfig, prettier
│  └─ test-utils/
├─ infra/
│  ├─ docker/
│  │  └─ docker-compose.yml            # api + postgres + redis + minio
│  ├─ db/
│  │  ├─ schema.sql
│  │  └─ seed/
│  ├─ nginx/
│  └─ terraform/
├─ docs/
│  ├─ product/
│  ├─ screen/
│  ├─ dev/
│  │  ├─ api.openapi.yaml
│  │  ├─ db.schema.sql
│  │  └─ erd.mmd
│  └─ qa/
└─ scripts/
   ├─ generate-openapi-types.ts
   ├─ seed-categories.ts
   └─ check-env.ts
```

## 폴더 구조 원칙

1. 앱 화면은 2차 문서의 화면 ID와 파일 위치가 대응되어야 합니다.
2. 백엔드는 도메인 모듈 단위로 Controller, Service, Repository, DTO를 분리합니다.
3. 공통 Enum과 비즈니스 룰은 `packages/domain`에 두어 모바일/백엔드/관리자가 같은 값을 사용합니다.
4. API 타입은 OpenAPI에서 생성하여 `packages/contracts`에 배포합니다.
5. 관리자 CMS는 운영자가 준비템/상품 링크/제휴 고지를 배포 없이 수정하는 도구입니다.
6. 엑셀 AI 분석은 API 요청 안에서 처리하지 않고 worker가 import_jobs 상태를 갱신합니다.
