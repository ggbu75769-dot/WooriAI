#!/usr/bin/env node
/**
 * QA-LOAD: 부하 스모크 — 핵심 엔드포인트 p50/p95 실측.
 *
 * 순수 Node(글로벌 fetch), 외부 의존성 없음. dev oauth(kakao/dev-kakao)로 1회
 * 로그인 후 시나리오별 N회 요청을 동시성 C로 발사하고 지연 분포를 출력한다.
 *
 * 사용:
 *   node scripts/qa/load-smoke.mjs
 *
 * 환경변수:
 *   LOAD_BASE_URL     기본 http://localhost:3400  (/api/v1은 스크립트가 붙임)
 *   LOAD_N            시나리오별 측정 요청 수 (기본 200)
 *   LOAD_CONCURRENCY  동시 요청 수 (기본 10)
 *   LOAD_WARMUP       시나리오별 워밍업 요청 수, 통계 제외 (기본 10)
 *   LOAD_ADMIN_TOKEN  감사로그 시나리오용 x-admin-token (기본 dev-admin-token)
 *   LOAD_SEED_ROWS    측정 전에 대상 아이에게 심을 지출 행 수 (기본 0 = 볼륨 축 끔)
 *   LOAD_SEED_KEEP    1이면 측정 후 시드 행을 지우지 않고 남긴다 (기본 0 = 정리)
 *   LOAD_SEED_DATABASE_URL  시드가 붙을 DB (기본 DATABASE_URL, 없으면 dev DB URL)
 *
 * 시나리오 (PERF-114에서 확장):
 *   - 기존: /home, /children/:id/expenses(GET·POST), /children/:id/items,
 *     /children/:id/reports/monthly, /health/ready
 *   - 추가: /sync/changes(델타 동기화, JWT), /health/push, /health/worker(무인증),
 *     /admin/audit-logs(관리자 감사로그 목록)
 *   - 볼륨 축(GAP-060 #8, LOAD_SEED_ROWS>0일 때만): 홈 콜드 스타트 전량 루프,
 *     지출 목록 깊은 커서 — 아래 "볼륨 축" 절 참고.
 *
 * ── 볼륨 축 (GAP-060 #8) ────────────────────────────────────────────────────
 * known-limitations H절(홈 주간 카드가 이번 달 지출 전량을 커서 루프로 끌어온다)과
 * F절(깊은 커서)은 **수용한 위험**인데, 그 크기를 한 번도 재 본 적이 없었다. 시드
 * 데이터 수준(수십 행)에서는 어떤 표도 그 위험을 보여 주지 못한다. 그래서
 * `LOAD_SEED_ROWS=5000`처럼 볼륨을 주면:
 *   1. 대상 아이에게 **이번 달** 지출 N행을 DB에 직접 심고(아래 이유로 API POST가
 *      아니다),
 *   2. 전량 루프(limit=500 페이지를 hasMore가 false가 될 때까지)와 마지막
 *      페이지 커서를 재는 시나리오 둘을 추가로 돌린 뒤,
 *   3. 측정이 끝나면 심은 행을 **하드 삭제**한다(LOAD_SEED_KEEP=1이면 남긴다).
 *
 * 왜 API POST가 아니라 DB 직접 삽입인가: ⓐ 5,000번의 POST는 측정 시간을 분 단위로
 * 늘리고 레이트리밋·멱등키 테이블까지 오염시키며, ⓑ 정리를 DELETE로 하면 소프트
 * 삭제라 **툼스톤이 남아** /sync/changes 델타에 계속 실려 다음 측정을 오염시킨다.
 * 시드는 apps/api의 Prisma 클라이언트를 그대로 빌려 쓴다(seed.ts와 같은 경로).
 *
 * ⚠️ 시드는 **dev DB 전용**이다. `wooriai_test`를 가리키면 거부한다 — 테스트 DB는
 * vitest globalSetup의 자산이라 남의 스위트를 깨뜨린다.
 *
 * ⚠️ 시각 컬럼은 밀리초로 절단해 넣는다(known-limitations F절 R24-L4): `now()`
 * 기본값으로 두면 마이크로초가 저장되고, 그 행이 페이지 경계에 걸리면 커서 왕복이
 * 한 건을 조용히 빠뜨린다 — 즉 커서를 재려고 심은 데이터가 커서를 망가뜨린다.
 *   - /admin/audit-logs는 dev/test 전용 레거시 x-admin-token 폴백(AdminTokenGuard)으로
 *     인증한다. 쿠키 세션 + TOTP MFA 로그인 전체 플로우는 부하 스크립트 범위 밖
 *     (admin-e2e.mjs가 담당). 폴백이 거부되는 환경(비 dev/test)에서는 프로브가
 *     403을 받고 해당 시나리오를 사유와 함께 건너뛴다.
 *
 * 주의: dev 서버는 인메모리 IP 레이트리밋(기본 300req/min 전역, auth 30/min)이
 * 있다. 로그인은 1회만 수행하지만 측정 트래픽 자체가 전역 한도를 넘으므로,
 * 공용 서버(3400) 대신 한도를 올린 전용 인스턴스에서 돌리는 것을 권장:
 *   cd apps/api && NODE_ENV=development PORT=3450 \
 *     RATE_LIMIT_GLOBAL_MAX=100000 RATE_LIMIT_AUTH_MAX=1000 \
 *     DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev \
 *     npx tsx src/main.ts
 *   LOAD_BASE_URL=http://localhost:3450 node scripts/qa/load-smoke.mjs
 * 429 응답은 오류(err)와 분리해 rate-limited(429) 칼럼으로 따로 집계된다.
 *
 * POST로 생성한 지출 행은 종료 시 전부 DELETE로 정리한다(DB를 깨끗하게 유지).
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = (process.env.LOAD_BASE_URL ?? "http://localhost:3400").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const N = intEnv("LOAD_N", 200);
const CONCURRENCY = intEnv("LOAD_CONCURRENCY", 10);
const WARMUP = intEnv("LOAD_WARMUP", 10);
const SEED_ROWS = intEnv("LOAD_SEED_ROWS", 0);
const SEED_KEEP = process.env.LOAD_SEED_KEEP === "1";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEV_DATABASE_URL = "postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev";
/** 시드 행을 되찾기 위한 표식 — 정리(그리고 크래시 후 재실행)가 이 값 하나로 끝난다. */
const SEED_ITEM_NAME = "load-smoke-seed";
/** 서버의 지출 목록 limit 상한(EXPENSE_LIST_MAX_LIMIT) = 모바일 전량 루프의 페이지 크기. */
const PAGE_LIMIT = 500;

function intEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

/** 요청 1회를 실행하고 {ms, status}를 돌려준다. fetch 자체 실패는 status 0. */
async function timedRequest(makeRequest) {
  const start = nowMs();
  let status = 0;
  try {
    const res = await makeRequest();
    status = res.status;
    // 바디를 끝까지 소비해야 keep-alive 소켓이 재사용되고 시간도 실제 응답 완료 기준이 된다.
    await res.arrayBuffer();
  } catch {
    status = 0;
  }
  return { ms: nowMs() - start, status };
}

/** total개의 요청을 동시성 concurrency의 워커 풀로 실행. */
async function runPool(total, concurrency, makeRequest) {
  const samples = [];
  let issued = 0;
  async function worker() {
    while (issued < total) {
      const i = issued++;
      samples.push(await timedRequest(() => makeRequest(i)));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return samples;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(name, samples) {
  const ok = samples.filter((s) => s.status >= 200 && s.status < 300);
  const rateLimited = samples.filter((s) => s.status === 429);
  const errors = samples.filter((s) => !(s.status >= 200 && s.status < 300) && s.status !== 429);
  const sorted = ok.map((s) => s.ms).sort((a, b) => a - b);
  return {
    name,
    n: samples.length,
    ok: ok.length,
    rateLimited: rateLimited.length,
    errors: errors.length,
    errRate: samples.length ? errors.length / samples.length : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? sorted[sorted.length - 1] : NaN
  };
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(1) : "-";
}

// ── 볼륨 축: dev DB 직접 시드 (GAP-060 #8) ────────────────────────────────────

/**
 * apps/api가 쓰는 것과 **같은** Prisma 클라이언트를 빌려 온다(seed.ts와 동일 경로).
 * 루트에는 @prisma/client가 없으므로 apps/api 기준으로 해석한다. 이 스크립트의
 * "외부 의존성 없음" 계약은 유지된다 — LOAD_SEED_ROWS>0일 때만 지연 로드한다.
 */
async function loadPrisma(databaseUrl) {
  // package.json을 기준점으로 준다 — 디렉터리 경로를 주면 createRequire가 그것을
  // 파일로 보고 한 단계 위(apps/node_modules)부터 뒤져 못 찾는다.
  const requireFromApi = createRequire(resolve(REPO_ROOT, "apps/api/package.json"));
  let entry;
  try {
    entry = requireFromApi.resolve("@prisma/client");
  } catch {
    throw new Error("@prisma/client를 찾지 못했습니다 — 먼저 `pnpm install`(+ prisma generate)을 실행하세요.");
  }
  const { PrismaClient } = await import(entry);
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

/**
 * 대상 아이에게 **이번 달** 지출 rows행을 심는다. 이번 달인 이유: H절이 말하는
 * 콜드 스타트 전량 조회도, 기록 탭의 `yearMonth` 목록도 이번 달 범위이기 때문 —
 * 다른 달에 심으면 재려는 질의가 그 행들을 아예 보지 않는다.
 */
async function seedExpenses(prisma, ctx, rows) {
  const now = new Date();
  // 달은 시나리오가 쿼리에 넣는 `yearMonth`(UTC 기준 YYYY-MM)에서 그대로 가져온다 —
  // 여기서 로컬 시각으로 따로 계산하면 월 경계에서 심는 달과 재는 달이 갈릴 수 있다.
  const [year, month] = ctx.yearMonth.split("-").map(Number);
  const daysSoFar = Math.max(1, Number(now.toISOString().slice(8, 10)));
  const batch = [];
  let created = 0;
  for (let i = 0; i < rows; i += 1) {
    // 이번 달 1일~오늘에 고르게 퍼뜨린다(하루에 몰면 keyset 정렬의 타이브레이커만 재게 된다).
    const day = (i % daysSoFar) + 1;
    // created_at/updated_at을 서로 다르게 흩뿌려 (spent_on, created_at, id) 정렬과
    // 델타 동기화 커서가 실제 데이터처럼 갈라지게 한다. **명시적으로** 넣는 것이
    // 핵심이다(F절 R24-L4): 생략하면 DB의 now() 기본값이 마이크로초를 써서, 커서를
    // 재려고 심은 행이 커서 왕복에서 한 건씩 새는 원인이 된다. JS Date는 밀리초다.
    const stamp = new Date(now.getTime() - (rows - i) * 1000);
    batch.push({
      householdId: ctx.householdId,
      childId: ctx.childId,
      createdByUserId: ctx.userId,
      categoryId: ctx.categoryId,
      amountKrw: 1000 + (i % 900) * 10,
      spentOn: new Date(Date.UTC(year, month - 1, day)),
      itemName: SEED_ITEM_NAME,
      memo: "QA-LOAD 볼륨 축 시드 (LOAD_SEED_ROWS — 측정 후 자동 삭제)",
      createdAt: stamp,
      updatedAt: stamp
    });
    if (batch.length === 500 || i === rows - 1) {
      const result = await prisma.expense.createMany({ data: batch });
      created += result.count;
      batch.length = 0;
    }
  }
  return created;
}

/**
 * 시드 행 하드 삭제. API DELETE(소프트 삭제)를 쓰지 않는 이유는 툼스톤이 남아
 * /sync/changes 델타에 계속 실려 다음 측정을 오염시키기 때문이다. 표식 하나로
 * 지우므로 이전 실행이 중간에 죽어 남긴 행도 함께 걷힌다.
 */
async function cleanupSeededExpenses(prisma, childId) {
  const deleted = await prisma.expense.deleteMany({ where: { childId, itemName: SEED_ITEM_NAME } });
  return deleted.count;
}

/**
 * 모바일 콜드 스타트와 같은 형태로 이번 달 지출을 hasMore가 끝날 때까지 따라간다
 * (`fetchMonthExpenses`, 페이지당 500). 페이지 수·행 수와 함께 **마지막 페이지를
 * 불러오는 커서**(=가장 깊은 커서)를 돌려준다 — F절 깊은 커서 시나리오의 입력이다.
 */
async function walkExpensePages(auth, childId, yearMonth) {
  let cursor = null;
  let pages = 0;
  let rows = 0;
  let deepestCursor = null;
  for (;;) {
    const url =
      `${API}/children/${childId}/expenses?yearMonth=${yearMonth}&limit=${PAGE_LIMIT}` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const res = await fetch(url, { headers: auth });
    if (!res.ok) throw new Error(`페이지 조회 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    const pageRows = body?.expenses?.length ?? 0;
    pages += 1;
    rows += pageRows;
    // 깊은 커서 시나리오가 첫 페이지와 **같은 크기**의 페이지를 재도록, 꽉 찬
    // 페이지를 여는 커서 중 가장 깊은 것을 고른다. 마지막 페이지를 그대로 쓰면
    // 대개 잔여 몇 행뿐이라 "깊어서 싸다"는 착시가 생긴다(깊이가 아니라 크기를 잰 셈).
    if (cursor && pageRows === PAGE_LIMIT) deepestCursor = cursor;
    if (!body?.hasMore || !body?.nextCursor) break;
    cursor = body.nextCursor;
  }
  return { pages, rows, deepestCursor };
}

async function main() {
  console.log(
    `# load-smoke  base=${BASE}  N=${N}  concurrency=${CONCURRENCY}  warmup=${WARMUP}  seedRows=${SEED_ROWS}`
  );

  // ── 1. 인증(1회만 — /auth/*는 레이트리밋이 더 빡빡함) ───────────────────
  const login = await jsonFetch("/auth/oauth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "kakao", providerToken: "dev-kakao" })
  });
  const accessToken = login?.tokens?.accessToken;
  if (!accessToken) throw new Error("로그인 실패: accessToken 없음");
  const auth = { Authorization: `Bearer ${accessToken}` };
  const userId = login?.user?.id;
  const householdId = login?.user?.households?.[0]?.id;

  // ── 2. childId 확보(/children → 없으면 생성) ────────────────────────────
  let childId = (await jsonFetch("/children", { headers: auth }))?.children?.[0]?.id;
  if (!childId) {
    if (!householdId) throw new Error("householdId 없음 — child 생성 불가");
    const created = await jsonFetch("/children", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        householdId,
        nickname: "load-smoke",
        stageMode: "born",
        birthDate: "2026-06-01"
      })
    });
    childId = created?.id ?? created?.child?.id;
  }
  if (!childId) throw new Error("childId 확보 실패");

  // ── 3. 지출 생성용 categoryId ───────────────────────────────────────────
  const categories = await jsonFetch("/categories", { headers: auth });
  const categoryId = categories?.categories?.[0]?.id;
  if (!categoryId) throw new Error("categoryId 확보 실패");

  const yearMonth = new Date().toISOString().slice(0, 7);
  const spentOn = new Date().toISOString().slice(0, 10);
  const createdExpenseIds = [];

  // ── 3b. 볼륨 축 시드 (GAP-060 #8, LOAD_SEED_ROWS>0일 때만) ───────────────
  // prisma/childId는 모듈 스코프 seedState에도 남긴다 — 측정이 도중에 터져도
  // 아래 main().catch가 심어 둔 행을 걷어낼 수 있어야 한다(dev DB 오염 방지).
  let prisma = null;
  let deepCursor = null;
  let walk = null;
  if (SEED_ROWS > 0) {
    const databaseUrl = process.env.LOAD_SEED_DATABASE_URL ?? process.env.DATABASE_URL ?? DEV_DATABASE_URL;
    if (/wooriai_test/.test(databaseUrl)) {
      throw new Error(
        `시드 거부: 대상이 테스트 DB입니다(${databaseUrl}). 볼륨 축은 dev DB 전용 — LOAD_SEED_DATABASE_URL로 dev DB를 지정하세요.`
      );
    }
    if (!userId) throw new Error("시드 불가: 로그인 응답에 user.id가 없습니다");
    prisma = await loadPrisma(databaseUrl);
    seedState = { prisma, childId };
    // 이전 실행이 중간에 죽어 남긴 시드가 있으면 먼저 걷어낸다(표식 기반).
    const stale = await cleanupSeededExpenses(prisma, childId);
    if (stale > 0) console.log(`seed: 이전 실행 잔여 시드 ${stale}건 정리`);
    const seeded = await seedExpenses(prisma, { householdId, childId, userId, categoryId, yearMonth }, SEED_ROWS);
    console.log(`seed: 지출 ${seeded}건 심음 (아이 ${childId}, ${yearMonth}, 표식 itemName="${SEED_ITEM_NAME}")`);
    // 전량 루프를 1회 걸어 페이지 수와 가장 깊은 커서를 확보한다(측정 전 사전 조사).
    walk = await walkExpensePages(auth, childId, yearMonth);
    deepCursor = walk.deepestCursor;
    console.log(`seed: 이번 달 전량 = ${walk.rows}행 / ${walk.pages}페이지(limit=${PAGE_LIMIT})`);
  }

  const scenarios = [
    {
      name: `GET /home?childId=`,
      request: () => fetch(`${API}/home?childId=${childId}`, { headers: auth })
    },
    {
      name: `GET /children/:id/expenses`,
      request: () => fetch(`${API}/children/${childId}/expenses?yearMonth=${yearMonth}`, { headers: auth })
    },
    {
      name: `GET /children/:id/items?tab=now`,
      request: () => fetch(`${API}/children/${childId}/items?tab=now`, { headers: auth })
    },
    {
      name: `GET .../reports/monthly`,
      request: () => fetch(`${API}/children/${childId}/reports/monthly?yearMonth=${yearMonth}`, { headers: auth })
    },
    {
      name: `POST /children/:id/expenses`,
      request: async () => {
        const res = await fetch(`${API}/children/${childId}/expenses`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
          body: JSON.stringify({
            categoryId,
            amountKrw: 100 + Math.floor(Math.random() * 900),
            spentOn,
            itemName: "load-smoke",
            memo: "QA-LOAD 부하 스모크 (자동 정리됨)"
          })
        });
        if (res.ok) {
          // clone: 본문은 timedRequest가 소비하므로 여기서 따로 읽는다.
          try {
            const body = await res.clone().json();
            if (body?.id) createdExpenseIds.push(body.id);
          } catch {
            /* 본문 파싱 실패는 무시 — 측정에는 영향 없음 */
          }
        }
        return res;
      }
    },
    {
      name: `GET /sync/changes`,
      // 델타 동기화 전체 창(커서 없음, limit=100) 반복 — 클라이언트 첫 동기화와 동일 형태.
      request: () => fetch(`${API}/sync/changes?limit=100`, { headers: auth })
    },
    {
      name: `GET /health/ready`,
      request: () => fetch(`${API}/health/ready`)
    },
    {
      name: `GET /health/push`,
      request: () => fetch(`${API}/health/push`)
    },
    {
      name: `GET /health/worker`,
      request: () => fetch(`${API}/health/worker`)
    }
  ];

  // ── 3c. 볼륨 축 시나리오 (시드가 있을 때만 의미가 있어 조건부로 붙인다) ──
  if (SEED_ROWS > 0) {
    scenarios.push({
      // H절 실측: 모바일 홈이 콜드 스타트에 도는 전량 커서 루프 그 자체.
      // ⚠️ 이 행의 지연은 요청 1건이 아니라 **루프 전체**(walk.pages개 요청)의 시간이다.
      name: `홈 콜드 스타트 전량 루프(${walk?.pages ?? "?"}페이지 × ${PAGE_LIMIT})`,
      // 한 표본이 여러 요청이라 N을 그대로 쓰면 측정만 수 분이 된다.
      n: Math.max(20, Math.floor(N / 10)),
      warmup: 2,
      request: async () => {
        let cursor = null;
        let res;
        for (;;) {
          const url =
            `${API}/children/${childId}/expenses?yearMonth=${yearMonth}&limit=${PAGE_LIMIT}` +
            (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
          res = await fetch(url, { headers: auth });
          if (!res.ok) return res;
          const body = await res.clone().json();
          if (!body?.hasMore || !body?.nextCursor) return res;
          cursor = body.nextCursor;
        }
      }
    });
    if (deepCursor) {
      scenarios.push({
        // F절 실측: 꽉 찬 마지막 페이지를 여는 커서 — 커서 술어가 깊어져도 인덱스가
        // 버텨 주는지(R24-M3 후속A의 AND 상한) 같은 크기의 첫 페이지와 나란히 놓고 본다.
        name: `GET /children/:id/expenses (깊은 커서 · ${PAGE_LIMIT}행 페이지)`,
        request: () =>
          fetch(
            `${API}/children/${childId}/expenses?yearMonth=${yearMonth}&limit=${PAGE_LIMIT}&cursor=${encodeURIComponent(deepCursor)}`,
            { headers: auth }
          )
      });
    }
    scenarios.push({
      // 같은 볼륨에서 첫 페이지(비교 기준) — 위 깊은 커서와 짝이다.
      name: `GET /children/:id/expenses (첫 페이지 limit=${PAGE_LIMIT})`,
      request: () =>
        fetch(`${API}/children/${childId}/expenses?yearMonth=${yearMonth}&limit=${PAGE_LIMIT}`, { headers: auth })
    });
  }

  // ── 3d. 관리자 감사로그 목록 — dev/test 전용 x-admin-token 폴백으로 인증 ──
  // (쿠키 세션 + MFA 실플로우는 admin-e2e.mjs 소관. 여기서는 서버가 폴백을
  //  허용하는 경우에만 측정하고, 아니면 사유를 남기고 건너뛴다.)
  const adminToken = process.env.LOAD_ADMIN_TOKEN ?? "dev-admin-token";
  const adminHeaders = { "x-admin-token": adminToken };
  const auditProbe = await fetch(`${API}/admin/audit-logs?limit=50`, { headers: adminHeaders });
  await auditProbe.arrayBuffer();
  if (auditProbe.ok) {
    scenarios.push({
      name: `GET /admin/audit-logs`,
      request: () => fetch(`${API}/admin/audit-logs?limit=50`, { headers: adminHeaders })
    });
  } else {
    console.warn(
      `skip: GET /admin/audit-logs — 프로브 응답 ${auditProbe.status}. ` +
        `dev/test 전용 x-admin-token 폴백이 거부됨(비 dev/test 환경이거나 WOORIAI_ADMIN_TOKEN 불일치 — LOAD_ADMIN_TOKEN으로 지정 가능).`
    );
  }

  const results = [];
  for (const scenario of scenarios) {
    // 시나리오별 n/warmup 재정의(볼륨 축의 전량 루프처럼 표본 1개가 비싼 경우).
    const scenarioN = scenario.n ?? N;
    await runPool(scenario.warmup ?? WARMUP, CONCURRENCY, scenario.request); // 워밍업 — 통계 제외
    const started = nowMs();
    const samples = await runPool(scenarioN, CONCURRENCY, scenario.request);
    const wallMs = nowMs() - started;
    const summary = summarize(scenario.name, samples);
    summary.rps = summary.n / (wallMs / 1000);
    results.push(summary);
    console.log(
      `done: ${scenario.name}  ok=${summary.ok}/${summary.n}  429=${summary.rateLimited}  err=${summary.errors}`
    );
  }

  // ── 4. 정리: 생성한 지출 전부 삭제 ─────────────────────────────────────
  if (createdExpenseIds.length > 0) {
    let deleted = 0;
    await runPool(createdExpenseIds.length, CONCURRENCY, async (i) => {
      const res = await fetch(`${API}/expenses/${createdExpenseIds[i]}`, {
        method: "DELETE",
        headers: { ...auth, "Idempotency-Key": randomUUID() }
      });
      if (res.ok) deleted += 1;
      return res;
    });
    console.log(`cleanup: 생성한 지출 ${createdExpenseIds.length}건 중 ${deleted}건 삭제 완료`);
    if (deleted < createdExpenseIds.length) {
      console.warn(`cleanup 경고: ${createdExpenseIds.length - deleted}건 삭제 실패 — 수동 확인 필요`);
    }
  }

  // ── 4b. 볼륨 축 시드 정리(하드 삭제 — 툼스톤을 남기지 않는다) ───────────
  if (prisma) {
    try {
      // 위 4번의 DELETE는 공개 API라 **소프트 삭제**다. 실측을 반복하면 그 툼스톤이
      // 계속 쌓이고, /sync/changes 델타는 툼스톤도 실어 보내므로 다음 측정의 델타
      // 시나리오가 실제보다 무거워진다(라운드 60에서 관측: 5회 실행 후 1,050건).
      // DB 핸들이 이미 열려 있는 이 경로에서만 그 잔여물까지 하드 삭제한다.
      const tombstones = await prisma.expense.deleteMany({
        where: { childId, itemName: "load-smoke", deletedAt: { not: null } }
      });
      if (tombstones.count > 0) {
        console.log(`cleanup: POST 시나리오 툼스톤 ${tombstones.count}건 하드 삭제(과거 실행 잔여 포함)`);
      }
      if (SEED_KEEP) {
        console.log(`cleanup: LOAD_SEED_KEEP=1 — 시드 행을 남깁니다(지우려면 같은 스크립트를 다시 돌리거나 itemName="${SEED_ITEM_NAME}" 행을 삭제).`);
      } else {
        const removed = await cleanupSeededExpenses(prisma, childId);
        console.log(`cleanup: 볼륨 축 시드 ${removed}건 하드 삭제 완료`);
      }
    } finally {
      seedState = null;
      await prisma.$disconnect();
    }
  }

  // ── 5. 결과 표(markdown) ────────────────────────────────────────────────
  console.log("");
  console.log("| 시나리오 | n | p50(ms) | p95(ms) | p99(ms) | max(ms) | req/s | 429 | err | err% |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.name} | ${r.n} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.max)} | ${fmt(r.rps)} | ${r.rateLimited} | ${r.errors} | ${(r.errRate * 100).toFixed(1)}% |`
    );
  }
  console.log("");
  console.log("주: 지연은 2xx 응답만 대상으로 집계. 429(rate limit)는 err와 분리해 별도 칼럼.");

  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  process.exitCode = totalErrors > 0 ? 1 : 0;
}

/** 측정이 도중에 터졌을 때 심어 둔 시드를 걷어내기 위한 참조(위 3b 참고). */
let seedState = null;

main().catch(async (error) => {
  console.error("load-smoke 실패:", error.message);
  if (seedState && !SEED_KEEP) {
    try {
      const removed = await cleanupSeededExpenses(seedState.prisma, seedState.childId);
      console.error(`cleanup: 실패 경로에서 볼륨 축 시드 ${removed}건 삭제`);
    } catch (cleanupError) {
      console.error(
        `cleanup 경고: 시드 정리 실패(${cleanupError.message}) — dev DB에 itemName="${SEED_ITEM_NAME}" 행이 남았을 수 있습니다.`
      );
    } finally {
      await seedState.prisma.$disconnect().catch(() => {});
    }
  }
  process.exit(1);
});
