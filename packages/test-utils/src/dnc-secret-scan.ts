// 라운드 86 트랙 E (GAP-086 #5) — DNC-019(비밀값 하드코딩 금지)의 부정 스윕.
// **무엇을 비밀값으로 볼 것인가**와 **가짜 값을 무엇으로 가를 것인가**를 오늘 값으로 정한다.
//
// 라운드 84 트랙 B가 `dnc-guard-ledger.ts`로 조항 스무 줄에 가드 대장을 세웠고, 그 대장이 남긴
// *"가드 없음"* 셋 가운데 둘의 재개 조건은 **사건이 아니라 결정**을 기다렸다. 라운드 85 트랙 E가
// 그중 하나(DNC-016)를 닫았고, 남은 하나가 이것이다. 대장이 그 자리에 적어 둔 문장 그대로:
//
//   DNC-019: "… 또는 **스윕의 모양이 결정되는 날** — 무엇을 비밀값으로 볼 것인가와 테스트
//   픽스처의 가짜 값을 어떻게 가를 것인가가 그 결정이고, **그 둘을 정하지 않은 스윕은 첫날부터
//   면제 목록으로 산다**."
//
// ⚠️ **사건을 기다리는 조건은 저절로 오지만, 결정을 기다리는 조건은 오지 않는다.** 라운드 85가
// 그 결정을 (옳게) 미뤘고, 그러자 한 라운드 동안 아무 일도 일어나지 않았다. 실패 시나리오는
// 이렇게 생겼다: 제휴 파트너 계약이 들어오고 누군가 시드의 `affiliatePartnerCode`에 실제 파트너
// 코드를 채운다. 그것은 링크가 동작하게 만드는 지극히 자연스러운 한 줄이고, 아무도 *"비밀값을
// 커밋한다"* 고 생각하지 않는다. **DNC-019의 경계는 그때 넘어가는데 빨개지는 자리가 0건이고,
// 그 저장소는 공개된다.** 같은 일이 소스에 적힌 OAuth secret에서도, staging DB URL에서도 일어난다.
//
// ## ⚠️ 결정 ① — 무엇이 비밀값인가 (뿌리)
//
// 조항이 이름으로 잠근 것은 셋이다(**실제 OAuth secret · 제휴 ID · 운영 DB URL**). 그 셋 각각을
// **자기 뿌리와 바늘**로 나눈다. 뿌리는 *"실제 값이 저장소에 들어온다면 반드시 앉는 자리"* 이고,
// 넷이다(`SECRET_ROOTS` — **뿌리마다 왜 이 뿌리인가가 빈 문자열일 수 없다**).
//
//  · `seed-affiliate-code` — 시드의 `affiliatePartnerCode` 칸. 제휴 ID가 저장소에 들어오는 가장 싼
//    입구이고, 오늘 **67행 전부 `null`** 이라 경계가 값으로 선명하다.
//  · `secret-fallback` — `requireSecret(envKey, devFallback)`의 **둘째 인자**. 이 저장소에서 비밀값을
//    읽는 자리는 그 함수 하나이고, 값이 코드에 적히는 자리도 거기 하나다.
//  · `db-url-literal` — 코드·설정에 적힌 `postgres(ql)://` URL 리터럴. 운영 DB URL은 URL로만 온다.
//  · `env-example-value` — `.env.example`의 `KEY=값` 줄. 실제 값이 **가장 자주 붙여넣어지는 자리**다
//    (자리표시자 파일이라 리뷰가 느슨하다).
//
// ⚠️ **먼저 모집단, 그다음 바늘** — 대장 자신이 이 자리에 적어 둔 순서다. 뿌리는 계약이 **실재와
// 산출을 함께 확인**한다(손으로 배열한 목록은 뿌리가 아니다 — 빈 모집단 위에서는 모든 부정 단언이
// 통과한다).
//
// ## ⚠️ 결정 ② — 가짜 값과 진짜 값을 무엇으로 가르는가 (표식, 그리고 게이트)
//
// **규칙은 하나다: 자기 고백 표식**(`FAKE_VALUE_MARKERS` — dev · test · local · example · sample ·
// change-me · placeholder · dummy · fake · unused). 표식을 단 값은 자기가 가짜라고 말하고 있고,
// **표식 없는 값이 비밀값 자리에 서면 진짜로 본다.**
//
// ⚠️ 그런데 그 규칙만으로 가르지 못하는 자리가 **하나** 있다. `requireSecret`의 둘째 인자는 표식이
// 있어도 **값이 코드에 있고 그 값으로 서버가 실제로 뜰 수 있는** 자리다. 그래서 그 자리는 표식이
// 아니라 **게이트**로 가른다 — *"`isDevOrTestEnv()` 뒤에서만 반환된다"*. 그 아홉(＋부트 점검 여섯
// ＋테스트 픽스처 하나)은 **이름으로 면제 대장에 오르고**(`SecretExemption`), **그 이유의 참을
// 계약이 소스로 확인한다**(`devFallbackGateProof` — 라운드 84 트랙 D의 `provenBy` 관례).
//
// ⚠️ **정찰이 센 셋 중 하나는 면제가 아니었다.** 정찰(#5 ⓐ②)은 면제 부류를 셋으로 적었다:
// (i) dev 폴백 · (ii) 테스트 픽스처 · (iii) `.env.example`의 자리표시자. 실측하면 **(iii)은 면제가
// 아니다** — 오늘 `.env.example`의 비밀 키 값 열둘은 **전부 표식을 달고 있어서**(change-me-… ·
// dev-… · …-local) 애초에 바늘에 걸리지 않는다. 걸리지도 않는 줄을 면제로 적으면 그것이 유령
// 면제이고, 그때부터 면제 목록은 세는 자리가 아니라 문이 된다. 그래서 **오늘 면제 부류는 둘**이다
// (`SECRET_EXEMPTION_CLASSES` — 그리고 계약이 *"부류마다 적어도 한 줄"* 을 함께 센다).
//
// ## ⚠️ 실측이 정찰과 갈린 자리 둘 (이 트랙이 세어서 정한다)
//
//  · **명명 폴백은 넷이 아니라 셋이다.** 정찰 #5 ⓒ는 *"아홉 중 넷은 `DEV_*_FALLBACK` 이름 상수,
//    다섯은 인라인 리터럴"* 이라고 적었다. 다시 세면 **셋**(`DEV_ALLOWED_DOMAINS_FALLBACK` ·
//    `DEV_CLICK_IP_SALT_FALLBACK` · `DEV_ANALYTICS_ANON_SALT_FALLBACK`)이고 **여섯**이 인라인이다
//    (정찰이 값으로 적어 둔 리터럴 목록 자체가 여섯 줄이다 — 목록과 수가 어긋나 있었다).
//    ⚠️ 그 수는 이 스윕의 판정에 쓰이지 않는다(표식은 **이름 상수든 리터럴이든 똑같이** 읽는다) —
//    갈린 사실만 값으로 남긴다.
//  · **DB URL 리터럴은 여섯이 아니다.** 정찰은 여섯으로 셌지만, 이 스윕의 모집단(코드·설정 전수 ·
//    문서 제외)에서 다시 세면 **열**이다. 정찰이 문서(README·CLAUDE.md·docs)를 함께 세고 주석 안의
//    같은 줄을 한 번만 센 결과다. **판정은 같다 — 열 전부 로컬 호스트이거나 compose 서비스
//    호스트이고, 운영 compose는 비밀번호를 `${POSTGRES_PASSWORD}`로 주입한다.**
//
// ## ⚠️ 이 스윕이 무는 것의 한계 — 값의 **모양**이지 값의 **정체**가 아니다
//
//  · 표식을 단 진짜 비밀값(`dev-`로 시작하는 실제 키)은 지나간다. 표식은 **관례**이고 이 스윕은
//    그 관례를 강제하는 것이지 값의 정체를 알지 못한다.
//  · `docs/**`는 모집단 밖이다 — 조항이 잠근 것은 *"코드/seed/test"* 이고, 이 트랙은 문서를
//    **읽기만** 한다(개정은 PM/Tech Lead 승인 절차). ⚠️ 문서에 붙여넣어진 운영 URL은 이 그물 밖이다
//    (재개 조건: 문서 축을 무는 스윕이 서는 날 — 그 결정은 이 트랙의 것이 아니다).
//  · 이름을 감춘 값(환경변수 이름을 바꿔 우회하거나 base64로 감싼 값)은 잡지 못한다. 고엔트로피
//    바늘 하나가 그 방향의 가장 흔한 모양만 문다.
//  · ⚠️ **라운드 86 리뷰가 연 사각 둘과 오늘의 처분**: ⓐ `.env.example`의 **자격증명 URL 키**
//    (`REDIS_URL`·`S3_ENDPOINT` — 이름에 SECRET·PASSWORD가 없어 옛 바늘 셋 어디에도 걸리지 않았다)는
//    오늘 `urlPassword` 조각을 뜯는 바늘 하나로 문다(M-5). 남는 한계는 **비밀번호 없이 사용자 이름만
//    있는 URL**이다 — 그 모양은 값 자체가 비밀이 아니라 판정을 세우지 않았다. ⓑ `requireSecret` 호출부를
//    **인자 내용의 콜론**으로 거르던 필터는 URL 폴백·삼항 폴백을 모집단 밖으로 내보내고 있었다 —
//    오늘은 **선언 줄의 위치**로만 가른다(M-3).
//
// 이 한계를 값으로 적어 두는 이유는 다음 사람이 이 파일을 *"저장소에 비밀값이 없다는 증명"* 으로
// 읽지 않게 하기 위해서다 — 이것은 **경계가 넘어갈 때 소리가 나는 자리**다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/** 조항의 단일 소스. ⚠️ 이 트랙은 이 파일을 **읽기만** 한다(개정은 PM/Tech Lead 승인 절차다). */
export const DNC_CONTRACT_PATH = "docs/dev/do-not-change.md";

