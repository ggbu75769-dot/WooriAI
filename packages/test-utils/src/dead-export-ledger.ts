// 라운드 87 트랙 E (GAP-087 #5) — **호출부 0건인 export**의 사문 대장.
//
// 라운드 86 트랙 A가 `itemListBadgeLabel` 하나를 걷어 내면서 그 옆에 같은 모양이 더 있는지 묻지
// 않았다. 정찰이 세어 보니 **열일곱**이고, **열일곱 다 테스트 참조가 있다** — 즉 전부 *"계약만
// 초록인데 아무도 부르지 않는다"* 이다. 그리고 **이유가 소스에 적힌 것은 둘뿐**이다.
//
// ⚠️⚠️ **오늘 대장에 서는 것은 열여섯이다** — 정찰의 열일곱 중 `hasAnyAuditLogFilter` 하나를
// **같은 라운드의 트랙 A가 되살렸다**(`apps/admin/src/lib/audit-log-rows.ts`가 감사 로그 빈 표의
// 두 문장을 가르며 그 술어를 부른다). 이 대장은 **정찰의 수가 아니라 최종 실측**을 싣는다 —
// 정찰의 열일곱을 그대로 못 박았으면 이 계약은 태어나자마자 유령 행 하나를 들고 빨간 채로 살았고,
// 그때 사람이 하는 일은 수를 고치는 것뿐이라 계약이 아무것도 지키지 못한다. ⚠️ 그리고 이 한 건이
// 이 대장의 존재 이유를 그대로 보여 준다: **호출부 0건인 판정은 결함이 아니라 아직 배선되지 않은
// 답이고, 그 목록이 값으로 서 있으면 옆 트랙이 그중 하나를 집어 든다.**
//
// ⚠️ **이 라운드가 하는 일은 지우는 것이 아니라 세는 자리를 세우는 것이다.** 제품 소스는 0건
// 고쳤다(열여섯 중 하나도 지우거나 주석을 달지 않았다 — 지우는 판단은 이 자리가 선 다음이고,
// 그 판단은 항목마다 다르다: `isNamedImportFailure`처럼 소스가 *"지우지 않는다"* 고 못 박은 것도,
// `updateContentRevisionDraft`처럼 계약의 문장이 거짓에 가까워진 것도 같은 목록에 있다).
//
// ## ⚠️ 결정 ① — 무엇을 **호출부**로 볼 것인가 (`CALLSITE_DEFINITION`)
//
// 호출부는 **제품 소스**다: `apps/mobile/app/**`·`apps/mobile/src/**`·`apps/admin/app/**`·
// `apps/admin/src/**`의 비테스트 `.ts`/`.tsx` 전수이고, **선언한 자기 파일까지 포함한다.**
// 그 전수 어디에도 이름이 (선언 줄 자신을 빼고) 한 번도 나오지 않으면 호출부 0건이다.
//
// ⚠️ 자기 파일을 호출부에 **넣는** 이유: 같은 파일 안에서만 쓰이는 함수는 사문이 아니라 그냥
// 잘못 export된 함수다(판정이 다르고, 고치는 손도 다르다). ⚠️ 테스트를 호출부에서 **빼는**
// 이유: 이 대장이 세는 것이 정확히 *"테스트만 부른다"* 이기 때문이다 — 테스트를 호출부로 세면
// 이 대장의 모집단은 첫날부터 0건이 된다.
//
// ## ⚠️ 결정 ② — 무엇을 **모집단**으로 볼 것인가 (`POPULATION_DEFINITION`)
//
// 모집단은 **`export function` 선언**이다: 모바일 `apps/mobile/src/**/*.ts`(테스트 · `local-backend` ·
// `local-fixtures` 제외)와 어드민 `apps/admin/src/lib/**/*.ts`(테스트 제외).
//
// ⚠️ **`export const` 축은 오늘 모집단에 넣지 않는다.** 넣으면 **계약 전용 데이터 모듈 열하나가
// 첫날부터 면제부**가 되기 때문이다 — 그 모듈들은 *"테스트만 읽는 것이 설계"* 라고 자기 머리말에
// 적어 두었고(`offline-aware-screens.ts:13`), 면제 줄 열하나로 시작하는 대장은 세는 자리가 아니라
// 문이다. ⚠️ 다만 **그 사실을 산문이 아니라 값으로 적는다**(`LEDGER_BLIND_SPOTS`) — 적어 두지
// 않으면 다음 라운드가 같은 축을 다시 세고, 세어 놓고 어디에도 적지 못한다(AA-4의 규율).
//
// ⚠️ **먼저 모집단, 그다음 바늘.** 뿌리는 계약이 **실재와 산출을 함께 확인한다** — 손으로 배열한
// 목록은 뿌리가 아니고, 빈 모집단 위에서는 *"사문이 열여섯을 넘지 않는다"* 가 언제나 참이다.
//
// ## ⚠️ 열여섯이 갈리는 셋 (`DeadExportReasonKind`)
//
//  ⓐ **이름이 자기를 고백하는 것**(`reset*` · `*ForTests` · `__*`) — 이름이 이미 이유다.
//  ⓑ **이유가 소스에 적힌 것** — `⚠ **테스트 전용 export**(라운드 71 리뷰 S-8) … **지우지 않는다**`
//     관례. ⚠️ **이 대장은 그 이유가 실제로 그 파일에 있는지 소스로 확인한다**(`sourceReasonProof`).
//  ⓒ **이유가 대장에만 있는 것** — 소스에 아무 말이 없어서 **여기에 적는다**. ⚠️ 그 이유는 빈
//     문자열일 수 없고, *"왜 화면이 부르지 않는가"* 를 말해야 한다(*"안 쓴다"* 는 이유가 아니다).
//
// ⚠️ **실측이 정찰(round87-scout #5 ⓐ)과 갈린 자리 셋** — 값으로 남긴다:
//  · **명단이 열일곱이 아니라 열여섯이다**(위 머리말 — 트랙 A가 `hasAnyAuditLogFilter`를 되살렸다).
//    ⚠️ 나머지 열여섯의 **이름과 자리는 정찰과 정확히 같다** — 트랙 E가 정찰의 목록을 옮겨 적은 것이
//    아니라 같은 조건으로 **다시 세어서** 같은 답이 나왔다(모집단·호출부를 코드로 걷는다).
//  · **이름이 고백하는 것은 여섯이 아니라 다섯이다.** 정찰은 여섯으로 적었지만 `reset*`·`*ForTests`
//    모양은 다섯뿐이고(`__resetAnalyticsClientForTests`·`resetImportBulkRuns`·`resetLocalDevicesForTests`·
//    `resetPushRegistrationForTests`·`resetAppQueryClientRegistryForTests`), 그래서 갈래는 **5 / 2 / 9**다
//    (정찰의 셈은 6 / 2 / 9였고 그 아홉에는 되살아난 하나가 들어 있었다).
//  · **어드민 모집단의 수가 정찰과 다르다.** 정찰은 `apps/admin/src/lib/**`를 확장자 구별 없이 세어
//    146을 얻었는데 그중 둘이 `admin-token-context.tsx`의 컴포넌트 export다(둘 다 화면이 부른다).
//    이 대장은 `.tsx`를 모집단 밖에 두므로 그날의 같은 자리가 144였고, **오늘 다시 재면 147**이다
//    (트랙 A가 `audit-log-rows.ts`를 세우며 셋을 더했다). ⚠️ **사문 수는 그 셋과 무관하게 움직였다** —
//    새 파일이 사문을 만든 것이 아니라 **있던 사문 하나를 불렀다.**
//
// ## ⚠️ 이 그물이 무는 것의 한계 — **이름의 텍스트**이지 **해석된 참조**가 아니다
//
//  · 이름으로 훑으므로 **흔한 이름을 가르지 못한다**(AA-4가 이름 붙인 그 사각). 속성 접근
//    (`api.listItems`)이나 객체 키(`listItems:`)도 한 번의 텍스트 일치이고, 이 그물은 그것을 호출과
//    구별하지 못한다 — 그 방향의 오차는 **사문을 놓치는 쪽**이다(거짓 초록이지 거짓 빨강이 아니다).
//  · 동적 접근(`registry["legalDocumentUrl"]`)·배럴 재export도 텍스트 한 번으로 보인다.
//  · ⚠️ **주석·문자열 리터럴도 참조로 센다**(라운드 87 리뷰 L-1) — 소스를 마스킹하지 않으므로 주석이
//    이름을 인용하기만 해도 호출부 1건이다. 방향은 같은 **거짓 초록**이고, 오늘의 실피해는 0건이다
//    (주석 마스킹 재실측 16 → 16 · 사각 `comment-and-string-references`가 그 값을 진다).
//  · `.tsx`의 컴포넌트 export와 `apps/api/**`·`packages/**`는 오늘 모집단 밖이다.
//  이 한계를 값으로 적어 두는 이유는 다음 사람이 이 파일을 *"사문이 열여섯뿐이라는 증명"* 으로
//  읽지 않게 하기 위해서다 — 이것은 **열여덟 번째가 생길 때 소리가 나는 자리**다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/** 이 실측이 선 날 — 아래 수들이 언제의 값인지 말한다. */
export const MEASURED_ON = "2026-08-31";

