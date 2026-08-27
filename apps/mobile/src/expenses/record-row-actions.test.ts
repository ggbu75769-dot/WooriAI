import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANDROID_ALERT_BUTTON_LIMIT,
  buildRecordRowActions,
  buildRecordRowActionSheet,
  buildRepeatExpenseParams,
  isRepeatableExpenseType,
  parseExpensePrefillParams,
  recordRowAccessibilityActions,
  recordRowAccessibilityHint,
  recordRowAccessibilityLabel,
  RECORD_ROW_DELETE_LABEL,
  RECORD_ROW_EDIT_LABEL,
  RECORD_ROW_REPEAT_LABEL,
  RECORD_ROW_SHEET_FALLBACK_TITLE,
  RECORD_ROW_SHEET_MESSAGE,
  resolveRecordRowAction
} from "./record-row-actions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("UX-L(A) 행 액션 목록", () => {
  it("일반 지출 행은 수정 · 또 기록 · 삭제 세 갈래를 이 순서로 준다", () => {
    const actions = buildRecordRowActions({ expenseType: "expense" });

    expect(actions.map((action) => action.key)).toEqual(["edit", "repeat", "delete"]);
    expect(actions.map((action) => action.label)).toEqual([
      RECORD_ROW_EDIT_LABEL,
      RECORD_ROW_REPEAT_LABEL,
      RECORD_ROW_DELETE_LABEL
    ]);
  });

  it("DNC-015: 선물·환불 행에서는 '또 기록'을 아예 내놓지 않는다", () => {
    // 선물을 일반 지출로 복사하면 사용자가 쓰지 않은 돈이 이번 달 합계에 들어간다(허위 표시).
    // 타입까지 복사하는 대안도 택하지 않는다 -- 선물은 다시 사는 물건이 아니라 받은 물건이라
    // "또 기록"이라는 반복 구매 동선 자체가 성립하지 않는다(EXP-113 최근 품목 칩과 같은 판단).
    for (const expenseType of ["gift", "refund"]) {
      expect(buildRecordRowActions({ expenseType }).map((action) => action.key), expenseType).toEqual([
        "edit",
        "delete"
      ]);
    }
  });

  it("expenseType이 없는 레거시 행은 일반 지출로 본다", () => {
    expect(isRepeatableExpenseType(undefined)).toBe(true);
    expect(isRepeatableExpenseType(null)).toBe(true);
    expect(buildRecordRowActions({}).map((action) => action.key)).toEqual(["edit", "repeat", "delete"]);
  });

  /**
   * 라운드 38 H-7 — 눌러도 아무 일이 없는 항목.
   *
   * 프리필을 만드는 `buildRepeatExpenseParams`는 선물·환불에 더해 **빈 품목명·0 이하 금액**도
   * 막는데, 액션 목록은 `expenseType`만 봤다. 그래서 손상된 레거시 행(이름이 비었거나 금액이 0)
   * 에서는 "같은 내용으로 또 기록"이 보이는데 눌러도 아무 일도 일어나지 않았다.
   */
  it("H-7: 프리필을 만들 수 없는 행에서는 '또 기록' 항목 자체를 빼서 두 함수 규칙이 같다", () => {
    const rows = [
      { itemName: "기저귀", amountKrw: 38_500 },
      { itemName: "   ", amountKrw: 38_500 },
      { itemName: "", amountKrw: 38_500 },
      { itemName: "기저귀", amountKrw: 0 },
      { itemName: "기저귀", amountKrw: -1_000 },
      { itemName: "기저귀", amountKrw: 1_000.5 },
      { itemName: "기저귀", amountKrw: Number.NaN },
      { itemName: "기저귀", amountKrw: 38_500, expenseType: "gift" }
    ];

    for (const row of rows) {
      const offered = buildRecordRowActions(row).some((action) => action.key === "repeat");
      const usable = buildRepeatExpenseParams({ expenseType: "expense", ...row }) !== null;
      expect(offered, JSON.stringify(row)).toBe(usable);
      // 스크린리더 커스텀 액션도 같은 목록에서 나오므로 함께 사라진다.
      expect(
        recordRowAccessibilityActions(buildRecordRowActions(row)).some((action) => action.name === "repeat"),
        JSON.stringify(row)
      ).toBe(usable);
      // 목록에 없는 이름은 어떤 경로로도 실행되지 않는다.
      expect(resolveRecordRowAction("repeat", buildRecordRowActions(row)) !== null, JSON.stringify(row)).toBe(usable);
    }
  });

  it("H-7: 이름·금액을 넘기지 않는 호출부는 종전대로 expenseType만으로 판정한다", () => {
    expect(buildRecordRowActions({ expenseType: "expense" }).map((action) => action.key)).toEqual([
      "edit",
      "repeat",
      "delete"
    ]);
    // 이름만 아는 호출부는 아는 만큼만 검사한다(금액은 판정에서 빠진다).
    expect(buildRecordRowActions({ itemName: "기저귀" }).map((action) => action.key)).toContain("repeat");
    expect(buildRecordRowActions({ itemName: "  " }).map((action) => action.key)).not.toContain("repeat");
  });

  it("H-7: 액션시트도 같은 규칙이라 반응 없는 버튼이 뜨지 않는다", () => {
    const broken = buildRecordRowActionSheet({
      itemName: "  ",
      amountKrw: 38_500,
      expenseType: "expense",
      platform: "ios"
    });
    expect(broken.buttons.map((button) => button.actionKey)).toEqual(["edit", "delete", null]);
    // 이름을 지어내지 않는다(종전 규칙 유지).
    expect(broken.title).toBe(RECORD_ROW_SHEET_FALLBACK_TITLE);

    const zeroAmount = buildRecordRowActionSheet({
      itemName: "기저귀",
      amountKrw: 0,
      expenseType: "expense",
      platform: "ios"
    });
    expect(zeroAmount.buttons.map((button) => button.actionKey)).toEqual(["edit", "delete", null]);
  });

  it("삭제는 언제나 마지막이고 파괴적 동작으로 표시된다", () => {
    for (const expenseType of ["expense", "gift", undefined]) {
      const actions = buildRecordRowActions({ expenseType });
      const last = actions[actions.length - 1];
      expect(last.key, String(expenseType)).toBe("delete");
      expect(last.destructive, String(expenseType)).toBe(true);
      expect(actions.filter((action) => action.destructive)).toHaveLength(1);
    }
  });
});

