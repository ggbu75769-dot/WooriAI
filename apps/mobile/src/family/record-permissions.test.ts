import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canRecordExpenses,
  EXPENSE_EDIT_ROLES,
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  isExpenseEntryLocked,
  isViewOnlyRole,
  resolveHouseholdRole,
  VIEW_ONLY_ROLES
} from "./record-permissions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("UX-R(M) 역할별 기록 권한 판정", () => {
  it("서버 canEdit과 같은 역할만 기록할 수 있다", () => {
    expect(canRecordExpenses("owner")).toBe(true);
    expect(canRecordExpenses("co_parent")).toBe(true);
    expect(canRecordExpenses("viewer")).toBe(false);
    expect(canRecordExpenses("gift_participant")).toBe(false);
  });

  it("모르는 역할·미상은 기록 권한을 주장하지 않는다(서버 기준을 앱에서 넓히지 않는다)", () => {
    expect(canRecordExpenses(undefined)).toBe(false);
    expect(canRecordExpenses(null)).toBe(false);
    expect(canRecordExpenses("")).toBe(false);
    expect(canRecordExpenses("grandparent")).toBe(false);
  });

  it("보기 전용 역할 목록은 초대 화면이 이름 붙인 두 역할이다", () => {
    expect([...VIEW_ONLY_ROLES]).toEqual(["viewer", "gift_participant"]);
    expect([...EXPENSE_EDIT_ROLES]).toEqual(["owner", "co_parent"]);
    expect(isViewOnlyRole("viewer")).toBe(true);
    expect(isViewOnlyRole("gift_participant")).toBe(true);
    expect(isViewOnlyRole("owner")).toBe(false);
    expect(isViewOnlyRole(undefined)).toBe(false);
  });
});

describe("UX-R(M) 진입점 잠금 판정", () => {
  it("실세션의 viewer·gift_participant만 잠근다", () => {
    expect(isExpenseEntryLocked({ hasSession: true, role: "viewer" })).toBe(true);
    expect(isExpenseEntryLocked({ hasSession: true, role: "gift_participant" })).toBe(true);
  });

  it("owner·co_parent는 잠그지 않는다", () => {
    expect(isExpenseEntryLocked({ hasSession: true, role: "owner" })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "co_parent" })).toBe(false);
  });

  it("역할 미상(구세션·로딩 전·데모)은 잠그지 않는다 — 초대 판정과 반대 방향인 것이 의도다", () => {
    // 여기서 잘못 열면 남는 것은 예전과 똑같은 403 실패 행 한 줄이지만, 잘못 잠그면 정상
    // 사용자의 핵심 루프(지출 기록)가 통째로 죽는다.
    expect(isExpenseEntryLocked({ hasSession: true, role: undefined })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: null })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "" })).toBe(false);
    // 서버가 나중에 새 역할을 추가해도 마찬가지다(canRecordExpenses의 단순 부정이 아니다).
    expect(canRecordExpenses("grandparent")).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "grandparent" })).toBe(false);
  });

  it("⚠ 픽셀락 HOME-001·EXP-001·ITEM-001/002: 비세션은 어떤 역할이 와도 잠기지 않는다", () => {
    // 캡처는 app/pixel-lock.tsx가 clearSession으로 세션을 지운 뒤 찍는다.
    for (const role of ["viewer", "gift_participant", "owner", undefined, null]) {
      expect(isExpenseEntryLocked({ hasSession: false, role })).toBe(false);
    }
  });
});

describe("UX-R(M) 가구 역할 해석", () => {
  it("가구를 알면 그 가구의 역할을 쓴다", () => {
    expect(
      resolveHouseholdRole({ householdRoles: { "h-1": "owner", "h-2": "viewer" }, householdId: "h-2" })
    ).toBe("viewer");
  });

  it("가구를 모르면 가구가 하나뿐일 때만 쓴다(다가구에서 남의 역할로 잠그지 않는다)", () => {
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "viewer" } })).toBe("viewer");
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "owner", "h-2": "viewer" } })).toBeUndefined();
  });

  it("표에 없는 가구·빈 표·null은 모두 모름이다", () => {
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "owner" }, householdId: "h-9" })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: {} })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: null })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: undefined, householdId: "h-1" })).toBeUndefined();
  });

  it("모름은 잠금으로 이어지지 않는다(두 함수를 이어 붙인 실제 경로)", () => {
    const role = resolveHouseholdRole({ householdRoles: null, householdId: "h-1" });
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });
});

describe("UX-R(M) 문구", () => {
  it("과제가 정한 안내 문구를 그대로 쓴다", () => {
    expect(EXPENSE_VIEW_ONLY_MESSAGE).toBe("보기 전용으로 참여하고 있어요. 기록은 관리자·공동부모가 남길 수 있어요.");
  });

  it("DNC-018: 해요체이고, 비난하지 않으며, 재시도를 권하지 않는다", () => {
    for (const copy of [EXPENSE_VIEW_ONLY_MESSAGE, EXPENSE_VIEW_ONLY_ALERT_TITLE]) {
      expect(copy).toMatch(/요\.?$/);
      expect(copy).not.toContain("다시 시도");
      expect(copy).not.toContain("권한이 없");
    }
  });
});

