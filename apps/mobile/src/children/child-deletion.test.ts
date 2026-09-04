import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHILD_SCOPED_QUERY_KEY_PREFIXES } from "./child-switch";
import { CHILD_REMOVAL_INVALIDATE_KEYS, planAfterChildRemoval } from "./child-deletion";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("R19-C(F2) 아이 삭제 · 가구 탈퇴 이후 경로", () => {
  it("keeps the user in the app when another child remains, and says which one is selected now", () => {
    const plan = planAfterChildRemoval([
      { id: "child-1", nickname: "첫째" },
      { id: "child-3", nickname: "셋째" }
    ]);
    expect(plan).toEqual({
      kind: "select",
      childId: "child-1",
      // 두 시점(라운드 96 T5): 종전 "첫째(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요."
      notice: "첫째로 전환했어요. 설정의 아이 관리에서 바꿀 수 있어요."
    });
  });

  it("selects the single remaining child rather than bouncing to onboarding", () => {
    const plan = planAfterChildRemoval([{ id: "child-2", nickname: "둘째" }]);
    expect(plan.kind).toBe("select");
    expect(plan.kind === "select" ? plan.childId : null).toBe("child-2");
  });

  it("falls back to onboarding only when no child is left", () => {
    expect(planAfterChildRemoval([])).toEqual({ kind: "onboarding" });
  });

  it("falls back to onboarding when the remaining-children lookup itself failed (unknown, not empty)", () => {
    // 다음 실행에서 MOB-116 복구가 남은 아이를 다시 찾아주므로 영구적으로 막히지 않는다.
    expect(planAfterChildRemoval(null)).toEqual({ kind: "onboarding" });
  });

  it("invalidates every child-scoped query family plus the child list itself", () => {
    expect(CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => key[0])).toEqual([
      "children",
      "home",
      "expenses",
      "expense",
      "budget",
      "items",
      "item-detail",
      "report"
    ]);
    // 라운드 16의 단일 소스를 재사용한다 -- 새 아이 스코프 화면이 생기면 한 곳만 고치면 된다.
    expect(CHILD_REMOVAL_INVALIDATE_KEYS.length).toBe(CHILD_SCOPED_QUERY_KEY_PREFIXES.length + 1);
    expect(source("src/children/child-deletion.ts")).toContain(
      'import { CHILD_SCOPED_QUERY_KEY_PREFIXES } from "./child-switch";'
    );
  });

  describe("app/settings/privacy.tsx wiring (source contract -- the screen is not runtime-testable under vitest)", () => {
    const privacySource = source("app/settings/privacy.tsx");

    it("routes by the plan instead of always replacing to /onboarding/child-status", () => {
      expect(privacySource).toContain("planAfterChildRemoval(remaining)");
      expect(privacySource).toContain('router.replace("/(tabs)")');
      expect(privacySource).toContain('router.replace("/onboarding/child-status")');
      // 예전 구현: 삭제 성공 시 무조건 온보딩으로. 둘째를 지운 사용자까지 튕겼다.
      expect(privacySource).not.toContain(
        'Alert.alert("완료됐어요", "아이 프로필을 삭제했어요.");\n      router.replace("/onboarding/child-status");'
      );
    });

    it("looks up the remaining children after both removal flows and tolerates a failed lookup", () => {
      expect(privacySource).toContain("listChildren(authToken!)");
      expect(privacySource).toContain(".catch(() => null)");
      expect(privacySource).toContain('finishChildRemoval("아이 프로필을 삭제했어요.")');
      expect(privacySource).toContain('finishChildRemoval("가구에서 나갔어요.")');
    });

    it("keeps the demo session on its existing (onboarding) path, since local-backend does not model lost child access", () => {
      expect(privacySource).toContain("const isDemoSession = authToken === LOCAL_SESSION_TOKEN;");
      expect(privacySource).toContain("const remaining = isDemoSession");
    });

    it("invalidates through the shared key list and announces the new selection", () => {
      expect(privacySource).toContain("CHILD_REMOVAL_INVALIDATE_KEYS.map((key) =>");
      expect(privacySource).toContain("setSelectedChildId(plan.childId)");
      expect(privacySource).toContain("announceForA11y(plan.notice)");
    });
  });

  /**
   * 라운드 62 #5 — **삭제한 아이의 기기 잔재.**
   *
   * 뒤처리는 쿼리 캐시뿐이었다(위 CHILD_REMOVAL_INVALIDATE_KEYS). 기기에 persist되는 아이 단위
   * 상태 셋은 그대로 남아, 삭제한 아이의 알림 줄이 알림함에 계속 서고(태명을 해석할 수 없어
   * 어느 아이 것인지도 안 보인다) 정기 지출 템플릿이 아이별 상한 20칸을 차지한 채 남았다.
   * 트랙 B가 세 스토어에 아이 단위 정리 액션을 놓았고(clearForChild), 여기서는 그 **배선**을
   * 잡는다 -- 무엇을 지우는지는 각 스토어의 테스트가 이미 진다.
   */
  describe("라운드 62 #5 삭제한 아이의 기기 잔재 정리 (배선 source contract)", () => {
    const privacySource = source("app/settings/privacy.tsx");
    const blockBetween = (start: string, end: string) =>
      privacySource.slice(privacySource.indexOf(start), privacySource.indexOf(end));

    it("아이 삭제가 성공한 뒤 세 스토어의 아이 단위 정리를 부른다", () => {
      const childDeleteBlock = blockBetween("const childDelete = useMutation({", "const householdPreview = useMutation({");
      expect(childDeleteBlock).toContain("onSuccess: async () => {");
      expect(childDeleteBlock).toContain("const removedChildId = childId;");
      for (const store of [
        "useNotificationStore",
        "usePurchaseFollowupStore",
        "useRecurringExpenseStore"
      ]) {
        expect(childDeleteBlock, store).toContain(`${store}.getState().clearForChild(removedChildId);`);
        expect(privacySource, store).toContain(`import { ${store} }`);
      }
    });

    it("가구 탈퇴 경로에서는 부르지 않는다 — 사라진 아이 집합을 모른다", () => {
      const householdLeaveBlock = blockBetween("const householdLeave = useMutation({", "const accountPreview = useMutation({");
      // 주석에서 그 액션을 **언급**하는 것은 호출이 아니므로(왜 안 부르는지가 거기 적혀 있다),
      // 줄 첫 토큰이 호출인 형태만 잡는다 -- household-scope.test.ts의 clearSession 검사와 같은 관례.
      const clearForChildCall = /\n\s*use\w+Store\.getState\(\)\.clearForChild\(/;
      expect(householdLeaveBlock).not.toMatch(clearForChildCall);
      // 그 이유가 코드 옆에 그대로 남아 있어야 다음 라운드가 "빠뜨린 자리"로 오해하지 않는다.
      expect(householdLeaveBlock).toContain("어느 아이가 사라졌는가");
      // 공통 뒤처리(두 경로가 함께 지나는 자리)에도 없다 -- 있으면 탈퇴가 곧 그 호출이 된다.
      const finishBlock = blockBetween("const finishChildRemoval = async", "const privacy = useQuery({");
      expect(finishBlock).not.toMatch(clearForChildCall);
    });

    /**
     * 라운드 63 C(#4) 배선 — **네 번째 잔재: 기록 시트의 오프라인 초안.**
     *
     * 세 스토어는 깨끗해졌는데 초안만 살아남으면, 존재하지 않는 아이를 위해 치던 금액이 다음
     * 진입에서 남은 아이에게 프리필처럼 붙는다. 판정(무엇을 지우는가)은 모듈이 지고
     * (src/expenses/draft-storage.ts의 `clearQuickExpenseDraftForChild` — 트랙 C 소유),
     * 여기서는 **호출이 세 줄과 같은 자리에 있는지**만 잡는다.
     */
    it("삭제한 아이의 오프라인 초안도 같은 자리에서 지운다 (라운드 63 C 배선)", () => {
      const childDeleteBlock = blockBetween("const childDelete = useMutation({", "const householdPreview = useMutation({");
      expect(childDeleteBlock).toContain("await clearQuickExpenseDraftForChild(removedChildId);");
      expect(privacySource).toContain(
        'import { clearQuickExpenseDraftForChild } from "../../src/expenses/draft-storage";'
      );
      // 정리는 그 아이의 것으로 한정된다 -- 초안 전체를 지우는 함수를 부르면 다른 아이 앞에서
      // 치던 값까지 사라진다(그 규율은 모듈 주석과 draft-storage.test.ts가 진다).
      expect(privacySource).not.toMatch(/\n\s*await clearQuickExpenseDraft\(\)/);
      // 가구 탈퇴 경로에는 없다 -- 세 스토어와 같은 이유(사라진 아이 집합을 모른다).
      const householdLeaveBlock = blockBetween("const householdLeave = useMutation({", "const accountPreview = useMutation({");
      expect(householdLeaveBlock).not.toContain("clearQuickExpenseDraftForChild(");
    });

    it("PRIV-104 teardown(resetAll)과 섞지 않는다 — 아이 단위 정리는 별도 액션이다", () => {
      // 정체성 전환에만 발화하는 그 경로는 이 화면이 아니라 세션 teardown이 진다.
      expect(privacySource).not.toContain("resetAll()");
      expect(source("src/offline/session-teardown.ts")).toContain("useNotificationStore.getState().resetAll();");
      // 세 스토어 모두 같은 이름의 아이 단위 액션을 내놓는다(트랙 B 소유 -- 여기서는 호출만 한다).
      for (const storePath of [
        "src/notifications/notification.store.ts",
        "src/commerce/purchase-followup.store.ts",
        "src/stores/recurring-expense.store.ts"
      ]) {
        expect(source(storePath), storePath).toContain("clearForChild: (childId: string) => void;");
      }
    });
  });
});
