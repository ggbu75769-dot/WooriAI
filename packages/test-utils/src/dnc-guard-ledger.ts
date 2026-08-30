// 라운드 84 트랙 B (GAP-084 #3) — "가장 많이 인용되는 문서에 그것을 세는 자리가 없다"를 닫는 대장.
//
// `docs/dev/do-not-change.md`는 이 저장소의 절대 규칙이다. CLAUDE.md·AGENTS.md·CODEX_START_HERE.md가
// 모두 그 파일을 첫 줄로 가리키고, 테스트 주석은 조항 ID를 수백 번 인용한다. 그런데 라운드 84
// 정찰이 U-5(라운드 80이 물어 네 라운드 동안 답이 적히지 않은 질문)를 처음 실측했을 때 나온 것은
// 이것이었다 — **그 문서에 줄이 늘거나 문구가 완화돼도 빨개지는 자리가 사실상 없다.**
//
// 이 파일은 그 스무 줄에 **기계 가드 대장**을 세운다. 조항마다 둘 중 하나를 갖는다.
//  ① **가드 있음** — 가드 파일 경로 + **그 단언을 특정하는 소스 줄**(실재를 확인한다).
//  ② **가드 없음** — **빈 문자열이 아닌 이유 + 재개 조건**(무엇이 생기는 날 다시 여는가).
//
// ⚠️ 이번 라운드는 **대장까지다.** 비어 있는 자리에 가드를 만들지 않는다 — 무엇을 어떻게 막을지는
// 각각 다른 축의 판단이고(DNC-016은 부정 스윕의 모집단 결정, DNC-019는 "무엇을 비밀값으로 볼
// 것인가"의 결정), **먼저 세는 것이 이 트랙의 전부다**. 세어질 때만 값이다.
//
// ## ⚠️ 판정 기준 — "인용"과 "가드"를 무엇으로 가르는가
//
// 이 저장소의 고질병 하나를 O-3이 이름 붙였다: **인용이 실측을 대신한다.** 주석에 `DNC-009`가
// 적혀 있다는 사실은 아무것도 막지 않는다. 그래서 이 대장의 가드 칸은 **주석이 아닌 줄에 선
// 단언**만 받는다(아래 `findAssertionLines`가 그 판정을 기계로 강제한다 — 주석 안에서만 발견되는
// 문자열은 자리로 세지 않는다).
//
// 그리고 **반대 방향의 laundering(세탁)도 막는다.** 가드로 인정하는 조건은 이것이다:
//
//   > 그 조항이 **잠근 대상 자체**를 단언이 읽고, 그 대상이 계약이 말한 값·모양에서 벗어나면
//   > 빨개지는가.
//
// 이웃 조항의 가드가 위반의 **증상 하나**를 부수적으로 잡는 것은 그 이웃의 가드다. 예: 커뮤니티
// 탭을 하나 다는 것은 DNC-001(포지셔닝) 위반이면서 DNC-003(하단 탭 넷) 위반이고, 그때 빨개지는
// `route-surface.test.ts`는 **DNC-003의 가드**다. 그것으로 DNC-001에 가드가 있다고 적으면 대장이
// 곧 면제부가 된다.
//
// ## ⚠️ 정찰과 갈린 자리 둘 — 이 트랙이 실측해서 정한다
//
// 정찰(`docs/5차/round84-scout.md` #3)은 **인용 수**로 재어 *"테스트에 이름조차 없는 것 둘
// (DNC-005·DNC-016)"* 이라고 적었다. 이 대장은 인용이 아니라 **단언**으로 다시 쟀고, 둘이 갈렸다.
//
//  · **DNC-005(기술 스택)는 인용이 0건인데 가드는 있다.** `app-lock-gate-contract.test.ts`가
//    `apps/mobile/package.json`의 의존성 이름 **전수**를 못 박는다 — 그 목록에 `react-native`,
//    `expo`, `@tanstack/react-query`, `zustand`가 이름으로 들어 있어서 넷 중 하나라도 갈아 끼우면
//    빨개진다. 그 단언의 **목적**은 다른 것이고(그 라운드의 "새 의존성 0") DNC-005를 인용조차 하지
//    않는다. 그래서 이 줄을 대장에 적는 일 자체가 값이다 — 그 파일이 완화되는 날 DNC-005는
//    **조용히** 무가드가 되는데, 이제는 이 대장이 먼저 빨개진다.
//  · **DNC-001(포지셔닝)은 인용이 둘인데 가드는 없다.** 둘 다 주석이다.
//
// 그래서 오늘 *"가드 없음"* 은 정찰이 센 둘이 아니라 **셋**이고(DNC-001·016·019), 래칫은 그 값이다.
//
// ## 문서를 읽는 계약은 오늘 둘이다(그리고 둘 다 조항을 지키지는 않는다)
//
// 정찰은 *"문서 자체를 읽어 지키는 계약은 하나"* (DNC-017)라고 적었다. 실측하면 `do-not-change.md`를
// 읽는 계약은 **둘**이다.
//  · `store-brand-and-asset-provenance.test.ts` — DNC-017 행의 토큰 세 값을 글자 단위로 대조한다
//    (**조항 하나를 실제로 지킨다**).
//  · `repo-self-description.test.ts` — 표에서 조항 ID 전수를 파싱하고 판(v0.5)을 읽지만, 그것이 무는
//    것은 **"규칙 목록의 사본이 둘 이상 있지 않다"** 는 문서 위생이지 **어느 조항의 내용도 아니다**.
//
// 이 대장은 그 둘 다와 다른 축이다: 조항 스무 줄 **각각**에 대해 *"오늘 이것을 지키는 기계가
// 있는가"* 를 묻고, 없으면 **왜 없는지와 언제 다시 여는지**를 값으로 남긴다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/** 조항의 단일 소스. ⚠️ 이 트랙은 이 파일을 **읽기만** 한다(개정은 PM/Tech Lead 승인 절차다). */
export const DNC_CONTRACT_PATH = "docs/dev/do-not-change.md";