/**
 * 이 대장 자신의 두 파일 — 계약 ⓕ가 읽는다.
 *
 * ⚠️ **대장은 자기를 모집단에 넣지 않는다.** 이 파일들은 사문 이름 열여섯을 **값으로** 싣고 있어서,
 * 모집단에 들어오는 순간 자기 자신이 자기 항목의 호출부가 된다(그리고 열여섯이 전부 조용히
 * 사라진다). 오늘은 경로상 이미 모집단 밖이지만(`packages/**`), 그 사실에 기대지 않고 값으로
 * 못 박는다 — 뿌리가 넓어지는 날 이 배제가 먼저 서 있어야 한다.
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/dead-export-ledger.ts",
  "packages/test-utils/src/dead-export-ledger.test.ts"
] as const;

/** ⚠️ 결정 ① — 값으로 적힌 호출부의 정의(계약 ⓐ가 이 문장이 비어 있지 않은지 센다). */
export const CALLSITE_DEFINITION =
  "호출부는 **제품 소스**다 — apps/mobile/app/** · apps/mobile/src/** · apps/admin/app/** · apps/admin/src/** 의 " +
  "비테스트 .ts/.tsx 전수이고, **선언한 자기 파일까지 포함한다**. 그 전수 어디에도 이름이 (선언 줄 자신을 빼고) " +
  "한 번도 나오지 않으면 호출부 0건이다. 테스트 파일은 호출부가 아니다 — 이 대장이 세는 것이 정확히 " +
  "'테스트만 부른다'이기 때문이고, 테스트를 호출부로 세면 이 대장의 모집단은 첫날부터 0건이 된다.";

/** ⚠️ 결정 ② — 값으로 적힌 모집단의 정의. */
export const POPULATION_DEFINITION =
  "모집단은 **`export function` 선언**이다 — 모바일 apps/mobile/src/**/*.ts(테스트·local-backend·local-fixtures 제외)와 " +
  "어드민 apps/admin/src/lib/**/*.ts(테스트 제외). `export const` 축은 넣지 않는다: 넣으면 계약 전용 데이터 모듈의 " +
  "상수 열하나가 첫날부터 면제부가 되고, 면제 열하나로 시작하는 대장은 세는 자리가 아니라 문이다. " +
  ".tsx의 컴포넌트 export와 apps/api/** · packages/** 도 오늘 모집단 밖이고, 그 셋 다 사각으로 적힌다.";

// ── 걷기 ──────────────────────────────────────────────────────────────────────

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
function walkFiles(absoluteDir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const absolute = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...walkFiles(absolute, extensions));
      continue;
    }
    if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(absolute);
  }
  return found;
}

function toRepoPath(absolutePath: string, baseDir: string): string {
  return relative(baseDir, absolutePath).split(sep).join("/");
}

/** 저장소 상대 경로를 읽는다. */
export function readRepoFile(relativePath: string, baseDir: string = repoRoot): string {
  return readFileSync(join(baseDir, relativePath), "utf8");
}

/** 테스트 파일인가 — 호출부에서도 모집단에서도 빠지는 유일한 갈래다. */
export function isTestFile(relativePath: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(relativePath) || relativePath.includes("/__tests__/");
}

/**
 * 한 뿌리 경로 아래의 파일 전수(테스트 제외 · 제외 조각 제외 · **대장 자신 제외**).
 *
 * 경로가 없으면 빈 배열이 아니라 **예외**다 — 없는 뿌리 위에서 조용히 초록인 것이 이 부류
 * 스윕의 가장 흔한 죽는 방식이다(계약 ⓑ가 실재를 따로 또 확인한다).
 */
export function filesUnder(
  relativePath: string,
  extensions: readonly string[],
  excludeSegments: readonly string[] = [],
  baseDir: string = repoRoot
): string[] {
  const absolute = join(baseDir, relativePath);
  const stats = statSync(absolute);
  const paths = stats.isDirectory() ? walkFiles(absolute, extensions) : [absolute];
  return paths
    .map((file) => toRepoPath(file, baseDir))
    .filter((file) => !isTestFile(file))
    .filter((file) => !excludeSegments.some((segment) => file.includes(segment)))
    .filter((file) => !(LEDGER_SELF_FILES as readonly string[]).includes(file))
    .sort();
}

// ── 모집단 뿌리 ───────────────────────────────────────────────────────────────

export type PopulationRootId = "mobile-src" | "admin-src-lib";