describe("UX-L(A) 접근성: 롱프레스와 같은 목록을 커스텀 액션으로도 내놓는다", () => {
  it("accessibilityActions는 액션 목록과 이름·순서가 정확히 같다", () => {
    const actions = buildRecordRowActions({ expenseType: "expense" });

    expect(recordRowAccessibilityActions(actions)).toEqual([
      { name: "edit", label: RECORD_ROW_EDIT_LABEL },
      { name: "repeat", label: RECORD_ROW_REPEAT_LABEL },
      { name: "delete", label: RECORD_ROW_DELETE_LABEL }
    ]);
  });

  it("이 행이 내놓지 않은 액션 이름은 실행되지 않는다", () => {
    const giftActions = buildRecordRowActions({ expenseType: "gift" });

    expect(resolveRecordRowAction("edit", giftActions)).toBe("edit");
    expect(resolveRecordRowAction("delete", giftActions)).toBe("delete");
    // 선물 행에 "또 기록"이 어떤 경로로도 들어오면 안 된다.
    expect(resolveRecordRowAction("repeat", giftActions)).toBeNull();
    // OS 표준 액션/오타도 조용히 무시한다.
    expect(resolveRecordRowAction("activate", giftActions)).toBeNull();
    expect(resolveRecordRowAction("", giftActions)).toBeNull();
  });

  it("힌트는 실제로 제공하는 동작만 말한다 (조사는 마지막이 늘 '삭제'라 항상 맞는다)", () => {
    expect(recordRowAccessibilityHint(buildRecordRowActions({ expenseType: "expense" }))).toBe(
      "길게 누르면 수정·또 기록·삭제를 고를 수 있어요."
    );
    expect(recordRowAccessibilityHint(buildRecordRowActions({ expenseType: "gift" }))).toBe(
      "길게 누르면 수정·삭제를 고를 수 있어요."
    );
  });

  it("행 라벨은 화면에 보이는 세 문자열을 그대로 끊어 읽는다", () => {
    expect(
      recordRowAccessibilityLabel({ itemName: "기저귀", subtitle: "기저귀 · 8월 27일 (수)", amountLabel: "38,500원" })
    ).toBe("기저귀, 기저귀 · 8월 27일 (수), 38,500원");
    // 부제가 없으면 빈 조각을 남기지 않는다("기저귀, , 38,500원" 방지).
    expect(recordRowAccessibilityLabel({ itemName: "기저귀", subtitle: "", amountLabel: "38,500원" })).toBe(
      "기저귀, 38,500원"
    );
  });
});

