/**
 * QA-ADMIN-E2E: browser end-to-end drive of the admin console (apps/admin).
 *
 * Prerequisites:
 *   - API dev server running at http://localhost:3400
 *     (from apps/api: NODE_ENV=development DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev nohup npx tsx src/main.ts &)
 *   - Admin dev server running at http://localhost:3100 pointed at the API:
 *     (from apps/admin: ADMIN_API_PROXY_TARGET=http://localhost:3400 ./node_modules/.bin/next dev -p 3100)
 *   - Seeded dev admin account: admin@wooriai.local / wooriai-dev-admin
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
 *   QA_OUT_DIR       screenshot/output dir (default scripts/qa/out)
 *
 * The script prints a per-step PASS/FAIL summary and exits non-zero if any
 * step failed. It performs NO writes to the app data other than the MFA
 * enrollment for the dev admin (first run only) — the CSV bulk flow only
 * uses the read-only preview endpoint, never apply.
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
import { existsSync, mkdirSync } from "node:fs";
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

function totpSecretFromDb() {
  const out = execFileSync(
    "psql",
    [
      "-h", "localhost", "-U", "wooriai", "-d", "wooriai_dev", "-tA",
      "-c", `select totp_secret from admin_users where email = '${ADMIN_EMAIL.replace(/'/g, "''")}'`
    ],
    { env: { ...process.env, PGPASSWORD: "wooriai_dev_password" }, encoding: "utf8" }
  ).trim();
  if (!out) throw new Error(`no totp_secret in dev DB for ${ADMIN_EMAIL}`);
  return out;
}

async function totpCode(secret) {
  return await otplib.generate({ secret });
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
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    // Login screen
    await page.getByRole("heading", { name: "WooriAI 관리자" }).waitFor({ timeout: NAV_TIMEOUT });
    await page.getByPlaceholder("관리자 이메일").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("비밀번호").fill(ADMIN_PASSWORD);
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
      const secret = totpSecretFromDb();
      await page.getByPlaceholder("인증 코드 또는 복구 코드").fill(await totpCode(secret));
      await page.getByRole("button", { name: "확인", exact: true }).click();
    } else {
      flow = "no-mfa";
    }

    await dashHeading.waitFor({ timeout: NAV_TIMEOUT });
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

    // Funnel section: 4 fixed stages.
    const funnelCard = page.locator("section:has(h2:text('KPI 퍼널'))");
    await funnelCard.waitFor();
    const funnelRows = await funnelCard.locator("table tbody tr").count();
    if (funnelRows !== 4) throw new Error(`expected 4 funnel rows, got ${funnelRows}`);

    // Event-count table: the 6 registry events always render (0 counts fine).
    const eventCard = page.locator("section:has(h2:text('이벤트별 카운트'))");
    const eventRows = await eventCard.locator("table tbody tr").count();
    if (eventRows < 6) throw new Error(`expected >= 6 event rows, got ${eventRows}`);

    // 7/30-day toggle.
    const btn30 = page.getByRole("button", { name: "최근 30일" });
    await btn30.click();
    await page.getByRole("heading", { name: /요약 \(최근 30일\)/ }).waitFor({ timeout: STEP_TIMEOUT });
    if ((await btn30.getAttribute("aria-pressed")) !== "true") throw new Error("30일 toggle not aria-pressed after click");
    return `funnel rows: ${funnelRows}, event rows: ${eventRows}, 30일 toggle OK`;
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