export type PopulationRoot = {
  readonly id: PopulationRootId;
  readonly path: string;
  readonly extensions: readonly string[];
  readonly excludeSegments: readonly string[];
  /** 이 뿌리가 내놓아야 하는 파일 수의 **하한**(유령 방지 — 오늘 실측의 아래에 둔다). */
  readonly minFiles: number;
  /** 이 뿌리가 내놓아야 하는 `export function` 수의 **하한**. */
  readonly minExports: number;
  /** 오늘 실측(문서용 — 판정은 하한이 한다). */
  readonly measuredFiles: number;
  readonly measuredExports: number;
  /** 왜 이 뿌리인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
};

/**
 * 순수 판정 모듈이 사는 두 자리.
 *
 * ⚠️ 하한을 실측보다 **낮게** 두는 이유: 이 대장은 A~D 트랙과 나란히 사는 파일이고, 화면 하나가
 * 모듈 하나를 흡수하면 파일 수가 준다. 하한이 무는 것은 *"뿌리가 통째로 비었다"* 이지 *"한 파일이
 * 줄었다"* 가 아니다 — 후자를 물면 이 계약은 남의 라운드에서 빨개지는 소음이 된다.
 */
export const POPULATION_ROOTS: readonly PopulationRoot[] = [
  {
    id: "mobile-src",
    path: "apps/mobile/src",
    extensions: [".ts"],
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 180,
    minExports: 700,
    measuredFiles: 221,
    measuredExports: 869,
    reason:
      "모바일의 순수 판정(문구·파생값·술어)이 사는 자리다 — 화면(`app/**`)은 이 모듈들을 부르기만 하고, " +
      "그래서 '아무도 부르지 않는 판정'이 생길 수 있는 유일한 층이 여기다. " +
      "⚠️ `local-backend`·`local-fixtures`를 빼는 이유는 그 둘이 **개발 전용 대역**이라 화면 호출부가 " +
      "없는 것이 정상이기 때문이다(빼지 않으면 첫날부터 면제 줄이 붙는다)."
  },
  {
    id: "admin-src-lib",
    path: "apps/admin/src/lib",
    extensions: [".ts"],
    excludeSegments: [],
    minFiles: 15,
    minExports: 110,
    measuredFiles: 22,
    measuredExports: 147,
    reason:
      "어드민에서 같은 층에 해당하는 자리다(`src/lib` = API 클라이언트와 뷰 파생). " +
      "⚠️ `src/components`·`app/**`은 모집단이 아니다 — 컴포넌트 export는 JSX로 쓰이고 이 그물의 " +
      "이름 훑기가 그 사용을 다르게 읽는다(그 사실은 사각 `tsx-components`로 적는다). " +
      "⚠️ 같은 이유로 `src/lib`의 단 하나뿐인 `.tsx`(admin-token-context.tsx)도 밖이다 — " +
      "정찰이 146으로 센 것과 이 대장이 그날 144로 센 것의 차이가 정확히 그 둘이고, 둘 다 화면이 부른다."
  }
];

// ── 호출부 뿌리 ───────────────────────────────────────────────────────────────

export type CallsiteRoot = {
  readonly path: string;
  readonly excludeSegments: readonly string[];
  readonly minFiles: number;
  readonly measuredFiles: number;
  readonly reason: string;
};

/**
 * 호출부 전수가 사는 네 자리.
 *
 * ⚠️ 모집단 뿌리 둘이 여기 **다시** 들어 있다 — 결정 ①이 *"자기 파일까지 포함"* 이기 때문이다.
 * 같은 파일 안에서만 쓰이는 함수는 사문이 아니라 잘못 export된 함수이고, 그 둘은 고치는 손이 다르다.
 */
export const CALLSITE_ROOTS: readonly CallsiteRoot[] = [
  {
    path: "apps/mobile/app",
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 25,
    measuredFiles: 38,
    reason: "모바일 화면 전수(expo-router). 판정 모듈을 부르는 쪽의 절반이다."
  },
  {
    path: "apps/mobile/src",
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 180,
    measuredFiles: 241,
    reason:
      "모듈이 모듈을 부르는 자리 + 자기 파일. ⚠️ 모집단 뿌리와 같은 경로를 호출부로도 두는 것이 " +
      "결정 ①의 '자기 파일까지 포함'이다."
  },
  {
    path: "apps/admin/app",
    excludeSegments: [],
    minFiles: 10,
    measuredFiles: 15,
    reason: "어드민 화면 전수(next app router)."
  },
  {
    path: "apps/admin/src",
    excludeSegments: [],
    minFiles: 15,
    measuredFiles: 25,
    reason: "어드민 컴포넌트·lib 전수 + 자기 파일."
  }
];

/** 호출부 파일 전수 — 이 대장의 모든 판정이 이 집합 위에서 난다. */
export function collectCallsiteFiles(baseDir: string = repoRoot): string[] {
  const files = new Set<string>();
  for (const root of CALLSITE_ROOTS) {
    for (const file of filesUnder(root.path, [".ts", ".tsx"], root.excludeSegments, baseDir)) {
      files.add(file);
    }
  }
  return [...files].sort();
}

// ── 모집단 걷기 ───────────────────────────────────────────────────────────────

export type ExportedFunction = {
  /** 사문 대장의 열쇠 — `파일:이름`. 줄 번호는 열쇠에 넣지 않는다(줄은 라운드마다 밀린다). */
  readonly id: string;
  readonly root: PopulationRootId;
  readonly file: string;
  readonly line: number;
  readonly name: string;
};

/**
 * `export function NAME(` / `export async function NAME<` — **줄 머리에서만** 읽는다.
 *
 * 들여쓰인 `export`는 이 저장소에 0건이고(중첩 export는 문법이 아니다), 줄 머리로 못 박으면
 * 문자열·주석 안의 같은 텍스트가 선언으로 읽히지 않는다.
 */
const EXPORT_FUNCTION_DECLARATION = /^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[(<]/;

/** `export const NAME =` / `export const NAME:` — 사각 `export-const-axis`가 세는 축. */
const EXPORT_CONST_DECLARATION = /^export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/;

function collectDeclarations(
  root: PopulationRoot,
  pattern: RegExp,
  baseDir: string
): ExportedFunction[] {
  const found: ExportedFunction[] = [];
  for (const file of filesUnder(root.path, root.extensions, root.excludeSegments, baseDir)) {
    readRepoFile(file, baseDir)
      .split("\n")
      .forEach((line, index) => {
        const match = pattern.exec(line);
        if (!match) return;
        found.push({ id: `${file}:${match[1]}`, root: root.id, file, line: index + 1, name: match[1] });
      });
  }
  return found;
}

/** 모집단 전수 — `export function` 선언(결정 ②). */
export function collectExportedFunctions(baseDir: string = repoRoot): ExportedFunction[] {
  return POPULATION_ROOTS.flatMap((root) => collectDeclarations(root, EXPORT_FUNCTION_DECLARATION, baseDir));
}

/** 같은 뿌리의 `export const` 축 — **모집단이 아니다.** 사각을 값으로 재기 위해서만 걷는다. */
export function collectExportedConstants(baseDir: string = repoRoot): ExportedFunction[] {
  return POPULATION_ROOTS.flatMap((root) => collectDeclarations(root, EXPORT_CONST_DECLARATION, baseDir));
}

// ── 호출부 세기 ───────────────────────────────────────────────────────────────

/** 낱말 경계로 끊은 이름(부분 일치가 호출로 읽히지 않게 한다). */
function identifierPattern(name: string): RegExp {
  return new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`, "g");
}

export type CallsiteHit = { readonly file: string; readonly line: number };

/**
 * 제품 소스에서 이 이름이 나오는 자리 전수 — **선언 줄 자신은 빼고**.
 *
 * ⚠️ 선언 줄만 빼는 이유: 선언은 참조가 아니지만 같은 파일의 다른 줄은 참조다(결정 ①).
 */
export function findProductReferences(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>
): CallsiteHit[] {
  const hits: CallsiteHit[] = [];
  for (const [file, source] of sources) {
    for (const match of source.matchAll(identifierPattern(item.name))) {
      const line = source.slice(0, match.index).split("\n").length;
      if (file === item.file && line === item.line) continue;
      hits.push({ file, line });
    }
  }
  return hits;
}

/** 호출부 파일의 내용을 한 번만 읽어 둔다(모집단 천 개 × 파일 삼백 개라 재사용이 필수다). */
export function readCallsiteSources(baseDir: string = repoRoot): Map<string, string> {
  return new Map(collectCallsiteFiles(baseDir).map((file) => [file, readRepoFile(file, baseDir)]));
}

/** 모집단 중 **호출부 0건**인 것 전수 — 오늘의 열여섯이 여기서 나온다. */
export function findDeadExports(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectExportedFunctions(baseDir).filter((item) => findProductReferences(item, sources).length === 0);
}

/** 같은 판정을 `export const` 축에 적용한 것 — 사각을 재는 자(모집단이 아니다). */
export function findDeadConstants(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectExportedConstants(baseDir).filter((item) => findProductReferences(item, sources).length === 0);
}

/** 테스트 파일 전수 — *"계약만 초록"* 이라는 말이 참인지 세는 자리. */
export function collectTestFiles(baseDir: string = repoRoot): string[] {
  const files = new Set<string>();
  for (const root of ["apps/mobile", "apps/admin"]) {
    for (const file of walkFiles(join(baseDir, root), [".ts", ".tsx"])) {
      const relativePath = toRepoPath(file, baseDir);
      if (isTestFile(relativePath)) files.add(relativePath);
    }
  }
  return [...files].sort();
}

/** 이 이름을 잡고 있는 테스트 파일 전수(0건이면 그 항목은 사문이 아니라 그냥 죽은 코드다). */
export function findTestReferences(name: string, testSources: ReadonlyMap<string, string>): string[] {
  // ⚠️ `g` 없는 정규식을 새로 만든다 — 전역 정규식은 `lastIndex`를 들고 다녀서 같은 객체를 여러
  // 파일에 대고 `test`하면 **파일마다 다른 답**이 나온다(이 부류 스윕의 조용한 오답 하나).
  const pattern = new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`);
  return [...testSources.entries()]
    .filter(([, source]) => pattern.test(source))
    .map(([file]) => file)
    .sort();
}

// ── 갈래 ⓐ 이름이 고백하는 것 ─────────────────────────────────────────────────

export const NAME_CONFESSION_PATTERNS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
  readonly reason: string;
}[] = [
  {
    label: "reset-prefix",
    pattern: /^_{0,2}reset[A-Z]/,
    reason:
      "`reset…`은 **테스트 사이에 모듈 상태를 되돌리는 손**의 이름이다 — 제품 흐름에는 '되돌린다'는 " +
      "순간이 없다(앱은 한 번 뜨고 계속 산다). 이름 자체가 호출부가 테스트뿐임을 말한다."
  },
  {
    label: "for-tests-suffix",
    pattern: /ForTests$/,
    reason: "`…ForTests`는 관례가 아니라 문장이다 — 이름이 이미 '이유가 소스에 적힌 것'과 같은 일을 한다."
  },
  {
    label: "dunder-prefix",
    pattern: /^__[A-Za-z]/,
    reason:
      "`__`는 이 저장소에서 '제품이 부르지 않는 뒷문'의 표식이다(RN 런타임 전역 `__DEV__`와 같은 결). " +
      "⚠️ 오늘 이 표식을 단 사문은 하나이고 그 하나는 `ForTests`도 함께 달고 있다 — 표식 둘이 " +
      "겹치는 것은 문제가 아니다(고백은 많을수록 좋다)."
  }
];

