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
 *
 * 시나리오 (PERF-114에서 확장):
 *   - 기존: /home, /children/:id/expenses(GET·POST), /children/:id/items,
 *     /children/:id/reports/monthly, /health/ready
 *   - 추가: /sync/changes(델타 동기화, JWT), /health/push, /health/worker(무인증),
 *     /admin/audit-logs(관리자 감사로그 목록)
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

const BASE = (process.env.LOAD_BASE_URL ?? "http://localhost:3400").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const N = intEnv("LOAD_N", 200);
const CONCURRENCY = intEnv("LOAD_CONCURRENCY", 10);
const WARMUP = intEnv("LOAD_WARMUP", 10);

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

async function main() {
  console.log(`# load-smoke  base=${BASE}  N=${N}  concurrency=${CONCURRENCY}  warmup=${WARMUP}`);

  // ── 1. 인증(1회만 — /auth/*는 레이트리밋이 더 빡빡함) ───────────────────
  const login = await jsonFetch("/auth/oauth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "kakao", providerToken: "dev-kakao" })
  });
  const accessToken = login?.tokens?.accessToken;
  if (!accessToken) throw new Error("로그인 실패: accessToken 없음");
  const auth = { Authorization: `Bearer ${accessToken}` };
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

  // ── 3b. 관리자 감사로그 목록 — dev/test 전용 x-admin-token 폴백으로 인증 ──
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
    await runPool(WARMUP, CONCURRENCY, scenario.request); // 워밍업 — 통계 제외
    const started = nowMs();
    const samples = await runPool(N, CONCURRENCY, scenario.request);
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

main().catch((error) => {
  console.error("load-smoke 실패:", error.message);
  process.exit(1);
});