/**
 * 대장 자신의 두 자리 — ⓔ 부정 단언이 읽는다.
 *
 * ⚠️ **대장은 스스로를 가드로 세지 않는다.** 대장이 자기 자신을 가리키면 "가드 있음" 칸은 그저
 * "대장에 줄이 있다"는 말이 되고, 그 순간 이 파일은 세는 도구가 아니라 면제부가 된다.
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/dnc-guard-ledger.ts",
  "packages/test-utils/src/dnc-guard-ledger.test.ts"
] as const;

/** 저장소 상대 경로를 읽는다(가드 파일의 실재 확인은 이 읽기의 성공 여부다). */
export function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

// ── 표 파싱 ───────────────────────────────────────────────────────────────────

/**
 * 조항 표의 한 줄 — **첫 칸이 ID인 줄만** 받는다.
 *
 * ⚠️ 개정 이력 표에도 `DNC-017`이 실리지만(`| v0.5 | 2026-08-27 | DNC-017 | … |`) 그 줄의 첫 칸은
 * 판 번호다. 첫 칸을 묻는 것이 두 표를 가르는 유일한 방법이고, 그래서 수를 손으로 적지 않아도
 * 된다.
 */
const CONTRACT_ROW = /^\|\s*(DNC-\d{3})\s*\|/gm;

/** 문서에서 조항 ID 전수를 읽는다 — **수를 손으로 적지 않는다**(계약 ⓐ). */
export function parseDncRuleIds(contractSource: string): string[] {
  return [...contractSource.matchAll(CONTRACT_ROW)].map((match) => match[1]);
}

// ── 단언 자리 판정 ────────────────────────────────────────────────────────────

/**
 * 단언의 모양 — `expect(` 또는 `expect.`(vitest의 `expect.objectContaining` 등)를 지녀야 한다.
 *
 * ⚠️ 이 검사가 가드 칸의 **형식**이다. 주석에 조항 ID가 적혀 있다는 사실은 가드가 아니므로,
 * 대장은 *"단언을 특정하는 문자열"* 만 받는다.
 */
