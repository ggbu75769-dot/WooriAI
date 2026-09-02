/**
 * 출시 준비 자동화 (트랙 LP-B) — `pnpm launch:prepare`
 *
 * 사용자가 launch.config.json(예시: launch.config.example.json) 하나만 채우면:
 *  1) infra/legal·infra/site HTML의 [대괄호] placeholder를 실제 값으로 치환하고
 *  2) 프로덕션 환경 파일 .env.production을 생성하며(비밀값은 crypto로 자동 생성)
 *  3) `pnpm check:env --file .env.production`으로 생성 결과를 검증한다.
 *
 * ## 하지 않는 것 (일부러)
 *  - `[적용 법령·기간은 법률 검토 시 확정]`(개인정보처리방침 §3)은 **치환하지 않는다** —
 *    라운드 75 보존 계약(packages/test-utils/src/data-retention-promise.test.ts ⓔ)이
 *    "이 자리는 숫자 없이 [대괄호]로 남아 있어야 한다"를 핀으로 걸고 있다(법률 검토 대상).
 *  - `[대괄호]`라는 낱말 자체(초안 배너·HTML 주석의 메타 표현)도 치환 대상이 아니다.
 *    초안 배너 제거는 법률 검토 완료의 선언이므로 사람이 한다.
 *  - 치환은 **정의된 토큰의 정확 일치**만 수행한다 — 그 밖의 바이트는 건드리지 않는다.
 *
 * ## 안전 규칙
 *  - 비밀값(JWT/salt/DB 비밀번호/관리자 초기 비밀번호)은 절대 로그로 출력하지 않는다.
 *  - .env.production이 이미 있으면 덮어쓰지 않는다(운영 중 시크릿 회전 사고 방지) —
 *    재생성하려면 `--force-env`.
 *  - .env.production·launch.config.json이 .gitignore에 없으면 추가한다.
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const CONFIG_PATH = resolve(repoRoot, "launch.config.json");
const EXAMPLE_PATH = resolve(repoRoot, "launch.config.example.json");
const ENV_PATH = resolve(repoRoot, ".env.production");
const GITIGNORE_PATH = resolve(repoRoot, ".gitignore");

const forceEnv = process.argv.includes("--force-env");

function fail(message: string): never {
  console.error(`[launch:prepare] ${message}`);
  process.exit(1);
}

if (!existsSync(join(repoRoot, "scripts", "launch", "prepare.ts"))) {
  fail("리포지토리 루트에서 실행하세요: pnpm launch:prepare");
}

/* ---------------------------------------------------------------------------
 * 1) launch.config.json 읽기
 * ------------------------------------------------------------------------- */

if (!existsSync(CONFIG_PATH)) {
  console.error(
    [
      "[launch:prepare] launch.config.json이 없습니다.",
      "",
      "  1) cp launch.config.example.json launch.config.json",
      "  2) 파일 안 [필수] 4개(운영 주체명·지원 이메일·도메인·시행일)와 카카오 키를 채운다",
      "  3) pnpm launch:prepare 재실행",
      "",
      "  (launch.config.json은 .gitignore 대상 — 커밋되지 않습니다)"
    ].join("\n")
  );
  process.exit(1);
}

/** 예시 파일과 같은 규칙: "줄 전체 주석"(트림 후 //로 시작)만 지우고 JSON으로 파싱. */
function parseJsonc(raw: string, source: string): unknown {
  const withoutComments = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  try {
    return JSON.parse(withoutComments);
  } catch (error) {
    fail(`${source} 파싱 실패: ${(error as Error).message}\n  (주석은 줄 전체 주석만 허용됩니다 — 값 뒤 // 금지)`);
  }
}

type LaunchConfig = {
  operatorName: string;
  supportEmail: string;
  domain: string;
  launchDate: string;
  siteDomain: string;
  kakao: { restApiKey: string; javascriptKey: string; nativeAppKey: string };
  privacyOfficerName: string;
  hostingProvider: string;
  pushProvider: string;
};

const rawConfig = parseJsonc(readFileSync(CONFIG_PATH, "utf8"), "launch.config.json") as Record<string, unknown>;

