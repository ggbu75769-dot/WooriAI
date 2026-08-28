import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  recurringPrefillParams,
  RECURRING_ITEM_NAME_MAX_LENGTH,
  RECURRING_MERCHANT_MAX_LENGTH,
  type RecurringExpenseTemplate
} from "./recurring-template";

/**
 * 라운드 55 트랙 A — 반복/고정 지출의 **소스 계약**.
 *
 * 이 저장소의 vitest는 react-native 화면을 렌더할 수 없다(src/screen-header-back.test.ts 머리말).
 * 그래서 화면이 지키기로 한 약속은 소스 grep으로 고정한다 — export-flow.test.ts /
 * notification-flow.test.ts와 같은 관례다.
 *
 * 여기서 지키는 것 중 첫 번째가 가장 중요하다: **어떤 경로로도 지출이 자동으로 만들어지지
 * 않는다**(DNC-013, 설계 §1.7 수용 기준 1). 그 계약은 값 테스트로는 증명할 수 없다 — "부르지
 * 않는다"는 부재이기 때문에 소스에서 확인해야 한다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 주석을 걷어낸 소스.
 *
 * "이 이름을 부르지 않는다"를 grep으로 확인하려면 **설명하는 문장**과 **부르는 코드**를 갈라야
 * 한다. 이 파일들의 머리말은 "createExpense도 createExpenseOffline도 부르지 않는다"라고 그
 * 이름을 적어 두는데(그게 다음 사람에게 필요한 설명이다), 그 문장 때문에 계약이 깨졌다고
 * 말하면 주석을 지우는 쪽으로 몰리게 된다. 이 세 파일에는 문자열 안의 `//`가 없다.
 */