/** 면제의 증명이 읽는 파일 — 이 트랙은 이 파일을 **읽기만** 했다. */
export const REQUIRE_SECRET_PATH = "apps/api/src/common/config/require-secret.ts";

/**
 * 이 스윕 자신의 두 파일 — 계약 ⓓ가 읽는다.
 *
 * ⚠️ **스윕은 자기를 모집단에 넣지 않는다.** 이 파일들에는 가짜 픽스처와 `postgres(ql)://` 예시가
 * 값으로 실려 있어서, 모집단에 들어오는 순간 이 계약은 **첫날부터 빨간 채로** 산다. 그러면 다음
 * 사람이 고치는 방법은 하나뿐이다 — 자기 자신을 면제 목록에 적는 것. 그 순간 면제 목록이 문을
 * 열고, 대장이 세는 도구가 아니라 면제부가 된다(라운드 85 트랙 E가 같은 자리에 적은 규율).
 */
export const SWEEP_SELF_FILES = [
  "packages/test-utils/src/dnc-secret-scan.ts",
  "packages/test-utils/src/dnc-secret-scan.test.ts"
] as const;

/** 저장소 상대 경로를 읽는다. */
export function readRepoFile(relativePath: string, baseDir: string = repoRoot): string {
  return readFileSync(join(baseDir, relativePath), "utf8");
}

// ── 뿌리 ──────────────────────────────────────────────────────────────────────

export type SecretRootKind =
  | "seed-affiliate-code"
  | "secret-fallback"
  | "db-url-literal"
  | "env-example-value";

export type SecretRoot = {
  readonly kind: SecretRootKind;
  /** 저장소 상대 경로(파일 또는 디렉터리) 전수 — 계약이 **실재를 확인한다**. */
  readonly paths: readonly string[];
  /** 이 뿌리가 내놓는 자리 하나의 모양(실패 메시지가 이 말을 쓴다). */
  readonly unit: string;
  /** 왜 이 뿌리인가 — **빈 문자열일 수 없다.** 뿌리도 값이고, 값에는 이유가 붙는다. */
  readonly reason: string;
};

/**
 * 실제 비밀값이 저장소에 들어온다면 **반드시 앉는 자리** 넷.
 *
 * ⚠️ 이 목록이 **모집단의 결정**이다(DNC-019의 재개 조건이 기다리던 그 결정의 절반). 늘리는 것은
 * 다음 라운드의 판단이지만, 줄이는 것은 그물을 좁히는 일이라 이유와 함께 적혀야 한다.
 */
export const SECRET_ROOTS: readonly SecretRoot[] = [
  {
    kind: "seed-affiliate-code",
    paths: ["apps/api/prisma/seed-data.ts"],
    unit: "productLinkSeeds 각 행의 `affiliatePartnerCode` 칸",
    reason:
      "제휴 ID가 저장소에 들어오는 가장 싼 입구다 — 파트너 계약이 성사되면 '링크가 동작하게 만드는 한 줄'로 " +
      "이 칸이 채워지고, 그것을 비밀값 커밋이라고 생각하는 사람은 없다. 오늘 이 칸은 **전 행이 `null`** 이라 " +
      "경계가 값으로 선명하다: null이 아닌 것 하나가 곧 경계다."
  },
  {
    kind: "secret-fallback",
    paths: ["apps/api/src", "apps/api/test"],
    unit: "`requireSecret(envKey, devFallback)`의 둘째 인자(적힌 그대로의 표현식)",
    reason:
      "이 저장소에서 비밀값을 **읽는** 자리는 그 함수 하나이고, 비밀값이 **코드에 적히는** 자리도 거기 하나다. " +
      "조항이 이름으로 든 OAuth secret은 오늘 정확히 이 모양으로 산다. ⚠️ 뿌리에 `apps/api/test`를 함께 두는 이유는 " +
      "조항의 말이 '코드/seed/**test**'이기 때문이다 — 테스트를 모집단 밖에 두면 조항의 한 낱말이 그물 밖으로 나간다."
  },
  {
    kind: "db-url-literal",
    paths: ["apps", "packages", "scripts", "infra", ".env.example"],
    unit: "`postgres(ql)://…` URL 리터럴 하나(호스트·비밀번호를 조각으로 나눠 든다)",
    reason:
      "운영 DB URL은 URL 리터럴로만 온다 — 그리고 그것이 들어오는 경로는 대개 '한 번만 쓰려고' 붙여넣는 스크립트나 " +
      "compose 파일이라 소스 디렉터리 하나만 보는 그물로는 놓친다. 그래서 코드·설정 **전수**를 훑는다. " +
      "⚠️ `docs/**`는 뿌리에 두지 않는다(조항의 말은 '코드/seed/test'이고, 이 트랙은 문서를 읽기만 한다 — 위 한계 절)."
  },
  {
    kind: "env-example-value",
    paths: [".env.example"],
    unit: "`KEY=값` 줄 하나(빈 값과 순수 숫자는 비밀값이 아니라 자리표시자·설정값이라 걷지 않는다)",
    reason:
      "실제 값이 **가장 자주 붙여넣어지는 자리**다: 이 파일은 자리표시자 파일이라 리뷰가 느슨하고, " +
      "'내 로컬에서 되게' 하려고 진짜 값을 적었다가 그대로 커밋되는 사고가 이 부류에서 가장 흔하다. " +
      "⚠️ 키 이름의 두 방향(카탈로그와 이 파일이 같은 키를 아는가)은 `scripts/check-env.ts`의 축이고, " +
      "이 뿌리가 묻는 것은 그 옆 칸이다 — **값이 가짜인가.**"
  }
];

// ── 뿌리에서 자리 걷기 ────────────────────────────────────────────────────────

