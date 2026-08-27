import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  canRecordExpenses,
  EXPENSE_EDIT_ROLES,
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  guardExpenseAction,
  isExpenseEntryLocked,
  isSingleKnownHousehold,
  isViewOnlyRole,
  needsChildHouseholdResolution,
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

  it("가구를 모르면 서버가 '가구가 하나뿐'이라고 말했을 때만 쓴다(다가구에서 남의 역할로 잠그지 않는다)", () => {
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] })).toBe("viewer");
    expect(
      resolveHouseholdRole({
        householdRoles: { "h-1": "owner", "h-2": "viewer" },
        knownHouseholdIds: ["h-1", "h-2"]
      })
    ).toBeUndefined();
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

/**
 * 라운드 40 J-2 — 1행짜리 **부분 표**가 "가구가 하나뿐"으로 오해되어 다른 가구의 내 아이까지
 * 잠그던 문제.
 *
 * 재현: H1의 owner이자 H2의 viewer인 사용자. v3 이전 블롭에서 올라와 역할 표가 null이 된 뒤,
 * 가족 화면이나 초대 수락으로 {H2: "viewer"} 한 줄만 복구된다. 표의 행 수만 보면 "가구가
 * 하나"라서, H1의 자기 아이를 보고 있어도(아이-가구 해석 실패 포함) 전부 잠겼다.
 */
describe("라운드 40 J-2 부분 표 vs 서버가 말한 가구 수", () => {
  const partialTable = { householdRoles: { "h-2": "viewer" }, knownHouseholdIds: null } as const;

  it("서버 가구 목록을 모르면 1행 표를 전체로 치지 않는다 — 아이-가구 해석 실패는 열림(undefined)", () => {
    expect(isSingleKnownHousehold(partialTable)).toBe(false);
    const role = resolveHouseholdRole({ ...partialTable, householdId: null });
    expect(role).toBeUndefined();
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });

  it("다른 가구(H1)의 아이를 보고 있으면 잠기지 않는다 — 표에 없는 가구는 모름이다", () => {
    const role = resolveHouseholdRole({ ...partialTable, householdId: "h-1" });
    expect(role).toBeUndefined();
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });

  it("부분 표가 담고 있는 그 가구(H2)의 아이는 종전대로 잠긴다", () => {
    const role = resolveHouseholdRole({ ...partialTable, householdId: "h-2" });
    expect(role).toBe("viewer");
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(true);
  });

  it("진짜 단일 가구(로그인 응답이 그렇게 말한다)는 종전대로 잠긴다", () => {
    const single = { householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] };
    expect(isSingleKnownHousehold(single)).toBe(true);
    const role = resolveHouseholdRole({ ...single, householdId: null });
    expect(role).toBe("viewer");
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(true);
  });

  it("서버가 말한 가구가 표의 가구와 다르면(잔여 표) 폴백하지 않는다", () => {
    expect(isSingleKnownHousehold({ householdRoles: { "h-9": "viewer" }, knownHouseholdIds: ["h-1"] })).toBe(false);
    expect(
      resolveHouseholdRole({ householdRoles: { "h-9": "viewer" }, knownHouseholdIds: ["h-1"] })
    ).toBeUndefined();
  });

  it("아이 목록 조회는 판정이 실제로 필요할 때만 켠다(대부분의 계정은 추가 요청 0건)", () => {
    // 표가 비었으면 어차피 잠기지 않는다.
    expect(needsChildHouseholdResolution({ householdRoles: null, knownHouseholdIds: null })).toBe(false);
    expect(needsChildHouseholdResolution({ householdRoles: {}, knownHouseholdIds: ["h-1"] })).toBe(false);
    // 서버가 가구가 하나뿐이라고 말했으면 그 하나를 쓰면 된다.
    expect(
      needsChildHouseholdResolution({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] })
    ).toBe(false);
    // 다가구 · 부분 표에서만 아이-가구 해석이 필요하다.
    expect(needsChildHouseholdResolution({ ...partialTable })).toBe(true);
    expect(
      needsChildHouseholdResolution({
        householdRoles: { "h-1": "owner", "h-2": "viewer" },
        knownHouseholdIds: ["h-1", "h-2"]
      })
    ).toBe(true);
  });
});

/**
 * 라운드 40 J-1 — 저장 **실행**을 감싸는 규칙. 진입점을 다 잠가도 목적지 화면(app/expenses/
 * new.tsx)이 그대로면 딥링크 한 번으로 "기기에 저장했어요 → 403 failed 행"이 되살아난다.
 */