describe("UX-L(A) 액션시트(RN Alert) 버튼 구성", () => {
  it("iOS는 동작 + 취소를 모두 담고, 삭제만 파괴적 스타일이다", () => {
    const sheet = buildRecordRowActionSheet({ itemName: "기저귀", expenseType: "expense", platform: "ios" });

    expect(sheet.title).toBe("기저귀");
    expect(sheet.message).toBe(RECORD_ROW_SHEET_MESSAGE);
    expect(sheet.buttons).toEqual([
      { label: RECORD_ROW_EDIT_LABEL, actionKey: "edit" },
      { label: RECORD_ROW_REPEAT_LABEL, actionKey: "repeat" },
      { label: RECORD_ROW_DELETE_LABEL, actionKey: "delete", style: "destructive" },
      { label: "취소", actionKey: null, style: "cancel" }
    ]);
  });

  it("Android는 3버튼 상한을 넘기지 않는다 (RN이 4번째를 말없이 잘라낸다)", () => {
    const sheet = buildRecordRowActionSheet({ itemName: "기저귀", expenseType: "expense", platform: "android" });

    expect(sheet.buttons.length).toBeLessThanOrEqual(ANDROID_ALERT_BUTTON_LIMIT);
    expect(sheet.buttons.map((button) => button.actionKey)).toEqual(["edit", "repeat", "delete"]);
    // 취소 버튼을 넣지 못했으므로 뒤로 가기/바깥 탭으로 빠져나갈 수 있어야 한다
    // (Android Alert의 기본값은 cancelable:false라 명시하지 않으면 갇힌다).
    expect(sheet.cancelable).toBe(true);
  });

  it("Android라도 동작이 둘뿐이면(선물 행) 취소 버튼이 들어간다", () => {
    const sheet = buildRecordRowActionSheet({ itemName: "배냇저고리", expenseType: "gift", platform: "android" });

    expect(sheet.buttons.map((button) => button.label)).toEqual([
      RECORD_ROW_EDIT_LABEL,
      RECORD_ROW_DELETE_LABEL,
      "취소"
    ]);
    expect(sheet.buttons[sheet.buttons.length - 1].style).toBe("cancel");
  });

  it("취소는 언제나 마지막이고 아무 동작도 싣지 않는다", () => {
    for (const platform of ["ios", "android", "web"]) {
      const sheet = buildRecordRowActionSheet({ itemName: "기저귀", expenseType: "gift", platform });
      const cancel = sheet.buttons[sheet.buttons.length - 1];
      expect(cancel.actionKey, platform).toBeNull();
      expect(cancel.style, platform).toBe("cancel");
      expect(sheet.cancelable, platform).toBe(true);
    }
  });

  it("품목명이 비어 있으면 이름을 지어내지 않는다", () => {
    expect(buildRecordRowActionSheet({ itemName: "   ", expenseType: "expense", platform: "ios" }).title).toBe(
      RECORD_ROW_SHEET_FALLBACK_TITLE
    );
  });
});