/** 뿌리에서 걷어 올린 자리 하나. `parts`에는 `value`가 반드시 있고, 뿌리에 따라 조각이 더 붙는다. */
export type SecretCandidate = {
  readonly kind: SecretRootKind;
  /** 이 자리의 **이름**(값이 아니다) — 면제 대장과 실패 메시지가 이것을 쓴다. */
  readonly id: string;
  /** 어디서 왔는가 — 실패 메시지가 사람을 그 파일로 보낸다. */
  readonly where: string;
  readonly parts: Readonly<Record<string, string>>;
};

const POPULATION_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".prisma",
  ".sql",
  ".sh"
] as const;

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".expo",
  ".turbo",
  "android",
  "ios"
]);

/** `node_modules`·빌드 산출물·점 디렉터리를 뺀 재귀 걷기(다른 스윕들과 같은 관례). */
function walkFiles(absoluteDir: string, matches: (fileName: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const absolute = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...walkFiles(absolute, matches));
      continue;
    }
    if (matches(entry.name)) found.push(absolute);
  }
  return found;
}

function toRepoPath(absolutePath: string, baseDir: string = repoRoot): string {
  return relative(baseDir, absolutePath).split(sep).join("/");
}

/** 한 뿌리 경로(파일이든 디렉터리든) 아래의 모집단 파일 전수 — **스윕 자신의 파일은 뺀다.** */
export function filesUnder(relativePath: string, baseDir: string = repoRoot): string[] {
  const absolute = join(baseDir, relativePath);
  const stats = statSync(absolute);
  const paths = stats.isDirectory()
    ? walkFiles(absolute, (name) => POPULATION_EXTENSIONS.some((ext) => name.endsWith(ext)))
    : [absolute];
  return paths
    .map((file) => toRepoPath(file, baseDir))
    .filter((file) => !(SWEEP_SELF_FILES as readonly string[]).includes(file))
    .sort();
}

/** DB URL 뿌리가 실제로 읽는 파일 전수 — 계약이 실재와 자기 배제를 함께 확인한다. */
export function scannedFiles(baseDir: string = repoRoot): string[] {
  const root = SECRET_ROOTS.find((entry) => entry.kind === "db-url-literal");
  const files = new Set<string>();
  for (const path of root?.paths ?? []) {
    for (const file of filesUnder(path, baseDir)) files.add(file);
  }
  return [...files].sort();
}

/** ⓐ 시드의 파트너 코드 칸 — 타입 선언 줄(`string | null;`)은 자리가 아니다(끝이 `,`인 줄만 읽는다). */
const SEED_AFFILIATE_FIELD = /^\s*affiliatePartnerCode:\s*(.+?),\s*$/gm;

export function collectSeedAffiliateCodes(baseDir: string = repoRoot): SecretCandidate[] {
  const where = "apps/api/prisma/seed-data.ts";
  const source = readRepoFile(where, baseDir);
  return [...source.matchAll(SEED_AFFILIATE_FIELD)].map((match, index) => ({
    kind: "seed-affiliate-code" as const,
    id: `affiliatePartnerCode[${index}]`,
    where,
    parts: { value: match[1].trim() }
  }));
}

/**
 * 이 `requireSecret(` 자리가 **함수 선언**인가(호출부가 아닌가).
 *
 * ⚠️ **라운드 86 리뷰 M-3** — 종전에는 이것을 *인자의 내용*으로 갈랐다(*"둘째 인자에 `:`가 있으면
 * 선언"*). 선언 줄(`devFallback: string`)은 실제로 그 모양이지만, **콜론은 호출부에도 흔하다**:
 * `requireSecret("REDIS_URL", "redis://localhost:6379")` 같은 URL 폴백도, 삼항 폴백
 * (`isX ? "a" : "b"`)도 그 필터에 걸려 **모집단에서 통째로 사라진다** — 즉 실제 비밀값이 들어올
 * 수 있는 모양 둘이 조용히 그물 밖으로 나갔다.
 *
 * 그래서 오늘은 **선언 줄의 위치**로 가른다: 이 자리 바로 앞이 `function ` 이면 선언이다
 * (`export function requireSecret(` · `function requireSecret(` — 오늘 저장소의 유일한 선언이
 * `require-secret.ts`의 그 한 줄이다). 인자 안에 무엇이 적혀 있든 판정이 흔들리지 않는다.
 */
function isRequireSecretDeclaration(source: string, cursor: number): boolean {
  return /(?:^|\W)(?:export\s+)?(?:async\s+)?function\s+$/.test(source.slice(Math.max(0, cursor - 40), cursor));
}

/** 괄호 균형을 세어 `requireSecret(…)`의 인자 전체를 떼어 낸다(여러 줄 호출도 읽는다). */
function requireSecretArguments(source: string): string[][] {
  const calls: string[][] = [];
  const marker = "requireSecret(";
  let cursor = source.indexOf(marker);

  while (cursor !== -1) {
    let depth = 0;
    let end = cursor + marker.length - 1;
    for (; end < source.length; end += 1) {
      if (source[end] === "(") depth += 1;
      else if (source[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inner = source.slice(cursor + marker.length, end);
    // 최상위 쉼표 하나로 가른다(둘째 인자에 쉼표가 있는 표현식은 오늘 0건이지만 깊이를 세어 둔다).
    let nesting = 0;
    let split = -1;
    for (let index = 0; index < inner.length; index += 1) {
      const char = inner[index];
      if (char === "(" || char === "[" || char === "{") nesting += 1;
      else if (char === ")" || char === "]" || char === "}") nesting -= 1;
      else if (char === "," && nesting === 0 && split === -1) split = index;
    }
    // 선언 줄은 자리가 아니다(위 `isRequireSecretDeclaration`) — 그래도 커서는 그 괄호 끝까지 넘긴다.
    if (split !== -1 && !isRequireSecretDeclaration(source, cursor)) {
      calls.push([inner.slice(0, split).trim(), inner.slice(split + 1).trim()]);
    }
    cursor = source.indexOf(marker, end);
  }

  return calls;
}

/** 문자열 리터럴이면 따옴표를 벗기고, 아니면 **적힌 그대로**(식별자 이름)를 돌려준다. */
function literalOrExpression(expression: string): string {
  const quoted = /^(["'`])([\s\S]*)\1$/.exec(expression);
  return quoted ? quoted[2] : expression;
}

/** 같은 파일 안에서 `const NAME = "…"` 를 찾아 값을 푼다(못 풀면 빈 문자열 — 조각이 서지 않는다). */
function resolveInFileConstant(source: string, name: string): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return "";
  const declaration = new RegExp(`const\\s+${name}\\s*(?::[^=]+)?=\\s*(["'\`])([\\s\\S]*?)\\1`);
  const match = declaration.exec(source);
  return match ? match[2] : "";
}

export function collectSecretFallbacks(baseDir: string = repoRoot): SecretCandidate[] {
  const root = SECRET_ROOTS.find((entry) => entry.kind === "secret-fallback");
  const seen = new Set<string>();
  const candidates: SecretCandidate[] = [];

  for (const rootPath of root?.paths ?? []) {
    for (const file of filesUnder(rootPath, baseDir)) {
      const source = readRepoFile(file, baseDir);
      if (!source.includes("requireSecret(")) continue;
      for (const [envKeyExpression, fallbackExpression] of requireSecretArguments(source)) {
        // ⚠️ 함수 **정의**는 위 걷기가 **선언 줄의 위치**로 이미 걸러 냈다(리뷰 M-3) — 여기서
        // 인자 내용으로 다시 거르지 않는다. 콜론이 든 폴백(URL·삼항)은 호출부이고, 호출부다.
        const envKey = literalOrExpression(envKeyExpression);
        const value = literalOrExpression(fallbackExpression);
        const id = `${envKey}@${file}`;
        const key = `${id}::${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const parts: Record<string, string> = { value };
        const resolved = value === fallbackExpression ? resolveInFileConstant(source, fallbackExpression) : "";
        if (resolved) parts.resolved = resolved;
        candidates.push({ kind: "secret-fallback", id, where: file, parts });
      }
    }
  }

  return candidates;
}

/**
 * ⓒ DB URL 리터럴 — 조각(호스트·비밀번호)까지 뜯어 든다(바늘이 조각에 대고 견준다).
 *
 * ⚠️ 중괄호는 문자 집합 안에 **남겨 둔다**: 이 저장소의 DB URL 넷은 비밀번호나 호스트를
 * `${POSTGRES_PASSWORD}`·`${dbUser}`로 주입하고, 중괄호에서 끊으면 그 URL의 호스트 조각이
 * 사용자 이름으로 잘못 읽힌다(그리고 그 순간 스윕이 **거짓 빨강**으로 산다).
 */
const DB_URL_LITERAL = /postgres(?:ql)?:\/\/[^\s"'`,\\)\]<>]+/g;

export function parseDbUrlParts(url: string): { host: string; password: string } {
  const authority = /^postgres(?:ql)?:\/\/(?:([^@/]*)@)?([^/?#]*)/.exec(url);
  const userinfo = authority?.[1] ?? "";
  const hostport = authority?.[2] ?? "";
  const passwordSplit = userinfo.indexOf(":");
  const password = passwordSplit === -1 ? "" : userinfo.slice(passwordSplit + 1);
  const host = hostport.startsWith("[")
    ? hostport.slice(0, hostport.indexOf("]") + 1)
    : hostport.split(":")[0];
  return { host, password };
}

export function collectDbUrlLiterals(baseDir: string = repoRoot): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  for (const file of scannedFiles(baseDir)) {
    const source = readRepoFile(file, baseDir);
    if (!source.includes("postgres")) continue;
    source.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(DB_URL_LITERAL)) {
        const url = match[0];
        const { host, password } = parseDbUrlParts(url);
        candidates.push({
          kind: "db-url-literal",
          id: `${file}:${index + 1}`,
          where: file,
          parts: { value: url, host, password }
        });
      }
    });
  }
  return candidates;
}

/** ⓓ `.env.example`의 값 — 빈 값과 순수 숫자는 걷지 않는다(자리표시자·설정값이지 비밀값이 아니다). */
const ENV_ASSIGNMENT = /^([A-Z][A-Z0-9_]*)=(.*)$/;

/** `scheme://user:pass@…` 모양에서 **비밀번호 조각**만 떼어 낸다(없으면 `null` — 조각이 서지 않는다). */
const CREDENTIALED_URL = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^\s/@]+)@/;

export function urlCredentialPassword(value: string): string | null {
  const match = CREDENTIALED_URL.exec(value.trim());
  if (!match) return null;
  const split = match[1].indexOf(":");
  return split === -1 ? null : match[1].slice(split + 1);
}

export function collectEnvExampleValues(baseDir: string = repoRoot): SecretCandidate[] {
  const where = ".env.example";
  return readRepoFile(where, baseDir)
    .split("\n")
    .map((line) => ENV_ASSIGNMENT.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ key: match[1], value: match[2].trim() }))
    .filter(({ value }) => value.length > 0 && !/^\d+$/.test(value))
    .map(({ key, value }) => {
      const parts: Record<string, string> = { value };
      // ⚠️ 리뷰 M-5: 자격증명이 실린 URL 값(`REDIS_URL`·`S3_ENDPOINT` 같은 키)의 비밀번호 조각.
      // 없으면 조각 자체를 세우지 않는다 — 없는 조각을 가리키는 바늘은 그 후보를 지나간다.
      const urlPassword = urlCredentialPassword(value);
      if (urlPassword !== null) parts.urlPassword = urlPassword;
      return { kind: "env-example-value" as const, id: key, where, parts };
    });
}