/** 이 이름이 어떤 표식으로 자기가 테스트 전용이라고 말하는가(0건이면 이름은 아무 말도 하지 않는다). */
export function nameConfessions(name: string): string[] {
  return NAME_CONFESSION_PATTERNS.filter((entry) => entry.pattern.test(name)).map((entry) => entry.label);
}

// ── 갈래 ⓑ 이유가 소스에 있는 것 ──────────────────────────────────────────────

/** 라운드 71 리뷰 S-8이 세운 관례의 첫 문장. */
export const SOURCE_REASON_MARKER = "테스트 전용 export";

/** 같은 관례의 둘째 문장 — **왜 지우지 않는가**까지 적어야 이유다. */
export const SOURCE_REASON_KEEP_MARKER = "지우지 않는다";

/** 선언 줄 위로 몇 줄까지 그 관례를 찾는가(JSDoc 한 덩어리의 길이). */
export const SOURCE_REASON_LOOKBACK = 14;

export type SourceReasonProof = {
  readonly file: string;
  readonly markerLine: number;
  readonly keepLine: number;
  readonly text: string;
};

/**
 * 이 선언 **바로 위 주석 덩어리**에 관례가 실제로 적혀 있는가 — 소스로 확인한다.
 *
 * ⚠️ 줄 번호를 대장에 적지 않고 이렇게 찾는 이유: 줄은 라운드마다 밀리고, 밀린 줄을 못 박은
 * 계약은 **내용이 그대로인데도** 빨개진다(그리고 그때 사람이 하는 일은 수를 고치는 것뿐이라
 * 계약이 아무것도 지키지 못하게 된다).
 */
export function sourceReasonProof(item: ExportedFunction, baseDir: string = repoRoot): SourceReasonProof | null {
  const lines = readRepoFile(item.file, baseDir).split("\n");
  const start = Math.max(0, item.line - 1 - SOURCE_REASON_LOOKBACK);
  const block = lines.slice(start, item.line - 1);
  const markerIndex = block.findIndex((line) => line.includes(SOURCE_REASON_MARKER));
  const keepIndex = block.findIndex((line) => line.includes(SOURCE_REASON_KEEP_MARKER));
  if (markerIndex === -1 || keepIndex === -1) return null;
  return {
    file: item.file,
    markerLine: start + markerIndex + 1,
    keepLine: start + keepIndex + 1,
    text: block.slice(markerIndex).join("\n").trim()
  };
}

// ── 갈래 판정 ─────────────────────────────────────────────────────────────────

export type DeadExportReasonKind = "name-confesses" | "reason-in-source" | "reason-in-ledger";