export const ASSERTION_SHAPE = /\bexpect\s*[.(]/;

export function isAssertionShaped(excerpt: string): boolean {
  return excerpt.trim().length > 0 && ASSERTION_SHAPE.test(excerpt);
}

/**
 * 줄 단위 주석 판정.
 *
 * 이 저장소의 주석은 `//` 한 줄이거나 `/** … *\/` 블록(이어지는 줄은 `*`로 시작)이다. 그래서
 * **줄의 시작**만 보면 충분하고, 정규식 리터럴 안의 `/`를 주석으로 오인하는 사고가 생기지 않는다
 * (`toMatch(/[요]\.$/)` 같은 줄이 실제로 가드 칸에 있다).
 *
 * ⚠️ 근사임을 적어 둔다: 줄 중간에서 시작하는 블록 주석(`foo(); /* … *\/`)은 이 판정이 놓친다.
 * 오늘 가드 칸의 열일곱 줄 가운데 그런 모양은 0건이고, 놓치는 방향은 **더 엄격한 쪽이 아니라 더
 * 느슨한 쪽**이므로 그 사실을 여기 남긴다.
 */
export function commentLineFlags(sourceLines: readonly string[]): boolean[] {
  const flags: boolean[] = [];
  let insideBlock = false;

  for (const rawLine of sourceLines) {
    const line = rawLine.trim();
    if (insideBlock) {
      flags.push(true);
      if (line.includes("*/")) insideBlock = false;
      continue;
    }
    if (line.startsWith("/*")) {
      flags.push(true);
      if (!line.includes("*/")) insideBlock = true;
      continue;
    }
    flags.push(line.startsWith("//") || line.startsWith("*"));
  }

  return flags;
}

/**
 * 단언 발췌가 소스의 **주석이 아닌 줄**에 실제로 서 있는 자리(0-기반 줄 번호) 전수.
 *
 * 비교는 **줄마다 trim 후 글자 그대로**다. 들여쓰기가 바뀌어도 살아남고(다른 트랙이 그 파일을
 * 재정렬해도 이 대장이 병목이 되지 않는다), 단언의 **내용**이 한 글자라도 바뀌면 빨개진다.
 * ⚠️ 줄 번호는 대장에 적지 않는다 — 줄 번호로 적으면 그 파일을 여는 모든 트랙이 이 대장을 함께
 * 고쳐야 한다(라운드 78 트랙 E가 같은 이유로 `파일 → 개수` 단위를 골랐다).
 */
export function findAssertionLines(source: string, excerpt: string): number[] {
  const sourceLines = source.split("\n").map((line) => line.trim());
  const comments = commentLineFlags(source.split("\n"));
  const excerptLines = excerpt.split("\n").map((line) => line.trim());
  const found: number[] = [];

  if (excerptLines.length === 0) return found;

  for (let start = 0; start + excerptLines.length <= sourceLines.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < excerptLines.length; offset += 1) {
      if (sourceLines[start + offset] !== excerptLines[offset] || comments[start + offset]) {
        matched = false;
        break;
      }
    }
    if (matched) found.push(start);
  }

  return found;
}

// ── 대장 ──────────────────────────────────────────────────────────────────────

/** 오늘 그 조항의 위반을 빨갛게 만드는 단언이 있는 자리. */
export type DncGuardedEntry = {
  readonly state: "guarded";
  /** 저장소 상대 경로. ⚠️ 이 트랙은 이 파일들을 **읽기만** 했다. */
  readonly file: string;
  /** 그 단언을 특정하는 소스 줄(하나 이상 · 글자 그대로). */
  readonly assertion: string;
  /** 그 단언이 **무는 것**과 **물지 않는 것** — 빈 문자열일 수 없다. */
  readonly covers: string;
};

/** 오늘 그 조항을 지키는 기계가 없는 자리. */
export type DncUnguardedEntry = {
  readonly state: "unguarded";
  /** 왜 없는가 — 빈 문자열일 수 없다(계약 ⓒ). */
  readonly reason: string;
  /** 무엇이 생기는 날 다시 여는가 — 빈 문자열일 수 없다(계약 ⓒ). */
  readonly resumeWhen: string;
};

export type DncLedgerEntry = DncGuardedEntry | DncUnguardedEntry;

/**
 * 조항 → 가드(또는 이유·재개 조건).
 *
 * ⚠️ 키를 손으로 세지 않는다 — 계약이 문서에서 ID 전수를 파싱해 이 객체의 키 집합과 **양방향으로**
 * 맞춰 본다. 문서에 줄이 늘거나 줄면 이 대장이 **먼저** 빨개진다.
 */