describe("라운드 40 J-1 저장 실행 가드", () => {
  it("잠긴 역할의 저장 시도는 뮤테이션을 실행하지 않고 안내만 한다", () => {
    const mutate = vi.fn();
    const explain = vi.fn();
    guardExpenseAction(true, explain, mutate)();
    expect(mutate).not.toHaveBeenCalled();
    expect(explain).toHaveBeenCalledTimes(1);
  });

  it("잠기지 않았으면 인자까지 그대로 원래 동작으로 넘긴다", () => {
    const action = vi.fn();
    const explain = vi.fn();
    guardExpenseAction<[string, number]>(false, explain, action)("expense-1", 3);
    expect(action).toHaveBeenCalledWith("expense-1", 3);
    expect(explain).not.toHaveBeenCalled();
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
    // 라운드 40 J-2: 4는 `householdIds`(서버가 말한 가구 목록)를 더한 버전이다.
    expect(sessionStoreSource).toContain("version: 4,");
    expect(sessionStoreSource).toContain("function normalizeHouseholdRoles(");
    expect(sessionStoreSource).toContain("householdIds: string[] | null;");
    expect(sessionStoreSource).toContain("function normalizeHouseholdIds(");
  });

  it("라운드 40 J-2: setHouseholdRole은 한 가구 사실만 담고 '가구 목록 전체'로 넓히지 않는다", () => {
    const setOne = sessionStoreSource.slice(
      sessionStoreSource.indexOf("setHouseholdRole: (householdId, role) =>"),
      sessionStoreSource.indexOf("setHouseholdRoles: (households) =>")
    );
    // 이미 아는 목록에 없는 가구면 그 하나만 더한다 -- 모르는 목록(null)을 지어내지 않는다.
    expect(setOne).toContain("state.householdIds && !state.householdIds.includes(householdId)");
    expect(setOne).not.toContain("householdIds: [householdId]");
  });

  it("라운드 40 J-3: /me 재조회 응답은 표 전체를 갈아 끼운다(부분 표가 남지 않는다)", () => {
    expect(sessionStoreSource).toContain("setHouseholdRoles: (households) =>");
    const replaceAll = sessionStoreSource.slice(
      sessionStoreSource.indexOf("setHouseholdRoles: (households) =>"),
      sessionStoreSource.indexOf("startTestSession: () => {")
    );
    expect(replaceAll).toContain("householdRolesFrom(households)");
    expect(replaceAll).toContain("householdIdsFrom(households)");
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
    expect(hookSource).toContain("resolveHouseholdRole({ householdRoles, householdId, knownHouseholdIds })");
    expect(hookSource).toContain("guardExpenseAction(locked, explainExpenseViewOnly, action)");
    // 판정이 아이-가구 해석을 실제로 필요로 할 때만 아이 목록을 부른다(추가 요청 0건).
    expect(hookSource).toContain("enabled: hasSession && needsHouseholdLookup");
    expect(hookSource).toContain("needsChildHouseholdResolution({ householdRoles, knownHouseholdIds })");
  });

  /**
   * 라운드 40 J-1: 진입점 화이트리스트만으로는 부족하다 — 목적지 화면 자체가 저장을 막아야
   * 딥링크(`wooriai:///expenses/new`)와 아직 잠기지 않은 새 진입점이 같은 거짓말을 되살리지
   * 못한다.
   */
  it("라운드 40 J-1: 목적지 화면(app/expenses/new.tsx)의 저장 실행이 같은 게이트를 지난다", () => {
    const screen = source("app/expenses/new.tsx");
    expect(screen).toContain("useExpenseEntryGate");
    expect(screen).toContain("const expenseGate = useExpenseEntryGate();");
    expect(screen).toContain("onPress={expenseGate.guard(() => saveExpense.mutate())}");
    // 시트 진입 자체는 막지 않는다 -- 열람 후 안내가 이 앱의 관례다.
    expect(screen).not.toContain("if (expenseGate.locked) return null;");
    // 픽셀락 EXP-001: 저장 버튼의 disabled 조건은 종전 그대로다(비세션은 애초에 잠기지 않는다).
    expect(screen).toContain("disabled={saveExpense.isPending || isAmountInvalid}");
  });

  /**
   * 라운드 40 J-9 — **역방향 계약**. 위 화이트리스트는 "적어 둔 진입점"만 지킨다. 새 진입점이
   * 하나 생기면 목록에 없으니 통과해 버리므로, 여기서는 반대로 소스를 훑어 `/expenses/new`로
   * 실제로 이동하는 파일 집합을 찾아내고 **그 집합의 모든 파일**이 게이트를 참조하는지 본다.
   * 새 진입점의 기본값은 실패다.
   *
   * 파일 단위 검사인 이유: app/(tabs)/index.tsx의 오프라인 실패 카드 입구
   * (`OFFLINE_RECORDING_ENTRY_LABEL`)는 src/offline/messages.test.ts가 guard 없는 원문 그대로
   * 고정하고 있다(그 화면은 잠금과 무관하게 "기록은 지금도 남길 수 있어요"를 약속한다).
   * 그 한 줄은 J-1의 화면 게이트가 목적지에서 받아 주므로, 여기서는 파일이 게이트를 알고
   * 있는지만 확인해 두 계약이 충돌하지 않게 한다.
   */
  it("라운드 40 J-9: /expenses/new로 이동하는 모든 파일이 게이트를 참조한다(새 진입점 = 실패)", () => {
    const navigatesToNewExpense = /router\.(?:push|replace)\(\s*(?:\{[^{}]*)?["']\/expenses\/new["']/;
    const referencesGate = /useExpenseEntryGate|expenseGate\.(?:guard|locked|explain)|expenseEntryLocked/;

    const sourceFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        sourceFiles.push(fullPath);
      }
    };
    walk(join(mobileRoot, "app"));
    walk(join(mobileRoot, "src"));

    const entryPoints = sourceFiles
      .filter((fullPath) => navigatesToNewExpense.test(readFileSync(fullPath, "utf8")))
      .map((fullPath) => relative(mobileRoot, fullPath).split("\\").join("/"))
      .sort();

    // 스캔이 무언가를 실제로 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(entryPoints.length).toBeGreaterThan(3);
    expect(entryPoints).toContain("app/(tabs)/index.tsx");
    expect(entryPoints).toContain("src/commerce/PurchaseFollowupPrompt.tsx");

    const ungated = entryPoints.filter((path) => !referencesGate.test(source(path)));
    expect(ungated, `게이트를 거치지 않는 지출 기록 진입점: ${ungated.join(", ")}`).toEqual([]);
  });
});
