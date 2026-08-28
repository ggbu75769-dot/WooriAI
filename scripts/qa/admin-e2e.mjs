/**
 * QA-ADMIN-E2E: browser end-to-end drive of the admin console (apps/admin).
 *
 * Prerequisites:
 *   - API dev server running at http://localhost:3400
 *     (from apps/api: NODE_ENV=development DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev nohup npx tsx src/main.ts &)
 *   - Admin dev server running at http://localhost:3100 pointed at the API:
 *     (from apps/admin: ADMIN_API_PROXY_TARGET=http://localhost:3400 ./node_modules/.bin/next dev -p 3100)
 *   - Seeded dev admin account: admin@wooriai.local / wooriai-dev-admin
 *   - Seeded dev editor account: editor@wooriai.local / wooriai-dev-editor
 *     (apps/api/prisma/seed.ts COM-103 — used by the QA-114 audit-log
 *     role-gate step; that step SKIPs with a note if the account is missing)
 *   - playwright-core installed at the workspace root (pnpm add -D -w playwright-core)
 *   - Playwright Chromium available (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers,
 *     falls back to executablePath /opt/pw-browsers/chromium)
 *   - otplib available from apps/api/node_modules (used to compute TOTP codes in-process)
 *   - psql on PATH with access to the dev DB (only used for the MFA verify-login
 *     fallback path, when the admin already has MFA enrolled from a prior run)
 *
 * Run:
 *   node scripts/qa/admin-e2e.mjs
 *
 * Environment overrides:
 *   ADMIN_BASE_URL   (default http://localhost:3100)
 *   ADMIN_EMAIL      (default admin@wooriai.local)
 *   ADMIN_PASSWORD   (default wooriai-dev-admin)
 *   EDITOR_EMAIL     (default editor@wooriai.local — QA-114 role-gate step)
 *   EDITOR_PASSWORD  (default wooriai-dev-editor)
 *   QA_OUT_DIR       screenshot/output dir (default scripts/qa/out)
 *
 * The script prints a per-step PASS/FAIL summary and exits non-zero if any
 * step failed. It performs NO writes to the app data other than the MFA
 * enrollment for the dev admin and dev editor (first run only) — the CSV
 * bulk flow only uses the read-only preview endpoint, never apply, and the
 * audit-log steps (QA-114/QA-118) are read-only viewers of rows the logins
 * above already produced (the QA-118 CSV export pages the same read-only
 * list API and builds the file client-side).
 *
 * GAP-063 #9 (round 63) stopped the funnel step from hardcoding the stage count
 * (it had been red for two rounds after round 61 #5 prefixed the onboarding
 * stages) — the expectation is now derived from FUNNEL_STAGES itself, labels and
 * order included. The same round added three read-only steps: the round-61
 * 온보딩 단계 이탈 card, the audit-log action-preset datalist (round 62 #7's
 * household.leave/account.delete reaching the screen), and the round-63 MFA
 * re-enrollment entry point in the account area — that last one only OPENS the
 * panel and closes it again, and must never submit: submitting would really
 * disable the dev admin's MFA.
 *
 * GAP-059 #8 (round 59) added the round-56 CS path: 사용자 조회 search +
 * ?actorUserId deep link into 감사 로그 (steps 11), and load/read steps for
 * 카테고리 관리 · 제휴 고지 문구 · 클릭 통계 (steps 12-14). All four are
 * read-only: the only interactions are search, client-side filters and the
 * clicks range toggle — no 저장/추가/적용 button is ever clicked. NOTE that
 * the users-lookup search itself is audit-logged server-side
 * (admin.user_lookup.search), which is a log row, not app data.
 *
 * SECURITY:
 *   - ADMIN_BASE_URL is restricted to localhost/127.0.0.1: the script types a
 *     real admin password and TOTP codes into whatever page it is pointed at.
 *     Set QA_ALLOW_REMOTE=1 only if you deliberately target another host.
 *   - Screenshots in QA_OUT_DIR may contain the MFA enrollment secret /
 *     recovery codes (the enrollment screen renders them). The default out
 *     dir scripts/qa/out is gitignored — NEVER commit the output dir, and
 *     delete it after triage.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const { chromium } = require(path.join(repoRoot, "node_modules", "playwright-core"));
const otplib = require(path.join(repoRoot, "apps", "api", "node_modules", "otplib"));

const BASE_URL = process.env.ADMIN_BASE_URL ?? "http://localhost:3100";

// Localhost guard (see SECURITY header note): refuse to drive a non-local
// admin URL — this script auto-fills the admin password and TOTP codes —
// unless the operator explicitly opts in with QA_ALLOW_REMOTE=1.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL) && process.env.QA_ALLOW_REMOTE !== "1") {
  console.error(
    `ADMIN_BASE_URL이 로컬 주소가 아닙니다: ${BASE_URL}\n` +
      "이 스크립트는 관리자 비밀번호와 MFA 코드를 자동 입력하므로 기본적으로 localhost/127.0.0.1만 허용합니다.\n" +
      "정말 원격 환경을 대상으로 실행하려면 QA_ALLOW_REMOTE=1 환경변수를 설정해 주세요."
  );
  process.exit(1);
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@wooriai.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "wooriai-dev-admin";
const EDITOR_EMAIL = process.env.EDITOR_EMAIL ?? "editor@wooriai.local";
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD ?? "wooriai-dev-editor";
const OUT_DIR = process.env.QA_OUT_DIR ?? path.join(repoRoot, "scripts", "qa", "out");
// Dev-first-compile of a Next.js route can take a long time.
const NAV_TIMEOUT = 120_000;
const STEP_TIMEOUT = 60_000;

mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let shotIndex = 0;

async function screenshot(page, name) {
  shotIndex += 1;
  const file = path.join(OUT_DIR, `${String(shotIndex).padStart(2, "0")}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch (error) {
    return `(screenshot failed: ${error.message})`;
  }
}

async function pageSnippet(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return text.replace(/\n{2,}/g, "\n").slice(0, 1500);
  } catch (error) {
    return `(could not read page content: ${error.message})`;
  }
}

async function runStep(name, page, fn) {
  process.stdout.write(`\n=== STEP: ${name} ===\n`);
  try {
    const detail = await fn();
    const shot = await screenshot(page, name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase());
    results.push({ name, status: "PASS", detail: detail ?? "", shot });
    process.stdout.write(`PASS ${name}${detail ? ` — ${detail}` : ""}\n`);
    return true;
  } catch (error) {
    const shot = await screenshot(page, `FAIL-${name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`);
    const snippet = await pageSnippet(page);
    results.push({ name, status: "FAIL", detail: error.message, shot, snippet });
    process.stdout.write(`FAIL ${name} — ${error.message}\n--- page content snippet ---\n${snippet}\n---\n`);
    return false;
  }
}

function totpSecretFromDb(email = ADMIN_EMAIL) {
  const out = execFileSync(
    "psql",
    [
      "-h", "localhost", "-U", "wooriai", "-d", "wooriai_dev", "-tA",
      "-c", `select totp_secret from admin_users where email = '${email.replace(/'/g, "''")}'`
    ],
    { env: { ...process.env, PGPASSWORD: "wooriai_dev_password" }, encoding: "utf8" }
  ).trim();
  if (!out) throw new Error(`no totp_secret in dev DB for ${email}`);
  return out;
}

/** QA-114c: whether an active admin_users row exists for `email` in the dev DB
 * (used to SKIP the editor role-gate step instead of failing when the seed
 * account is absent). */