function str(key: string, fallback = ""): string {
  const value = rawConfig[key];
  return typeof value === "string" ? value.trim() : fallback;
}

const kakaoRaw = (rawConfig.kakao ?? {}) as Record<string, unknown>;
const kakaoStr = (key: string): string => (typeof kakaoRaw[key] === "string" ? (kakaoRaw[key] as string).trim() : "");

/** "https://example.com/" → "example.com" (스킴·말미 슬래시 제거 후 형식 검증). */
function normalizeDomain(value: string, label: string): string {
  const stripped = value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z0-9-]+$/.test(stripped)) {
    fail(`${label} 형식이 올바르지 않습니다: "${value}" (예: wooriai.duckdns.org)`);
  }
  return stripped;
}

/**
 * 시행일을 YYYY-MM-DD로 정규화한다. "2026년 9월 15일"·"2026.9.15" 꼴도 받아 준다.
 *
 * ⚠️ 문서에 "N일" 꼴(예: "15일")이 섞여 들어가면 라운드 75 보존 계약의 전수 스윕
 * (모든 "N일/N년/…" 표현 분류)이 미분류 숫자로 빨개진다 — 그래서 반드시 ISO로 기록한다.
 */
function normalizeLaunchDate(value: string): string {
  const match = /^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})[일\s.]*$/.exec(value);
  if (!match) fail(`launchDate 형식이 올바르지 않습니다: "${value}" (예: 2026-09-15)`);
  const [, y, m, d] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    fail(`launchDate가 실제 달력 날짜가 아닙니다: "${value}"`);
  }
  return iso;
}

const missingRequired = (["operatorName", "supportEmail", "domain", "launchDate"] as const).filter(
  (key) => str(key) === ""
);
if (missingRequired.length > 0) {
  fail(`launch.config.json의 [필수] 항목이 비어 있습니다: ${missingRequired.join(", ")}`);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str("supportEmail"))) {
  fail(`supportEmail이 이메일 형식이 아닙니다: "${str("supportEmail")}"`);
}

const config: LaunchConfig = {
  operatorName: str("operatorName"),
  supportEmail: str("supportEmail"),
  domain: normalizeDomain(str("domain"), "domain"),
  launchDate: normalizeLaunchDate(str("launchDate")),
  siteDomain: str("siteDomain") === "" ? "" : normalizeDomain(str("siteDomain"), "siteDomain"),
  kakao: {
    restApiKey: kakaoStr("restApiKey"),
    javascriptKey: kakaoStr("javascriptKey"),
    nativeAppKey: kakaoStr("nativeAppKey")
  },
  privacyOfficerName: str("privacyOfficerName"),
  hostingProvider: str("hostingProvider"),
  pushProvider: str("pushProvider")
};

const siteDomain = config.siteDomain || config.domain;
const privacyOfficer = config.privacyOfficerName || config.operatorName;
const hostingProvider = config.hostingProvider || "Oracle Cloud Infrastructure(오라클 클라우드)";
const pushProvider = config.pushProvider || "Google LLC(Firebase Cloud Messaging — 푸시 알림 기능 사용 시)";
const kakaoConfigured = config.kakao.restApiKey !== "";

/* ---------------------------------------------------------------------------
 * 2) infra/legal·infra/site placeholder 치환 (정확 일치 토큰만)
 * ------------------------------------------------------------------------- */

const HTML_TARGETS = [
  "infra/legal/terms-of-service.html",
  "infra/legal/privacy-policy.html",
  "infra/legal/account-deletion.html",
  "infra/site/index.html",
  "infra/site/faq.html",
  "infra/site/support.html"
] as const;