function codeOnly(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

/** 트랙 A가 새로 들인 반복 지출 표면 전부. */
const recurringSources = [
  "src/expenses/recurring-template.ts",
  "src/stores/recurring-expense.store.ts",
  "app/expenses/recurring.tsx"
] as const;

describe("DNC-013 — 반복 지출은 어떤 경로로도 지출을 만들지 않는다 (수용 기준 1)", () => {
  it("반복 지출 표면 어디에도 지출 생성 호출이 없다", () => {
    // 지출을 실제로 만드는 세 갈래: 서버 직행 · 오프라인 로컬 우선 저장 · 아웃박스 enqueue.
    const forbidden = [
      "createExpense",
      "createExpenseOffline",
      "enqueue",
      "mutation_outbox",
      "sync-controller",
      "adoptServerExpense"
    ];
    for (const relativePath of recurringSources) {
      const text = codeOnly(relativePath);
      for (const needle of forbidden) {
        expect(text, `${relativePath}에 ${needle}가 있으면 자동 기록 경로가 생긴다`).not.toContain(needle);
      }
    }
  });

  it("관리 화면이 사용자에게도 그 사실을 말한다 (자동 기록을 기대하고 들어온 사람 대비)", () => {
    const screen = source("app/expenses/recurring.tsx");
    expect(screen).toContain("자동으로 기록되지는 않아요");
    // "자동으로 기록했어요" 계열 문구 금지(설계 §1.3).
    expect(screen).not.toMatch(/자동으로 기록했|자동 기록했|대신 기록했/);
  });

  it("템플릿 저장소는 오프라인 아웃박스가 아니라 persist 스토어다", () => {
    const store = source("src/stores/recurring-expense.store.ts");
    expect(store).toContain('from "./persist-storage"');
    expect(store).not.toContain('from "../offline/');
  });
});

describe("라운드 55 #4 규칙 재사용 (규칙 두 벌 금지)", () => {
  it("이름 비교는 normalizeItemName을 재사용하고 자체 정규화를 재구현하지 않는다", () => {
    const text = source("src/expenses/recurring-template.ts");
    expect(text).toContain('from "./item-name-match"');
    expect(text).toContain("normalizeItemName(");
    // 정규화를 손으로 다시 적으면 자동완성·카테고리 추천과 답이 갈린다.
    expect(text).not.toContain("toLowerCase()");
    expect(text).not.toMatch(/replace\(\/\\s\+\/g/);
  });

  it("금액 상한은 amount-limit 모듈 하나에서 온다 (서버 int4 한계와 같은 숫자)", () => {
    const text = source("src/expenses/recurring-template.ts");
    expect(text).toContain('from "./amount-limit"');
    expect(text).toContain("isAmountOverLimit(");
    // 상한 숫자를 이 모듈에 다시 적지 않는다.
    expect(text).not.toContain("2147483647");
    expect(text).not.toContain("2_147_483_647");
  });

  /**
   * 길이 상한 드리프트 가드.
   *
   * 유효한 계약은 DB 컬럼이 아니라 **서버 DTO**다: `@MaxLength(100)`을 넘긴 품목명·판매처는
   * 컬럼에 자리가 있어도 400으로 거절된다. 그런데 이 템플릿의 목적지는 로컬 우선 저장
   * (createExpenseOffline)이라, 상한이 어긋나면 "기기에 저장했어요"가 먼저 뜬 뒤 flush에서
   * 400을 만나 **영구 실패 행**이 된다 — 금액 상한(amount-limit.ts)이 막으려던 GAP-054 P0-2와
   * 같은 모양이다. 그래서 숫자를 손으로 맞춰 두지 않고 서버 DTO에서 읽어 대조한다.
   */
  it("품목명·판매처 상한이 서버 DTO의 @MaxLength와 같은 숫자다", () => {
    const dto = readFileSync(join(mobileRoot, "../api/src/finance/dto/expense.dto.ts"), "utf8");
    const itemNameMax = /@MaxLength\((\d+)\)\s*itemName!/.exec(dto);
    const merchantMax = /@MaxLength\((\d+)\)\s*merchant\?/.exec(dto);
    // 가드의 가드: DTO 모양이 바뀌어 정규식이 죽으면 조용히 통과해 버린다.
    expect(itemNameMax, "CreateExpenseDto.itemName의 @MaxLength를 찾지 못했다").not.toBeNull();
    expect(merchantMax, "CreateExpenseDto.merchant의 @MaxLength를 찾지 못했다").not.toBeNull();

    expect(RECURRING_ITEM_NAME_MAX_LENGTH).toBe(Number(itemNameMax![1]));
    expect(RECURRING_MERCHANT_MAX_LENGTH).toBe(Number(merchantMax![1]));

    // 화면 입력 칸도 같은 상수를 쓴다(리터럴을 따로 적으면 다음 사람이 한쪽만 고친다).
    const screenSource = source("app/expenses/recurring.tsx");
    expect(screenSource).toContain("maxLength={RECURRING_ITEM_NAME_MAX_LENGTH}");
    expect(screenSource).toContain("maxLength={RECURRING_MERCHANT_MAX_LENGTH}");
    expect(screenSource).not.toMatch(/maxLength=\{1[0-9][0-9]\}/);
  });

  it("'일반 지출인가' 판정과 결제 수단 화이트리스트도 기존 모듈에서 온다", () => {
    const text = source("src/expenses/recurring-template.ts");
    expect(text).toContain('from "./record-row-actions"');
    expect(text).toContain("isRepeatableExpenseType(");
    expect(text).toContain("EXPENSE_PREFILL_PAYMENT_METHODS");
  });

  it("검증·문구·상한은 순수 모듈에 있고 화면은 결과를 그대로 보여준다", () => {
    const screen = source("app/expenses/recurring.tsx");
    expect(screen).toContain('from "../../src/expenses/recurring-template"');
    // 화면이 자기만의 판정을 하지 않는다.
    expect(screen).not.toContain("EXPENSE_AMOUNT_MAX_KRW");
    expect(screen).not.toMatch(/dayOfMonth\s*[<>]/);
  });
});

describe("라운드 55 #4 프리필 계약이 한 벌이다 (수용 기준 5)", () => {
  const newExpenseSource = source("app/expenses/new.tsx");
  const paramsBlock = newExpenseSource.slice(
    newExpenseSource.indexOf("const params = useLocalSearchParams<{"),
    newExpenseSource.indexOf("}>();")
  );

  it("템플릿이 싣는 파라미터 이름을 빠른 기록 시트가 전부 읽는다", () => {
    const template: RecurringExpenseTemplate = {
      id: "local-recurring-1",
      childId: "child-1",
      itemName: "기저귀",
      amountKrw: 38_500,
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      paymentMethod: "card",
      merchant: "쿠팡",
      dayOfMonth: 5,
      active: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      skippedYearMonths: []
    };
    const params = recurringPrefillParams(template);
    expect(params).not.toBeNull();

    for (const name of Object.keys(params!)) {
      expect(paramsBlock, `/expenses/new이 ${name} 파라미터를 읽지 않는다`).toContain(`${name}?: string;`);
    }
  });

  it("결제 수단 파싱은 화이트리스트를 지나고, 모르는 값은 조용히 버려진다", () => {
    const contractSource = source("src/expenses/record-row-actions.ts");
    expect(contractSource).toContain("export const EXPENSE_PREFILL_PAYMENT_METHODS =");
    expect(contractSource).toContain("export function parseExpensePrefillPaymentMethod(");
    expect(contractSource).toContain("paymentMethod: parseExpensePrefillPaymentMethod(params.paymentMethod)");
    // 서버 enum의 "unknown"은 프리필로 실려 오지 않는다.
    expect(contractSource).toContain('["card", "cash", "transfer", "mobile_pay"] as const');
  });

  it("빠른 기록 시트가 프리필된 결제 수단을 세그먼트 초기값으로 쓴다", () => {
    expect(newExpenseSource).toContain(
      "quickExpensePaymentMethods.findIndex((method) => method.value === prefill.paymentMethod)"
    );
    expect(newExpenseSource).toContain(
      "prefilledPaymentMethodIndex >= 0 ? prefilledPaymentMethodIndex : 0"
    );
    // 프리필이 없거나 비세션이면 예전 그대로 0(카드)에서 시작한다(EXP-001 캡처 불변).
    expect(newExpenseSource).toContain("const prefilledPaymentMethodIndex = authToken");
  });

  it("날짜는 계약에 없다 — 새 기록은 오늘이다", () => {
    const moduleSource = source("src/expenses/recurring-template.ts");
    expect(moduleSource).not.toContain("spentOn:");
    expect(paramsBlock).not.toContain("spentOn");
  });
});

describe("라운드 55 #4 관리 화면 계약", () => {
  const screen = source("app/expenses/recurring.tsx");

  it("서술형 testID를 쓰고 잠긴 화면 ID 네임스페이스를 침범하지 않는다 (DNC-004)", () => {
    expect(screen).toContain('const recurringScreenId = "screen-recurring-expenses"');
    expect(screen).toContain("testID={recurringScreenId}");
    expect(screen).not.toMatch(/testID="(?:pixel-)?screen-(?:SPL|AUTH|ONB|HOME|EXP|ITEM|REP|FAM|IMP|SET|ADM)-/);
  });

  it("스택으로만 도달하는 화면이라 나가는 길이 있다", () => {
    expect(screen).toContain("onBack={() => router.back()}");
    expect(screen).toContain('from "expo-router"');
  });

  it("비세션·아이 미선택에서는 관리 UI를 그리지 않는다 (수용 기준 9)", () => {
    expect(screen).toContain("const canManage = Boolean(authToken && selectedChildId);");
    expect(screen).toContain("{!canManage ? (");
    expect(screen).toContain("{canManage ? (");
  });

  it("/expenses/new 진입점은 보기 전용 게이트를 지난다 (UX-R(M) · 라운드 40 J-9)", () => {
    // 게이트를 빠뜨리면 보기 전용 참여자가 "기기에 저장했어요"를 듣고 flush에서 403을 받는다.
    // 반대로 템플릿 CRUD는 지출이 아니므로 게이트를 지나지 않는다.
    expect(screen).toContain("const expenseGate = useExpenseEntryGate();");
    expect(screen).toContain("onPress={expenseGate.guard(");
    expect(screen).toContain('router.push({ pathname: "/expenses/new", params });');
  });

  it("삭제는 확인 다이얼로그를 거치고, 발견 불가 제스처 전용 동작을 만들지 않는다", () => {
    expect(screen).toContain("Alert.alert(");
    expect(screen).not.toContain("onLongPress");
  });

  it("작은 코랄 텍스트를 쓰지 않는다 (A11Y-117 대비 규칙)", () => {
    expect(screen).not.toMatch(
      /(?<![A-Za-z])color:\s*theme\.colors\.(?:mainCoral|subCoral|peach|coral\[(?:50|100|200|300|400|500|600)\])/
    );
  });
});

describe("라운드 55 #4 배치 결정 — 리마인더는 한 자리뿐 (§1.5)", () => {
  it("기록 탭에는 정기 지출 리마인더를 두지 않는다", () => {
    /**
     * 이건 트랙 A의 일시적 경계가 아니라 **지속되는 결정**이라 여기 고정한다.
     *
     * 기록 탭 헤더에는 이미 빠른 기록 버튼 · 확정 토스트 · 대기/실패/충돌 배지 · 아이 이름 ·
     * 월 이동 · 요약 · 검색 · 필터 칩이 서 있고, `record_gap` 알림의 딥링크 목적지도 이 화면이다
     * (src/notifications/notification-route.ts). 여기에 리마인더를 하나 더 세우면 같은 사람이
     * 같은 화면에서 두 번 재촉당한다. 리마인더의 자리는 홈 카드 한 곳뿐이고, 그 합류는 홈
     * 순위표(HOME_SECTION_RANK)의 상한 규칙 안에서 경쟁한다 — 트랙 C의 몫이다.
     */
    expect(source("app/(tabs)/records.tsx")).not.toContain("recurring");
  });

  it("정기 지출 리마인더는 인앱 알림함 종류를 늘리지 않는다", () => {
    // 채널이 다르다: record_gap = 알림함 엔트리(주 1회 dedupe), 정기 지출 = 홈 카드.
    // 알림함에 넣으면 설정 화면에 7번째 스위치가 필요해지고 dedupe 메모리를 소모한다(§1.2).
    const options = source("src/notifications/notification-preferences.store.ts");
    expect(options).not.toContain("recurring");
    expect(codeOnly("src/expenses/recurring-template.ts")).not.toContain("dedupeKey");
  });
});