/**
 * 항목의 갈래는 **손으로 적는 것이 아니라 재는 것**이다 — 대장의 `reasonKind`는 이 함수의
 * 산출과 대조되고, 갈리면 빨개진다(대장이 자기 갈래를 스스로 정하면 그 칸은 값이 아니다).
 *
 * 우선순위: 이름 → 소스 → 대장. ⚠️ 이름이 이미 고백하는 자리에 소스 주석이 함께 있어도 갈래는
 * `name-confesses`다 — 더 싼 근거가 이기는 순서이고, 그래야 갈래가 한 항목에 하나로 정해진다.
 */
export function classifyDeadExport(item: ExportedFunction, baseDir: string = repoRoot): DeadExportReasonKind {
  if (nameConfessions(item.name).length > 0) return "name-confesses";
  if (sourceReasonProof(item, baseDir)) return "reason-in-source";
  return "reason-in-ledger";
}

// ── 대장 ──────────────────────────────────────────────────────────────────────

export type DeadExportEntry = {
  /** `파일:이름` — 모집단 실측과 **집합으로** 대조된다(계약 ⓒ·ⓕ). */
  readonly id: string;
  readonly file: string;
  readonly name: string;
  /** 재어서 정해지는 갈래(위 `classifyDeadExport`와 대조된다). */
  readonly reasonKind: DeadExportReasonKind;
  /**
   * **왜 화면이 부르지 않는가.** 빈 문자열일 수 없다.
   *
   * ⚠️ `name-confesses`·`reason-in-source` 항목도 이 칸을 비워 두지 않는다 — 이름과 주석은
   * *"테스트 전용이다"* 까지만 말하고, *"그래서 오늘 사용자에게 보이는 결함이 있는가"* 는
   * 말하지 않는다. 그 한 문장이 이 대장이 다음 라운드에 주는 값이다.
   */
  readonly reason: string;
};

/**
 * ⚠️ **오늘의 열여섯 전수**(모바일 15 · 어드민 1). `MEASURED_ON` 기준 최종 실측이고, 계약이 이 목록을
 * 실측 집합과 **양방향으로** 대조한다 — 새 사문이 생기면 빨개지고(래칫), 항목이 되살아나도
 * 빨개진다(유령 행 금지: 되살아난 줄을 남겨 두면 그 줄이 다음 사문을 가려 준다).
 *
 * ⚠️ **오늘 이 열여섯 중 사용자에게 보이는 결함은 0건이다** — 하나씩 판정했고 그 판정이 각 줄의
 * `reason`이다. 그래서 이 라운드는 **하나도 지우지 않는다**(제품 소스 0건 수정).
 */