/** 긴 토큰을 먼저 치환한다("[운영 주체명 — …]"이 "[운영 주체명]"보다 먼저). */
const TOKEN_MAP: [token: string, value: string][] = [
  ["[운영 주체명: 개인/사업자 확정 후 기재]", config.operatorName],
  ["[운영 주체명 — 확정 후 기재]", config.operatorName],
  ["[운영 주체명]", config.operatorName],
  ["[성명 — 확정 후 기재]", privacyOfficer],
  ["[support@example.com — 실제 지원 이메일로 교체]", config.supportEmail],
  ["[지원 이메일 주소]", config.supportEmail],
  ["[지원 이메일]", config.supportEmail],
  ["[출시일]", config.launchDate],
  ["[호스팅 사업자명 — 확정 후 기재]", hostingProvider],
  ["[푸시 발송 사업자 — 사용 시 기재]", pushProvider]
];

/** 치환 후에도 남는 것이 정상인 대괄호 표현(메타 표현·법률 검토 핀). */
const EXPECTED_REMAINING = ["[대괄호]", "[적용 법령·기간은 법률 검토 시 확정]"] as const;

type ReplaceResult = { path: string; replaced: number };
const replaceResults: ReplaceResult[] = [];
const unexpectedRemaining: string[] = [];

for (const relativePath of HTML_TARGETS) {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) fail(`치환 대상 파일이 없습니다: ${relativePath}`);
  const original = readFileSync(absolute, "utf8");
  let updated = original;
  let replaced = 0;
  for (const [token, value] of TOKEN_MAP) {
    if (!updated.includes(token)) continue;
    const count = updated.split(token).length - 1;
    updated = updated.split(token).join(value);
    replaced += count;
  }
  if (updated !== original) writeFileSync(absolute, updated, "utf8");
  replaceResults.push({ path: relativePath, replaced });

  for (const match of updated.matchAll(/\[[^\][\n]{1,60}\]/g)) {
    const token = match[0];
    if ((EXPECTED_REMAINING as readonly string[]).includes(token)) continue;
    if (/^\[aria-/.test(token)) continue; // CSS/HTML 속성 선택자 표기
    unexpectedRemaining.push(`${relativePath}: ${token}`);
  }
}

/* ---------------------------------------------------------------------------
 * 3) .env.production 생성
 * ------------------------------------------------------------------------- */

const secret = (bytes: number) => randomBytes(bytes).toString("base64url");
/** DATABASE_URL에 그대로 들어가므로 URL-인코딩이 필요 없는 hex만 쓴다. */
const dbPassword = randomBytes(24).toString("hex");

const KAKAO_SENTINEL = "replace-with-kakao-rest-api-key";
const kakaoClientId = kakaoConfigured ? config.kakao.restApiKey : KAKAO_SENTINEL;

let envSkipped = false;

