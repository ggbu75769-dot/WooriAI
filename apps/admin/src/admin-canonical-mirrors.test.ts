import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  ANALYTICS_EVENT_LABELS,
  ANALYTICS_EVENT_NAMES,
  CHILD_STAGE_CODES,
  CHILD_STAGE_LABELS,
  CLICK_SUMMARY_DAYS_OPTIONS,
  LINK_HEALTH_LABELS,
  NECESSITY_LEVELS,
  NECESSITY_LEVEL_LABELS,
  PRODUCT_PLATFORMS,
  PRODUCT_PLATFORM_LABELS
} from "./lib/admin-api";

/**
 * GAP-075 #5 — **어드민 손 미러의 대조 계약**.
 *
 * 라운드 60 리뷰 P2-8이 옳은 관례와 그 이유를 이미 적어 두었다(`app/analytics/page.tsx`의
 * `ONBOARDING_STEPS` 위 주석): 이 워크스페이스(apps/admin)는 `@wooriai/contracts`도
 * `@wooriai/domain`도 의존성으로 들지 않으므로 목록을 **손으로 미러**하고, 그 대신
 * **대조 테스트**가 정본 파일을 읽어 리터럴과 순서를 고정한다. 갈리는 순간 테스트가 깨지고
 * 고칠 곳은 사본 하나다.
 *
 * ⚠️ 문제는 그 관례가 적용된 미러가 **여덟(오늘 아홉) 중 하나뿐**이었다는 것이다. 나머지는
 * "지금 틀렸다"가 아니라 **"틀려도 조용하다"** 였다 — 도메인에 스테이지 코드가 하나 늘면
 * 서버·모바일은 import라 함께 자라지만 어드민만 자라지 않고, 준비템 편집 화면이 계속
 * **아홉 개짜리 세계**를 그린다(아무 테스트도 빨개지지 않는다). 이 파일이 그 침묵을 없앤다.
 *
 * **이 계약은 값을 바꾸지 않는다.** 2026-08-30 실측으로 사본은 전부 정본과 같다 — 여기서
 * 하는 일은 그 사실을 **묶어 두는 것**뿐이다.
 *
 * 정본은 **소스 텍스트로 읽어 파싱한다**(import가 아니다 — 위 P2-8의 근거 그대로).
 * 라운드 60 P2-8이 `ONBOARDING_STEPS`에서 쓴 방법, `apps/api/test/mobile-stage-band-contract.test.ts`가
 * 두 밴드 표에서 쓴 방법과 같다.
 */

const adminRoot = process.cwd();
const repoRoot = join(adminRoot, "..", "..");

function readAdminSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `apps/admin/${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readRepoSource(relativePath: string): string {
  const filePath = join(repoRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ---------------------------------------------------------------------------
// 정본 파서. 전부 "선언을 정규식으로 찾아 그 블록의 리터럴을 순서대로 뽑는다" 한 가지 모양이고,
// 선언을 못 찾으면 조용히 빈 배열을 돌려주는 대신 **테스트가 실패한다**(사각을 만들지 않는다).
// ---------------------------------------------------------------------------

/** `export const NAME = [...] as const;` 꼴 정본 목록의 문자열 리터럴(순서 보존). */
function parseAsConstStringList(source: string, name: string, where: string): string[] {
  const block = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source)?.[1];
  expect(block, `${where}에서 ${name} 선언을 찾지 못했어요`).toBeTruthy();
  const literals = [...block!.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  expect(literals.length, `${where}의 ${name}이(가) 비어 있어요`).toBeGreaterThan(0);
  return literals;
}

/** `export const NAME = [...] as const;` 꼴 정본 목록의 숫자 리터럴(순서 보존). */
function parseAsConstNumberList(source: string, name: string, where: string): number[] {
  const block = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source)?.[1];
  expect(block, `${where}에서 ${name} 선언을 찾지 못했어요`).toBeTruthy();
  const literals = [...block!.matchAll(/-?\d+(?:_\d+)*/g)].map((match) => Number(match[0].replace(/_/g, "")));
  expect(literals.length, `${where}의 ${name}이(가) 비어 있어요`).toBeGreaterThan(0);
  return literals;
}

/** `export type NAME = "a" | "b" | "c";` 꼴 유니온의 문자열 리터럴(순서 보존). 여러 줄 허용. */
function parseTypeUnionLiterals(source: string, typeName: string, where: string): string[] {
  const block = new RegExp(`export type ${typeName} =([^;]*);`).exec(source)?.[1];
  expect(block, `${where}에서 type ${typeName} 선언을 찾지 못했어요`).toBeTruthy();
  const literals = [...block!.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  expect(literals.length, `${where}의 ${typeName}이(가) 문자열 유니온이 아니에요`).toBeGreaterThan(0);
  return literals;
}

/** Prisma `enum NAME { ... }` 멤버(선언 순서 보존, `@@map` 같은 속성 줄은 뺀다). */
function parsePrismaEnum(source: string, enumName: string): string[] {
  const block = new RegExp(`enum ${enumName} \\{([^}]*)\\}`).exec(source)?.[1];
  expect(block, `schema.prisma에서 enum ${enumName}을(를) 찾지 못했어요`).toBeTruthy();
  const members = block!
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z][a-z0-9_]*$/.test(line));
  expect(members.length, `enum ${enumName}이(가) 비어 있어요`).toBeGreaterThan(0);
  return members;
}

/** `Record<..., string>` 리터럴 표의 키(선언 순서 보존). 주석 줄은 키가 아니다. */
function parseRecordKeys(source: string, declaration: string, where: string): string[] {
  const block = source.split(declaration)[1]?.split("\n};")[0];
  expect(block, `${where}에서 ${declaration} 선언을 찾지 못했어요`).toBeTruthy();
  const keys = [...block!.matchAll(/^\s{2}([a-z][a-z0-9_]*):/gm)].map((match) => match[1]);
  expect(keys.length, `${where}의 ${declaration} 표가 비어 있어요`).toBeGreaterThan(0);
  return keys;
}

/** 계약 레지스트리의 이벤트 이름(등록 순서 = 어드민 응답 `byName`의 순서). */
function parseRegistryEventNames(): string[] {
  const source = readRepoSource("packages/contracts/src/analytics.ts");
  const block = /export const analyticsEventRegistry: readonly AnalyticsEventRegistryEntry\[\] = \[([\s\S]*?)\n\];/.exec(
    source
  )?.[1];
  expect(block, "packages/contracts/src/analytics.ts에서 analyticsEventRegistry를 찾지 못했어요").toBeTruthy();
  const names = [...block!.matchAll(/eventName: "([a-z_]+)"/g)].map((match) => match[1]);
  expect(names.length, "analyticsEventRegistry가 비어 있어요").toBeGreaterThan(0);
  return names;
}

// ---------------------------------------------------------------------------
// 미러 대장(臺帳). ⓓ의 전수 단언이 이 목록과 `admin-api.ts`의 실제 상수 표를 대조하므로,
// **새 미러가 대조 없이 생기면 통과하지 못한다**(라운드 74 O-4: 종결은 그 종결을 세는 목록이
// 그것을 세고 있을 때만 종결이다).
// ---------------------------------------------------------------------------

type MirrorEntry = {
  /** 사본 이름(상수·타입 선언 이름). */
  name: string;
  /** 사본이 사는 파일(어드민 워크스페이스 기준). */
  copy: string;
  /** 정본 — 파일과 그 안의 선언 이름. */
  canonical: string;
  /** `codes` = 리터럴과 순서까지 고정 · `labels` = 키 집합만(문구는 어드민의 것, 아래 판정 참고). */
  kind: "codes" | "labels";
  /** 이 미러를 실제로 고정하는 단언이 사는 곳. 빈 문자열 금지. */
  pinnedBy: string;
};

/**
 * ⚠️ **어드민의 한국어 라벨은 앱의 것과 일부러 다르다.** 예: 어드민 `"신생아 (0~3개월)"` vs
 * 도메인 `MANUAL_STAGE_LABELS`의 `"0~3개월"`. 운영자 표는 **코드가 무엇인지**를 함께 말해야
 * 하고(스테이지 코드를 골라 준비템을 배정하는 화면이다), 앱은 사용자에게 시기만 말한다.
 * 그러니 라벨 표는 **문자열이 아니라 키 집합**을 묻는다 — 면제가 아니라 **판정**이다.
 */
const LABEL_TABLE_VERDICT =
  "라벨 표는 키 집합만 대조한다 — 어드민 문구는 운영자용이라 앱/도메인의 문구와 의도적으로 다르다";

/**
 * ⚠️ **어드민이 정본 패키지를 import하지 못하는 이유**(라운드 60 P2-8, 오늘도 성립):
 * 어드민은 REST 응답만 읽는 Next 앱이고 `@wooriai/contracts`를 끌어오면 그 트랜지티브
 * 의존성(zod 등)이 어드민 번들로 따라 들어온다. `@wooriai/domain`은 `main`이 raw TS라
 * Next에서 쓰려면 `transpilePackages` — **빌드 설정 변경**이라 별도 결정이다(P3).
 * 그래서 이 계약이 손 미러 + 소스 파싱이라는 모양을 취한다.
 */
const NO_WORKSPACE_DEPENDENCY_VERDICT =
  "어드민은 @wooriai/contracts·@wooriai/domain을 의존성으로 들지 않는다 — 번들 트랜지티브 의존성 + transpilePackages(빌드 설정 변경, 별도 결정)";

const MIRRORS: MirrorEntry[] = [
  {
    name: "NECESSITY_LEVELS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts NECESSITY_LEVELS",
    kind: "codes",
    pinnedBy: "NECESSITY_LEVELS mirrors the domain enum"
  },
  {
    name: "NECESSITY_LEVEL_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts NECESSITY_LEVELS (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "CHILD_STAGE_CODES",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts CHILD_STAGE_CODES",
    kind: "codes",
    pinnedBy: "CHILD_STAGE_CODES mirrors the domain enum"
  },
  {
    name: "CHILD_STAGE_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts CHILD_STAGE_CODES (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "PRODUCT_PLATFORMS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts PRODUCT_PLATFORMS",
    kind: "codes",
    pinnedBy: "PRODUCT_PLATFORMS mirrors the domain enum"
  },
  {
    name: "PRODUCT_PLATFORM_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/domain/src/enums.ts PRODUCT_PLATFORMS (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "LINK_HEALTH_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "apps/api/src/worker/jobs/link-health.job.ts LinkHealthStatus (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "CLICK_SUMMARY_DAYS_OPTIONS",
    copy: "src/lib/admin-api.ts",
    canonical: "apps/api/src/admin/affiliate-click-breakdown.service.ts CLICK_BREAKDOWN_WINDOWS",
    kind: "codes",
    pinnedBy: "CLICK_SUMMARY_DAYS_OPTIONS mirrors the server's click-breakdown windows"
  },
  {
    name: "ANALYTICS_EVENT_NAMES",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/contracts/src/analytics.ts analyticsEventRegistry (앞부분 + 페이지 라벨 표와의 합집합)",
    kind: "codes",
    pinnedBy: "이벤트 이름의 6 + 4 합집합이 레지스트리 전부와 정확히 같다"
  },
  {
    name: "ANALYTICS_EVENT_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "packages/contracts/src/analytics.ts analyticsEventRegistry (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "ADMIN_ROLES",
    copy: "src/lib/admin-api.ts",
    canonical: "apps/api/prisma/schema.prisma enum AdminRole",
    kind: "codes",
    pinnedBy: "ADMIN_ROLES mirrors the Prisma AdminRole enum"
  },
  {
    name: "ADMIN_ROLE_LABELS",
    copy: "src/lib/admin-api.ts",
    canonical: "apps/api/prisma/schema.prisma enum AdminRole (키 집합만)",
    kind: "labels",
    pinnedBy: "라벨 표의 키 집합이 정본 코드 집합과 같다"
  },
  {
    name: "LinkHealthStatus",
    copy: "src/lib/admin-api.ts (type)",
    canonical: "apps/api/src/worker/jobs/link-health.job.ts LinkHealthStatus",
    kind: "codes",
    pinnedBy: "LinkHealthStatus mirrors the worker verdict union"
  },
  {
    name: "ChildStageCode",
    copy: "src/lib/admin-api.ts (type)",
    canonical: "packages/domain/src/enums.ts CHILD_STAGE_CODES",
    kind: "codes",
    pinnedBy: "CHILD_STAGE_CODES mirrors the domain enum"
  },
  {
    name: "ANA127_EVENT_LABELS",
    copy: "app/analytics/page.tsx",
    canonical: "packages/contracts/src/analytics.ts analyticsEventRegistry (합집합의 나머지)",
    kind: "labels",
    pinnedBy: "이벤트 이름의 6 + 4 합집합이 레지스트리 전부와 정확히 같다"
  },
  {
    // 라운드 60 P2-8의 **본보기**. 그 대조 테스트는 무변경이고, 이 대장은 그 자리를 세기만 한다.
    name: "ONBOARDING_STEPS",
    copy: "app/analytics/page.tsx",
    canonical: "packages/contracts/src/analytics.ts ONBOARDING_STEPS",
    kind: "codes",
    pinnedBy: "src/admin-analytics.test.ts (keeps the ONBOARDING_STEPS mirror ... 대조 테스트)"
  }
];

/** `admin-api.ts`에서 `X[]`/`Record<X, ...>` 꼴 상수 표 이름을 긁는다(ⓓ 전수 단언의 눈). */
function scrapeAdminApiConstantTables(source: string): string[] {
  return [...source.matchAll(/^export const ([A-Z][A-Z0-9_]*)\s*:\s*([^=\n]+?)\s*=\s*[[{]/gm)]
    .filter((match) => /\[\]$/.test(match[2]) || /^Record</.test(match[2]))
    .map((match) => match[1]);
}

describe("어드민 손 미러의 대조 계약 (GAP-075 #5)", () => {
  describe("정본이 도메인 enum인 미러 — 리터럴과 순서", () => {
    const domainEnums = () => readRepoSource("packages/domain/src/enums.ts");

    it("NECESSITY_LEVELS mirrors the domain enum", () => {
      const canonical = parseAsConstStringList(domainEnums(), "NECESSITY_LEVELS", "packages/domain/src/enums.ts");
      expect(
        NECESSITY_LEVELS,
        `어드민의 NECESSITY_LEVELS(${NECESSITY_LEVELS.join(", ")})가 정본(${canonical.join(", ")})과 달라요`
      ).toEqual(canonical);
    });

    it("CHILD_STAGE_CODES mirrors the domain enum", () => {
      const canonical = parseAsConstStringList(domainEnums(), "CHILD_STAGE_CODES", "packages/domain/src/enums.ts");
      expect(
        CHILD_STAGE_CODES,
        `어드민의 CHILD_STAGE_CODES(${CHILD_STAGE_CODES.length}개)가 정본(${canonical.length}개)과 달라요`
      ).toEqual(canonical);

      // 타입 유니온도 같은 집합이다 — 상수만 자라고 타입이 안 자라면 편집 화면이 새 코드를
      // 값으로는 그리면서 타입으로는 모르는 상태가 된다.
      const mirroredType = parseTypeUnionLiterals(
        readAdminSource("src/lib/admin-api.ts"),
        "ChildStageCode",
        "apps/admin/src/lib/admin-api.ts"
      );
      expect(mirroredType).toEqual(canonical);
    });

    it("PRODUCT_PLATFORMS mirrors the domain enum", () => {
      const canonical = parseAsConstStringList(domainEnums(), "PRODUCT_PLATFORMS", "packages/domain/src/enums.ts");
      expect(
        PRODUCT_PLATFORMS,
        `어드민의 PRODUCT_PLATFORMS(${PRODUCT_PLATFORMS.join(", ")})가 정본(${canonical.join(", ")})과 달라요`
      ).toEqual(canonical);
    });
  });

  describe("정본이 서버 코드인 미러 — 리터럴과 순서", () => {
    it("LinkHealthStatus mirrors the worker verdict union", () => {
      // COM-105: 판정은 워커 잡이 product_links.health_status에 쓰는 값이고, NULL(=미확인)은
      // 그 유니온 밖이다 — 그래서 어드민의 LINK_HEALTH_UNKNOWN_LABEL은 표의 키가 아니다.
      const canonical = parseTypeUnionLiterals(
        readRepoSource("apps/api/src/worker/jobs/link-health.job.ts"),
        "LinkHealthStatus",
        "apps/api/src/worker/jobs/link-health.job.ts"
      );
      const mirrored = parseTypeUnionLiterals(
        readAdminSource("src/lib/admin-api.ts"),
        "LinkHealthStatus",
        "apps/admin/src/lib/admin-api.ts"
      );
      expect(
        mirrored,
        `어드민의 LinkHealthStatus(${mirrored.join(", ")})가 정본(${canonical.join(", ")})과 달라요`
      ).toEqual(canonical);
      expect(Object.keys(LINK_HEALTH_LABELS)).toEqual(canonical);
    });

    it("ADMIN_ROLES mirrors the Prisma AdminRole enum", () => {
      const canonical = parsePrismaEnum(readRepoSource("apps/api/prisma/schema.prisma"), "AdminRole");
      expect(
        ADMIN_ROLES,
        `어드민의 ADMIN_ROLES(${ADMIN_ROLES.join(", ")})가 정본(${canonical.join(", ")})과 달라요`
      ).toEqual(canonical);
    });

    it("CLICK_SUMMARY_DAYS_OPTIONS mirrors the server's click-breakdown windows", () => {
      // ⚠️ 이 미러는 라운드 75 정찰의 **여덟 목록에 없었다** — 아래 ⓓ 전수 단언(상수 표 스크레이프)이
      // 찾아냈다. 계약이 자기 일을 한 자리이고, 값은 한 글자도 바뀌지 않았다.
      const canonical = parseAsConstNumberList(
        readRepoSource("apps/api/src/admin/affiliate-click-breakdown.service.ts"),
        "CLICK_BREAKDOWN_WINDOWS",
        "apps/api/src/admin/affiliate-click-breakdown.service.ts"
      );
      expect(
        CLICK_SUMMARY_DAYS_OPTIONS,
        `어드민의 조회 창(${CLICK_SUMMARY_DAYS_OPTIONS.join(", ")})이 서버가 받는 창(${canonical.join(", ")})과 달라요`
      ).toEqual(canonical);
    });
  });

  /**
   * ⓑ 라벨 표는 **키 집합만** 묻는다. 이유는 위 LABEL_TABLE_VERDICT — 면제가 아니라 판정이다.
   * 순서를 묻지 않는 것도 같은 이유다(운영자 표의 정렬은 화면이 정하고, 키 집합이 갈리는 순간만
   * 화면이 거짓말을 한다).
   */
  describe("라벨 표 — 키 집합만 (문자열은 묻지 않는다)", () => {
    it("어드민 라벨이 앱/도메인과 다른 이유를 값으로 적어 둔다", () => {
      expect(LABEL_TABLE_VERDICT.length).toBeGreaterThan(0);

      // 그 다름은 오늘 실재한다 — 판정이 추상론이 아니라는 증거를 값으로 남긴다.
      const stageSource = readRepoSource("packages/domain/src/stage.ts");
      const domainStageLabels = stageSource
        .split("const MANUAL_STAGE_LABELS: Record<ChildStageCode, string> = {")[1]
        ?.split("\n};")[0];
      expect(domainStageLabels, "packages/domain/src/stage.ts의 MANUAL_STAGE_LABELS를 찾지 못했어요").toBeTruthy();
      const newbornDomainLabel = /newborn_0_3: "([^"]+)"/.exec(domainStageLabels!)?.[1];
      expect(newbornDomainLabel).toBeTruthy();
      expect(CHILD_STAGE_LABELS.newborn_0_3).not.toBe(newbornDomainLabel);
      expect(CHILD_STAGE_LABELS.newborn_0_3).toContain(newbornDomainLabel!);
    });

    it("라벨 표의 키 집합이 정본 코드 집합과 같다", () => {
      const domainEnums = readRepoSource("packages/domain/src/enums.ts");
      const adminRoles = parsePrismaEnum(readRepoSource("apps/api/prisma/schema.prisma"), "AdminRole");
      const linkHealth = parseTypeUnionLiterals(
        readRepoSource("apps/api/src/worker/jobs/link-health.job.ts"),
        "LinkHealthStatus",
        "apps/api/src/worker/jobs/link-health.job.ts"
      );

      const cases: { name: string; table: Record<string, string>; canonical: string[] }[] = [
        {
          name: "NECESSITY_LEVEL_LABELS",
          table: NECESSITY_LEVEL_LABELS,
          canonical: parseAsConstStringList(domainEnums, "NECESSITY_LEVELS", "packages/domain/src/enums.ts")
        },
        {
          name: "CHILD_STAGE_LABELS",
          table: CHILD_STAGE_LABELS,
          canonical: parseAsConstStringList(domainEnums, "CHILD_STAGE_CODES", "packages/domain/src/enums.ts")
        },
        {
          name: "PRODUCT_PLATFORM_LABELS",
          table: PRODUCT_PLATFORM_LABELS,
          canonical: parseAsConstStringList(domainEnums, "PRODUCT_PLATFORMS", "packages/domain/src/enums.ts")
        },
        { name: "LINK_HEALTH_LABELS", table: LINK_HEALTH_LABELS, canonical: linkHealth },
        { name: "ADMIN_ROLE_LABELS", table: ADMIN_ROLE_LABELS, canonical: adminRoles },
        {
          // 이 표는 레지스트리 **전부**가 아니라 어드민이 든 앞부분만 라벨한다 — 나머지 넷의
          // 라벨은 화면의 ANA127_EVENT_LABELS가 지고, 그 합집합은 아래 이벤트 절이 센다.
          // 그래서 여기서의 정본은 ANALYTICS_EVENT_NAMES이고, 그 목록이 레지스트리와 같은지는
          // 아래 "앞부분 여섯은 레지스트리 순서 그대로다"가 진다(사본이 사본을 지키지 않는다).
          name: "ANALYTICS_EVENT_LABELS",
          table: ANALYTICS_EVENT_LABELS,
          canonical: [...ANALYTICS_EVENT_NAMES]
        }
      ];

      for (const { name, table, canonical } of cases) {
        const keys = Object.keys(table);
        expect([...keys].sort(), `${name}의 키 집합이 정본과 달라요 (${LABEL_TABLE_VERDICT})`).toEqual(
          [...canonical].sort()
        );
        // 빈 문구 0건 — 라벨이 없으면 운영자 표에 영문 코드/이벤트 이름이 그대로 뜬다.
        for (const key of keys) {
          expect(table[key].trim(), `${name}.${key}의 한국어 라벨이 비어 있어요`).not.toBe("");
        }
      }
    });
  });

  /**
   * ⓒ 이벤트 이름은 **합집합**으로 묻는다. 오늘 레지스트리는 열이고 어드민은 그것을
   * `admin-api.ts`의 여섯 + `app/analytics/page.tsx`의 넷으로 **쪼개 들고 있다** — 지금까지는
   * 어느 쪽도 정본을 읽지 않아 **사본이 사본을 지키고** 있었다.
   *
   * ⚠️ **6 + 4 분리 자체는 유지한다.** 앞 여섯은 0건이어도 항상 표에 서고 나머지는 응답의
   * `byName`으로 들어온다는 렌더 규칙은 라운드 60·39가 세운 자리다. 바뀌는 것은 **그 둘의 합이
   * 무엇과 같아야 하는가**뿐이다.
   */
  describe("이벤트 이름 — 6 + 4의 합집합이 레지스트리 열과 같다", () => {
    const ana127Keys = (): string[] =>
      parseRecordKeys(
        readAdminSource("app/analytics/page.tsx"),
        "const ANA127_EVENT_LABELS: Record<string, string> = {",
        "apps/admin/app/analytics/page.tsx"
      );

    it("이벤트 이름의 6 + 4 합집합이 레지스트리 전부와 정확히 같다", () => {
      const registryNames = parseRegistryEventNames();
      const mirrored = [...ANALYTICS_EVENT_NAMES];
      const laterLabels = ana127Keys();

      // 두 표는 겹치지 않는다 — 겹치면 같은 이름이 표에 두 줄로 선다.
      expect(mirrored.filter((name) => laterLabels.includes(name))).toEqual([]);

      const union = [...mirrored, ...laterLabels];
      expect(
        [...union].sort(),
        `어드민이 든 이벤트 이름(${union.length}개)이 레지스트리(${registryNames.length}개)와 달라요`
      ).toEqual([...registryNames].sort());

      // 부정 단언 둘. 숫자를 손으로 적지 않는다 — 양쪽 다 파일이 세는 값이다.
      const unlabelled = registryNames.filter((name) => !union.includes(name));
      expect(unlabelled, `라벨 없는 레지스트리 이름이 있어요: ${unlabelled.join(", ")}`).toEqual([]);
      const ghosts = union.filter((name) => !registryNames.includes(name));
      expect(ghosts, `레지스트리에 없는 유령 라벨이 있어요: ${ghosts.join(", ")}`).toEqual([]);
    });

    it("앞부분 여섯은 레지스트리 순서 그대로다 (6 + 4 렌더 규칙의 근거)", () => {
      const registryNames = parseRegistryEventNames();
      expect(ANALYTICS_EVENT_NAMES.length).toBeGreaterThan(0);
      expect(
        ANALYTICS_EVENT_NAMES,
        "admin-api.ts의 미러가 레지스트리 앞부분과 순서까지 같아야 해요 (append-only 규칙)"
      ).toEqual(registryNames.slice(0, ANALYTICS_EVENT_NAMES.length));
      // 나머지는 레지스트리의 **뒤쪽**이다 — append-only 규칙이 깨지면 여기서 걸린다.
      expect([...ana127Keys()].sort()).toEqual([...registryNames.slice(ANALYTICS_EVENT_NAMES.length)].sort());
    });

    it("화면의 6 + 4 분리 규칙은 그대로다 (렌더 무변경)", () => {
      const source = readAdminSource("app/analytics/page.tsx");
      // 앞 여섯은 0건이어도 항상 서고(zero-fill), 나머지는 byName에서 뒤에 붙는다.
      expect(source).toContain("summary.byName.find((entry) => entry.name === name) ?? { name, count: 0 }");
      expect(source).toContain("summary.byName.filter((entry) => !(ANALYTICS_EVENT_NAMES as string[]).includes(entry.name))");
      expect(source).toContain("ANA127_EVENT_LABELS");
    });
  });

  /**
   * ⓓ **전수 단언.** 위 대장이 미러를 다 세고 있는가. `admin-api.ts`의 `X[]`/`Record<X, ...>` 꼴
   * 상수 표를 긁어 대장과 대조하므로, **대조 없이 새 미러를 더하면 여기서 걸린다.**
   */
  describe("미러 대장이 전수다", () => {
    it("admin-api.ts의 상수 표가 하나도 빠짐없이 대장에 있다", () => {
      const scraped = scrapeAdminApiConstantTables(readAdminSource("src/lib/admin-api.ts"));
      expect(scraped.length).toBeGreaterThan(0);

      const ledger = MIRRORS.filter((entry) => entry.copy === "src/lib/admin-api.ts").map((entry) => entry.name);
      const missing = scraped.filter((name) => !ledger.includes(name));
      expect(
        missing,
        `admin-api.ts의 상수 표 ${missing.join(", ")}이(가) 미러 대장에 없어요 — 정본을 적고 대조 단언을 더하세요`
      ).toEqual([]);
      const stale = ledger.filter((name) => !scraped.includes(name));
      expect(stale, `대장에만 있고 admin-api.ts에는 없는 이름: ${stale.join(", ")}`).toEqual([]);
    });

    it("대장의 모든 항목이 정본과 고정 자리를 이름으로 적는다 (빈 문자열 0건)", () => {
      expect(MIRRORS.length).toBeGreaterThan(0);
      expect(new Set(MIRRORS.map((entry) => `${entry.copy}:${entry.name}`)).size).toBe(MIRRORS.length);
      for (const entry of MIRRORS) {
        expect(entry.canonical.trim(), `${entry.name}의 정본이 비어 있어요`).not.toBe("");
        expect(entry.pinnedBy.trim(), `${entry.name}을(를) 고정하는 자리가 비어 있어요`).not.toBe("");
        // 정본 파일이 실제로 있는가 — 경로가 낡으면 대장이 거짓말을 한다.
        const canonicalFile = entry.canonical.split(" ")[0];
        expect(
          existsSync(join(repoRoot, ...canonicalFile.split("/"))),
          `${entry.name}의 정본 파일 ${canonicalFile}이(가) 없어요`
        ).toBe(true);
      }
    });

    it("본보기(ONBOARDING_STEPS)의 기존 대조 테스트는 그대로 살아 있다", () => {
      // 라운드 60 P2-8이 세운 자리. 이 트랙은 그것을 **베끼지 않고 가리킨다** — 같은 대조를 두
      // 파일에 적으면 그것이야말로 사본이 사본을 낳는 모양이다.
      const analyticsTest = readAdminSource("src/admin-analytics.test.ts");
      expect(analyticsTest).toContain("keeps the ONBOARDING_STEPS mirror (literals + order) in sync");
      expect(MIRRORS.some((entry) => entry.name === "ONBOARDING_STEPS")).toBe(true);
    });
  });

  /**
   * 왜 import가 아닌가를 **값으로** 적어 둔다. 이 판정이 바뀌면(어드민이 워크스페이스 패키지를
   * 들게 되면) 이 파일 전체가 소스 파싱을 그만두고 import로 바뀌어야 한다 — 그 신호를 여기서 잡는다.
   */
  describe("왜 import가 아니라 손 미러인가 (판정)", () => {
    it("어드민 package.json은 워크스페이스 패키지를 의존성으로 들지 않는다", () => {
      expect(NO_WORKSPACE_DEPENDENCY_VERDICT.length).toBeGreaterThan(0);
      const pkg = JSON.parse(readAdminSource("package.json")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      const workspacePackages = declared.filter((name) => name.startsWith("@wooriai/"));
      expect(workspacePackages, `${NO_WORKSPACE_DEPENDENCY_VERDICT} — 그런데 ${workspacePackages.join(", ")}이(가) 들어왔어요`).toEqual(
        []
      );
    });

    it("어드민 소스가 워크스페이스 패키지를 import하지 않는다", () => {
      for (const file of ["src/lib/admin-api.ts", "app/analytics/page.tsx"]) {
        expect(readAdminSource(file), `${file}이(가) 워크스페이스 패키지를 import해요`).not.toMatch(
          /from ["']@wooriai\//
        );
      }
    });
  });
});
