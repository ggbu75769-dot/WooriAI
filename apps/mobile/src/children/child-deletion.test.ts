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
      notice: "첫째(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요."
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
});