export const DEAD_EXPORT_LEDGER: readonly DeadExportEntry[] = [
  {
    id: "apps/mobile/src/analytics/client.ts:getQueuedAnalyticsEventCount",
    file: "apps/mobile/src/analytics/client.ts",
    name: "getQueuedAnalyticsEventCount",
    reasonKind: "reason-in-ledger",
    reason:
      "메모리 큐의 길이는 **화면에 그려지지 않는다**(사용자에게 '보내지 못한 이벤트 3건'을 말하지 않는 것이 " +
      "이 큐의 설계다 — 분석은 조용히 실패해도 되는 축이다). 이 함수가 여는 것은 상한(MAX_QUEUE_SIZE)에서 " +
      "앞쪽이 잘리는지와 플러시 뒤 비는지를 밖에서 관측하는 창 하나이고, 그 창을 닫으면 두 판정이 " +
      "모듈 내부 변수로 숨는다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/analytics/client.ts:__resetAnalyticsClientForTests",
    file: "apps/mobile/src/analytics/client.ts",
    name: "__resetAnalyticsClientForTests",
    reasonKind: "name-confesses",
    reason:
      "모듈 수준 큐를 테스트 사이에 비우는 손이다. 제품 흐름에는 '앱을 되돌린다'는 순간이 없다 — " +
      "로그아웃 teardown조차 이 함수가 아니라 세션 정리 경로를 지난다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/auth/release-build.ts:isRealUserBuild",
    file: "apps/mobile/src/auth/release-build.ts",
    name: "isRealUserBuild",
    reasonKind: "reason-in-ledger",
    reason:
      "`isDeveloperBuild()`의 **부정 편의판**이다. 화면은 전부 긍정형으로 묻는다(개발자에게만 하는 말을 " +
      "'참일 때 세운다'가 이 축의 관례이고, 부정형으로 물으면 '실사용자에게만 세우는 것'이 되어 관례가 " +
      "두 방향으로 갈린다). 지우는 판단은 그 관례를 어느 방향으로 고정할지 정한 다음이다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/consent/consent-definitions.ts:hasPendingRequiredConsents",
    file: "apps/mobile/src/consent/consent-definitions.ts",
    name: "hasPendingRequiredConsents",
    reasonKind: "reason-in-ledger",
    reason:
      "화면은 '남았는가'(불리언)가 아니라 **'무엇이 남았는가'**(`pendingRequiredConsents`)와 " +
      "**'무엇을 보낼 것인가'**(`requiredConsentAcceptances`)를 묻는다 — 목록을 이미 손에 쥐고 있으면 " +
      "길이를 보면 되고, 그래서 술어판이 남았다. 같은 파일의 두 형제는 화면이 부른다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/consent/legal-links.ts:legalDocumentUrl",
    file: "apps/mobile/src/consent/legal-links.ts",
    name: "legalDocumentUrl",
    reasonKind: "reason-in-ledger",
    reason:
      "화면이 쓰는 복수형 `legalDocumentUrls()`의 **단수 편의판**이다 — 약관·개인정보 두 링크는 언제나 " +
      "같은 자리에 함께 서므로 화면은 한 번에 둘을 읽는다. ⚠️ `settings/support-links.ts:supportLinkUrl`이 " +
      "**같은 모양의 쌍둥이**다(그 파일이 이 파일을 이름으로 가리키며 형식만 가져갔다) — 그래서 이 둘은 " +
      "하나를 지우면 다른 하나도 함께 판정해야 한다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/import/bulk-run.ts:resetImportBulkRuns",
    file: "apps/mobile/src/import/bulk-run.ts",
    name: "resetImportBulkRuns",
    reasonKind: "name-confesses",
    reason:
      "일괄 반영의 진행 상태(모듈 수준 맵)를 테스트 사이에 비우는 손이다. 제품 경로에서는 작업이 " +
      "끝나면서 스스로 정리된다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/import/import-failure-messages.ts:isNamedImportFailure",
    file: "apps/mobile/src/import/import-failure-messages.ts",
    name: "isNamedImportFailure",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **이유가 소스에 있는 둘 중 하나**(라운드 71 리뷰 S-8 관례). 소스가 '표가 아는 코드와 모르는 코드의 " +
      "경계를 값으로 지켜 둔다'며 **지우지 않는다**고 못 박았다 — 재시도 버튼을 이름 있는 실패에서 접는 " +
      "화면이 생기면 그때 필요한 술어다. **이 형식이 옳은 형식이고 열여섯 중 둘뿐이다.**"
  },
  {
    id: "apps/mobile/src/import/preview-rows.ts:canBulkSelectImportRows",
    file: "apps/mobile/src/import/preview-rows.ts",
    name: "canBulkSelectImportRows",
    reasonKind: "reason-in-ledger",
    reason:
      "화면이 **더 넓은 판정으로 갈아탔다** — `app/import/[importJobId].tsx`가 `canStartImportBulkRun`을 " +
      "부른다(행 선택 가능 여부에 더해 대상 아이·진행 중 여부까지 함께 본다). 좁은 술어가 남은 것이지 " +
      "화면이 판정을 잃은 것이 아니다. ⚠️ **열여섯 중 유일하게 '대체되었다'가 이유인 자리**이고, " +
      "그래서 지우는 판단이 가장 싼 자리이기도 하다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/local-devices.ts:resetLocalDevicesForTests",
    file: "apps/mobile/src/notifications/local-devices.ts",
    name: "resetLocalDevicesForTests",
    reasonKind: "name-confesses",
    reason:
      "로컬 기기 목록 저장소를 테스트 사이에 비우는 손이다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/notification-preferences.store.ts:notificationTypeLabel",
    file: "apps/mobile/src/notifications/notification-preferences.store.ts",
    name: "notificationTypeLabel",
    reasonKind: "reason-in-ledger",
    reason:
      "화면은 종류 하나를 이름 짓는 대신 **목록(`NOTIFICATION_TYPE_OPTIONS`)을 그대로 돌면서** 스위치를 " +
      "그린다 — 이름은 그 순회 안에서 이미 손에 있다. 소스 주석도 '화면이 목록을 돌지 않고 한 종류만 " +
      "이름 지을 때 쓴다'고 그 조건을 적어 두었지만, **그 조건을 만족하는 화면은 오늘 0건**이다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/usePushDeviceRegistration.ts:resetPushRegistrationForTests",
    file: "apps/mobile/src/notifications/usePushDeviceRegistration.ts",
    name: "resetPushRegistrationForTests",
    reasonKind: "name-confesses",
    reason:
      "푸시 등록 훅의 모듈 수준 상태를 테스트 사이에 비우는 손이다(로그아웃 teardown 계약도 이 함수가 " +
      "아니라 세션 정리 경로를 잡는다). **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/offline/offline-aware-screens.ts:usesOfflineAwareLoadErrorCopy",
    file: "apps/mobile/src/offline/offline-aware-screens.ts",
    name: "usesOfflineAwareLoadErrorCopy",
    reasonKind: "reason-in-ledger",
    reason:
      "⚠️ **이 모듈은 설계상 화면이 import하지 않는다** — 자기 머리말이 '계약 전용 데이터라 앱 번들에 " +
      "실리지 않는다'고 적어 두었고, 이 술어는 그 대장을 읽는 세 계약 파일이 쓰는 손이다. " +
      "즉 이 한 줄은 **`export const` 축의 면제 사유가 `export function` 축으로 새어 나온 자리**이고, " +
      "그래서 이 대장의 사각(`export-const-axis`)이 왜 값으로 적혀야 하는지를 보여 주는 증거다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/query/query-client-registry.ts:resetAppQueryClientRegistryForTests",
    file: "apps/mobile/src/query/query-client-registry.ts",
    name: "resetAppQueryClientRegistryForTests",
    reasonKind: "name-confesses",
    reason:
      "쿼리 클라이언트 레지스트리를 테스트 사이에 비우는 손이다(세션 만료·로그아웃 teardown 계약 둘이 쓴다). " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/settings/destructive-flow-messages.ts:destructiveFlowFallbackMessage",
    file: "apps/mobile/src/settings/destructive-flow-messages.ts",
    name: "destructiveFlowFallbackMessage",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **이유가 소스에 있는 둘 중 둘째**(같은 라운드 71 리뷰 S-8 관례). 화면은 `destructiveFlowErrorMessage` " +
      "하나만 부르고, 소스가 '스윕 계약이 흐름별 사용자 문장을 적을 때 쓰는 값이라 **지우지 않는다**'고 " +
      "적어 두었다 — 그 매핑을 테스트로 옮기면 표가 두 벌이 된다."
  },
  {
    id: "apps/mobile/src/settings/support-links.ts:supportLinkUrl",
    file: "apps/mobile/src/settings/support-links.ts",
    name: "supportLinkUrl",
    reasonKind: "reason-in-ledger",
    reason:
      "화면이 쓰는 복수형 `supportLinkUrls()`의 **단수 편의판**이다(FAQ·문의 두 링크가 한 자리에 함께 선다). " +
      "⚠️ `consent/legal-links.ts:legalDocumentUrl`과 **같은 모양의 쌍둥이**다 — 이 파일이 소스에 " +
      "'형식은 legal-links.ts에서 값이 아니라 형식만 가져왔다'고 적어 두었고(`:19`), 그래서 한 라운드가 " +
      "하나만 지우면 그 관례가 반쪽으로 남는다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/admin/src/lib/admin-api.ts:updateContentRevisionDraft",
    file: "apps/admin/src/lib/admin-api.ts",
    name: "updateContentRevisionDraft",
    reasonKind: "reason-in-ledger",
    reason:
      "⚠️ **계약의 문장이 거짓에 가까워진 자리.** `src/content-revisions.test.ts`가 " +
      "*\"exposes the full draft -> review -> publish surface\"* 라며 여덟 이름의 **소스 텍스트 포함**을 " +
      "단언하는데, 그중 이 하나는 **어느 화면도 부르지 않는다** — 어드민 세 화면(items·links·disclosures)은 " +
      "초안을 만들고 곧바로 제출하는 합성 함수 `draftAndSubmitContentRevision` 하나만 쓴다. " +
      "**'있다'는 단언과 '닿는다'는 사실이 갈렸다.** 서버 PATCH 엔드포인트 자체는 살아 있으므로 이 라운드는 " +
      "지우지 않고 **그 갈림을 값으로 적는다.** 오늘 사용자·운영자에게 보이는 결함 0건."
  }
  // ⚠️ 정찰이 열일곱째로 센 `apps/admin/src/lib/audit-log-filters.ts:hasAnyAuditLogFilter`는
  // **오늘 사문이 아니다** — 같은 라운드의 트랙 A가 `apps/admin/src/lib/audit-log-rows.ts`에서
  // 그 술어를 부르며 감사 로그 빈 표의 두 문장(*"아직 기록이 없어요"* / *"조건에 맞는 기록이
  // 없어요"*)을 갈랐다. 되살아난 줄을 대장에 남겨 두면 그 줄이 **다음 사문을 가려 주는 자리**가
  // 되므로(래칫이 하나 헐거워진다) 여기 두지 않고, 그 사실만 이 주석과 머리말에 값으로 남긴다.
];