export const DNC_GUARD_LEDGER: Readonly<Record<string, DncLedgerEntry>> = {
  "DNC-001": {
    state: "unguarded",
    reason:
      "조항이 잠근 것은 제품 포지션 문장('아이 비용 관리 + 시기별 준비템 구매 내비게이션'이고 일반 가계부/쇼핑몰/커뮤니티가 아니다)인데, " +
      "그 문장을 읽는 단언이 0건이다. 저장소의 DNC-001 인용 둘은 전부 주석이다 " +
      "(apps/mobile/src/items/items-stage-band-flow.test.ts · apps/mobile/app/(tabs)/items.tsx). " +
      "이웃의 가드가 위반의 증상 하나씩을 잡지만(DNC-003이 탭 넷을, DNC-002가 루프의 마지막 고리를) " +
      "그것은 그 조항들의 가드이고, 그것으로 이 칸을 채우면 대장이 면제부가 된다.",
    resumeWhen:
      "탭·핵심 루프 밖에서 포지션을 옮기는 표면이 하나라도 서는 날(커뮤니티 피드·독립 상품 카탈로그·일반 가계부 진입점 등), " +
      "또는 DNC-016의 부정 스윕이 서는 날 — 그 스윕의 모집단이 이 조항의 첫 가드가 된다(같은 축이다)."
  },
  "DNC-002": {
    state: "guarded",
    file: "apps/api/test/items-commerce.e2e.test.ts",
    assertion: '        expect(body).toMatchObject({ id: linkedItem.id, status: "prepared" });',
    covers:
      "핵심 루프의 마지막 고리(구매 후 기록 → 준비템 상태 체크)를 서버 e2e가 실제로 돌린다 — 연결 지출을 만들면 그 준비템이 prepared가 된다. " +
      "⚠️ 무는 것은 고리 하나다: 루프 1~4단계가 흐려지는 다른 방식(예: 홈에서 기록 진입이 사라지는 것)은 " +
      "apps/mobile/src/home/first-run-guide.test.ts의 유도 경로 단언이 따로 문다."
  },
  "DNC-003": {
    state: "guarded",
    file: "apps/mobile/src/route-surface.test.ts",
    assertion: [
      "    expect(parsed.filter((screen) => !screen.hidden).map((screen) => screen.name)).toEqual([",
      '      "index",',
      '      "records",',
      '      "items",',
      '      "reports"',
      "    ]);"
    ].join("\n"),
    covers:
      "app/(tabs)/_layout.tsx를 파싱해 탭 바에 서는 Tabs.Screen이 정확히 넷이고 그 이름이 홈·기록·준비템·리포트임을 못 박는다. " +
      "탭을 더하거나 이름을 바꾸면 빨개진다(href: null로 숨긴 다섯째도 같은 테스트가 이름으로 센다)."
  },
  "DNC-004": {
    state: "guarded",
    file: "apps/mobile/src/expense-home-report-flow.test.ts",
    assertion: '      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);',
    covers:
      "잠긴 화면 ID(HOME-001 · EXP-001/003/004 · REP-001/002 · BUD-001)가 각자의 라우트 파일에 실제로 실려 있는지를 " +
      "routeExpectations 표 전수로 확인한다 — ID를 임의로 갈면 빨개진다. " +
      "⚠️ 무는 것은 그 표에 오른 여덟이다: SPL·AUTH·ONB·ITEM·FAM·IMP·SET·ADM 네임스페이스는 이 표 밖이고, " +
      "그쪽은 침범 금지(부정) 단언만 있다(apps/mobile/src/expenses/recurring-flow.test.ts · src/security/app-lock-gate-contract.test.ts)."
  },
  "DNC-005": {
    state: "guarded",
    file: "apps/mobile/src/security/app-lock-gate-contract.test.ts",
    assertion: "    expect(Object.keys(packageJson.dependencies).sort()).toEqual([",
    covers:
      "apps/mobile/package.json의 의존성 이름 전수를 못 박는다 — 그 목록에 react-native · expo · @tanstack/react-query · zustand가 " +
      "이름으로 있어서 넷 중 하나라도 갈아 끼우면 빨개진다. " +
      "⚠️ 이 단언은 DNC-005를 인용하지 않고 목적도 다르다(그 라운드의 '새 의존성 0'). 그리고 조합의 나머지는 다른 자리이거나 0건이다: " +
      "PostgreSQL + Prisma는 apps/api/test/db-contract.test.ts가 schema.prisma의 provider 두 줄로 따로 물고, " +
      "NestJS와 Next.js 어드민의 교체를 무는 단언은 오늘 0건이다(어드민 쪽은 '워크스페이스 패키지를 들지 않는다'만 묻는다)."
  },
  "DNC-006": {
    state: "guarded",
    file: "apps/api/test/api-foundation.e2e.test.ts",
    assertion: ['      .get("/api/v1/health")', "      .expect(200)"].join("\n"),
    covers:
      "서버를 실제로 띄워 고정 프리픽스 아래의 경로가 200을 주는지 묻는다 — setGlobalPrefix가 바뀌면 이 줄부터 " +
      "(그리고 /api/v1로 요청하는 api 계약 전부가) 빨개진다. " +
      "⚠️ 조항 뒷문장('OpenAPI 기반 DTO/타입 생성을 유지한다')은 이 단언 밖이다 — 저장소의 계약 타입은 " +
      "packages/contracts가 수기 단일 소스이고 contracts:generate는 스텁이다(CLAUDE.md)."
  },
  "DNC-007": {
    state: "guarded",
    file: "apps/api/test/db-contract.test.ts",
    assertion: '      expect(schema).toContain(`@@map("${tableName}")`);',
    covers:
      "잠긴 도메인 테이블 전수(users · households · household_members · children · expenses · budgets · item_templates · " +
      "child_item_statuses · product_links · affiliate_clicks · import_jobs/import_rows · consents · audit_logs 포함)가 " +
      "schema.prisma에 그 이름으로 살아 있는지를 표에서 돌며 묻는다 — 도메인을 지우면 빨개진다. " +
      "⚠️ '의미 변경'까지는 묻지 않는다(이름과 초기 마이그레이션의 존재까지다)."
  },
  "DNC-008": {
    state: "guarded",
    file: "apps/mobile/src/family/record-permissions.test.ts",
    assertion: [
      '    expect([...VIEW_ONLY_ROLES]).toEqual(["viewer", "gift_participant"]);',
      '    expect([...EXPENSE_EDIT_ROLES]).toEqual(["owner", "co_parent"]);'
    ].join("\n"),
    covers:
      "역할 넷(owner · co_parent · viewer · gift_participant)과 그 권한 원칙(누가 지출을 기록할 수 있는가)을 두 줄로 못 박는다 — " +
      "역할을 더하거나 지우거나 기록 권한을 넓히면 빨개진다. 서버 쪽 같은 판정은 apps/api/test/household-role.guard.test.ts가 문다."
  },
  "DNC-009": {
    state: "guarded",
    file: "packages/domain/src/recommendation.boundary.test.ts",
    assertion: "      expect(calculateRecommendationScore({ ...base, affiliateCommissionRate: rate })).toBe(",
    covers:
      "임의 수수료율 100건(0 · 음수 · 거대값 · 소수 · NaN)을 넣어도 점수가 수수료율을 넣지 않은 기준값과 같음을 속성으로 묻는다 — " +
      "수수료율이 점수에 한 번이라도 유입되면 빨개진다. 가격이 순서에 유입되지 않는 인접 축은 " +
      "apps/api/test/product-link-price-honesty.e2e.test.ts와 apps/api/test/item-ranking.test.ts가 따로 문다."
  },
  "DNC-010": {
    state: "guarded",
    file: "apps/mobile/src/items/link-marker.test.ts",
    assertion: "    expect(productLinksDisclosureText([general, affiliate, general])).toBe(",
    covers:
      "제휴 링크가 하나라도 섞이면 고지 문구가 반드시 나오고, 운영 커스텀 문구를 써도 수수료 문장이 남는지를 묻는다 — " +
      "고지를 숨기면 빨개진다. 고지와 구매 CTA의 인접 순서는 같은 파일의 다른 단언과 " +
      "apps/mobile/src/design-restore-p2b.test.ts가 함께 문다."
  },
  "DNC-011": {
    state: "guarded",
    file: "apps/mobile/src/items/link-marker.test.ts",
    assertion: [
      "    expect(marker.badgeLabel).toBe(SPONSORED_MARKER_LABEL);",
      '    expect(marker.badgeTone).toBe("warning");',
      "    expect(marker.caption).toBe(SPONSORED_MARKER_CAPTION);"
    ].join("\n"),
    covers:
      "스폰서 링크가 경고 톤 배지(시각적 구분)와 광고 고지(표시)를 함께 갖는지를 묻는다 — 스폰서를 일반 추천과 같은 모양으로 " +
      "그리거나 광고 표시를 지우면 빨개진다."
  },
  "DNC-012": {
    state: "guarded",
    file: "apps/api/test/import-excel.e2e.test.ts",
    assertion: "      expect(await prisma.expense.count({ where: { importJobId: uploaded.id } })).toBe(0);",
    covers:
      "업로드 직후·확정 전에 그 잡에서 온 지출이 DB에 0건임을 실 PostgreSQL 위에서 센다 — 승인 전에 expenses에 쓰기 시작하면 " +
      "빨개진다. 취소가 확정이 아니라는 반대 방향도 같은 파일이 묻는다."
  },
  "DNC-013": {
    state: "guarded",
    file: "apps/api/test/db-contract.test.ts",
    assertion: '    expect(migration).toContain("amount_krw integer NOT NULL CHECK (amount_krw > 0)");',
    covers:
      "지출 금액이 '0보다 큰 원화 정수'라는 것을 스키마의 CHECK 제약으로 못 박는다 — 컬럼 타입이나 제약이 풀리면 빨개진다. " +
      "⚠️ 뒷문장(미래 지출 · 다통화 · 자동 환불을 임의로 더하지 않는다) 가운데 미래 날짜는 EXPENSE_FUTURE_DATE 코드 쪽이 묻고, " +
      "다통화·자동 환불은 오늘 부정 단언이 0건이다(금액 컬럼이 원화 정수 하나라는 사실이 그 자리를 대신 지키고 있다)."
  },
  "DNC-014": {
    state: "guarded",
    file: "apps/api/test/expense-home-report.e2e.test.ts",
    assertion: [
      "        expect.objectContaining({",
      "          actorUserId: expect.any(String),",
      "          householdId,",
      '          action: "expense.delete",'
    ].join("\n"),
    covers:
      "지출 삭제가 audit_logs에 expense.delete로 남는지를 실제 삭제 뒤에 묻는다(조항의 '감사 로그' 절반). " +
      "'soft delete' 절반은 같은 라운드의 집계 대조가 문다 — apps/api/test/reporting-hotpath.db.test.ts와 " +
      "apps/api/test/report-trend.e2e.test.ts가 삭제 행이 합계에서 빠지는지를 값으로 고정한다."
  },
  "DNC-015": {
    state: "guarded",
    file: "apps/api/test/expenses-pagination.e2e.test.ts",
    assertion: "    expect(legacyShaped.totalAmountKrw).toBe(30000);",
    covers:
      "선물 50만 원이 목록에는 나오되 총액에는 들어가지 않음을 못 박는다(10,000 + 20,000 = 30,000). " +
      "선물이 합계에 섞이면 빨개진다. 월 추이·홈 누적·예산 경고의 같은 술어는 " +
      "apps/api/test/report-trend.e2e.test.ts와 apps/mobile/src/home/*.test.ts가 각각 문다."
  },
  "DNC-016": {
    state: "unguarded",
    reason:
      "조항이 잠근 것은 범위 밖 여섯(사진/영수증 AI · 커뮤니티 · 가격 추적 · 중고 연동 · 보험/금융 제휴 · 의료 조언)인데, " +
      "그 여섯을 훑는 부정 단언이 0건이다. 저장소 전체에서 이 ID의 인용도 주석 한 줄뿐이다 " +
      "(apps/api/src/worker/jobs/data-retention-purge.job.ts). " +
      "⚠️ 오늘 여섯이 실제로 없다는 것은 사실이다(가격 이력 필드·커뮤니티 라우트·OCR 의존성 전부 0건). " +
      "문제는 없다는 사실을 세는 자리가 없다는 것이다 — 생겨도 조용하다.",
    resumeWhen:
      "여섯 중 하나에 인접한 필드·라우트·의존성이 하나라도 들어오는 날(가격 이력 저장 · 리뷰/댓글 테이블 · OCR/이미지 인식 의존성 · " +
      "중고 플랫폼 연동 키 · 보험 제휴 링크 종별), 또는 부정 스윕의 모집단(무엇을 어디까지 훑을 것인가)이 결정되는 날."
  },
  "DNC-017": {
    state: "guarded",
    file: "packages/test-utils/src/store-brand-and-asset-provenance.test.ts",
    assertion: "    expect(dncRow).toContain(`Primary \\`${tokens.locked.primary}\\``);",
    covers:
      "docs/dev/do-not-change.md의 DNC-017 행을 실제로 읽어, 잠근 토큰 셋이 브랜드 값 파일·apps/mobile/src/theme.ts와 " +
      "글자 단위로 같은지를 대조한다 — 저장소 스무 줄 가운데 문서 본문을 읽어 조항을 지키는 유일한 계약이다. " +
      "⚠️ 무접촉 대상이다(이 트랙은 이 파일을 읽기만 했다)."
  },
  "DNC-018": {
    state: "guarded",
    file: "apps/mobile/src/api/api-error.test.ts",
    assertion: "      expect(message, code).toMatch(/[요]\\.$/);",
    covers:
      "API 오류 문구 표 전수를 돌며 해요체로 끝나는지를 묻고, 같은 테스트가 사용자를 탓하는 표현 다섯을 부정으로 훑는다 — " +
      "표에 문구가 늘 때마다 모집단이 함께 는다. " +
      "⚠️ 무는 것은 이 표다: 저장/예산/제휴/빈화면 문구의 톤은 각 화면 계약이 자리마다 따로 문다(해요체 단언이 선 파일이 오늘 스무 곳 남짓)."
  },
  "DNC-019": {
    state: "unguarded",
    reason:
      "조항이 잠근 것은 코드/seed/test에 하드코딩된 실제 비밀값(OAuth secret · 제휴 ID · 운영 DB URL)인데, " +
      "저장소를 그 모양으로 훑는 스윕이 0건이다. 이웃 넷은 전부 다른 축이다: " +
      "apps/api/test/require-secret.test.ts(운영에서 기본값으로 뜨지 않는가) · " +
      "scripts/check-env.ts(.env.example과 카탈로그의 키 이름 두 방향) · " +
      "apps/mobile/src/settings/support-links.test.ts(문서에 하드코딩된 주소·이메일) · " +
      "apps/mobile/src/android-release-aab.test.ts(거부 메시지에 env 값이 실리지 않는가 — ⚠️ 그나마도 무는 것이 " +
      "'주석 한 줄이 실재하는가'라 이 대장의 판정 기준으로는 가드가 아니다).",
    resumeWhen:
      "실제 제휴 ID·OAuth secret·운영 DB URL이 저장소에 한 번이라도 들어오는 날, 또는 스윕의 모양이 결정되는 날 — " +
      "무엇을 비밀값으로 볼 것인가와 테스트 픽스처의 가짜 값(kakao-secret · test-access-secret 등)을 어떻게 가를 것인가가 " +
      "그 결정이고, 그 둘을 정하지 않은 스윕은 첫날부터 면제 목록으로 산다."
  },
  "DNC-020": {
    state: "guarded",
    file: "apps/mobile/src/items/item-trust-notes.test.ts",
    assertion:
      "    expect(MEDICAL_DISCLAIMER_TITLE + MEDICAL_DISCLAIMER_BODY).not.toMatch(/효과|치료|예방|좋아요|필요해요/);",
    covers:
      "의료 고지 문구가 진단·치료·효능을 단정하지 않고 상담으로만 연결하는지를 부정으로 묻는다 — 효능 단어가 들어오면 빨개진다. " +
      "⚠️ 무는 것은 이 문구 한 쌍이다: 시드의 영양제·의료용품 준비템 제목은 오늘 주석만 있고 단언이 0건이다 " +
      "(apps/api/prisma/seed-data.ts) — 그 자리는 DNC-016의 부정 스윕과 같은 축이라 함께 결정된다."
  }
};

/**
 * 래칫 상한 — **오늘 실측값 셋**(DNC-001 · DNC-016 · DNC-019)이다.
 *
 * ⚠️ 정찰이 적어 준 값이 아니다. 정찰은 인용 수로 둘을 셌고, 이 트랙이 단언으로 다시 재어 셋이
 * 됐다(위 머리말의 "정찰과 갈린 자리 둘" 참고). 가드가 하나 서면 이 줄을 함께 내린다 — 내리지
 * 않으면 다음 사람이 "셋까지는 비어도 된다"로 읽는다.
 */
export const UNGUARDED_RULE_MAX = 3;

/** 오늘 *"가드 없음"* 인 조항 — 대장에서 **파생한다**(손으로 세지 않는다). */
export function unguardedRuleIds(): string[] {
  return Object.entries(DNC_GUARD_LEDGER)
    .filter(([, entry]) => entry.state === "unguarded")
    .map(([id]) => id)
    .sort();
}

/** 오늘 가드가 선 조항 — 같은 방식으로 파생한다. */
export function guardedRuleIds(): string[] {
  return Object.entries(DNC_GUARD_LEDGER)
    .filter(([, entry]) => entry.state === "guarded")
    .map(([id]) => id)
    .sort();
}