function adminAccountInDb(email) {
  try {
    const out = execFileSync(
      "psql",
      [
        "-h", "localhost", "-U", "wooriai", "-d", "wooriai_dev", "-tA",
        "-c", `select 1 from admin_users where email = '${email.replace(/'/g, "''")}' and active = true`
      ],
      { env: { ...process.env, PGPASSWORD: "wooriai_dev_password" }, encoding: "utf8" }
    ).trim();
    return out === "1";
  } catch {
    return false;
  }
}

async function totpCode(secret) {
  return await otplib.generate({ secret });
}

/**
 * Shared UI login flow: password -> (forced MFA enrollment | MFA verify) ->
 * dashboard heading. Extracted from step 1 so the QA-114 editor role-gate
 * step can log in a second account the same way. Returns which MFA path ran.
 */
async function loginViaUi(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  // Login screen
  await page.getByRole("heading", { name: "WooriAI 관리자" }).waitFor({ timeout: NAV_TIMEOUT });
  await page.getByPlaceholder("관리자 이메일").fill(email);
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  // Three possible outcomes: forced MFA enrollment, MFA verify step, or a
  // login error. Wait for whichever shows up first.
  const enrollHeading = page.getByRole("heading", { name: "2단계 인증(MFA) 등록" });
  const verifyHeading = page.getByRole("heading", { name: "2단계 인증", exact: true });
  const dashHeading = page.getByRole("heading", { name: "WooriAI Admin CMS" });
  await Promise.race([
    enrollHeading.waitFor({ timeout: STEP_TIMEOUT }),
    verifyHeading.waitFor({ timeout: STEP_TIMEOUT }),
    dashHeading.waitFor({ timeout: STEP_TIMEOUT })
  ]);

  let flow;
  if (await enrollHeading.isVisible().catch(() => false)) {
    flow = "enrollment";
    // The manual-entry secret is rendered as <code> inside the hint paragraph.
    const secretEl = page.locator("p:has-text('수동 키') code");
    await secretEl.waitFor({ timeout: STEP_TIMEOUT });
    const secret = (await secretEl.innerText()).trim();
    if (!/^[A-Z2-7]{16,}$/.test(secret)) throw new Error(`unexpected TOTP secret from DOM: "${secret}"`);
    await page.getByPlaceholder("인증 앱의 6자리 코드").fill(await totpCode(secret));
    await page.getByRole("button", { name: "등록 완료" }).click();
    // Recovery-code screen, then continue.
    await page.getByRole("heading", { name: "복구 코드를 저장해 주세요" }).waitFor({ timeout: STEP_TIMEOUT });
    const recoveryCount = await page.locator("li").count();
    if (recoveryCount < 1) throw new Error("no recovery codes rendered");
    await page.getByRole("button", { name: "저장했어요, 계속하기" }).click();
  } else if (await verifyHeading.isVisible().catch(() => false)) {
    flow = "verify-login";
    const secret = totpSecretFromDb(email);
    await page.getByPlaceholder("인증 코드 또는 복구 코드").fill(await totpCode(secret));
    await page.getByRole("button", { name: "확인", exact: true }).click();
  } else {
    flow = "no-mfa";
  }

  await dashHeading.waitFor({ timeout: NAV_TIMEOUT });
  return flow;
}

/**
 * GAP-063 #9 (라운드 63): 퍼널 표의 기대값을 **화면의 계약에서 파생**한다.
 *
 * 종전에는 퍼널 행 수를 여섯으로 박아 두고 다르면 던졌다. 라운드 61 #5가 퍼널 앞에
 * 온보딩 4단을 접두하자(지금 10행) 이 스텝이 그대로 빨간불이 됐다 — 회귀가 아니라 하네스가
 * 늙은 것인데, 그런 실패는 진짜 회귀까지 같이 묻는다. 그래서 숫자를 옮겨 적는 대신
 * `FUNNEL_STAGES`(apps/admin/app/analytics/page.tsx)를 읽어 **라벨과 순서까지** 기대값으로
 * 삼는다. 다음에 단이 늘거나 순서가 바뀌면 이 스텝은 자동으로 따라가고, 화면이 계약과 어긋난
 * 경우에만 실패한다.
 *
 * 접두된 온보딩 단은 페이지의 손 미러(`ONBOARDING_STEPS`)에서 오고, 그 미러가 계약
 * (packages/contracts/src/analytics.ts)과 같은지는 apps/admin의 대조 테스트가 지킨다 —
 * 여기서는 두 목록의 **개수만** 교차 확인해, 어드민 미러만 늙은 상태에서 e2e가 초록불이
 * 되는 경우를 막는다.
 */