/** 모집단 전수 — 이 파일의 모든 판정이 여기서 나온다. */
export function collectSecretCandidates(baseDir: string = repoRoot): SecretCandidate[] {
  return [
    ...collectSeedAffiliateCodes(baseDir),
    ...collectSecretFallbacks(baseDir),
    ...collectDbUrlLiterals(baseDir),
    ...collectEnvExampleValues(baseDir)
  ];
}

// ── 표식 · 로컬 호스트 ────────────────────────────────────────────────────────

/**
 * **가짜 값의 자기 고백 표식** — 결정 ②의 본문이다.
 *
 * ⚠️ 목록을 늘리는 것은 그물을 넓히는 것이 아니라 **좁히는 것**이다(표식이 늘수록 통과하는 값이
 * 는다). 그래서 낱말마다 *"오늘 저장소의 어느 값이 이 표식으로 산다"* 를 적는다 — 근거 없는 낱말은
 * 조용한 면제부다.
 */
export const FAKE_VALUE_MARKERS: readonly { readonly label: string; readonly pattern: RegExp; readonly seenIn: string }[] = [
  { label: "dev", pattern: /(^|[^a-z])dev([^a-z]|$)/i, seenIn: "dev-admin-token · wooriai-dev-… · DEV_*_FALLBACK · wooriai_dev_password" },
  { label: "test", pattern: /(^|[^a-z])tests?([^a-z]|$)/i, seenIn: "wooriai_test(테스트 DB 이름)" },
  { label: "local", pattern: /(^|[^a-z])local(host|-only)?([^a-z]|$)/i, seenIn: "change-me-local-only · wooriai-local · @localhost" },
  { label: "example", pattern: /(^|[^a-z])examples?([^a-z]|$)/i, seenIn: ".env.example · 시드 픽스처의 example.com" },
  { label: "sample", pattern: /(^|[^a-z])samples?([^a-z]|$)/i, seenIn: "오늘 0건 — 같은 관례의 흔한 이웃이라 미리 든다" },
  { label: "change-me", pattern: /change-?me/i, seenIn: "change-me-local-only(.env.example의 비밀 키 여섯)" },
  { label: "placeholder", pattern: /placeholder/i, seenIn: "require-secret.ts의 부트 점검 자리표시자" },
  { label: "dummy", pattern: /(^|[^a-z])dummy([^a-z]|$)/i, seenIn: "오늘 0건 — 같은 관례의 흔한 이웃이라 미리 든다" },
  { label: "fake", pattern: /(^|[^a-z])fake([^a-z]|$)/i, seenIn: "오늘 0건 — 같은 관례의 흔한 이웃이라 미리 든다" },
  { label: "unused", pattern: /(^|[^a-z])unused([^a-z]|$)/i, seenIn: "unused-fallback-for-boot-check" }
];

/** 이 값이 어떤 표식으로 자기가 가짜라고 말하는가(0건이면 이 스윕은 진짜로 본다). */
export function fakeValueMarkersIn(value: string): string[] {
  return FAKE_VALUE_MARKERS.filter((marker) => marker.pattern.test(value)).map((marker) => marker.label);
}

/** 표식 하나라도 달렸는가 — 바늘이 이 모양에 대고 견준다. */
export const FAKE_VALUE_MARKER = new RegExp(
  FAKE_VALUE_MARKERS.map((marker) => marker.pattern.source).join("|"),
  "i"
);

/** 자기 기계를 가리키는 호스트 — 운영 DB가 될 수 없다. */
export const LOOPBACK_DB_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"] as const;

/**
 * 루프백이 아닌데도 로컬로 보는 호스트 — **docker compose의 서비스 이름**뿐이다.
 *
 * ⚠️ 이 하나는 이유만으로 서지 않는다: 계약이 `infra/docker/*.yml`의 `services:` 키를 읽어 이 이름이
 * **실제로 그 파일이 정의하는 서비스**임을 확인한다(그러지 않으면 이 배열은 호스트 이름 하나를 조용히
 * 통과시키는 문이다).
 */
export const COMPOSE_SERVICE_DB_HOSTS = ["postgres"] as const;

export const LOCAL_DB_HOSTS: readonly string[] = [...LOOPBACK_DB_HOSTS, ...COMPOSE_SERVICE_DB_HOSTS];