/**
 * ⚠️ **래칫** — 사문 항목 수가 이 값을 넘지 않는다.
 *
 * 넘는 순간 새 사문이 생긴 것이고, 그때 두 답 중 **하나를 값으로 고르게 된다**: 지우거나(호출부가
 * 없으니 없어도 된다), 이유를 적거나(소스의 S-8 관례든 이 대장의 줄이든). 세 번째 답 — *"조용히
 * 둔다"* — 은 이 값이 막는다.
 *
 * ⚠️ 이 값을 **늘려서** 통과시키는 것은 래칫을 푸는 일이다. 줄이는 것은 언제나 옳다(항목이 실제로
 * 걷혔을 때 이 값과 그 줄을 함께 내린다).
 */
export const DEAD_EXPORT_RATCHET = 16;

// ── 사각을 값으로 (AA-4의 규율을 태어날 때부터) ───────────────────────────────

/**
 * `export const` 축의 사문 중 **계약 전용 데이터 모듈**에 사는 것 — 이 목록이 곧 결정 ②의 이유다.
 *
 * 이 다섯 모듈은 *"테스트만 읽는 것이 이 모듈의 설계"* 인 자리이고, 그래서 `export const` 축을
 * 모집단에 넣는 순간 **면제 줄 열하나로 시작하는 대장**이 된다.
 */
export const CONTRACT_ONLY_DATA_MODULES: readonly { readonly path: string; readonly reason: string }[] = [
  {
    path: "apps/mobile/src/offline/offline-aware-screens.ts",
    reason:
      "머리말이 '이 모듈은 화면 코드가 import하지 않는다(계약 전용 데이터라 앱 번들에 실리지 않는다)'고 " +
      "직접 적어 두었다 — 세 계약 파일이 이 목록을 읽는 것이 이 파일의 존재 이유다."
  },
  {
    path: "apps/mobile/src/query/shared-cache-policy.ts",
    reason: "쓰기 API와 그 제외 목록의 단일 소스 — 캐시 무효화 계약이 읽는 표이지 화면이 읽는 값이 아니다."
  },
  {
    path: "apps/mobile/src/offline/messages.ts",
    reason:
      "오프라인 문장의 단일 소스. 여기 남은 사문 셋은 문장 자체가 아니라 **무엇을 세는지 말하는 값**" +
      "(teardown 대상 목록·스윕용 라벨)이고, 그 축의 소비자는 계약뿐이다."
  },
  {
    path: "apps/mobile/src/reports/empty-period-card.ts",
    reason: "'빈 기간 카드를 그리는 화면' 목록 — 화면이 자기 이름을 읽지 않으므로 소비자는 계약뿐이다."
  },
  {
    path: "apps/mobile/src/settings/more-menu.ts",
    reason: "더보기 메뉴에서 설정 화면에만 있는 경로 목록 — 두 화면의 갈림을 계약이 세는 표다."
  }
];

/** 그 다섯 모듈에 사는 `export const` 사문 전수. */
export function deadConstantsInContractOnlyModules(baseDir: string = repoRoot): ExportedFunction[] {
  const modules = CONTRACT_ONLY_DATA_MODULES.map((entry) => entry.path);
  return findDeadConstants(baseDir).filter((item) => modules.includes(item.file));
}

/**
 * 모집단 이름 가운데 제품 소스 어딘가에 **속성·키 자리**로도 나오는 것 — 이름 훑기의 사각.
 *
 * ⚠️ 이 수가 말하는 것: 그 이름들에 대해서는 *"텍스트가 한 번 나왔다"* 가 **호출의 증거가 아니다**
 * (`api.listItems`도, `{ listItems: … }`도 한 번의 일치다). 오차의 방향은 **사문을 놓치는 쪽**이라
 * 이 대장은 거짓 빨강이 아니라 거짓 초록으로 죽는다 — 그래서 값으로 적어 둔다.
 */
export function namesAlsoUsedAsProperty(baseDir: string = repoRoot): string[] {
  const sources = [...readCallsiteSources(baseDir).values()];
  const found: string[] = [];
  for (const item of collectExportedFunctions(baseDir)) {
    const pattern = new RegExp(`\\.\\s*${item.name}(?![\\w$])|(?<![\\w$])${item.name}\\s*:`);
    if (sources.some((source) => pattern.test(source))) found.push(item.name);
  }
  return [...new Set(found)].sort();
}

/** `.tsx`의 `export function`(컴포넌트·훅) 전수 — 모집단 밖의 축이 얼마나 큰가. */
export function tsxExportFunctionCount(baseDir: string = repoRoot): number {
  let count = 0;
  for (const root of ["apps/mobile/app", "apps/mobile/src", "apps/admin/app", "apps/admin/src"]) {
    for (const file of filesUnder(root, [".tsx"], ["local-backend", "local-fixtures"], baseDir)) {
      for (const line of readRepoFile(file, baseDir).split("\n")) {
        if (/^export\s+(?:default\s+)?(?:async\s+)?function\s/.test(line)) count += 1;
      }
    }
  }
  return count;
}

export type LedgerBlindSpot = {
  readonly id: string;
  /** `MEASURED_ON` 기준 실측값 — **산문이 아니라 값이다.** */
  readonly value: number;
  /**
   * 계약이 다시 재어 대는 **하한**.
   *
   * ⚠️ 하한이지 등호가 아닌 이유: 이 수들은 A~D 트랙이 화면 한 줄만 고쳐도 흔들린다. 계약이 무는
   * 것은 *"적어 둔 사각이 실은 없다"*(유령 사각)이고, 그 판정에 필요한 것은 하한이다. `value`가
   * 오래되면 그것은 다음 라운드가 값을 다시 재라는 신호이지 계약의 실패가 아니다.
   */
  readonly floor: number;
  /** 사각의 문장 — 빈 문자열일 수 없다. */
  readonly statement: string;
  /** 오늘 다시 재는 자(없으면 계약은 문장과 값만 센다). */
  readonly measure?: (baseDir: string) => number;
};

