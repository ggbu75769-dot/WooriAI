import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPENSE_LIST_MAX_LIMIT, TREND_REPORT_DEFAULT_MONTHS } from "./client";
import { LINK_PRICE_MAX_AGE_DAYS } from "../items/link-price";

const contractsSchemasSource = () =>
  readFileSync(join(process.cwd(), "..", "..", "packages", "contracts", "src", "schemas.ts"), "utf8");

/**
 * R25 리뷰 후속: 모바일은 packages/contracts를 import하지 않고 수기로 미러한다
 * (known-limitations §D). REC-124(H1)/CSV-124 이후 기록 탭·홈·CSV의 모든 목록 요청이
 * `limit=EXPENSE_LIST_MAX_LIMIT`를 명시하므로, 서버가 상한을 낮추면(@Max 위반 → 400)
 * 세 화면이 동시에 죽는다. 두 값이 갈라지는 순간을 커밋 시점에 잡는 드리프트 가드다 —
 * manage-children-flow.test.ts 등 기존 수기 미러 계약 테스트와 같은 관례.
 */
describe("contracts 수기 미러 드리프트 가드 — 상수 셋과 ImportJob.childId", () => {
  it("EXPENSE_LIST_MAX_LIMIT이 packages/contracts의 값과 같다", () => {
    const match = contractsSchemasSource().match(/export const EXPENSE_LIST_MAX_LIMIT = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(EXPENSE_LIST_MAX_LIMIT);
  });

  /**
   * REP-128: 리포트 월간 탭이 요청하는 추이 개월 수도 같은 수기 미러다. 서버 상한
   * (TREND_REPORT_MAX_MONTHS)을 넘으면 @Max 위반 → 400이라 추이 차트가 통째로 죽으므로,
   * 기본값이 상한 안에 있는지까지 함께 못 박는다.
   */
  it("TREND_REPORT_DEFAULT_MONTHS가 packages/contracts의 값과 같고 서버 상한 안에 있다", () => {
    const source = contractsSchemasSource();
    const defaultMatch = source.match(/export const TREND_REPORT_DEFAULT_MONTHS = (\d+);/);
    const maxMatch = source.match(/export const TREND_REPORT_MAX_MONTHS = (\d+);/);
    expect(defaultMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    expect(Number(defaultMatch![1])).toBe(TREND_REPORT_DEFAULT_MONTHS);
    expect(TREND_REPORT_DEFAULT_MONTHS).toBeGreaterThanOrEqual(1);
    expect(TREND_REPORT_DEFAULT_MONTHS).toBeLessThanOrEqual(Number(maxMatch![1]));
  });

  /**
   * 라운드 64 M-2 — 가격 스냅샷 만료 문턱도 같은 수기 미러다(계약과 모바일 두 벌).
   *
   * 두 값이 갈라지면 조용히 틀린다: 어드민 표의 "만료" 배지는 **서버가 계약 상수로** 판정한
   * `priceExpired`를 그리고, 앱은 자기 상수로 그릴지 말지를 정한다. 문턱이 어긋나는 순간
   * 어드민은 "앱에 보인다"고 말하는데 앱은 안 그리는(혹은 그 반대) 상태가 되고, 그 표가
   * 드러내려던 '조용한 만료'를 표 자신이 틀리게 보고한다.
   *
   * 계약 주석이 근거로 들던 `apps/api/test/mobile-link-price-contract.test.ts`는 존재한 적이
   * 없었다 — 그래서 가드를 여기(이미 있는 수기 미러 계약 파일)에 세우고 그 주석을 정정했다.
   */
  it("LINK_PRICE_MAX_AGE_DAYS가 packages/contracts의 값과 같다", () => {
    const match = contractsSchemasSource().match(/export const LINK_PRICE_MAX_AGE_DAYS = (\d+);/);
    expect(match, "packages/contracts에서 LINK_PRICE_MAX_AGE_DAYS를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(LINK_PRICE_MAX_AGE_DAYS);
  });

  /**
   * 라운드 42 L-7 — `ImportJob.childId`가 양쪽에 남아 있는지 고정한다.
   *
   * 이 필드는 라운드 41 K-2가 응답 계약에 새로 실은 값이고, 검수 화면(app/import/[importJobId].tsx)의
   * "대상 아이" 표시가 **오직 이 값**에 걸려 있다 -- 선택 아이 스토어로 되돌아가면 아이를 바꾼 뒤
   * 예전 검수 링크에서 헤더가 틀린 이름을 확신에 차서 보여 주고, 그대로 수백 건이 엉뚱한 아이의
   * 가계부로 확정된다. 모바일은 contracts를 import하지 않고 수기로 미러하므로(known-limitations §D),
   * 서버 계약에서 이 필드가 빠지는 순간을 커밋 시점에 잡는 드리프트 가드를 둔다.
   */
  it("L-7: ImportJob.childId가 서버 계약과 모바일 미러 양쪽에 있다", () => {
    const contractsSource = contractsSchemasSource();
    const importJobBlock = contractsSource.slice(
      contractsSource.indexOf("export const importJobSchema = z.object({"),
      contractsSource.indexOf("export const importRowSchema = z.object({")
    );
    expect(importJobBlock).toContain("childId: uuidSchema,");

    const clientSource = readFileSync(join(process.cwd(), "src", "api", "client.ts"), "utf8");
    const mirrorBlock = clientSource.slice(
      clientSource.indexOf("export type ImportJob = {"),
      clientSource.indexOf("export type ImportRow = {")
    );
    expect(mirrorBlock).toContain("childId: string;");
  });
});

/**
 * 라운드 84 트랙 C — **모집단이 값이 된다.**
 *
 * 위 넷은 값 셋과 필드 하나를 문다. 그런데 이 파일의 제목이 무는 것은 "contracts 수기 미러"
 * 전체였고, **모집단을 세는 자리는 0건**이었다. 그래서 실제로 갈린 자리는 아무 단언도 잡지
 * 못했다 — `expenseSchema`는 필드가 열다섯인데 모바일 `Expense`는 열넷이다(`createdByUserId`).
 * 그 사실은 사람이 눈으로 찾아, 타입에 없는 값을 방어적으로 꺼내는 접근자를 적어 두는 것으로
 * 끝났다(src/expenses/records-list-view.ts `expenseCreatedByUserId`). 다음 필드가 같은 식으로
 * 갈리면 다시 사람이 찾아야 한다.
 *
 * 아래 스윕이 하는 것:
 *  ⓐ **모집단** — `packages/contracts/src/schemas.ts`의 `export const` 전수와
 *     `src/api/client.ts`의 객체 리터럴 타입 전수를 **파싱해서** 짝을 짓는다. 짝 목록을 손으로
 *     적지 않는다 — 이름 규칙(`xxxSchema` → `Xxx`, 낱말 회전, `…Request` → `…Body`)으로만 잇고,
 *     후보가 둘 이상이면 모호하다고 빨개진다.
 *  ⓑ **필드 두 방향** — 짝마다 필드 이름 집합이 양방향으로 같다. 다른 자리는 **면제 대장**에
 *     이유와 함께 있어야 하고, 대장에 있는데 실제로는 같아진 자리도 빨개진다(죽은 면제 금지).
 *  ⓒ **짝 없는 스키마** — 요청·쿼리·봉투처럼 짝이 없는 것도 이유와 함께 대장에 있다.
 *  ⓓ **상수 대장** — 계약 상수 전수가 "모바일 사본이 있는가 · 그 대조는 어느 파일인가"를 갖는다.
 *     대장은 **가리키기만** 한다 — 이미 다른 파일에 선 대조를 이 파일로 옮기지 않는다.
 *  ⓔ **래칫** — 면제의 수는 오늘 값을 넘을 수 없다.
 *
 * 하지 않는 것: **zod를 실행하지 않는다.** 모바일은 `@wooriai/contracts`를 의존하지 않고
 * (apps/mobile/package.json — 그 의존성 없음이 이 수기 미러 관례의 근거다), 그래서 이 스윕은
 * 두 소스의 **이름 집합**만 읽는다. 값 검증·런타임 파싱은 이 파일의 일이 아니다.
 *
 * 모집단 밖 하나: 계약의 `MONEY_KRW_MAX`는 `export const`가 아니라 도메인 값의 **재수출**
 * (`export { MONEY_KRW_MAX };`)이라 아래 상수 모집단에 들어오지 않는다. 그 사본
 * (`src/expenses/amount-limit.ts`의 `EXPENSE_AMOUNT_MAX_KRW`)의 대조는
 * `src/expenses/expense-detail-edit-rules.test.ts`에 이미 서 있다.
 */
const mobileRoot = process.cwd();
const mobileSource = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const CLIENT_PATH = "src/api/client.ts";
const SELF_PATH = "src/api/contracts-mirror.test.ts";
const TEXT_LIMITS_TEST_PATH = "src/expenses/text-limits.test.ts";

/** 오늘 실측한 면제 수의 천장(래칫). 넘기려면 이 줄을 고쳐야 하고, 그게 곧 리뷰 지점이다. */
const FIELD_EXEMPTION_CEILING = 1;
/** 오늘 실측한 "짝 없는 스키마" 수의 천장(래칫). */
const UNPAIRED_SCHEMA_CEILING = 11;

/**
 * ⓑ 면제 대장 — 짝의 필드 집합이 갈린 자리 전부. 키는 `모바일타입.필드`.
 *
 * ⚠️ 이 대장은 "**오늘 갈려 있다**"만 적는다. 갈린 것을 고치는 일(계약 필드를 모바일 타입에
 * 더하거나 계약에서 빼는 일)은 각각 다른 축의 결정이다.
 */
const FIELD_EXEMPTIONS: Record<string, { onlyIn: "contract" | "mobile"; reason: string }> = {
  "Expense.createdByUserId": {
    onlyIn: "contract",
    reason:
      "서버 toExpenseDto(apps/api/src/onboarding/store-shared.ts)는 이 값을 진작부터 내려주고 " +
      "계약에도 있지만, 모바일 미러 타입에는 아직 없다. 값을 읽는 자리는 타입에 없는 필드를 " +
      "방어적으로 좁혀 꺼낸다(src/expenses/records-list-view.ts `expenseCreatedByUserId` — " +
      "FAM-127 공동 기록 작성자 표기). 타입에 더하면 그 접근자가 존재할 이유가 바뀌므로 " +
      "정리는 별도 결정이고, 더하는 날 이 줄을 지우면 초록이다."
  }
};

/**
 * ⓒ 짝 없는 스키마 대장 — 이름 규칙으로 모바일 타입에 닿지 않는 객체 스키마 전부와 그 이유.
 *
 * "짝이 없다"는 대개 **모바일이 그 모양을 타입으로 들지 않는다**는 뜻이다(요청 인라인 인자 ·
 * URL 문자열 조립 · 중첩 리터럴). 그 자체가 드리프트는 아니지만, 이유 없이 늘어나면 스윕이
 * 무는 범위가 조용히 줄어든다 — 그래서 전수를 여기 적는다.
 */
const UNPAIRED_SCHEMAS: Record<string, string> = {
  errorResponseSchema:
    "오류 봉투. 모바일은 이 모양을 타입이 아니라 파서로 다루고(src/api/api-error.ts " +
    "`parseApiErrorEnvelope`는 봉투 한 겹을 벗겨 code/message만 든다), 그 계약은 " +
    "src/api/api-error.test.ts가 이미 문다.",
  categorySchema:
    "임베디드 참조용 최소 필드 스키마. 모바일이 미러하는 것은 목록 항목 쪽뿐이고 " +
    "(categoryListItemSchema ↔ CategoryListItem), 그 짝이 이 필드들을 그대로 포함한다.",
  listCategoriesResponseSchema:
    "응답 봉투 한 겹(`{ categories }`). 모바일은 호출부에서 인라인으로 적고 이름 붙은 타입을 " +
    "두지 않는다(client.ts `listCategories`).",
  createExpenseRequestSchema:
    "요청 바디. 모바일 사본은 createExpense/createExpenseWithIdempotency의 **인라인 인자 객체**라 " +
    "이름 붙은 타입이 없다. 필드는 응답 짝(expenseSchema ↔ Expense)이 사실상 덮는다.",
  updateExpenseRequestSchema:
    "모바일 사본 `UpdateExpenseBody`는 `Partial<Pick<Expense, …>> & { … }`라 객체 리터럴 선언이 " +
    "아니다(이 스윕의 타입 모집단은 객체 리터럴 타입이다). 고른 필드는 Expense 짝을 통해 " +
    "간접적으로 대조되고, `expectedVersion`은 바디가 아니라 updateExpenseWithVersion의 별도 " +
    "인자로 실린다.",
  deleteExpenseRequestSchema:
    "삭제는 바디가 없다 — `expectedVersion`은 쿼리 파라미터다(client.ts " +
    "deleteExpenseWithVersion이 URL에 싣는다).",
  versionConflictResponseSchema:
    "409 봉투. 모바일은 봉투가 아니라 그 안의 `current`만 `ExpenseConflictSnapshot`(합 타입)으로 " +
    "들고, 그 계약은 오프라인 충돌 병합 테스트가 문다.",
  listExpensesQuerySchema:
    "쿼리 파라미터 계약. 모바일은 타입이 아니라 URL 문자열로 조립한다(client.ts listExpenses). " +
    "그 중 limit 상한은 아래 상수 대장의 EXPENSE_LIST_MAX_LIMIT가 문다.",
  homeMonthlyBudgetSchema:
    "budgetSchema의 파생(합계 0을 허용하는 amountKrw 하나만 다르다). 모바일 HomeSummary.monthly는 " +
    "Budget을 그대로 쓰므로 필드 집합은 budgetSchema ↔ Budget 짝이 이미 덮는다.",
  listItemsQuerySchema:
    "쿼리 파라미터 계약. 모바일은 URL로 조립하고(client.ts listItems), 시기 칩 라벨 네 문자열은 " +
    "src/items/stage-bands.ts가 든다(대조는 아래 상수 대장의 STAGE_BAND_LABELS 줄).",
  categoryBreakdownEntrySchema:
    "카테고리 합계 한 줄. 모바일은 이 모양을 MonthlyReport.categoryTop·CategoryReport.categories " +
    "**안에 인라인**으로 적는다 — 중첩이라 이 스윕의 깊이 1 모집단 밖이고, 두 짝의 필드 이름은 " +
    "그 배열 이름까지만 대조된다."
};

/**
 * ⓓ 상수 대장 — 계약 `export const` 중 상수(대문자 이름) 전수.
 *
 * `mirror`가 있으면 "모바일이 사본을 든다"는 뜻이고, `checkedBy`가 **그 두 값을 실제로 맞대는
 * 자리**를 파일 이름으로 가리킨다. 이 대장은 가리키기만 한다 — text-limits.test.ts의 대조를
 * 이리로 옮기지 않는다(옮기면 같은 단언이 두 벌이 되고, 옆 파일의 경계·문구 계약과 떨어진다).
 */
const CONSTANT_LEDGER: Record<
  string,
  { mirror: { module: string; exportName: string; checkedBy: string } | null; reason: string }
> = {
  EXPENSE_ITEM_NAME_MAX_LENGTH: {
    mirror: {
      module: "src/expenses/text-limits.ts",
      exportName: "ITEM_NAME_MAX_LENGTH",
      checkedBy: TEXT_LIMITS_TEST_PATH
    },
    reason: "GAP-056 #1 — 입력 가드가 값을 자기 모듈에 두고, 옆 테스트가 계약 선언과 맞댄다."
  },
  EXPENSE_MERCHANT_MAX_LENGTH: {
    mirror: {
      module: "src/expenses/text-limits.ts",
      exportName: "MERCHANT_MAX_LENGTH",
      checkedBy: TEXT_LIMITS_TEST_PATH
    },
    reason: "GAP-056 #1 — 위와 같은 관례(판매처 상한)."
  },
  EXPENSE_MEMO_MAX_LENGTH: {
    mirror: {
      module: "src/expenses/text-limits.ts",
      exportName: "MEMO_MAX_LENGTH",
      checkedBy: TEXT_LIMITS_TEST_PATH
    },
    reason: "GAP-056 #1 — 위와 같은 관례(메모 상한)."
  },
  EXPENSE_LIST_DEFAULT_LIMIT: {
    mirror: null,
    reason:
      "서버가 정하는 기본 페이지 크기다. 모바일은 목록 요청마다 limit을 **명시**하므로 " +
      "(REC-124/CSV-124 — 기록 탭·홈·CSV) 기본값 사본을 들 이유가 없다. 사본을 드는 날 " +
      "이 줄이 mirror를 갖거나, 아래 사본 없음 스윕이 빨개진다."
  },
  EXPENSE_LIST_MAX_LIMIT: {
    mirror: { module: CLIENT_PATH, exportName: "EXPENSE_LIST_MAX_LIMIT", checkedBy: SELF_PATH },
    reason: "API-124 — 상한을 넘긴 요청은 400이라 세 화면이 함께 죽는다(이 파일 첫 단언)."
  },
  STAGE_BAND_LABELS: {
    mirror: {
      module: "src/items/stage-bands.ts",
      exportName: "bandDefinitions",
      checkedBy: "../api/test/mobile-stage-band-contract.test.ts"
    },
    reason:
      "ITEM-121 — 모바일 사본은 `bandDefinitions`의 네 라벨 문자열이고, 대조는 **모바일 밖**에 " +
      "이미 서 있다(서버·모바일·계약 셋을 한자리에서 맞대는 테스트라 그 자리가 맞다). 이 " +
      "대장은 그 자리를 가리키기만 한다."
  },
  LINK_PRICE_MAX_AGE_DAYS: {
    mirror: { module: "src/items/link-price.ts", exportName: "LINK_PRICE_MAX_AGE_DAYS", checkedBy: SELF_PATH },
    reason: "라운드 64 M-2 — 문턱이 갈리면 어드민의 '만료' 배지가 앱과 다른 말을 한다(이 파일 셋째 단언)."
  },
  TREND_REPORT_DEFAULT_MONTHS: {
    mirror: { module: CLIENT_PATH, exportName: "TREND_REPORT_DEFAULT_MONTHS", checkedBy: SELF_PATH },
    reason: "REP-128 — 기본 개월 수 사본(이 파일 둘째 단언이 값과 상한 안 여부를 함께 문다)."
  },
  TREND_REPORT_MAX_MONTHS: {
    mirror: null,
    reason:
      "서버 검증 상한이다. 모바일은 기본값만 들고 상한 사본은 두지 않는다 — 이 파일 둘째 단언이 " +
      "계약 소스에서 상한을 읽어 '기본값 ≤ 상한'만 확인한다(사본이 아니라 읽기다)."
  }
};

type ContractDecl = {
  name: string;
  kind: "object" | "value" | "constant";
  base?: string;
  ownFields: string[];
  body: string;
};

/** 주석은 이름 집합의 일부가 아니다 — 블록/줄 주석을 먼저 지운다(`https://`는 앞에 공백이 없어 안 지워진다). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line.replace(/\s\/\/.*$/, "")))
    .join("\n");
}

/** 소스에서 마커의 위치를 **실재 확인과 함께** 얻는다(없으면 그 자리에서 빨개진다). */
function requireIndex(source: string, marker: string, what: string): number {
  const at = source.indexOf(marker);
  expect(at, `${what}: 소스에서 \`${marker}\`를 찾지 못했다`).toBeGreaterThan(-1);
  return at;
}

/**
 * `openerIndex`의 여는 괄호가 감싸는 모양에서 **깊이 1의 키 이름**만 모은다.
 * 중첩 객체(예: itemDetailSchema.linkedExpense의 안쪽)는 세지 않는다 — 이 스윕이 무는 것은
 * 한 모양의 필드 이름 집합이다.
 */
function shapeKeys(source: string, openerIndex: number): string[] {
  const keys: string[] = [];
  const keyPattern = /([A-Za-z_$][\w$]*)\??\s*:/y;
  let depth = 0;
  for (let i = openerIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{" || ch === "(" || ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "}" || ch === ")" || ch === "]") {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }
    if (depth !== 1 || !/[A-Za-z_$]/.test(ch)) continue;
    let back = i - 1;
    while (back >= 0 && /\s/.test(source[back])) back -= 1;
    const previous = back < 0 ? "" : source[back];
    if (previous !== "{" && previous !== "," && previous !== ";") continue;
    keyPattern.lastIndex = i;
    const matched = keyPattern.exec(source);
    if (!matched) continue;
    keys.push(matched[1]);
    i += matched[0].length - 1;
  }
  return keys;
}

/** ⓐ 계약 소스의 `export const` 전수를 스스로 파싱한다(손 목록 0건). */
function parseContractDeclarations(): ContractDecl[] {
  const source = stripComments(contractsSchemasSource());
  const heads: { name: string; start: number }[] = [];
  const headPattern = /^export const ([A-Za-z_$][\w$]*) =/gm;
  let head = headPattern.exec(source);
  while (head !== null) {
    heads.push({ name: head[1], start: head.index });
    head = headPattern.exec(source);
  }
  expect(heads.length, "계약 소스에서 export const를 하나도 파싱하지 못했다").toBeGreaterThan(0);

  return heads.map((entry, index) => {
    const body = source.slice(entry.start, index + 1 < heads.length ? heads[index + 1].start : source.length);
    const extended = /^export const [\w$]+ = ([A-Za-z_$][\w$]*)\.extend\(\{/.exec(body);
    if (extended) {
      const opener = requireIndex(body, ".extend({", `${entry.name}의 extend 모양`) + ".extend(".length;
      return { name: entry.name, kind: "object", base: extended[1], ownFields: shapeKeys(body, opener), body };
    }
    const objectAt = body.indexOf(".object({");
    const isUnion = body.indexOf(".union(") >= 0 && body.indexOf(".union(") < objectAt;
    if (objectAt >= 0 && !isUnion) {
      return { name: entry.name, kind: "object", ownFields: shapeKeys(body, objectAt + ".object(".length), body };
    }
    return { name: entry.name, kind: /^[A-Z0-9_]+$/.test(entry.name) ? "constant" : "value", ownFields: [], body };
  });
}

/** ⓐ 모바일 미러 소스(client.ts)의 객체 리터럴 타입 전수. */
function parseMobileTypes(): Map<string, { base?: string; ownFields: string[] }> {
  const source = stripComments(mobileSource(CLIENT_PATH));
  const types = new Map<string, { base?: string; ownFields: string[] }>();
  const typePattern = /^export type ([A-Za-z_$][\w$]*) = (?:([A-Za-z_$][\w$]*) & )?\{/gm;
  let matched = typePattern.exec(source);
  while (matched !== null) {
    const opener = matched.index + matched[0].length - 1;
    expect(source[opener], `${matched[1]} 선언의 여는 중괄호 위치`).toBe("{");
    types.set(matched[1], { base: matched[2], ownFields: shapeKeys(source, opener) });
    matched = typePattern.exec(source);
  }
  expect(types.size, "client.ts에서 객체 리터럴 타입을 하나도 파싱하지 못했다").toBeGreaterThan(0);
  return types;
}

function resolveFields(
  name: string,
  ownOf: (key: string) => { base?: string; ownFields: string[] } | undefined,
  seen: Set<string> = new Set()
): string[] {
  const entry = ownOf(name);
  if (!entry || seen.has(name)) return [];
  seen.add(name);
  const inherited = entry.base ? resolveFields(entry.base, ownOf, seen) : [];
  return [...new Set([...inherited, ...entry.ownFields])];
}

const pascal = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * 짝 후보를 **이름 규칙**으로만 만든다(짝 목록을 손으로 적지 않는다).
 *  - `expenseSchema` → `Expense`
 *  - `reportTrendSchema` → `ReportTrend` → 낱말 회전 → `TrendReport`
 *  - `updateChildRequestSchema` → `UpdateChildRequest` → `UpdateChildBody`
 */
function pairCandidates(schemaName: string): string[] {
  const base = pascal(schemaName.replace(/Schema$/, ""));
  const words = (base.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g) ?? []).map(pascal);
  const candidates = new Set<string>([base]);
  if (words.length > 1) candidates.add([...words.slice(1), words[0]].join(""));
  candidates.add(base.replace(/Request$/, "Body"));
  return [...candidates];
}

type Population = {
  declarations: ContractDecl[];
  mobileTypes: Map<string, { base?: string; ownFields: string[] }>;
  contractFieldsOf: (name: string) => string[];
  mobileFieldsOf: (name: string) => string[];
  pairs: { schema: string; type: string; contractFields: string[]; mobileFields: string[] }[];
  unpaired: string[];
};

let cachedPopulation: Population | null = null;

/** 파싱은 첫 테스트에서 한 번만(실재 확인 단언이 테스트 안에서 돌아야 한다). */
function population(): Population {
  if (cachedPopulation) return cachedPopulation;
  const declarations = parseContractDeclarations();
  const mobileTypes = parseMobileTypes();
  const byName = new Map(declarations.map((decl) => [decl.name, decl]));
  const contractFieldsOf = (name: string) =>
    resolveFields(name, (key) => {
      const decl = byName.get(key);
      return decl && decl.kind === "object" ? { base: decl.base, ownFields: decl.ownFields } : undefined;
    });
  const mobileFieldsOf = (name: string) => resolveFields(name, (key) => mobileTypes.get(key));

  const pairs: Population["pairs"] = [];
  const unpaired: string[] = [];
  for (const decl of declarations) {
    if (decl.kind !== "object") continue;
    const matches = pairCandidates(decl.name).filter((candidate) => mobileTypes.has(candidate));
    expect(matches.length, `${decl.name}의 짝 후보가 모호하다: ${matches.join(", ")}`).toBeLessThan(2);
    if (matches.length === 1) {
      pairs.push({
        schema: decl.name,
        type: matches[0],
        contractFields: contractFieldsOf(decl.name),
        mobileFields: mobileFieldsOf(matches[0])
      });
    } else {
      unpaired.push(decl.name);
    }
  }

  cachedPopulation = { declarations, mobileTypes, contractFieldsOf, mobileFieldsOf, pairs, unpaired };
  return cachedPopulation;
}

/** `src`·`app` 아래의 소스 전수(사본 없음 주장을 실제로 확인하는 자리). */
function mobileSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (relativeDir: string) => {
    for (const entry of readdirSync(join(mobileRoot, relativeDir), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) walk(relativePath);
      else if (/\.tsx?$/.test(entry.name)) found.push(relativePath);
    }
  };
  walk("src");
  walk("app");
  return found;
}

describe("contracts 수기 미러 모집단 스윕 — 스키마 짝·필드 두 방향·상수 대장", () => {
  it("ⓐ 계약의 export const 전수가 셋(객체 스키마·값 스키마·상수) 중 하나로 분류된다", () => {
    const { declarations, mobileTypes, contractFieldsOf, mobileFieldsOf, pairs } = population();

    // 수를 손으로 적지 않는다 — 소스가 스스로 센다.
    const declaredHeads = stripComments(contractsSchemasSource()).match(/^export const /gm) ?? [];
    expect(declarations.length).toBe(declaredHeads.length);
    expect(new Set(declarations.map((decl) => decl.name)).size).toBe(declarations.length);

    const kinds = declarations.map((decl) => decl.kind);
    expect(kinds.filter((kind) => kind === "object").length).toBeGreaterThan(0);
    expect(kinds.filter((kind) => kind === "constant").length).toBeGreaterThan(0);
    expect(kinds.filter((kind) => kind === "value").length).toBeGreaterThan(0);

    // 파서가 조용히 빈 집합을 돌려주면 이 스윕은 아무것도 무는 게 없다.
    for (const decl of declarations) {
      if (decl.kind !== "object") continue;
      expect(contractFieldsOf(decl.name), `${decl.name}의 필드를 하나도 읽지 못했다`).not.toHaveLength(0);
    }
    for (const [name] of mobileTypes) {
      expect(mobileFieldsOf(name), `client.ts ${name}의 필드를 하나도 읽지 못했다`).not.toHaveLength(0);
    }

    // 값 스키마는 필드 집합이 없는 값이다(합 타입인 expenseConflictSnapshotSchema 포함 —
    // 그 모바일 사본 `ExpenseConflictSnapshot`도 객체 리터럴이 아니라 합 타입이다).
    for (const decl of declarations) {
      if (decl.kind !== "value") continue;
      expect(decl.body, `${decl.name}은 값 스키마로 분류됐다`).toMatch(/z\.(enum|string|number)\(|\.union\(/);
    }

    // 핵심 루프의 짝이 모집단에 실제로 들어 있다(스윕이 헛도는 것을 막는 카나리아).
    expect(pairs.map((pair) => `${pair.schema}↔${pair.type}`)).toContain("expenseSchema↔Expense");

    // 한 모바일 타입이 두 스키마의 짝이 되지 않는다.
    expect(new Set(pairs.map((pair) => pair.type)).size).toBe(pairs.length);
  });

  it("ⓒ 짝 없는 객체 스키마 전수가 이유와 함께 대장에 있다", () => {
    const { unpaired } = population();

    expect([...unpaired].sort()).toEqual(Object.keys(UNPAIRED_SCHEMAS).sort());
    for (const [name, reason] of Object.entries(UNPAIRED_SCHEMAS)) {
      expect(reason.length, `${name}의 이유가 비어 있다`).toBeGreaterThan(20);
    }
    expect(unpaired.length).toBeLessThanOrEqual(UNPAIRED_SCHEMA_CEILING);
  });

  it("ⓑ 짝마다 필드 이름 집합이 양방향으로 같고, 갈린 자리는 면제 대장과 정확히 일치한다", () => {
    const { pairs } = population();

    const differences: string[] = [];
    for (const pair of pairs) {
      for (const field of pair.contractFields) {
        if (!pair.mobileFields.includes(field)) differences.push(`${pair.type}.${field} (contract)`);
      }
      for (const field of pair.mobileFields) {
        if (!pair.contractFields.includes(field)) differences.push(`${pair.type}.${field} (mobile)`);
      }
    }

    const ledger = Object.entries(FIELD_EXEMPTIONS).map(([key, entry]) => `${key} (${entry.onlyIn})`);
    // 두 방향: 새로 갈린 자리는 대장에 없어서 빨개지고, 같아진 자리는 대장에 남아 있어서 빨개진다.
    expect(differences.sort()).toEqual(ledger.sort());
    for (const [key, entry] of Object.entries(FIELD_EXEMPTIONS)) {
      expect(entry.reason.length, `${key}의 면제 이유가 비어 있다`).toBeGreaterThan(20);
    }

    // ⓔ 래칫.
    expect(Object.keys(FIELD_EXEMPTIONS).length).toBeLessThanOrEqual(FIELD_EXEMPTION_CEILING);
  });

  it("ⓑ 오늘 갈린 자리는 Expense.createdByUserId 하나이고, 그 방어적 접근자가 실재한다", () => {
    const { contractFieldsOf, mobileFieldsOf } = population();

    expect(contractFieldsOf("expenseSchema")).toContain("createdByUserId");
    expect(mobileFieldsOf("Expense")).not.toContain("createdByUserId");
    // 계약 열다섯 · 모바일 열넷 — 수도 손으로 적지 않고 두 소스에서 읽는다.
    expect(mobileFieldsOf("Expense").length).toBe(contractFieldsOf("expenseSchema").length - 1);

    // 타입에 없는 값을 읽는 자리(면제 이유가 가리키는 곳)가 실제로 있다.
    const accessor = mobileSource("src/expenses/records-list-view.ts");
    expect(accessor).toContain("export function expenseCreatedByUserId(expense: unknown)");
    expect(accessor).toContain("createdByUserId?: unknown");
  });

  it("ⓓ 계약 상수 전수가 대장에 있고, 사본이 있는 것은 대조 자리를 파일 이름으로 가리킨다", () => {
    const { declarations } = population();
    const constants = declarations.filter((decl) => decl.kind === "constant").map((decl) => decl.name);

    expect([...constants].sort()).toEqual(Object.keys(CONSTANT_LEDGER).sort());

    for (const [name, entry] of Object.entries(CONSTANT_LEDGER)) {
      expect(entry.reason.length, `${name}의 이유가 비어 있다`).toBeGreaterThan(20);
      if (!entry.mirror) continue;
      // 사본이 실재한다.
      expect(mobileSource(entry.mirror.module), `${name}의 모바일 사본 자리`).toContain(
        `export const ${entry.mirror.exportName}`
      );
      // 대조 자리가 실재하고, 계약 쪽 이름을 실제로 문다.
      expect(mobileSource(entry.mirror.checkedBy), `${name}의 대조 자리`).toContain(name);
    }

    // 사본이 없다고 적은 상수는 정말로 모바일 어디에도 같은 이름으로 선언돼 있지 않다.
    const withoutMirror = Object.entries(CONSTANT_LEDGER)
      .filter(([, entry]) => entry.mirror === null)
      .map(([name]) => name);
    expect(withoutMirror.length).toBeGreaterThan(0);
    const sources = mobileSourceFiles().map((path) => ({ path, text: mobileSource(path) }));
    for (const name of withoutMirror) {
      // 줄머리 선언만 센다 — 이 파일이 계약 소스를 읽으려고 들고 있는 정규식 문자열은 선언이 아니다.
      const declaration = new RegExp(`^export const ${name}\\b`, "m");
      const offenders = sources.filter((entry) => declaration.test(entry.text)).map((entry) => entry.path);
      expect(offenders, `${name}: 사본이 생겼는데 대장이 '사본 없음'이라고 말한다`).toEqual([]);
    }
  });

  it("ⓓ 모바일 안의 대조는 오늘 여섯이고 두 파일에 셋씩 나뉜다", () => {
    const insideMobile = Object.values(CONSTANT_LEDGER)
      .map((entry) => entry.mirror)
      .filter((mirror): mirror is NonNullable<typeof mirror> => mirror !== null)
      .filter((mirror) => !mirror.checkedBy.startsWith(".."));

    expect(insideMobile.filter((mirror) => mirror.checkedBy === SELF_PATH)).toHaveLength(3);
    expect(insideMobile.filter((mirror) => mirror.checkedBy === TEXT_LIMITS_TEST_PATH)).toHaveLength(3);
    expect(insideMobile).toHaveLength(6);

    // 모바일 밖을 가리키는 줄도 그 파일이 실재하는지까지 본다(위 ⓓ 단언이 읽는다).
    const outside = Object.values(CONSTANT_LEDGER)
      .map((entry) => entry.mirror)
      .filter((mirror): mirror is NonNullable<typeof mirror> => mirror !== null)
      .filter((mirror) => mirror.checkedBy.startsWith(".."));
    expect(outside.map((mirror) => mirror.checkedBy)).toEqual(["../api/test/mobile-stage-band-contract.test.ts"]);
  });
});