/** compose 파일이 정의하는 서비스 이름 전수 — 위 배열의 이유를 소스로 확인한다. */
export function composeServiceNames(baseDir: string = repoRoot): string[] {
  const names = new Set<string>();
  for (const file of filesUnder("infra/docker", baseDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const lines = readRepoFile(file, baseDir).split("\n");
    let inServices = false;
    for (const line of lines) {
      if (/^services:\s*$/.test(line)) {
        inServices = true;
        continue;
      }
      if (inServices && /^\S/.test(line)) inServices = false;
      const service = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (inServices && service) names.add(service[1]);
    }
  }
  return [...names].sort();
}

// ── 셋 · 바늘 · 면제 ──────────────────────────────────────────────────────────

/**
 * 면제 **부류** — 이유·재개 조건·증명은 부류가 지고, 자리는 이름과 한 줄 메모로 대장에 오른다.
 *
 * ⚠️ 부류를 늘리는 것이 면제 목록이 문을 여는 방식이다. 그래서 계약이 *"부류마다 적어도 한 줄"* 을
 * 세고(유령 부류 금지), 각 줄이 **오늘 실제로 바늘에 걸리는 자리**인지도 함께 센다(유령 면제 금지).
 */
export type SecretExemptionClassId = "dev-fallback-gate" | "test-fixture";

export const SECRET_EXEMPTION_CLASSES: Readonly<
  Record<SecretExemptionClassId, { readonly reason: string; readonly resumeWhen: string; readonly provenBy: string }>
> = {
  "dev-fallback-gate": {
    reason:
      "`requireSecret`의 둘째 인자로만 도달하는 dev 폴백이다 — 값이 코드에 있지만 **운영에서는 반환되지 않는다**: " +
      "환경변수가 없고 NODE_ENV가 development/test가 아니면 그 함수는 폴백 대신 던진다(NODE_ENV 미설정도 운영 취급). " +
      "그래서 이 자리는 표식이 아니라 **게이트**로 가른다.",
    resumeWhen:
      "`requireSecret`이 게이트 밖에서도 폴백을 돌려주게 되는 날(또는 그 자리의 값이 가짜 표식을 잃는 날) — " +
      "둘 다 아래 증명이 먼저 빨개진다.",
    provenBy:
      "apps/api/src/common/config/require-secret.ts를 소스로 읽어 ① 폴백 반환이 `isDevOrTestEnv()` 갈래 **안에만** 있고 " +
      "② 그 갈래 밖에서는 던지며 ③ 게이트가 NODE_ENV를 development/test로만 참으로 만드는지를 확인하고, " +
      "덧붙여 ④ 면제에 오른 자리의 **오늘 값이 가짜 표식을 달고 있는지**를 다시 센다(실제 값으로 갈아 끼우면 그 자리에서 빨개진다) — " +
      "⚠️ 그 자리가 이름 상수로 넘기는 자리면 **풀린 값**(`parts.resolved`)도 함께 잰다(리뷰 M-4: 이름만 `DEV_`이고 값이 진짜인 자리를 " +
      "이름의 표식이 가려 주던 사각이다)."
  },
  "test-fixture": {
    reason:
      "테스트 픽스처다 — 그 파일이 검증하는 대상이 `requireSecret`의 갈래 자체라서 폴백 값을 **일부러** 넘긴다. " +
      "제품 코드가 읽지 않고, 값도 가짜 표식을 단다.",
    resumeWhen: "그 픽스처 값이 가짜 표식을 잃는 날 — 아래 증명이 먼저 빨개진다.",
    provenBy:
      "면제에 오른 자리의 오늘 값이 가짜 표식을 달고 있는지를 계약이 다시 세고, 그 자리가 `*.test.ts` 또는 " +
      "`apps/api/test/**`에 있는지를 경로로 확인한다."
  }
};

/** 오늘 걸리지만 조항 위반이 아닌 자리 — **이름 + 부류 + 한 줄 메모**를 지고 선다. */
export type SecretExemption = {
  readonly kind: SecretRootKind;
  /** 걸리는 자리의 id 그대로(모집단에 실재해야 한다 — 유령 면제 금지). */
  readonly name: string;
  readonly exemptionClass: SecretExemptionClassId;
  /** 이 자리가 무엇을 읽는가 — 빈 문자열일 수 없다. */
  readonly note: string;
};

export type SecretNeedle = {
  /** 실패 메시지가 사람에게 말해 주는 이름. */
  readonly label: string;
  /** 이 바늘이 도는 뿌리. */
  readonly kinds: readonly SecretRootKind[];
  /** 이 바늘이 도는 자리를 더 좁힌다(후보 **id**에 대고 견준다). */
  readonly idPattern?: RegExp;
  /** 후보의 어느 조각을 읽는가(기본 `value`). 없는 조각을 가리키면 그 후보는 지나간다. */
  readonly part?: string;
  readonly pattern: RegExp;
  /** **부재로 무는 바늘** — `pattern`에 걸리지 **않는** 조각이 위반이다. */
  readonly absent?: boolean;
  /** 왜 이 모양인가 — 빈 문자열일 수 없다. */
  readonly reason: string;
};

/**
 * 고엔트로피 모양 — 구분자 없이 대소문자와 숫자가 섞인 24자 이상의 덩어리.
 *
 * 표식 규칙이 못 보는 방향(표식을 단 이름 뒤에 진짜 키를 숨기는 것)의 가장 흔한 모양이다.
 * 오늘 저장소의 가짜 값은 전부 하이픈·점·쉼표로 끊어져 있거나 소문자뿐이라 이 바늘 밖에 있다.
 */
export const HIGH_ENTROPY_SHAPE = /^(?=[^\s]*[a-z])(?=[^\s]*[A-Z])(?=[^\s]*\d)[A-Za-z0-9+/_=]{24,}$/;

/** DB 비밀번호가 스스로 가짜임을 말하는 모양 — 비어 있거나, 환경에서 주입되거나, 표식을 단다. */
export const DB_PASSWORD_PROVEN_FAKE = new RegExp(`^$|^\\$\\{[^}]+\\}$|${FAKE_VALUE_MARKER.source}`, "i");

export type SecretItem = {
  readonly id: string;
  /** ⚠️ 조항 문서의 DNC-019 행에서 파싱한 문구와 **글자 단위로** 같아야 한다. */
  readonly clausePhrase: string;
  /** 이 항목이 어느 뿌리에 서는가 — 항목마다 다르다(그리고 다른 이유가 값으로 적힌다). */
  readonly roots: readonly SecretRootKind[];
  /** 왜 이 뿌리들인가 · 왜 나머지는 아닌가. */
  readonly rootsReason: string;
  readonly needles: readonly SecretNeedle[];
  readonly exemptions: readonly SecretExemption[];
  /**
   * ⚠️ **이 항목의 바늘이 실제로 무는 가짜 자리 하나.**
   *
   * 물지 못하는 스윕은 영원히 초록이고, 그 사실은 아무도 모른다. 계약이 이 자리를 모집단에 섞어
   * 넣어 **빨개지는 것을 실제로 보인다**. ⚠️ 값은 **명백한 가짜**여야 한다 — 스윕이 찾는 모양을
   * 보이겠다고 실제 비밀값 모양을 저장소에 남기지 않는다.
   */
  readonly tripSample: SecretCandidate;
};

/**
 * DNC-019가 이름으로 잠근 셋.
 *
 * ⚠️ `clausePhrase`는 문서에서 파싱한 셋과 대조된다 — 조항에 넷째가 붙으면 이 스윕이 **먼저**
 * 빨개진다(그때 새 항목의 뿌리·바늘을 정하는 것이 그 라운드의 일이다).
 */
export const SECRET_ITEMS: readonly SecretItem[] = [
  {
    id: "oauth-secret",
    clausePhrase: "실제 OAuth secret",
    roots: ["secret-fallback", "env-example-value"],
    rootsReason:
      "OAuth secret은 **환경에서 읽히는 값**이고, 이 저장소에서 그것을 읽는 자리는 `requireSecret` 하나다 — " +
      "그래서 그 둘째 인자와 `.env.example`의 같은 키 값이 이 항목의 두 뿌리다. " +
      "⚠️ 이 항목이 걷는 `secret-fallback` 자리는 **`AFFILIATE_*`를 뺀 전부**다(제휴 둘은 아래 항목이 걷는다). " +
      "조항이 이름으로 든 것은 OAuth secret이지만 이 뿌리가 내놓는 자리는 '비밀값을 읽는 유일한 함수'이고, " +
      "그 자리에 실제 값이 박히는 사고는 키 이름을 가리지 않는다 — **어느 항목도 걷지 않는 자리를 남기면 그 자리가 조용하다.** " +
      "시드·DB URL 뿌리는 이 항목에 두지 않는다(다른 두 항목의 축이고, 겹쳐 세면 어느 항목이 깨졌는지 말하지 못한다).",
    needles: [
      {
        label: "코드에 적힌 비밀값 폴백",
        kinds: ["secret-fallback"],
        idPattern: /^(?!AFFILIATE_)/,
        pattern: /^[\s\S]+$/,
        reason:
          "⚠️ 이 자리는 **표식으로 가르지 않는다** — 표식이 있어도 값이 코드에 있고 그 값으로 서버가 뜰 수 있다. " +
          "그래서 값이 서 있다는 사실 자체를 걸고, 게이트가 증명된 자리만 면제 대장으로 내린다(결정 ②)."
      },
      {
        label: "표식 없는 .env.example 비밀값",
        kinds: ["env-example-value"],
        idPattern: /^(?!AFFILIATE_).*(SECRET|TOKEN|PASSWORD|CLIENT_ID|ACCESS_KEY|API_KEY|SALT|CREDENTIAL)/,
        pattern: FAKE_VALUE_MARKER,
        absent: true,
        reason:
          "비밀을 담는 키 이름(SECRET·TOKEN·PASSWORD·CLIENT_ID·ACCESS_KEY·API_KEY·SALT·CREDENTIAL)의 값이 " +
          "자기 고백 표식을 잃으면 진짜가 붙여넣어진 것으로 본다. 빈 값·순수 숫자는 애초에 모집단 밖이다(뿌리의 단위)."
      },
      {
        label: "고엔트로피 비밀값 모양",
        kinds: ["secret-fallback", "env-example-value"],
        part: "value",
        pattern: HIGH_ENTROPY_SHAPE,
        reason:
          "표식 규칙이 못 보는 방향을 문다 — `DEV_…` 이름 뒤에 진짜 키를 숨겨도 **값의 모양**은 남는다. " +
          "오늘 이 두 뿌리의 값은 전부 하이픈·점·쉼표로 끊기거나 소문자뿐이라 이 바늘 밖이다."
      },
      {
        label: "이름 상수가 감춘 고엔트로피 값",
        kinds: ["secret-fallback"],
        part: "resolved",
        pattern: HIGH_ENTROPY_SHAPE,
        reason:
          "위 바늘은 **적힌 그대로**를 읽으므로 `DEV_X_FALLBACK` 같은 이름은 표식을 단 것으로 보인다. " +
          "같은 파일에서 그 상수가 풀리면 **풀린 값**도 함께 본다(오늘 셋 다 도메인 목록·하이픈 소금이라 이 바늘 밖이다)."
      }
    ],
    exemptions: [
      {
        kind: "secret-fallback",
        name: "WOORIAI_ADMIN_TOKEN@apps/api/src/admin/admin-token.guard.ts",
        exemptionClass: "dev-fallback-gate",
        note: "레거시 공유 시크릿 어드민 헤더 — 운영에서는 이 헤더 자체가 인정되지 않고 per-admin JWT를 쓴다."
      },
      {
        kind: "secret-fallback",
        name: "JWT_ACCESS_SECRET@apps/api/src/admin/admin-token-crypto.ts",
        exemptionClass: "dev-fallback-gate",
        note: "어드민 세션 토큰 암복호에 쓰는 액세스 시크릿."
      },
      {
        kind: "secret-fallback",
        name: "OAUTH_KAKAO_CLIENT_ID@apps/api/src/auth/kakao/kakao-oidc-client.http.ts",
        exemptionClass: "dev-fallback-gate",
        note: "카카오 OIDC 클라이언트 ID — 조항이 이름으로 든 OAuth 축의 자리다."
      },
      {
        kind: "secret-fallback",
        name: "JWT_ACCESS_SECRET@apps/api/src/auth/token.service.ts",
        exemptionClass: "dev-fallback-gate",
        note: "액세스 토큰 서명 시크릿."
      },
      {
        kind: "secret-fallback",
        name: "JWT_REFRESH_SECRET@apps/api/src/auth/token.service.ts",
        exemptionClass: "dev-fallback-gate",
        note: "리프레시 토큰 서명 시크릿."
      },
      {
        kind: "secret-fallback",
        name: "JWT_ACCESS_SECRET@apps/api/src/common/security/rate-limit.middleware.ts",
        exemptionClass: "dev-fallback-gate",
        note: "레이트리밋이 계정 단위 버킷을 가르려고 같은 시크릿으로 토큰을 검증한다."
      },
      {
        kind: "secret-fallback",
        name: "ANALYTICS_ANON_SALT@apps/api/src/analytics/analytics-anon.util.ts",
        exemptionClass: "dev-fallback-gate",
        note: "분석 익명 식별자 HMAC 소금 — 이름 상수(DEV_ANALYTICS_ANON_SALT_FALLBACK)로 넘긴다."
      },
      {
        kind: "secret-fallback",
        name: "JWT_ACCESS_SECRET@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "부트 점검(assertRequiredSecretsConfigured)이 도는 자리 — 폴백이 아니라 자리표시자 하나다."
      },
      {
        kind: "secret-fallback",
        name: "JWT_REFRESH_SECRET@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "같은 부트 점검의 두 번째 키."
      },
      {
        kind: "secret-fallback",
        name: "WOORIAI_ADMIN_TOKEN@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "같은 부트 점검의 세 번째 키."
      },
      {
        kind: "secret-fallback",
        name: "ANALYTICS_ANON_SALT@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "같은 부트 점검의 여섯 번째 키."
      },
      {
        kind: "secret-fallback",
        name: "envKey@apps/api/test/require-secret.test.ts",
        exemptionClass: "test-fixture",
        note: "`requireSecret`의 갈래 자체를 검증하는 픽스처 — 다섯 호출이 같은 이름·같은 값이라 한 자리로 센다."
      }
    ],
    tripSample: {
      kind: "secret-fallback",
      id: "OAUTH_KAKAO_CLIENT_SECRET@apps/api/src/auth/kakao/가짜-새-호출부.ts",
      where: "apps/api/src/auth/kakao/가짜-새-호출부.ts",
      parts: { value: "명백한가짜-표식없는-폴백" }
    }
  },
  {
    id: "affiliate-id",
    clausePhrase: "제휴 ID",
    roots: ["seed-affiliate-code", "secret-fallback", "env-example-value"],
    rootsReason:
      "제휴 ID는 **시드로 온다** — 파트너 계약이 성사되면 링크가 동작하게 만드는 한 줄로 `affiliatePartnerCode`가 채워진다. " +
      "그래서 첫 뿌리가 시드이고, 같은 축의 환경 비밀값(`AFFILIATE_*`)이 두 번째·세 번째 뿌리다. " +
      "⚠️ DB URL 뿌리는 두지 않는다(다른 항목의 축이다). ⚠️ `AFFILIATE_DISCLOSURE_TEXT`·`AFFILIATE_*_RETENTION_DAYS`는 " +
      "제휴 **ID**가 아니라 문구·보존 기간이라 `.env.example` 바늘이 키 이름으로 갈라 둔다 — 이름만 같은 이웃을 무는 바늘은 " +
      "첫날부터 면제 줄을 부른다(라운드 85 트랙 E의 판정 그대로).",
    needles: [
      {
        label: "시드의 제휴 파트너 코드 칸에 값이 들어왔다",
        kinds: ["seed-affiliate-code"],
        pattern: /^null$/,
        absent: true,
        reason:
          "오늘 이 칸은 전 행이 `null`이다. 실제 파트너 코드든 가짜든 **문자열이 들어오는 순간**이 조항의 경계이고, " +
          "여기서는 표식으로 가르지 않는다 — 시드는 DB에 그대로 실리므로 '가짜 파트너 코드'라는 것이 존재할 이유가 없다."
      },
      {
        label: "코드에 적힌 제휴 비밀값 폴백",
        kinds: ["secret-fallback"],
        idPattern: /^AFFILIATE_/,
        pattern: /^[\s\S]+$/,
        reason: "위 항목과 같은 이유로 값의 존재 자체를 걸고, 게이트가 증명된 자리만 면제 대장으로 내린다."
      },
      {
        label: "표식 없는 .env.example 제휴 비밀값",
        kinds: ["env-example-value"],
        idPattern: /^AFFILIATE_.*(SALT|SECRET|TOKEN|CODE|KEY|ID)$/,
        pattern: FAKE_VALUE_MARKER,
        absent: true,
        reason: "제휴 축의 키 가운데 **값이 비밀인 것**만 고른다(문구·보존 기간·허용 도메인 목록은 비밀값이 아니다)."
      },
      {
        label: "시드에 박힌 고엔트로피 값",
        kinds: ["seed-affiliate-code"],
        pattern: HIGH_ENTROPY_SHAPE,
        reason:
          "위 첫 바늘이 이미 `null` 아닌 전부를 물지만, 이 바늘은 **왜 빨간지**를 다르게 말한다 — " +
          "실패 메시지가 '칸이 채워졌다'와 '실제 키 모양이다'를 구별해 주면 사람이 이유를 다시 찾지 않는다."
      }
    ],
    exemptions: [
      {
        kind: "secret-fallback",
        name: "AFFILIATE_ALLOWED_DOMAINS@apps/api/src/items-commerce/affiliate-link-guard.util.ts",
        exemptionClass: "dev-fallback-gate",
        note: "제휴 redirect 허용 도메인 목록 — 이름 상수(DEV_ALLOWED_DOMAINS_FALLBACK)로 넘긴다."
      },
      {
        kind: "secret-fallback",
        name: "AFFILIATE_CLICK_IP_SALT@apps/api/src/items-commerce/affiliate-link-guard.util.ts",
        exemptionClass: "dev-fallback-gate",
        note: "클릭 IP 해시 소금 — 이름 상수(DEV_CLICK_IP_SALT_FALLBACK)로 넘긴다."
      },
      {
        kind: "secret-fallback",
        name: "AFFILIATE_ALLOWED_DOMAINS@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "부트 점검이 도는 자리 — 폴백이 아니라 자리표시자 하나다."
      },
      {
        kind: "secret-fallback",
        name: "AFFILIATE_CLICK_IP_SALT@apps/api/src/common/config/require-secret.ts",
        exemptionClass: "dev-fallback-gate",
        note: "같은 부트 점검의 다섯 번째 키."
      }
    ],
    tripSample: {
      kind: "seed-affiliate-code",
      id: "affiliatePartnerCode[가짜]",
      where: "apps/api/prisma/seed-data.ts",
      parts: { value: '"명백한가짜-파트너코드"' }
    }
  },
  {
    id: "prod-db-url",
    clausePhrase: "운영 DB URL",
    roots: ["db-url-literal", "env-example-value"],
    rootsReason:
      "운영 DB URL은 **URL 리터럴로만** 온다. 그래서 뿌리 하나는 코드·설정 전수의 `postgres(ql)://` 리터럴이고, " +
      "다른 하나는 `.env.example`의 `DATABASE_URL` 줄이다(⚠️ 리뷰 M-5 이후 그 파일에서 이 항목이 보는 것은 그 한 줄이 " +
      "아니라 **자격증명이 실린 URL 값 전부**다 — `REDIS_URL`·`S3_ENDPOINT`처럼 이름에 비밀이라는 말이 없는 키가 " +
      "같은 모양으로 오고, 그 줄들은 어느 항목의 바늘에도 걸리지 않고 있었다). " +
      "⚠️ 이 항목은 표식이 아니라 **URL의 조각**으로 가른다(호스트와 비밀번호) — DB URL은 값 전체가 아니라 " +
      "그 두 조각이 운영을 가리키는지가 판정이고, `wooriai_dev_password@localhost`처럼 표식이 이미 조각 안에 산다. " +
      "⚠️ 시드·비밀값 폴백 뿌리는 이 항목에 두지 않는다(다른 두 항목의 축이다)."
    ,
    needles: [
      {
        label: "로컬이 아닌 DB 호스트",
        kinds: ["db-url-literal"],
        part: "host",
        pattern: new RegExp(`^(?:${LOCAL_DB_HOSTS.map((host) => host.replace(/[.[\]:]/g, "\\$&")).join("|")})$`, "i"),
        absent: true,
        reason:
          "운영 DB URL과 로컬 DB URL을 가르는 것은 비밀번호가 아니라 **호스트**다. 오늘 열 자리 전부 루프백이거나 " +
          "compose 서비스 이름이고, 그 하나(`postgres`)는 계약이 compose 파일의 `services:` 키로 확인한다."
      },
      {
        label: "표식 없는 DB 비밀번호",
        kinds: ["db-url-literal"],
        part: "password",
        pattern: DB_PASSWORD_PROVEN_FAKE,
        absent: true,
        reason:
          "호스트가 로컬이어도 비밀번호가 진짜면 그 값은 재사용된다(같은 비밀번호로 운영이 뜨는 일이 흔하다). " +
          "비어 있거나 `${…}`로 주입되거나 표식을 단 비밀번호만 가짜로 본다 — 운영 compose가 정확히 `${POSTGRES_PASSWORD}`다."
      },
      {
        label: "표식 없는 .env.example DB URL",
        kinds: ["env-example-value"],
        idPattern: /^DATABASE_URL$/,
        pattern: FAKE_VALUE_MARKER,
        absent: true,
        reason:
          "자리표시자 파일의 `DATABASE_URL`은 실제 값이 가장 자주 붙여넣어지는 한 줄이다. " +
          "값 전체에 표식이 하나도 없으면(호스트·비밀번호·DB 이름 어디에도) 그 줄은 운영을 가리키고 있다."
      },
      {
        label: "표식 없는 자격증명 URL 값",
        kinds: ["env-example-value"],
        part: "urlPassword",
        pattern: DB_PASSWORD_PROVEN_FAKE,
        absent: true,
        reason:
          "⚠️ **라운드 86 리뷰 M-5가 연 사각이다.** 위 바늘은 키 이름이 `DATABASE_URL`인 한 줄만 보고, " +
          "옆 바늘들은 키 이름에 SECRET·TOKEN·PASSWORD…가 든 줄만 본다 — 그래서 `REDIS_URL`·`S3_ENDPOINT`처럼 " +
          "**이름에 비밀이라는 말이 없는 URL 키**에 `scheme://user:pass@host`가 붙여넣어지면 이 스윕은 " +
          "그것을 보고도 지나갔다(운영 Redis·오브젝트 스토리지 자격증명이 정확히 그 모양으로 온다). " +
          "그래서 키 이름이 아니라 **값의 모양**으로 문다: 자격증명이 실린 URL이면 비밀번호 조각을 떼어 내 " +
          "DB URL과 **같은 잣대**(비어 있거나 `${…}` 주입이거나 표식을 달았는가)로 잰다. " +
          "오늘 이 조각이 서는 줄은 `DATABASE_URL` 하나이고(`wooriai_dev_password` — 표식 있음), 나머지 URL 값에는 " +
          "userinfo 자체가 없어 조각이 서지 않는다. ⚠️ 비밀번호 없이 사용자 이름만 있는 URL은 이 바늘 밖이다(값의 한계)."
      }
    ],
    exemptions: [],
    tripSample: {
      kind: "db-url-literal",
      id: "infra/docker/가짜-운영.yml:1",
      where: "infra/docker/가짜-운영.yml",
      parts: {
        value: "postgres(가짜 운영 URL — 호스트와 비밀번호 조각으로만 판정한다)",
        host: "가짜운영호스트.invalid",
        password: "가짜비밀번호"
      }
    }
  }
];

// ── 판정 ──────────────────────────────────────────────────────────────────────

export type SecretViolation = {
  readonly itemId: string;
  readonly needle: string;
  readonly kind: SecretRootKind;
  readonly id: string;
  readonly where: string;
  readonly part: string;
};

/**
 * 실패 메시지 한 줄 — 어느 항목의 어느 바늘이 **어디서** 걸렸는가.
 *
 * ⚠️ **값을 싣지 않는다.** 이 스윕이 빨개지는 상황은 저장소에 진짜 비밀값이 들어온 상황이고,
 * 그때 실패 메시지가 그 값을 CI 로그에 다시 찍으면 스윕이 유출의 두 번째 경로가 된다.
 */
export function describeSecretViolation(violation: SecretViolation): string {
  return `${violation.itemId} · ${violation.needle} · ${violation.kind} \`${violation.id}\` (${violation.where} · ${violation.part} 조각)`;
}

/** 한 항목의 바늘에 걸리는 자리 전수 — **면제를 빼지 않는다**(유령 면제 검사가 이것을 읽는다). */
export function findSecretHits(item: SecretItem, candidates: readonly SecretCandidate[]): SecretViolation[] {
  const hits: SecretViolation[] = [];
  for (const candidate of candidates) {
    if (!item.roots.includes(candidate.kind)) continue;
    for (const needle of item.needles) {
      if (!needle.kinds.includes(candidate.kind)) continue;
      if (needle.idPattern && !needle.idPattern.test(candidate.id)) continue;
      const part = needle.part ?? "value";
      const piece = candidate.parts[part];
      if (piece === undefined) continue;
      const matched = needle.pattern.test(piece);
      if (matched === Boolean(needle.absent)) continue;
      hits.push({
        itemId: item.id,
        needle: needle.label,
        kind: candidate.kind,
        id: candidate.id,
        where: candidate.where,
        part
      });
    }
  }
  return hits;
}

function isExempt(item: SecretItem, hit: SecretViolation): boolean {
  return item.exemptions.some((exemption) => exemption.kind === hit.kind && exemption.name === hit.id);
}

/** 한 항목의 위반 전수 — 면제 대장에 선 자리를 뺀 나머지. 여기 한 줄이라도 남으면 경계가 넘어갔다. */
export function findSecretViolations(
  item: SecretItem,
  candidates: readonly SecretCandidate[]
): SecretViolation[] {
  return findSecretHits(item, candidates).filter((hit) => !isExempt(item, hit));
}

/** 실패했을 때 사람에게 무엇을 하라고 말하는가(항목마다 다르다 — 한 덩어리 메시지를 쓰지 않는다). */
export function secretFailureHint(item: SecretItem): string {
  return (
    `DNC-019가 잠근 "${item.clausePhrase}"(${item.id})의 자리에 가짜 표식이 없는 값이 섰어요. ` +
    "이 조항은 보안 보호를 위한 절대 규칙이에요 — 실제 값이라면 저장소에서 지우고 **회전**한 뒤 환경변수로 옮기세요" +
    "(이미 커밋된 값은 기록에 남아요). 실제 값이 아니라면 가짜임을 값으로 말하게 하거나" +
    "(dev-·test-·local-·change-me- 같은 표식), 새 갈래라면 이 항목의 뿌리·바늘·면제" +
    "(packages/test-utils/src/dnc-secret-scan.ts)를 이유·재개 조건·증명과 함께 고치세요."
  );
}

// ── 문서에서 셋을 읽는다 ──────────────────────────────────────────────────────

/** DNC-019 행의 "Do Not Change" 칸에서 잠근 셋을 파싱한다(수도 이름도 손으로 적지 않는다). */
export function parseSecretClausePhrases(contractSource: string): string[] {
  const row = contractSource.split("\n").find((line) => /^\|\s*DNC-019\s*\|/.test(line));
  if (!row) return [];
  const cells = row.split("|").map((cell) => cell.trim());
  const locked = cells[3] ?? "";
  return (locked.split(/을\s*코드/)[0] ?? "")
    .split(",")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

// ── 면제의 증명(계약 ⓒ) ──────────────────────────────────────────────────────

/**
 * dev 폴백 면제의 이유 — *"`isDevOrTestEnv()` 뒤에서만 반환된다"* — 를 **소스로** 확인한다.
 *
 * ⚠️ 이유를 적기만 하고 확인하지 않으면 그것이 면제부다(라운드 84 트랙 D의 `provenBy` 관례).
 * 이 함수는 `require-secret.ts`를 읽어 셋을 센다. 셋 중 하나라도 거짓이 되면 그날 dev 폴백은
 * 면제의 근거를 잃고, 계약이 그 자리에서 빨개진다.
 */
/** `export function NAME(` 로 시작하는 함수 본문의 줄 전수 — 중괄호 깊이로 끝을 찾는다. */
function functionBodyLines(lines: readonly string[], name: string): string[] {
  const start = lines.findIndex((line) => line.startsWith(`export function ${name}(`));
  if (start === -1) return [];
  const body: string[] = [];
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    body.push(line);
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (index > start && depth <= 0) break;
  }
  return body;
}

export function devFallbackGateProof(baseDir: string = repoRoot): {
  readonly returnsFallbackOnlyBehindGate: boolean;
  readonly throwsOutsideGate: boolean;
  readonly gateChecksNodeEnv: boolean;
  readonly fallbackReturnLines: number;
} {
  const lines = readRepoFile(REQUIRE_SECRET_PATH, baseDir)
    .split("\n")
    .map((line) => line.trim());

  const body = functionBodyLines(lines, "requireSecret");

  // 게이트 갈래의 안쪽만 떼어 낸다(같은 중괄호 깊이 세기 — 여는 줄 다음부터 닫히는 줄 전까지).
  // ⚠️ 줄의 **번호**로 잡는다(내용이 아니라): 같은 문장이 게이트 안팎에 함께 있을 수 있고,
  // 그때 문자열 비교로는 "밖에도 있다"를 말할 수 없다(리뷰 M-6).
  const gateIndex = body.findIndex((line) => line === "if (isDevOrTestEnv()) {");
  const insideGateIndexes = new Set<number>();
  if (gateIndex !== -1) {
    let depth = 0;
    for (let index = gateIndex; index < body.length; index += 1) {
      const line = body[index];
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      if (index > gateIndex && depth <= 0) break;
      if (index > gateIndex) insideGateIndexes.add(index);
    }
  }

  const fallbackReturns = body.filter((line) => line === "return devFallback;");
  const fallbackInsideGate = body.filter(
    (line, index) => insideGateIndexes.has(index) && line === "return devFallback;"
  );

  return {
    returnsFallbackOnlyBehindGate:
      fallbackReturns.length > 0 && fallbackReturns.length === fallbackInsideGate.length,
    /**
     * ⚠️ **리뷰 M-6**: 종전에는 본문 어디든 `throw new Error(`가 있으면 참이었다 — 게이트 **안**의
     * throw(예: dev 폴백을 검증하다 던지는 줄)까지 이 조건을 만족시켜, *"게이트 밖에서는 던진다"*
     * 는 면제의 근거가 사실 확인 없이 초록으로 남을 수 있었다. 이제 **게이트 밖 줄에서만** 센다.
     */
    throwsOutsideGate: body.some(
      (line, index) => !insideGateIndexes.has(index) && line.startsWith("throw new Error(")
    ),
    gateChecksNodeEnv: functionBodyLines(lines, "isDevOrTestEnv").some((line) =>
      line.includes('nodeEnv === "development" || nodeEnv === "test"')
    ),
    fallbackReturnLines: fallbackReturns.length
  };
}