describe("UX-L(A) '같은 내용으로 또 기록' 프리필 계약", () => {
  const row = { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper", expenseType: "expense" };

  it("품목명·금액·카테고리만 싣는다 (날짜는 계약에 없다 -- 새 기록은 오늘이다)", () => {
    const params = buildRepeatExpenseParams(row);

    expect(params).toEqual({ itemName: "기저귀", amountKrw: "38500", categoryId: "cat-diaper" });
    expect(params && "spentOn" in params).toBe(false);
  });

  it("선물·환불 행은 파라미터를 만들지 않는다 (액션 목록과 같은 규칙)", () => {
    expect(buildRepeatExpenseParams({ ...row, expenseType: "gift" })).toBeNull();
    expect(buildRepeatExpenseParams({ ...row, expenseType: "refund" })).toBeNull();
  });

  it("DNC-013을 어기는 금액과 빈 품목명은 넘기지 않는다", () => {
    for (const amountKrw of [0, -1000, 1000.5, Number.NaN]) {
      expect(buildRepeatExpenseParams({ ...row, amountKrw }), String(amountKrw)).toBeNull();
    }
    expect(buildRepeatExpenseParams({ ...row, itemName: "   " })).toBeNull();
  });

  it("카테고리가 없으면 그 키를 아예 빼고 보낸다 (빈 값을 실어 보내지 않는다)", () => {
    expect(buildRepeatExpenseParams({ ...row, categoryId: null })).toEqual({ itemName: "기저귀", amountKrw: "38500" });
    expect(buildRepeatExpenseParams({ ...row, categoryId: "  " })).toEqual({ itemName: "기저귀", amountKrw: "38500" });
  });

  it("직렬화 → 파싱 왕복에서 값이 사라지지 않는다", () => {
    const params = buildRepeatExpenseParams(row);
    expect(params).not.toBeNull();

    expect(parseExpensePrefillParams(params!)).toEqual({
      itemName: "기저귀",
      amountText: "38500",
      categoryId: "cat-diaper"
    });
  });

  it("파싱은 잘못된 값을 조용히 버린다 (링크 때문에 저장이 막히는 화면을 만들지 않는다)", () => {
    for (const amountKrw of ["0", "-1", "1.5", "38,500", "abc", ""]) {
      expect(parseExpensePrefillParams({ amountKrw }).amountText, amountKrw).toBe("");
    }
    expect(parseExpensePrefillParams({ amountKrw: "38500" }).amountText).toBe("38500");
  });

  it("파라미터가 없거나 배열로 와도 안전하다 (expo-router는 string | string[]을 준다)", () => {
    expect(parseExpensePrefillParams({})).toEqual({ itemName: "", amountText: "", categoryId: null });
    expect(parseExpensePrefillParams({ itemName: ["기저귀", "분유"], amountKrw: ["38500"], categoryId: [] })).toEqual({
      itemName: "기저귀",
      amountText: "38500",
      categoryId: null
    });
    expect(parseExpensePrefillParams({ itemName: "  기저귀  ", categoryId: " cat-diaper " })).toEqual({
      itemName: "기저귀",
      amountText: "",
      categoryId: "cat-diaper"
    });
  });
});

/**
 * 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어 이 저장소의
 * 관례대로 소스 grep으로 확인한다: save-error-wiring.test.ts, records-list-virtualization.test.ts).
 */
describe("UX-L(A) 배선 계약", () => {
  const recordsSource = source("app/(tabs)/records.tsx");
  const detailSource = source("app/expenses/[expenseId].tsx");
  const newExpenseSource = source("app/expenses/new.tsx");

  it("기록 행은 롱프레스와 스크린리더 커스텀 액션을 **같은 목록**에서 얻는다", () => {
    expect(recordsSource).toContain('from "../../src/expenses/record-row-actions"');
    expect(recordsSource).toContain("buildRecordRowActions({ expenseType: expense.expenseType })");
    expect(recordsSource).toContain("recordRowAccessibilityActions(rowActions)");
    expect(recordsSource).toContain("onLongPress={openRowActionSheet}");
    expect(recordsSource).toContain("accessibilityActions={rowAccessibilityActions}");
    expect(recordsSource).toContain("onAccessibilityAction={handleRowAccessibilityAction}");
    expect(recordsSource).toContain("resolveRecordRowAction(event.nativeEvent.actionName, rowActions)");
  });

  it("공용 ListRow를 고치지 않고 이 화면 전용 래퍼로 감싼다 (안쪽은 터치·접근성 모두 잠근다)", () => {
    expect(recordsSource).toContain('<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">');
    // 안쪽 ListRow에 onPress를 다시 주면 그것이 responder를 가져가 롱프레스가 오지 않는다.
    expect(recordsSource).not.toMatch(/<ListRow[\s\S]{0,200}onPress=\{\(\) => router\.push\(`\/expenses\//);
  });

  it("삭제는 상세 화면과 같은 확인 문구 · 같은 오프라인 아웃박스 경로를 쓴다", () => {
    for (const [name, screenSource] of [
      ["records", recordsSource],
      ["detail", detailSource]
    ] as const) {
      expect(screenSource, name).toContain("Alert.alert(EXPENSE_DELETE_CONFIRM_TITLE, EXPENSE_DELETE_CONFIRM_MESSAGE, [");
      expect(screenSource, name).toContain("{ text: EXPENSE_DELETE_CONFIRM_CANCEL_LABEL, style: \"cancel\" },");
      // 문구를 화면에 다시 적으면 두 경로가 갈린다.
      expect(screenSource, name).not.toContain('Alert.alert("지출 삭제"');
      expect(screenSource, name).not.toContain('"이 지출 기록을 삭제할까요?"');
    }
    // 목록 전용 삭제 경로를 새로 만들지 않는다 -- 상세와 같은 adopt → outbox 삭제다.
    expect(recordsSource).toContain("const localRow = await adoptServerExpense(expense);");
    expect(recordsSource).toContain("await deleteExpenseOffline(authToken, queryClient, localRow.localId);");
    expect(recordsSource).toContain(
      'Alert.alert(EXPENSE_DELETE_FAILED_ALERT_TITLE, expenseMutationErrorMessage("delete", error));'
    );
  });

  it("'또 기록'은 프리필 파라미터를 순수 모듈에서 만들어 빠른 기록 시트로 보낸다", () => {
    expect(recordsSource).toContain("const params = buildRepeatExpenseParams(expense);");
    expect(recordsSource).toContain('router.push({ pathname: "/expenses/new", params });');
    // 날짜를 실어 보내면 지난달 행에서 또 기록할 때 이번 달 합계가 어긋난다.
    expect(recordsSource).not.toContain("spentOn: expense.spentOn }");
  });

  it("빠른 기록 시트는 같은 모듈로 프리필을 파싱한다 (계약이 한 곳에만 있다)", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/record-row-actions"');
    expect(newExpenseSource).toContain("const prefill = parseExpensePrefillParams(params);");
    expect(newExpenseSource).toContain("const prefilledItemName = prefill.itemName;");
    // 라운드 38 H-6: 8타일 id와 완전히 같지 않아도(서버 시드 UUID) 공용 매핑으로 타일을 찾는다.
    expect(newExpenseSource).toContain("buildTileCategoryIdResolver(");
    expect(newExpenseSource).toContain("resolveTileCategoryId(prefill.categoryId)");
    expect(newExpenseSource).toContain(
      "quickExpenseCategories.find((category) => category.id === prefilledCategoryTileId)"
    );
    // 매핑조차 안 되는 카테고리는 무시하고 기본 타일로 둔다(최근 품목 칩과 같은 판단).
    expect(newExpenseSource).toContain("const [selectedCategory, setSelectedCategory] = useState(prefilledCategory ?? quickExpenseCategories[0]);");
  });
});