export const LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = [
  {
    id: "export-const-axis",
    value: 13,
    floor: 8,
    statement:
      "같은 뿌리·같은 조건으로 `export const` 축을 재면 651 중 13이 호출부 0건이다. " +
      "⚠️ **라운드 87 리뷰 M-1의 정정**: 당시 이 자리의 분모는 591이었는데 그것은 모집단 뿌리 **둘 중 " +
      "모바일 하나만**(`apps/mobile/src`) 센 수라, 바로 앞 문장의 *'같은 뿌리·같은 조건'* 과 코드의 " +
      "모집단(`collectExportedConstants` = 모바일 591 + 어드민 `src/lib` 60)이 갈려 있었다. " +
      "**라운드 87 리뷰 이후**의 실측은 651이고, 분자 13은 두 뿌리를 다 세도 그대로다 — 오늘 " +
      "어드민 `src/lib`의 `export const` 60은 **전부 호출부가 있다**(그래서 정정으로 늘어난 것은 분모뿐이다). " +
      "**모집단에 넣지 않았다** — " +
      "그중 열하나가 계약 전용 데이터 모듈 다섯(CONTRACT_ONLY_DATA_MODULES)에 살아서 '테스트만 읽는 것이 그 모듈의 " +
      "설계'이고, 그러면 이 대장은 첫날부터 면제 줄 열하나로 시작한다. 남은 둘(IMPORT_FAILURE_KINDS · " +
      "OFFLINE_DB_SCHEMA_VERSION) 중 하나는 이미 소스에 S-8 관례가 붙어 있다 — 즉 **그 관례 넷 중 둘이 오늘 " +
      "모집단 밖에 산다.** ⚠️ 재개 조건(결정형 · 손은 안): 계약 전용 데이터 모듈을 **뿌리에서** 가르는 " +
      "판정이 서는 날 — 그날 이 축이 모집단으로 들어온다.",
    measure: (baseDir) => findDeadConstants(baseDir).length
  },
  {
    id: "contract-only-data-modules",
    value: 11,
    floor: 8,
    statement:
      "그 열셋 중 **열하나**가 다섯 모듈에 산다(offline-aware-screens 셋 · shared-cache-policy 셋 · " +
      "offline/messages 셋 · empty-period-card 하나 · more-menu 하나). 이 열하나가 결정 ②의 이유 전체다.",
    measure: (baseDir) => deadConstantsInContractOnlyModules(baseDir).length
  },
  {
    id: "common-name",
    value: 77,
    floor: 20,
    statement:
      "이 그물은 **이름의 텍스트**를 훑지 해석된 참조를 보지 않는다. 모집단 1016 이름 중 77은 제품 소스 " +
      "어딘가에 속성 접근(`api.listItems`)이나 객체 키(`listItems:`) 자리로도 나온다 — 그 이름들에 대해서는 " +
      "한 번의 텍스트 일치가 호출의 증거가 아니다. ⚠️ 오차의 방향은 **사문을 놓치는 쪽**이고(거짓 초록), " +
      "그래서 오늘의 열여섯은 하한이지 상한이 아니다. AA-4가 이름 붙인 바로 그 사각이다. " +
      "⚠️ **라운드 87 리뷰 M-2의 정정**: 이 자리에 적혀 있던 수는 76이었는데 `namesAlsoUsedAsProperty()`를 " +
      "돌리면 트랙 E 커밋 시점에도 77이었다 — 코드가 갈린 것이 아니라 **옮겨 적기 오차**였다. " +
      "**라운드 87 리뷰 이후**의 값은 실행값 77이다.",
    measure: (baseDir) => namesAlsoUsedAsProperty(baseDir).length
  },
  {
    id: "comment-and-string-references",
    value: 0,
    floor: 0,
    statement:
      "같은 층의 다른 얼굴 — `findProductReferences`는 소스를 **마스킹 없이** 훑는다. 그래서 **주석 안의 " +
      "이름도, 문자열 리터럴 안의 이름도 참조 한 번**으로 센다(이 저장소의 주석은 모듈·함수 이름을 자주 " +
      "인용한다). 오차의 방향은 위 `common-name`과 같은 **사문을 놓치는 쪽**이다 — *'아무도 부르지 않는데 " +
      "주석만 이름을 말하고 있는'* export는 이 대장에 서지 않는다. ⚠️ **오늘 실피해 0건**(라운드 87 리뷰 " +
      "L-1의 실측): 줄 수를 보존한 채 주석만 지우고 다시 재면 사문 수가 **16 → 16으로 같고**, 참조가 " +
      "**전부 주석뿐**인 export는 **0건**이다. ⚠️ 문자열 리터럴은 같은 사각이지만 템플릿 리터럴의 " +
      "`${…}` 안은 진짜 코드라 통째로 지우는 재측정이 성립하지 않는다 — 그래서 오늘의 0은 **주석 마스킹 " +
      "기준**이다. ⚠️ 재개 조건(사건형): 이 재측정이 0을 넘는 날 — 그날 이 그물은 마스킹을 배워야 한다. " +
      "⚠️ 값이 0이라 다시 재는 자를 달지 않는다(`outside-two-apps`와 같은 모양) — 하한 0 위의 재측정은 " +
      "언제나 참이라 계약이 아무것도 지키지 못한다. 이 줄이 하는 일은 **그 재측정을 언제 어떻게 했는지**를 " +
      "값으로 남겨, 다음 라운드가 같은 축을 다시 세고도 적을 자리를 못 찾는 일을 막는 것이다."
  },
  {
    id: "tsx-components",
    value: 141,
    floor: 80,
    statement:
      "`.tsx`의 `export function`(컴포넌트·훅) 141은 모집단 밖이다 — JSX 사용(`<Foo />`)은 이 그물의 이름 " +
      "훑기가 호출과 다르게 읽고, 화면 파일의 default export는 라우터가 경로로 부르므로 텍스트 호출부가 " +
      "애초에 없다. ⚠️ 재개 조건(결정형 · 손은 안): JSX 사용을 참조로 세는 판정이 서는 날.",
    measure: (baseDir) => tsxExportFunctionCount(baseDir)
  },
  {
    id: "outside-two-apps",
    value: 0,
    floor: 0,
    statement:
      "`apps/api/**`와 `packages/**`는 오늘 모집단에도 호출부에도 없다. AA-1의 질문이 '순수 판정 모듈'을 " +
      "물었고 그 층이 두 앱에 있기 때문이지, 서버에 사문이 없기 때문이 아니다 — **재어 보지 않았다.** " +
      "⚠️ 재개 조건(사건형): 서버 축을 세는 라운드가 오는 날. 값이 0인 것은 측정값이 아니라 **미측정**이고, " +
      "그 사실을 0으로 적어 두는 것이 이 줄의 일이다."
  }
];

// ── 실패 메시지 ───────────────────────────────────────────────────────────────

/** 사람을 그 파일로 보내는 한 줄(수만 던지는 실패 메시지는 사람에게 이유를 다시 찾게 한다). */
export function describeDeadExport(item: ExportedFunction): string {
  return `${item.file}:${item.line} ${item.name}()`;
}

/** 새 사문이 생겼을 때 사람이 고를 두 답을 적어 준다. */
export function deadExportHint(item: ExportedFunction): string {
  return (
    `${describeDeadExport(item)} — 제품 소스 어디에서도 부르지 않아요(테스트만 부릅니다).\n` +
    "  두 답 중 하나를 값으로 고르세요:\n" +
    "   ① 지운다 — 호출부가 없으니 없어도 됩니다(테스트도 함께 걷습니다).\n" +
    "   ② 이유를 적는다 — 소스 주석에 '⚠ **테스트 전용 export** … **지우지 않는다**'(라운드 71 리뷰 S-8 관례)를\n" +
    "      달거나, 이름을 `…ForTests`로 바꾸거나, dead-export-ledger.ts의 DEAD_EXPORT_LEDGER에 줄을 더하세요.\n" +
    "  ⚠️ 대장에 줄을 더했다면 DEAD_EXPORT_RATCHET도 함께 올라갑니다 — 그 값은 늘리지 않는 것이 원칙입니다."
  );
}