if (existsSync(ENV_PATH) && !forceEnv) {
  envSkipped = true;
} else {
  // 비밀값 자동 생성 항목: 아래 8개(값은 로그에 출력하지 않는다).
  const envContent = `# 우리아이 프로덕션 환경변수 — pnpm launch:prepare가 생성 (${new Date().toISOString().slice(0, 10)})
# ⚠️ 비밀값 포함 — 커밋 금지(.gitignore), 파일 권한 600.
# 배포: docs/5차/oracle-free-deploy-runbook.md (docker-compose.prod.yml + caddy 오버레이)

NODE_ENV=production
PORT=3000
LOG_LEVEL=info
# Caddy/리버스 프록시 1홉 뒤 전제 — 프록시 없이 직접 노출한다면 0으로 (check-env.ts 참고).
TRUST_PROXY=1

# ── DB ──────────────────────────────────────────────────────────
# docker-compose.prod.yml은 POSTGRES_PASSWORD로 DATABASE_URL을 직접 조립한다 —
# 두 값의 비밀번호는 같아야 하며, 아래 두 줄은 launch:prepare가 같은 값으로 생성했다.
POSTGRES_PASSWORD=${dbPassword}
DATABASE_URL=postgresql://wooriai:${dbPassword}@postgres:5432/wooriai

# ── 시크릿 (자동 생성 — 재생성하려면 pnpm launch:prepare --force-env) ─
JWT_ACCESS_SECRET=${secret(48)}
JWT_REFRESH_SECRET=${secret(48)}
# 프로덕션에서는 무시되는 dev/test 전용 헤더지만 부팅 필수 키라 난수로 채운다.
WOORIAI_ADMIN_TOKEN=${secret(32)}
AFFILIATE_CLICK_IP_SALT=${secret(32)}
ANALYTICS_ANON_SALT=${secret(32)}

# ── 도메인 파생값 (launch.config.json의 domain/siteDomain) ───────
INVITE_LINK_BASE_URL=https://${config.domain}
EXPO_PUBLIC_API_BASE_URL=https://${config.domain}/api/v1
# 지원 사이트(infra/site + infra/legal 사본 — infra/site/README.md 배포 절차) 기준.
EXPO_PUBLIC_TERMS_URL=https://${siteDomain}/terms-of-service.html
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://${siteDomain}/privacy-policy.html
EXPO_PUBLIC_SUPPORT_URL=https://${siteDomain}/support.html
EXPO_PUBLIC_FAQ_URL=https://${siteDomain}/faq.html

# ── 카카오 로그인 ────────────────────────────────────────────────
${
  kakaoConfigured
    ? "# launch.config.json의 REST API 키."
    : `# ⚠️ 카카오 키 미입력 — 아래 표식 값을 실제 REST API 키로 바꾸고 EXPO_PUBLIC_KAKAO_ENABLED=1로 올린 뒤
# api 재기동·앱 재빌드하세요 (launch.config.json에 채워 pnpm launch:prepare --force-env 재실행도 가능
# — 단 재실행은 모든 시크릿을 새로 뽑으므로 이미 배포했다면 이 파일을 직접 수정).`
}
OAUTH_KAKAO_CLIENT_ID=${kakaoClientId}
# 카카오 콘솔에서 Client Secret을 "사용"으로 켰을 때만 채운다(선택).
OAUTH_KAKAO_CLIENT_SECRET=
OAUTH_KAKAO_REDIRECT_URIS=wooriai://oauth/kakao
EXPO_PUBLIC_KAKAO_ENABLED=${kakaoConfigured ? "1" : "0"}
EXPO_PUBLIC_KAKAO_CLIENT_ID=${kakaoConfigured ? config.kakao.restApiKey : ""}
EXPO_PUBLIC_KAKAO_REDIRECT_URI=wooriai://oauth/kakao

# ── 운영 스위치 (끌 때도 값을 명시 — oracle-bootstrap.sh와 같은 규율) ─
# 단일 VM 1프로세스 전제 — 수평 확장 시 워커 전용 1대에만 1.
WORKER_ENABLED=1
LINK_HEALTH_ENABLED=0
PUSH_ENABLED=0
EXPO_PUBLIC_PUSH_ENABLED=0

# ── 어드민 초기 계정 (첫 시드에서 1회 사용 — 로그인 후 즉시 비밀번호 교체) ─
ADMIN_SEED_EMAIL=${config.supportEmail}
ADMIN_SEED_PASSWORD=${secret(18)}

# ── 제휴 ────────────────────────────────────────────────────────
AFFILIATE_ALLOWED_DOMAINS=coupang.com,link.coupang.com,smartstore.naver.com,shopping.naver.com,brand.naver.com
# 고지 문구의 런타임 단일 소스는 disclosure 테이블 — 이 키는 check:env 필수 유지용(DNC-010).
AFFILIATE_DISCLOSURE_TEXT=이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.

# ── 아직 배선되지 않은 자리 (check:env 필수 유지용 — 코드가 읽지 않음) ─
OAUTH_APPLE_CLIENT_ID=apple-login-not-wired
OAUTH_GOOGLE_CLIENT_ID=google-login-not-wired
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=wooriai-prod
S3_ACCESS_KEY_ID=wooriai
S3_SECRET_ACCESS_KEY=${secret(32)}
`;
  writeFileSync(ENV_PATH, envContent, "utf8");
  chmodSync(ENV_PATH, 0o600);
}

/* ---------------------------------------------------------------------------
 * 4) .gitignore 방어선 확인
 * ------------------------------------------------------------------------- */

const gitignore = existsSync(GITIGNORE_PATH) ? readFileSync(GITIGNORE_PATH, "utf8") : "";
const gitignoreLines = gitignore.split(/\r?\n/).map((line) => line.trim());
const additions: string[] = [];
if (!gitignoreLines.includes("launch.config.json")) additions.push("launch.config.json");
if (!gitignoreLines.includes(".env.production") && !gitignoreLines.includes(".env.*")) {
  additions.push(".env.production");
}
if (additions.length > 0) {
  writeFileSync(
    GITIGNORE_PATH,
    `${gitignore.replace(/\n*$/, "\n")}\n# 출시 준비 산출물(비밀값 포함 — scripts/launch/prepare.ts)\n${additions.join("\n")}\n`,
    "utf8"
  );
  console.log(`[launch:prepare] .gitignore에 추가: ${additions.join(", ")}`);
}