describe("UX-R(M) 세션 스토어 배선 (source contract)", () => {
  const sessionStoreSource = source("src/stores/session.store.ts");

  it("역할 표를 세션 스토어가 들고, 저장 버전을 함께 올린다", () => {
    expect(sessionStoreSource).toContain("householdRoles: Record<string, string> | null;");
    expect(sessionStoreSource).toContain("version: 3,");
    expect(sessionStoreSource).toContain("function normalizeHouseholdRoles(");
  });

  it("로그아웃은 역할을 지우고, 만료는 유지한다(AUTH-127 규칙과 같은 갈래)", () => {
    const clearBlock = sessionStoreSource.slice(sessionStoreSource.indexOf("clearSession: (reason: SessionEndReason"));
    const expiredShape = clearBlock.slice(clearBlock.indexOf('reason === "expired"'), clearBlock.indexOf(": {"));
    expect(expiredShape).not.toContain("householdRoles");
    expect(clearBlock).toContain("householdRoles: null,");
  });

  it("데모(테스트) 세션은 역할을 지어내지 않는다", () => {
    const testSessionBlock = sessionStoreSource.slice(
      sessionStoreSource.indexOf("startTestSession: () => {"),
      sessionStoreSource.indexOf("clearSession: (reason: SessionEndReason")
    );
    expect(testSessionBlock).toContain("householdRoles: null,");
  });

  it("로그인·초대 수락이 서버가 준 역할을 그대로 담는다(새 엔드포인트 없음)", () => {
    expect(source("app/(auth)/login.tsx")).toContain("households: result.user.households");
    expect(source("app/family/accept/[token].tsx")).toContain(
      "setHouseholdRole(result.household.id, result.household.role)"
    );
    // 가족 화면은 구성원 목록에서 확인한 내 역할로 스토어를 최신화한다(역할 변경 반영).
    expect(source("app/family/index.tsx")).toContain("setHouseholdRole(householdId, myRole);");
  });
});

describe("UX-R(M) 화면 배선 (source contract — 화면은 vitest에서 렌더할 수 없다)", () => {
  it("모든 지출 생성 진입점이 같은 판정 훅 하나를 거친다", () => {
    const wired: Array<[string, string]> = [
      // 홈: 퀵액션 · 빈 상태 · FAB · 첫 실행 유도 카드(지출 갈래만).
      ["app/(tabs)/index.tsx", 'label="지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))}'],
      ["app/(tabs)/index.tsx", 'actionLabel="기록하기"'],
      ["app/(tabs)/index.tsx", '<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />'],
      ["app/(tabs)/index.tsx", 'if (firstRunGuide.variant === "first-expense" && expenseGate.locked) {'],
      // 기록 탭: 상단 CTA · 빈 상태 · 행 액션(또 기록 · 삭제).
      ["app/(tabs)/records.tsx", 'label="빠른 지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))}'],
      ["app/(tabs)/records.tsx", "if (expenseEntryLocked) {"],
      // 리포트 탭 빈 상태.
      ["app/(tabs)/reports.tsx", 'onPress={expenseGate.guard(() => router.push("/expenses/new"))}'],
      // 준비템 목록의 "지출도 기록할까요?" · 상세의 "이미 샀어요" / "지출 기록하고 준비 완료".
      ["app/(tabs)/items.tsx", "const openExpenseLinkPrompt = expenseGate.guard("],
      ["app/items/[itemTemplateId].tsx", "onPress={expenseGate.guard(() =>"],
      // 구매 확인 카드의 "샀어요".
      ["src/commerce/PurchaseFollowupPrompt.tsx", "if (expenseGate.locked) {"],
      // 지출 상세의 수정 저장 · 삭제.
      ["app/expenses/[expenseId].tsx", "onPress={expenseGate.guard(() => save.mutate())}"],
      ["app/expenses/[expenseId].tsx", "if (expenseGate.locked) {"]
    ];
    for (const [file, snippet] of wired) {
      expect(source(file), `${file} — ${snippet}`).toContain(snippet);
    }
  });

  it("판정 훅을 쓰는 화면은 모두 같은 모듈에서 가져온다(화면마다 조건을 다시 적지 않는다)", () => {
    const screens = [
      "app/(tabs)/index.tsx",
      "app/(tabs)/records.tsx",
      "app/(tabs)/reports.tsx",
      "app/(tabs)/items.tsx",
      "app/items/[itemTemplateId].tsx",
      "app/expenses/[expenseId].tsx",
      "src/commerce/PurchaseFollowupPrompt.tsx"
    ];
    for (const screen of screens) {
      const text = source(screen);
      expect(text, screen).toContain("useExpenseEntryGate");
      expect(text, screen).toMatch(/from "(\.\.\/)+(src\/)?family\/useExpenseEntryGate"/);
      // 역할 문자열을 화면에서 직접 비교하는 복제 판정이 생기지 않게 한다.
      expect(text, screen).not.toContain('=== "gift_participant"');
    }
  });

  it("행 탭·행 액션의 '수정'은 막지 않는다 — 보기 전용도 지출 상세를 볼 수 있어야 한다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    const handler = recordsSource.slice(
      recordsSource.indexOf("const handleRowAction = useCallback<RecordRowActionHandler>("),
      recordsSource.indexOf("// EXP-005: not-yet-synced local expenses")
    );
    // 잠금 검사는 반드시 "edit" 조기 반환 **뒤**에 온다.
    expect(handler.indexOf('if (action === "edit")')).toBeLessThan(handler.indexOf("if (expenseEntryLocked)"));
    expect(handler.indexOf("if (expenseEntryLocked)")).toBeLessThan(handler.indexOf('if (action === "repeat")'));
  });

  it("훅은 판정을 스스로 적지 않고 순수 모듈에 위임한다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    expect(hookSource).toContain('from "./record-permissions"');
    expect(hookSource).toContain("isExpenseEntryLocked({ hasSession, role })");
    expect(hookSource).toContain("resolveHouseholdRole({ householdRoles, householdId })");
    // 다가구가 아니면 아이 목록을 새로 부르지 않는다(추가 요청 0건).
    expect(hookSource).toContain("enabled: hasSession && isMultiHousehold");
  });
});