function readFunnelStageContract() {
  const pageSource = readFileSync(
    path.join(repoRoot, "apps", "admin", "app", "analytics", "page.tsx"),
    "utf8"
  );

  const mirrorBlock = pageSource.split("const ONBOARDING_STEPS:")[1]?.split("];")[0];
  if (!mirrorBlock) throw new Error("analytics/page.tsx에서 ONBOARDING_STEPS 미러를 찾지 못했습니다");
  const onboardingLabels = [...mirrorBlock.matchAll(/label: "([^"]+)"/g)].map((m) => `온보딩 · ${m[1]}`);
  if (onboardingLabels.length === 0) throw new Error("ONBOARDING_STEPS 미러에서 라벨을 하나도 읽지 못했습니다");

  const contractsSource = readFileSync(
    path.join(repoRoot, "packages", "contracts", "src", "analytics.ts"),
    "utf8"
  );
  const contractList = /export const ONBOARDING_STEPS = \[([^\]]*)\] as const;/.exec(contractsSource)?.[1];
  const contractSteps = [...(contractList ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  if (contractSteps.length !== onboardingLabels.length) {
    throw new Error(
      `어드민 온보딩 미러 ${onboardingLabels.length}단 != 계약 ${contractSteps.length}단 ` +
        "(packages/contracts/src/analytics.ts의 ONBOARDING_STEPS)"
    );
  }

  const funnelBlock = pageSource.split("const FUNNEL_STAGES: FunnelStage[] = [")[1]?.split("\n];")[0];
  if (!funnelBlock) throw new Error("analytics/page.tsx에서 FUNNEL_STAGES를 찾지 못했습니다");
  // 접두(spread) 뒤에 오는 명시 단들 — 각 항목이 한 줄이라 줄 단위로 읽는다.
  const explicitLabels = [...funnelBlock.matchAll(/^\s*\{ key: "[^"]+", label: "([^"]+)"/gm)].map((m) => m[1]);
  if (explicitLabels.length === 0) throw new Error("FUNNEL_STAGES에서 명시 단을 하나도 읽지 못했습니다");

  return { onboardingLabels, labels: [...onboardingLabels, ...explicitLabels] };
}

/** 감사 로그 액션 프리셋(datalist 후보)의 원천. 화면에 실제로 그 옵션들이 붙는지 대조한다. */
function readAuditActionPresets() {
  const source = readFileSync(
    path.join(repoRoot, "apps", "admin", "src", "lib", "audit-log-filters.ts"),
    "utf8"
  );
  const block = source.split("export const AUDIT_LOG_ACTION_PRESETS")[1]?.split("\n];")[0];
  if (!block) throw new Error("audit-log-filters.ts에서 AUDIT_LOG_ACTION_PRESETS를 찾지 못했습니다");
  const actions = [...block.matchAll(/\{ action: "([^"]+)"/g)].map((m) => m[1]);
  if (actions.length === 0) throw new Error("AUDIT_LOG_ACTION_PRESETS에서 액션을 하나도 읽지 못했습니다");
  return actions;
}

/** QA-114: parse the total count out of the audit-log record card heading
 * ("기록 (총 1,234건)"). */
async function readAuditTotal(page) {
  const heading = page.locator("h2", { hasText: "기록" });
  const text = (await heading.innerText()).trim();
  const match = text.match(/총\s*([\d,]+)\s*건/);
  if (!match) throw new Error(`could not parse total from record heading: "${text}"`);
  return Number(match[1].replace(/,/g, ""));
}

async function main() {
  let executablePath;
  try {
    executablePath = chromium.executablePath();
  } catch {
    executablePath = undefined;
  }
  if (!executablePath || !existsSync(executablePath)) {
    // The preinstalled Chromium revision may not match this playwright-core
    // version's registry entry — point at the shipped binary directly.
    executablePath = "/opt/pw-browsers/chromium";
  }
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  // ---- Step 1: login + MFA (enrollment or verify) -> dashboard --------------
  const loginOk = await runStep("login-mfa-dashboard", page, async () => {
    const flow = await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    return `logged in via ${flow} path, dashboard heading visible`;
  });

  if (!loginOk) {
    // Nothing else can run without a session.
    await finish(browser, consoleErrors, 1);
    return;
  }

  // ---- Step 2: dashboard summary cards --------------------------------------
  await runStep("dashboard-summary-cards", page, async () => {
    await page.getByRole("heading", { name: "운영 현황 요약" }).waitFor();
    // Cards render once the summary API resolves; each card's value is the
    // second <p> inside the article.
    const cards = page.locator("section:has(h2:text('운영 현황 요약')) article");
    await cards.first().waitFor({ timeout: STEP_TIMEOUT });
    const count = await cards.count();
    if (count !== 8) throw new Error(`expected 8 summary cards, got ${count}`);
    const values = [];
    for (let i = 0; i < count; i++) {
      const label = (await cards.nth(i).locator("p").nth(0).innerText()).trim();
      const value = (await cards.nth(i).locator("p").nth(1).innerText()).trim();
      if (!/^[\d,.]+$/.test(value)) throw new Error(`card "${label}" value not numeric: "${value}"`);
      values.push(`${label}=${value}`);
    }
    return values.join(", ");
  });

  // ---- Step 3: items page ----------------------------------------------------
  await runStep("items-table", page, async () => {
    await page.getByRole("link", { name: "준비템 관리" }).click();
    await page.waitForURL("**/items", { timeout: NAV_TIMEOUT });
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ timeout: NAV_TIMEOUT });
    const count = await rows.count();
    if (count < 1) throw new Error("items table has 0 rows");
    return `items table rows: ${count}`;
  });

  // ---- Step 4: links page + CSV bulk preview --------------------------------
  await runStep("links-table-and-bulk-preview", page, async () => {
    await page.getByRole("link", { name: "상품 링크 관리" }).click();
    await page.waitForURL("**/links", { timeout: NAV_TIMEOUT });

    // Link list with health-status badge column.
    const listCard = page.locator("section:has(h2:text('상품 링크 목록'))");
    const rows = listCard.locator("table tbody tr");
    await rows.first().waitFor({ timeout: NAV_TIMEOUT });
    const rowCount = await rows.count();
    if (rowCount < 1) throw new Error("links table has 0 rows");
    const healthHeader = listCard.locator("th", { hasText: "링크 상태" });
    if ((await healthHeader.count()) !== 1) throw new Error("링크 상태 column header not found");

    // CSV bulk panel (rendered inline for admin role).
    const bulkCard = page.locator("section:has(h2:text('CSV 일괄 교체'))");
    await bulkCard.waitFor();
    const templateLink = bulkCard.locator("a:text('템플릿 다운로드')");
    if ((await templateLink.count()) !== 1) throw new Error("템플릿 다운로드 link not present");
    const href = await templateLink.getAttribute("href");
    if (href !== "/product-link-bulk-template.csv") throw new Error(`template link href: ${href}`);
    // The template file must actually be served.
    const resp = await context.request.get(`${BASE_URL}/product-link-bulk-template.csv`);
    if (!resp.ok()) throw new Error(`template CSV fetch: HTTP ${resp.status()}`);
    const templateCsv = await resp.text();

    // Paste the template into the textarea and run the read-only preview.
    await page.locator("#bulk-csv-text").fill(templateCsv);
    await bulkCard.getByRole("button", { name: "미리보기" }).click();
    const previewSummary = bulkCard.locator("p", { hasText: "적용하면 유효한 행만 반영돼요" });
    await previewSummary.waitFor({ timeout: STEP_TIMEOUT });
    const summaryText = (await previewSummary.innerText()).trim();
    const previewRows = bulkCard.locator("table tbody tr");
    const previewRowCount = await previewRows.count();
    if (previewRowCount < 1) throw new Error("bulk preview rendered no rows");
    const rowDetails = [];
    for (let i = 0; i < previewRowCount; i++) {
      const cells = await previewRows.nth(i).locator("td").allInnerTexts();
      rowDetails.push(`row${i + 1}[${cells[1]}]: ${cells[5]}`);
      if (!/유효|오류/.test(cells[1])) throw new Error(`preview row ${i + 1} status not Korean 유효/오류: "${cells[1]}"`);
    }
    // NOTE: deliberately NOT clicking 적용 — preview is validate-only.
    return `links rows: ${rowCount}; preview: ${summaryText} | ${rowDetails.join(" | ")}`;
  });

  // ---- Step 5: analytics page ------------------------------------------------
  await runStep("analytics-toggle-and-tables", page, async () => {
    await page.getByRole("link", { name: "분석", exact: true }).click();
    await page.waitForURL("**/analytics", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: /요약 \(최근 7일\)/ }).waitFor({ timeout: NAV_TIMEOUT });

    // Funnel section. GAP-063 #9: 단 수를 숫자로 박지 않고 FUNNEL_STAGES에서 파생한다
    // (readFunnelStageContract 주석 참고 — 라운드 61 #5의 온보딩 4단 접두가 옛 하드코딩 6을
    // 두 라운드째 빨간불로 만들었다). 라벨과 순서까지 대조하므로 "행 수만 맞는" 회귀도 잡는다.
    const funnel = readFunnelStageContract();
    const funnelCard = page.locator("section:has(h2:text('KPI 퍼널'))");
    await funnelCard.waitFor();
    const funnelRowLocator = funnelCard.locator("table tbody tr");
    await funnelRowLocator.first().waitFor({ timeout: STEP_TIMEOUT });
    const funnelRows = await funnelRowLocator.count();
    if (funnelRows !== funnel.labels.length) {
      throw new Error(
        `expected ${funnel.labels.length} funnel rows (FUNNEL_STAGES 계약), got ${funnelRows}`
      );
    }
    // 표는 "1. 온보딩 · 아이 상태 선택"처럼 계약 순서 번호를 스스로 붙인다.
    const stageCells = await funnelRowLocator.locator("td:nth-child(1)").allInnerTexts();
    const renderedStages = stageCells.map((text) => text.replace(/\s+/g, " ").trim());
    const expectedStages = funnel.labels.map((label, index) => `${index + 1}. ${label}`);
    for (const [index, expected] of expectedStages.entries()) {
      if (renderedStages[index] !== expected) {
        throw new Error(`funnel row ${index + 1}: "${renderedStages[index]}" != "${expected}"`);
      }
    }

    // Event-count table: the registry events always render (0 counts fine). 하한만
    // 확인한다 — byName은 계약 레지스트리에서 생성되므로 배포된 API 버전에 따라 더 많을 수 있다.
    const eventCard = page.locator("section:has(h2:text('이벤트별 카운트'))");
    const eventRows = await eventCard.locator("table tbody tr").count();
    if (eventRows < 6) throw new Error(`expected >= 6 event rows, got ${eventRows}`);

    // 7/30-day toggle.
    const btn30 = page.getByRole("button", { name: "최근 30일" });
    await btn30.click();
    await page.getByRole("heading", { name: /요약 \(최근 30일\)/ }).waitFor({ timeout: STEP_TIMEOUT });
    if ((await btn30.getAttribute("aria-pressed")) !== "true") throw new Error("30일 toggle not aria-pressed after click");
    return (
      `funnel rows: ${funnelRows} (계약 파생, 앞 ${funnel.onboardingLabels.length}단 온보딩 접두 · 라벨/순서 일치), ` +
      `event rows: ${eventRows}, 30일 toggle OK`
    );
  });

  // ---- Step 5b: 온보딩 단계 이탈 카드 (라운드 61 #5) -------------------------
  // GAP-063 #9ⓑ: 라운드 61이 신설한 패널을 e2e가 한 번도 방문하지 않았다. 읽기 전용 스텝 —
  // 세 숫자 카드가 실제로 그려지는지와, 이 화면의 정직성 각주(동의한 사용자만 · 분류 불가)가
  // 남아 있는지만 본다.
  await runStep("analytics-onboarding-dropoff-card", page, async () => {
    const card = page.locator("section:has(h2:text('온보딩 단계 이탈'))");
    await card.waitFor({ timeout: NAV_TIMEOUT });
    const labels = ["단계 진입 (이벤트 수)", "온보딩 완료", "완료 1건당 단계 진입"];
    const values = [];
    for (const label of labels) {
      const article = card.locator("article", { hasText: label });
      if ((await article.count()) !== 1) throw new Error(`온보딩 이탈 카드에 "${label}" 항목이 없어요`);
      const value = (await article.first().locator("p").nth(1).innerText()).trim();
      // 건수는 "1,234건", 배수는 "3.2배"/"-" 형태.
      if (!/^[\d,]+건$|^[\d.]+배$|^-$/.test(value)) throw new Error(`"${label}" 값이 숫자 표기가 아니에요: "${value}"`);
      values.push(`${label}=${value}`);
    }
    // 정직성 각주: 이 수를 신규 사용자 수처럼 읽지 못하게 하는 문장이 남아 있어야 한다.
    for (const notice of ["통계 수집 동의", "하한"]) {
      if ((await card.locator("p", { hasText: notice }).count()) < 1) {
        throw new Error(`온보딩 이탈 카드에서 "${notice}" 고지가 사라졌어요`);
      }
    }
    return values.join(", ");
  });

  // ---- Step 6: admin users page ---------------------------------------------
  await runStep("users-self-marker", page, async () => {
    await page.getByRole("link", { name: "관리자 계정" }).click();
    await page.waitForURL("**/users", { timeout: NAV_TIMEOUT });
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ timeout: NAV_TIMEOUT });
    const selfRow = page.locator("table tbody tr", { hasText: ADMIN_EMAIL });
    if ((await selfRow.count()) < 1) throw new Error(`no row for ${ADMIN_EMAIL}`);
    const selfText = await selfRow.first().innerText();
    if (!selfText.includes("(나)")) throw new Error(`current-admin row lacks (나) marker: "${selfText.slice(0, 200)}"`);
    return `admin table rows: ${await rows.count()}, (나) marker present on ${ADMIN_EMAIL}`;
  });

  // ---- Step 7: reviews page --------------------------------------------------
  await runStep("reviews-page-loads", page, async () => {
    await page.getByRole("link", { name: "콘텐츠 검토" }).click();
    await page.waitForURL("**/reviews", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "콘텐츠 검토" }).waitFor({ timeout: NAV_TIMEOUT });
    // Wait until either the list table or the empty state renders (i.e. the
    // load finished), and assert no error banner.
    await Promise.race([
      page.locator("table tbody tr").first().waitFor({ timeout: STEP_TIMEOUT }),
      page.locator("p", { hasText: "해당 상태의 초안이 없어요" }).first().waitFor({ timeout: STEP_TIMEOUT })
    ]);
    const errorBanner = page.locator("p", { hasText: "검토 목록을 불러오지 못했어요" });
    if (await errorBanner.count()) throw new Error("reviews list error banner shown");
    const rowCount = await page.locator("table tbody tr").count();
    return `reviews loaded without error (rows: ${rowCount})`;
  });

  // ---- Step 8: audit-log viewer table + pagination (QA-114a) ----------------
  await runStep("audit-logs-table-and-pagination", page, async () => {
    await page.getByRole("link", { name: "감사 로그" }).click();
    await page.waitForURL("**/audit-logs", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "감사 로그", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });

    // The step-1 login itself is audit-logged ("admin.login" in
    // admin-auth.service.ts), so at least one row must always exist here —
    // no extra write action is needed to guarantee data.
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ timeout: NAV_TIMEOUT });
    const rowCount = await rows.count();
    if (rowCount < 1) throw new Error("audit-log table has 0 rows");
    // CS-101(라운드 56): 행위자 열은 어드민 계정만 남는 자리가 아니라서(앱 사용자의
    // expense.update/delete 등도 같은 표에 뜬다) 열 이름이 "관리자" → "행위자"로 바뀌었다.
    for (const header of ["시각", "행위자", "액션", "대상", "상세"]) {
      if ((await page.locator("table th", { hasText: header }).count()) !== 1) {
        throw new Error(`missing audit table header: ${header}`);
      }
    }
    const total = await readAuditTotal(page);
    if (total < rowCount) throw new Error(`total (${total}) < visible rows (${rowCount})`);

    // GAP-063 #9ⓒ: 액션 프리셋 datalist가 원천(audit-log-filters.ts의
    // AUDIT_LOG_ACTION_PRESETS)을 빠짐없이 그리는지. 라운드 62 #7이 더한 household.leave ·
    // account.delete가 화면까지 닿았는지를 여기서 확인한다(그 두 액션은 "본인이 나가거나
    // 탈퇴한" CS 문의의 유일한 단서다). 목록은 파일에서 읽는다 — 숫자도 목록도 박지 않는다.
    const presetActions = readAuditActionPresets();
    const optionValues = await page
      .locator("datalist#audit-log-action-presets option")
      .evaluateAll((nodes) => nodes.map((node) => node.value));
    const missingPresets = presetActions.filter((action) => !optionValues.includes(action));
    if (missingPresets.length) {
      throw new Error(`액션 프리셋이 datalist에 없어요: ${missingPresets.join(", ")}`);
    }
    for (const action of ["household.leave", "account.delete"]) {
      if (!optionValues.includes(action)) {
        throw new Error(`라운드 62 #7의 액션 프리셋이 화면에 없어요: ${action}`);
      }
    }

    // Pagination round-trip, only meaningful when there is more than one page
    // (dev DB easily exceeds 20 rows; keep the single-page case green too).
    let pagination = "single page";
    if (total > 20) {
      if (rowCount !== 20) throw new Error(`expected 20 rows on page 1 of ${total} total, got ${rowCount}`);
      const nextBtn = page.getByRole("button", { name: "다음" });
      const prevBtn = page.getByRole("button", { name: "이전" });
      if (!(await prevBtn.isDisabled())) throw new Error("이전 button not disabled on page 1");
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && r.url().includes("offset=20"), { timeout: STEP_TIMEOUT }),
        nextBtn.click()
      ]);
      await page.getByText(/2 \/ [\d,]+ 페이지/).waitFor({ timeout: STEP_TIMEOUT });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && r.url().includes("offset=0"), { timeout: STEP_TIMEOUT }),
        prevBtn.click()
      ]);
      await page.getByText(/1 \/ [\d,]+ 페이지/).waitFor({ timeout: STEP_TIMEOUT });
      pagination = "다음/이전 page-2 round-trip OK";
    }
    return (
      `rows: ${rowCount}, total: ${total}, pagination: ${pagination}, ` +
      `액션 프리셋 ${presetActions.length}종 datalist 반영(household.leave·account.delete 포함)`
    );
  });

  // ---- Step 9: audit-log action filter narrows results (QA-114b) ------------
  await runStep("audit-logs-action-filter", page, async () => {
    const totalBefore = await readAuditTotal(page);

    // Exact-match filter on "admin.login": guaranteed >= 1 (this run's step-1
    // login) and guaranteed fewer than the unfiltered total (at minimum the
    // admin.mfa_enabled row from the MFA enrollment coexists).
    await page.locator("#filter-action").fill("admin.login");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && r.url().includes("action=admin.login"), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "필터 적용" }).click()
    ]);
    // Every visible action cell (3rd column — the 상세 column also contains
    // <code> nodes inside collapsed <details>) must now be admin.login.
    await page.waitForFunction(
      () => {
        const cells = document.querySelectorAll("table tbody tr td:nth-child(3) code");
        return cells.length > 0 && Array.from(cells).every((el) => el.textContent === "admin.login");
      },
      undefined,
      { timeout: STEP_TIMEOUT }
    );
    const filteredTotal = await readAuditTotal(page);
    if (filteredTotal < 1) throw new Error("admin.login filter returned 0 rows");
    if (filteredTotal >= totalBefore) {
      throw new Error(`action filter did not narrow results: ${filteredTotal} filtered vs ${totalBefore} total`);
    }

    // A non-existent action must land on the empty state, not an error banner.
    await page.locator("#filter-action").fill("qa.e2e.no-such-action");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && r.url().includes("qa.e2e.no-such-action"), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "필터 적용" }).click()
    ]);
    await page.locator("p", { hasText: "조건에 맞는 기록이 없어요." }).waitFor({ timeout: STEP_TIMEOUT });
    if (await page.locator("table tbody tr").count()) throw new Error("rows rendered for non-existent action filter");
    if (await page.locator("p", { hasText: "감사 로그를 불러오지 못했어요." }).count()) {
      throw new Error("error banner shown for non-existent action filter");
    }

    // 초기화 restores the unfiltered list.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && !r.url().includes("action="), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "초기화" }).click()
    ]);
    await page.locator("table tbody tr").first().waitFor({ timeout: STEP_TIMEOUT });
    const totalAfterReset = await readAuditTotal(page);
    return `total ${totalBefore} → admin.login ${filteredTotal} → nonexistent 0 → reset ${totalAfterReset}`;
  });

  // ---- Step 10: audit-log CSV export + filter linkage (QA-118a) -------------
  // NOTE (QA-118b, deliberately omitted): the audit-log TIMEOUT UI (admin-api
  // fetchWithTimeout aborts after 10s -> "요청 시간이 초과됐어요(10초)..." +
  // 다시 시도 button) is not exercised here. Against a healthy local dev API the
  // request never hangs, and artificially stalling the Next.js proxy (route
  // interception / 10s+ holds) would test the harness rather than the app while
  // making every run 10s slower and flakier. The timeout branch is covered by
  // the jsdom unit tests instead (apps/admin/src/admin-audit-logs.test.ts).
  await runStep("audit-logs-csv-export", page, async () => {
    // Header order pinned by AUDIT_LOG_CSV_COLUMNS (apps/admin/src/lib/audit-log-csv.ts).
    const EXPECTED_HEADER = [
      "id", "createdAt", "actorEmail", "actorUserId", "householdId",
      "action", "targetType", "targetId", "before", "after", "ipHash"
    ];
    const MAX_EXPORT_ROWS = 1000; // AUDIT_LOG_EXPORT_MAX_ROWS

    // Clicks CSV 내보내기, receives the Blob download via the Playwright download
    // event, saves it into OUT_DIR, and validates the envelope (filename, BOM,
    // CRLF termination, 11-column header). Returns the parsed data rows.
    // Row parsing note: splitting on CRLF is safe for this file — no cell can
    // contain a raw newline (before/after are JSON.stringify output, which
    // escapes control characters; the other columns are ids/emails/actions).
    const exportAndRead = async (saveName) => {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: STEP_TIMEOUT }),
        page.getByRole("button", { name: "CSV 내보내기" }).click()
      ]);
      const suggested = download.suggestedFilename();
      if (!/^audit-logs-\d{8}\.csv$/.test(suggested)) {
        throw new Error(`unexpected suggested filename: ${suggested}`);
      }
      const file = path.join(OUT_DIR, saveName);
      await download.saveAs(file);
      const raw = readFileSync(file, "utf8");
      if (!raw.startsWith("\uFEFF")) throw new Error("exported CSV lacks the UTF-8 BOM prefix");
      const lines = raw.slice(1).split("\r\n");
      if (lines[lines.length - 1] !== "") throw new Error("exported CSV is not CRLF-terminated");
      const header = lines[0].split(",");
      if (header.length !== EXPECTED_HEADER.length || header.join(",") !== EXPECTED_HEADER.join(",")) {
        throw new Error(`unexpected CSV header (${header.length} cols): ${lines[0]}`);
      }
      return { suggested, dataRows: lines.slice(1, -1) };
    };

    // (1) Unfiltered export: row count == min(total, 1000) + matching notice.
    // Step 9 ended on the reset (unfiltered) list, so the heading total is live.
    const total = await readAuditTotal(page);
    const unfiltered = await exportAndRead("audit-logs-export-unfiltered.csv");
    const expectedRows = Math.min(total, MAX_EXPORT_ROWS);
    if (unfiltered.dataRows.length !== expectedRows) {
      throw new Error(`unfiltered export rows: ${unfiltered.dataRows.length}, expected ${expectedRows} (total ${total})`);
    }
    const expectedNotice = total > MAX_EXPORT_ROWS
      ? "상위 1,000건만 내보냈어요"
      : `${expectedRows.toLocaleString("ko-KR")}건을 내보냈어요.`;
    await page.locator("p", { hasText: expectedNotice }).waitFor({ timeout: STEP_TIMEOUT });

    // (2) Filter linkage: the export honors the currently APPLIED filter — the
    // admin.login export must be narrower than the unfiltered total (same
    // guarantee as step 9) and contain only admin.login rows.
    await page.locator("#filter-action").fill("admin.login");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && r.url().includes("action=admin.login"), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "필터 적용" }).click()
    ]);
    const filteredTotal = await readAuditTotal(page);
    if (filteredTotal < 1 || filteredTotal >= total) {
      throw new Error(`admin.login total (${filteredTotal}) not a strict narrowing of ${total}`);
    }
    const filtered = await exportAndRead("audit-logs-export-admin-login.csv");
    const expectedFilteredRows = Math.min(filteredTotal, MAX_EXPORT_ROWS);
    if (filtered.dataRows.length !== expectedFilteredRows) {
      throw new Error(`filtered export rows: ${filtered.dataRows.length}, expected ${expectedFilteredRows} (total ${filteredTotal})`);
    }
    // The action column (6th) sits between unquoted uuid/timestamp/email cells,
    // so a plain substring check per line is unambiguous here.
    for (const [index, row] of filtered.dataRows.entries()) {
      if (!row.includes(",admin.login,")) {
        throw new Error(`filtered export row ${index + 1} is not an admin.login row: ${row.slice(0, 160)}`);
      }
    }

    // Restore the unfiltered list so later steps see the default state.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/audit-logs") && !r.url().includes("action="), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "초기화" }).click()
    ]);
    await page.locator("table tbody tr").first().waitFor({ timeout: STEP_TIMEOUT });

    return (
      `download ${unfiltered.suggested}: header 11 cols, ${unfiltered.dataRows.length}/${total} rows (BOM+CRLF OK); ` +
      `admin.login filter: ${filtered.dataRows.length}/${filteredTotal} rows, all admin.login`
    );
  });

  // ---- Step 11: user lookup + audit-log deep link (ADM-127 / CS-101) --------
  // 라운드 56이 연 CS 경로의 끝단: 사용자 조회에서 찾은 사람의 "무엇을 했는지"로
  // 넘어가는 링크(auditLogsHrefForActor)가 실제로 ?actorUserId를 프리필하는지.
  await runStep("users-lookup-search-and-audit-deeplink", page, async () => {
    await page.getByRole("link", { name: "사용자 조회" }).click();
    await page.waitForURL("**/users-lookup", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "사용자 조회", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });
    // 개인정보 경계 고지가 화면에 남아 있어야 한다(금액·품목 미표시, 조회는 감사 로그에 남음).
    await page
      .locator("p", { hasText: "읽기 전용 화면이에요." })
      .first()
      .waitFor({ timeout: STEP_TIMEOUT });

    // dev oauth 스텁이 만드는 최종 사용자의 displayName은 "개발 사용자"
    // (apps/api/src/households/household-runtime.service.ts ensureDevUser) — server-smoke.sh를
    // 한 번이라도 돌린 dev DB라면 존재한다. 시드 자체에는 최종 사용자가 없어서
    // 결과 0건도 정상 상태이므로, 그때는 딥링크를 직접 URL로 검증하고 그 사실을 detail에 남긴다.
    await page.locator("#user-lookup-query").fill("개발");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/users-lookup"), { timeout: STEP_TIMEOUT }),
      page.getByRole("button", { name: "조회", exact: true }).click()
    ]);
    await page.getByRole("heading", { name: "조회 결과" }).waitFor({ timeout: STEP_TIMEOUT });

    const deepLinks = page.getByRole("link", { name: "이 사용자 감사 로그 보기" });
    const hitCount = await deepLinks.count();
    let actorId;
    let source;
    if (hitCount > 0) {
      const href = await deepLinks.first().getAttribute("href");
      const match = /[?&]actorUserId=([^&]+)/.exec(href ?? "");
      if (!match) throw new Error(`deep link href lacks actorUserId: ${href}`);
      actorId = decodeURIComponent(match[1]);
      source = `search hit (${hitCount} user card(s))`;
      await Promise.all([
        page.waitForURL("**/audit-logs?actorUserId=*", { timeout: NAV_TIMEOUT }),
        deepLinks.first().click()
      ]);
    } else {
      // 결과 0건이면 빈 상태 문구가 떠야 하고(오류 배너 아님), 딥링크 계약은 URL로 직접 확인한다.
      await page.locator("p", { hasText: "일치하는 사용자를 찾지 못했어요." }).waitFor({ timeout: STEP_TIMEOUT });
      actorId = "00000000-0000-4000-8000-000000000000";
      source = "no search hit — deep-link contract checked via direct URL";
      await page.goto(`${BASE_URL}/audit-logs?actorUserId=${actorId}`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT
      });
    }

    await page.getByRole("heading", { name: "감사 로그", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });
    // 프리필: 폼 입력값이 URL의 actorUserId와 같아야 한다.
    const prefilled = await page.locator("#filter-actor").inputValue();
    if (prefilled !== actorId) throw new Error(`#filter-actor prefill "${prefilled}" != "${actorId}"`);
    // 그리고 그 값이 **이미 적용된** 상태여야 한다 — 목록이나 빈 상태 중 하나가 뜨고,
    // "불러오지 못했어요" 배너는 없어야 한다(UUID가 아니면 서버가 400을 준다).
    await Promise.race([
      page.locator("table tbody tr").first().waitFor({ timeout: STEP_TIMEOUT }),
      page.locator("p", { hasText: "조건에 맞는 기록이 없어요." }).waitFor({ timeout: STEP_TIMEOUT })
    ]);
    if (await page.locator("p", { hasText: "감사 로그를 불러오지 못했어요." }).count()) {
      throw new Error("deep link landed on the audit-log error banner");
    }
    const rowCount = await page.locator("table tbody tr").count();
    return `${source}; actorUserId=${actorId} prefilled + applied (rows: ${rowCount})`;
  });

  // ---- Step 12: categories page (CAT-124 노출 축) ---------------------------
  await runStep("categories-table-and-filter", page, async () => {
    await page.getByRole("link", { name: "카테고리 관리" }).click();
    await page.waitForURL("**/categories", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "카테고리 관리", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });

    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ timeout: NAV_TIMEOUT });
    const total = await rows.count();
    if (total < 12) throw new Error(`categories table has ${total} rows (expected the 12 canonical rows at minimum)`);
    for (const header of ["코드", "이름", "표시 순서", "구분", "사용", "노출"]) {
      if ((await page.locator("table th", { hasText: header }).count()) !== 1) {
        throw new Error(`missing categories table header: ${header}`);
      }
    }
    // CAT-124: 이 화면은 앱이 보지 못하는 비노출(숨김) 행까지 전량을 보여주는 자리다.
    const hidden = await page.locator("table tbody tr", { hasText: "숨김" }).count();
    if (hidden < 1) throw new Error("no 숨김(non-selectable) row rendered — admin list is not showing every row");

    // 구분 필터(클라이언트 측)가 좁히는지 — 앱 별칭만 남으면 전부 숨김이어야 한다.
    await page.locator("#category-group").selectOption("mobile_alias");
    await page.waitForFunction(
      (before) => document.querySelectorAll("table tbody tr").length < before,
      total,
      { timeout: STEP_TIMEOUT }
    );
    const aliasRows = await rows.count();
    const aliasHidden = await page.locator("table tbody tr", { hasText: "숨김" }).count();
    if (aliasHidden !== aliasRows) throw new Error(`앱 별칭 rows ${aliasRows} but only ${aliasHidden} marked 숨김`);
    await page.locator("#category-group").selectOption("all");
    await page.waitForFunction((expected) => document.querySelectorAll("table tbody tr").length === expected, total, {
      timeout: STEP_TIMEOUT
    });
    return `rows: ${total} (숨김 ${hidden}), 앱 별칭 filter → ${aliasRows} rows all 숨김, reset OK`;
  });

  // ---- Step 13: disclosures page (DNC-010 고지 문구) ------------------------
  await runStep("disclosures-page-loads", page, async () => {
    await page.getByRole("link", { name: "제휴 고지 문구" }).click();
    await page.waitForURL("**/disclosures", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "제휴 고지 문구", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });
    // 읽기 전용 스텝 — 추가/저장 버튼은 절대 누르지 않는다(고지 문구는 DNC-010 대상).
    // 로드 완료 신호는 "불러오는 중..."이 사라지는 것. 그 뒤 오류 배너가 없어야 한다.
    await page.waitForFunction(() => !document.body.innerText.includes("불러오는 중..."), undefined, {
      timeout: STEP_TIMEOUT
    });
    if (await page.locator("p", { hasText: "고지 문구 목록을 불러오지 못했어요." }).count()) {
      throw new Error("disclosures list error banner shown");
    }
    // 고지 문구 카드는 각각 <h2>{key}</h2> + textarea (DisclosureRow). 등록된 게 없으면 빈 상태.
    const headings = (await page.locator("h2").allInnerTexts()).map((text) => text.trim());
    const disclosureKeys = headings.filter((text) => text !== "새 고지 문구 키 추가");
    if (disclosureKeys.length === 0) {
      await page.locator("p", { hasText: "등록된 고지 문구가 없어요." }).waitFor({ timeout: STEP_TIMEOUT });
      return "no disclosures registered — empty state rendered without an error banner";
    }
    // 각 카드에 편집용 textarea가 붙어 있어야 한다(새 키 입력칸 1개 + 카드당 1개).
    const textareaCount = await page.locator("textarea").count();
    if (textareaCount !== disclosureKeys.length + 1) {
      throw new Error(`textarea count ${textareaCount} != ${disclosureKeys.length} cards + 1 new-key field`);
    }
    return `disclosure cards: ${disclosureKeys.length} (${disclosureKeys.slice(0, 5).join(", ")})`;
  });

  // ---- Step 14: clicks page (COM-106 클릭 통계) -----------------------------
  await runStep("clicks-summary-and-range-toggle", page, async () => {
    await page.getByRole("link", { name: "클릭 통계" }).click();
    await page.waitForURL("**/clicks", { timeout: NAV_TIMEOUT });
    await page.getByRole("heading", { name: "클릭 통계", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });

    const totalCard = page.locator("section:has(h2:text('전체 클릭 수'))");
    await totalCard.waitFor({ timeout: NAV_TIMEOUT });
    await page.waitForFunction(
      () => !document.body.innerText.includes("불러오는 중..."),
      undefined,
      { timeout: STEP_TIMEOUT }
    );
    if (await page.locator("p", { hasText: "클릭 통계를 불러오지 못했어요" }).count()) {
      throw new Error("clicks summary error banner shown");
    }
    const totalText = (await totalCard.locator("p").first().innerText()).trim();
    if (!/^[\d,]+회$/.test(totalText)) throw new Error(`total clicks not rendered as a count: "${totalText}"`);

    // 기간 토글: 다른 일수 버튼을 눌러 aria-pressed가 옮겨 가고 요약이 다시 로드되는지.
    const buttons = page.locator("button", { hasText: /^최근 \d+일$/ });
    const buttonCount = await buttons.count();
    if (buttonCount < 2) throw new Error(`expected multiple range buttons, got ${buttonCount}`);
    const second = buttons.nth(1);
    const secondLabel = (await second.innerText()).trim();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/affiliate-clicks"), { timeout: STEP_TIMEOUT }),
      second.click()
    ]);
    if ((await second.getAttribute("aria-pressed")) !== "true") {
      throw new Error(`${secondLabel} toggle not aria-pressed after click`);
    }
    return `total ${totalText}; range toggle ${secondLabel} OK (${buttonCount} options)`;
  });

  // ---- Step 15: MFA 재등록 입구가 계정 영역에 있다 (GAP-063 #3) --------------
  // 읽기 전용 스텝: 헤더의 "인증 앱 다시 등록"을 열어 폼과 문구만 확인하고 **절대 제출하지
  // 않는다** — 제출하면 이 dev 관리자의 MFA가 실제로 해제되고 강제 재등록으로 넘어간다.
  await runStep("mfa-reenroll-entry-point", page, async () => {
    const openButton = page.getByRole("button", { name: "인증 앱 다시 등록" });
    if ((await openButton.count()) !== 1) throw new Error("헤더에 '인증 앱 다시 등록' 버튼이 없어요");
    await openButton.click();
    await page.getByRole("heading", { name: "인증 앱 다시 등록" }).waitFor({ timeout: STEP_TIMEOUT });

    // 복구 코드로도 해제할 수 있다는 사실을 화면이 말해야 한다(서버 verifyMfaCode는 이미 받는다).
    await page.locator("p", { hasText: "복구 코드를 입력해도 돼요" }).first().waitFor({ timeout: STEP_TIMEOUT });
    const codeInput = page.getByPlaceholder("인증 코드 또는 복구 코드");
    if ((await codeInput.count()) < 1) throw new Error("코드 입력칸이 없어요");
    // SEC-101: 해제 뒤 등록을 건너뛸 수 없다는 사실도 같은 화면에 있어야 한다.
    await page
      .locator("p", { hasText: "등록을 마치기 전에는 다른 화면을 쓸 수 없고" })
      .first()
      .waitFor({ timeout: STEP_TIMEOUT });
    const submit = page.getByRole("button", { name: "해제하고 다시 등록하기" });
    if ((await submit.count()) !== 1) throw new Error("'해제하고 다시 등록하기' 버튼이 없어요");
    // NOTE: 여기서 제출하지 않는다. 패널만 닫고 나간다.
    await page.getByRole("button", { name: "그만두기" }).click();
    await page.getByRole("heading", { name: "인증 앱 다시 등록" }).waitFor({ state: "detached", timeout: STEP_TIMEOUT });
    return "계정 영역에서 열림 · 복구 코드 안내/재등록 강제 고지 표시 · 제출 없이 닫힘";
  });

  // ---- Step 16: audit logs are admin-role-only (QA-114c) --------------------
  // The dev seed creates editor@wooriai.local (apps/api/prisma/seed.ts,
  // COM-103); there is NO analyst seed account, so only the editor role is
  // exercised. If the editor account is missing (custom DB), SKIP with a note
  // instead of failing — mirroring the "시드에 없으면 생략" QA-114 spec.
  if (!adminAccountInDb(EDITOR_EMAIL)) {
    process.stdout.write(`\n=== STEP: audit-logs-editor-role-gate ===\nSKIP — ${EDITOR_EMAIL} not found/active in dev DB (seed not run?)\n`);
    results.push({ name: "audit-logs-editor-role-gate", status: "SKIP", detail: `${EDITOR_EMAIL} not in dev DB`, shot: "(none)" });
  } else {
    // Fresh browser context so the editor session cookie never clobbers the
    // admin session used by steps 1-14.
    const editorContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
    const editorPage = await editorContext.newPage();
    editorPage.setDefaultTimeout(STEP_TIMEOUT);
    editorPage.setDefaultNavigationTimeout(NAV_TIMEOUT);
    editorPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[editor] ${msg.text()}`);
    });
    editorPage.on("pageerror", (error) => consoleErrors.push(`[editor] pageerror: ${error.message}`));

    await runStep("audit-logs-editor-role-gate", editorPage, async () => {
      const flow = await loginViaUi(editorPage, EDITOR_EMAIL, EDITOR_PASSWORD);
      // The nav must not offer 감사 로그 to a non-admin role (AdminShell roles gate).
      if ((await editorPage.getByRole("link", { name: "감사 로그" }).count()) !== 0) {
        throw new Error("editor nav shows the 감사 로그 link");
      }
      // Direct navigation renders the access notice, never the table.
      await editorPage.goto(`${BASE_URL}/audit-logs`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await editorPage.getByRole("heading", { name: "감사 로그", level: 1 }).waitFor({ timeout: NAV_TIMEOUT });
      await editorPage
        .locator("p", { hasText: "감사 로그는 관리자(admin) 권한에서만 사용할 수 있어요." })
        .waitFor({ timeout: STEP_TIMEOUT });
      if ((await editorPage.locator("table").count()) !== 0) throw new Error("editor still sees an audit-log table");
      return `editor logged in via ${flow} path; nav hides 감사 로그; direct URL shows the access notice`;
    });
    await editorContext.close().catch(() => {});
  }

  await finish(browser, consoleErrors, results.some((r) => r.status === "FAIL") ? 1 : 0);
}

async function finish(browser, consoleErrors, exitCode) {
  await browser.close().catch(() => {});
  process.stdout.write("\n================ SUMMARY ================\n");
  for (const r of results) {
    process.stdout.write(`${r.status.padEnd(4)} ${r.name}\n`);
    if (r.detail) process.stdout.write(`     ${r.detail}\n`);
    process.stdout.write(`     screenshot: ${r.shot}\n`);
  }
  if (consoleErrors.length) {
    process.stdout.write(`\nBrowser console errors (${consoleErrors.length}):\n`);
    for (const err of consoleErrors.slice(0, 20)) process.stdout.write(`  - ${err.slice(0, 300)}\n`);
  } else {
    process.stdout.write("\nNo browser console errors captured.\n");
  }
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("fatal:", error);
  process.exit(1);
});