/* ---------------------------------------------------------------------------
 * 5) 검증: pnpm check:env --file .env.production
 * ------------------------------------------------------------------------- */

const check = spawnSync("pnpm", ["check:env", "--file", ".env.production"], {
  cwd: repoRoot,
  encoding: "utf8"
});
// check-env.ts는 키 이름·개수만 출력한다(값 미출력) — 그대로 흘려도 안전.
if (check.stdout) process.stdout.write(check.stdout);
if (check.stderr) process.stderr.write(check.stderr);
if (check.status !== 0) {
  fail("생성된 .env.production이 pnpm check:env를 통과하지 못했습니다 — 위 오류를 확인하세요.");
}

/* ---------------------------------------------------------------------------
 * 6) 결과 요약 (비밀값은 출력하지 않는다)
 * ------------------------------------------------------------------------- */

const totalReplaced = replaceResults.reduce((sum, result) => sum + result.replaced, 0);

console.log("\n[launch:prepare] 완료 요약");
console.log("─".repeat(56));
console.log("● placeholder 치환 (infra/legal · infra/site)");
for (const result of replaceResults) {
  console.log(`  - ${result.path}: ${result.replaced}건${result.replaced === 0 ? " (이미 치환됨/없음)" : ""}`);
}
console.log(`  합계 ${totalReplaced}건 · 유지된 자리: [적용 법령·기간은 법률 검토 시 확정](법률 검토 핀) · 초안 배너`);
if (unexpectedRemaining.length > 0) {
  console.log("  ⚠️ 분류되지 않은 대괄호 표현이 남아 있습니다(확인 필요):");
  for (const entry of unexpectedRemaining) console.log(`    - ${entry}`);
}

console.log("● .env.production");
if (envSkipped) {
  console.log("  - 기존 파일 유지(덮어쓰지 않음) — 재생성은 --force-env. check:env는 기존 파일로 통과 확인.");
} else {
  console.log(`  - 생성 완료(권한 600) — 비밀값 8개 자동 생성(JWT 2·salt 2·어드민 토큰·DB 비밀번호·관리자 초기 비밀번호·S3), 도메인 파생 6개, 카카오 ${kakaoConfigured ? "키 주입" : "건너뜀"}`);
  console.log("  - 관리자 초기 비밀번호는 .env.production의 ADMIN_SEED_PASSWORD — 첫 로그인 후 즉시 교체(ADM-007)");
}

console.log("● 남은 수동 항목");
if (!kakaoConfigured) {
  console.log("  - 카카오 키 미입력: developers.kakao.com에서 발급 후 launch.config.json에 채우고 .env.production의 표식 값을 교체");
}
console.log("  - 법률 검토: 초안 배너 제거 + [적용 법령·기간은 법률 검토 시 확정] 확정(문서·코드 계약 함께 갱신)");
if (config.privacyOfficerName === "") {
  console.log(`  - 개인정보 보호책임자 성명: 운영 주체명("${config.operatorName}")으로 기재됨 — 사업자라면 실제 성명으로 확인`);
}
console.log("  - 카카오 콘솔: 플랫폼 등록 + redirect URI(wooriai://oauth/kakao) 등록(서버 allowlist와 동일 값)");
console.log("  - 다음 단계는 docs/5차/launch-minimal-guide.md 참고");
