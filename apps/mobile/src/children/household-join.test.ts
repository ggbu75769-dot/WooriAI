import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHILD_REMOVAL_INVALIDATE_KEYS } from "./child-deletion";
import {
  acceptInviteHref,
  HOUSEHOLD_JOIN_ESCAPE_LABEL,
  HOUSEHOLD_JOIN_INVALIDATE_KEYS,
  HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE,
  HOUSEHOLD_JOIN_VIEWER_NOTICE,
  householdJoinEscapePlan,
  INVITE_RESUME_PARAM,
  isChildCreateBlockedRole,
  loginHrefForInvite,
  planAfterHouseholdJoin,
  resumeHrefAfterLogin
} from "./household-join";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("FAM-121A 비로그인 초대 방문자의 로그인 왕복", () => {
  it("보낸다: 초대 토큰을 실은 로그인 목적지 (예전에는 갈 곳 자체가 없었다)", () => {
    expect(loginHrefForInvite("inv-abc123")).toBe("/login?invite=inv-abc123");
    expect(INVITE_RESUME_PARAM).toBe("invite");
  });

  it("되돌린다: 로그인 성공 후 정확히 그 초대 수락 화면으로", () => {
    expect(resumeHrefAfterLogin("inv-abc123")).toBe("/family/accept/inv-abc123");
  });

  it("왕복이 토큰을 보존한다 (수락 화면 -> 로그인 -> 같은 수락 화면)", () => {
    const token = "inv-round-trip";
    const loginHref = loginHrefForInvite(token)!;
    // expo-router가 파라미터를 파싱해 돌려주는 값 = 쿼리스트링의 invite 값.
    const parsed = decodeURIComponent(loginHref.split(`${INVITE_RESUME_PARAM}=`)[1]);
    expect(resumeHrefAfterLogin(parsed)).toBe(acceptInviteHref(token));
  });

  it("URL에 안전하지 않은 문자가 든 토큰도 왕복에서 살아남는다", () => {
    const token = "inv/with space&amp";
    const loginHref = loginHrefForInvite(token)!;
    expect(loginHref).toBe(`/login?invite=${encodeURIComponent(token)}`);
    expect(resumeHrefAfterLogin(token)).toBe(`/family/accept/${encodeURIComponent(token)}`);
  });

  it("초대 없이 온 로그인은 기존 목적지를 그대로 쓴다 (null = 호출측 폴백)", () => {
    expect(resumeHrefAfterLogin(undefined)).toBeNull();
    expect(resumeHrefAfterLogin("")).toBeNull();
    expect(resumeHrefAfterLogin("   ")).toBeNull();
    expect(resumeHrefAfterLogin(123)).toBeNull();
    expect(loginHrefForInvite("")).toBeNull();
  });

  it("expo-router가 파라미터를 배열로 줄 때도 첫 값을 쓴다", () => {
    expect(resumeHrefAfterLogin(["inv-abc123", "inv-second"])).toBe("/family/accept/inv-abc123");
    expect(resumeHrefAfterLogin([])).toBeNull();
  });
});

describe("FAM-121A 수락 성공 후 아이 재선택", () => {
  const daon = { id: "child-1", householdId: "household-old", nickname: "다온이" };
  const tunt = { id: "child-2", householdId: "household-new", nickname: "튼튼이" };
  const barn = { id: "child-3", householdId: "household-new", nickname: "반디" };

  it("새로 참여한 가구의 첫 아이로 전환하고 홈으로 보낸다", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [daon, tunt, barn],
      currentChildId: "child-1"
    });
    expect(plan).toEqual({
      kind: "select",
      childId: "child-2",
      // 두 시점(라운드 96 T5): 종전 "튼튼이(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요."
      notice: "튼튼이로 전환했어요. 설정의 아이 관리에서 바꿀 수 있어요.",
      href: "/(tabs)"
    });
  });

  it("이전 가구 아이를 계속 가리키지 않는다 (버그 재현 방지)", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [daon, tunt],
      currentChildId: daon.id
    });
    expect(plan.kind === "select" ? plan.childId : null).not.toBe(daon.id);
  });

  it("이미 새 가구의 아이를 보고 있으면 아무것도 바꾸지 않는다 (무의미한 전환 안내 금지)", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [daon, tunt],
      currentChildId: tunt.id
    });
    expect(plan).toEqual({ kind: "keep", href: "/family" });
  });

  it("새 가구에 아직 아이가 없으면 선택을 건드리지 않는다", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-empty",
      children: [daon, tunt],
      currentChildId: daon.id
    });
    expect(plan).toEqual({ kind: "keep", href: "/family" });
  });

  it("목록 조회 실패(아이는 이미 있음)는 허위 전환 안내 없이 기존 동작 유지", () => {
    expect(planAfterHouseholdJoin({ householdId: "household-new", children: null, currentChildId: daon.id })).toEqual({
      kind: "keep",
      href: "/family"
    });
  });

  /**
   * 라운드 49 QA(P3-10): 초대 수락 뒤 **볼 아이가 하나도 없는** 사람의 막다른 길.
   *
   * /family는 탭 밖 화면이라 하단 탭이 없고, 탭으로 돌아가려 해도 온보딩 게이트가 "/"로
   * 되돌린다. 데모 세션은 children이 언제나 null이라(허위 전환 안내 금지) 항상 이 자리였고,
   * 초대 링크로 앱을 처음 연 사용자는 참여 직후 그대로 갇혔다.
   */
  describe("볼 아이가 없을 때 (P3-10)", () => {
    it("데모 세션(children: null)이자 아이가 없으면 온보딩으로 잇는다", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-new",
        children: null,
        currentChildId: null
      });
      expect(plan).toEqual({
        kind: "onboarding",
        notice: "아직 볼 수 있는 아이가 없어요. 아이 정보를 등록하면 바로 시작할 수 있어요.",
        href: "/onboarding/child-status"
      });
    });

    it("아직 아이가 없는 가구에 참여한 실세션도 같은 길로 간다", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-empty",
        children: [],
        currentChildId: null
      });
      expect(plan.kind).toBe("onboarding");
    });

    it("이미 보고 있는 아이가 있으면 종전대로 가족 화면에 남는다 (탭으로 돌아갈 길이 있다)", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-empty",
        children: null,
        currentChildId: daon.id
      });
      expect(plan).toEqual({ kind: "keep", href: "/family" });
    });

    it("안내는 사실만 말한다 — 있지도 않은 전환을 알리지 않는다", () => {
      const plan = planAfterHouseholdJoin({ householdId: "h", children: null, currentChildId: null });
      const notice = plan.kind === "onboarding" ? plan.notice : "";
      expect(notice).not.toContain("전환했어요");
      expect(notice).toMatch(/요\.$/);
    });
  });

  it("아이를 고른 적 없는 사용자도 새 가구 아이로 시작한다", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [tunt],
      currentChildId: null
    });
    expect(plan.kind === "select" ? plan.childId : null).toBe(tunt.id);
  });

  it("id가 비어 있는 malformed 응답 항목은 고르지 않는다", () => {
    const plan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [{ id: "", householdId: "household-new", nickname: "" }, tunt],
      currentChildId: null
    });
    expect(plan.kind === "select" ? plan.childId : null).toBe(tunt.id);
  });

  it("탭 셸 뒤로 보내는 계획은 select뿐이다 — 온보딩 게이트를 통과시켜야 하는 경로 (FIX-121C/F4)", () => {
    // app/(tabs)/_layout.tsx는 `!hasReachedHome && !isTestSession`이면 "/"로 되돌린다.
    // 그 게이트에 걸리는 목적지는 "/(tabs)" 하나뿐이므로, 화면은 정확히 이 분기에서만
    // markHomeReached()를 세우면 된다("keep"의 /family는 탭 밖이라 게이트를 지나지 않는다).
    const selectPlan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: [{ id: "child-2", householdId: "household-new", nickname: "튼튼이" }],
      currentChildId: null
    });
    const keepPlan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: null,
      // 라운드 49 QA(P3-10): 아이가 하나도 없는 경우는 이제 "keep"이 아니라 "onboarding"이라,
      // keep 분기를 보려면 이미 보고 있는 아이가 있어야 한다.
      currentChildId: "child-1"
    });
    const onboardingPlan = planAfterHouseholdJoin({
      householdId: "household-new",
      children: null,
      currentChildId: null
    });

    expect(selectPlan.href).toBe("/(tabs)");
    expect(keepPlan.href).toBe("/family");
    expect(keepPlan.href.startsWith("/(tabs)")).toBe(false);
    // 온보딩 경로도 탭 셸 뒤가 아니다 -- 게이트를 지나지 않으므로 markHomeReached가 필요 없다.
    expect(onboardingPlan.href).toBe("/onboarding/child-status");
    expect(onboardingPlan.href.startsWith("/(tabs)")).toBe(false);
  });

  /**
   * 라운드 60 #3 — 수락 **후**의 막다른 길 두 개.
   *
   * ① 보기 전용·선물 참여로 초대받은 사람에게 온보딩은 길이 아니라 403 벽이다
   *    (서버: children.controller.ts의 @RequireHouseholdRoles("owner","co_parent")).
   * ② 아이 목록 조회 실패를 "아이 없음"으로 접으면, 아이가 이미 있는 가구에 참여한 사람도
   *    온보딩으로 떨어져 **아이를 한 번 더 만들 수 있었다**.
   */
  describe("막다른 길 ① 아이를 등록할 수 없는 역할 (라운드 60 #3)", () => {
    it("viewer는 온보딩이 아니라 안내로 착지한다 (403 무한 재시도 차단)", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-empty",
        children: [],
        currentChildId: null,
        role: "viewer"
      });
      expect(plan).toEqual({ kind: "blocked", notice: HOUSEHOLD_JOIN_VIEWER_NOTICE, href: "/(tabs)" });
      expect(plan.href).not.toBe("/onboarding/child-status");
      // 라운드 60 리뷰(P1-2): /family는 갈 곳이 아니다 -- 온보딩 분기 주석이 같은 이유로
      // 이미 그렇게 적어 뒀다(탭 밖 화면 + 온보딩 게이트가 되돌린다).
      expect(plan.href).not.toBe("/family");
    });

    it("gift_participant도 같은 길이다", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-empty",
        children: [],
        currentChildId: null,
        role: "gift_participant"
      });
      expect(plan.kind).toBe("blocked");
    });

    it("아이를 만들 수 있는 역할(co_parent)은 종전대로 온보딩으로 간다", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-empty",
        children: [],
        currentChildId: null,
        role: "co_parent"
      });
      expect(plan.kind).toBe("onboarding");
    });

    it("역할을 모르면 종전 경로를 그대로 쓴다 (모른다고 잠그지 않는다)", () => {
      for (const role of [undefined, null, "", "some_new_role"]) {
        expect(
          planAfterHouseholdJoin({
            householdId: "household-empty",
            children: [],
            currentChildId: null,
            role
          }).kind
        ).toBe("onboarding");
      }
      expect(isChildCreateBlockedRole(undefined)).toBe(false);
      expect(isChildCreateBlockedRole("owner")).toBe(false);
      expect(isChildCreateBlockedRole("viewer")).toBe(true);
      expect(isChildCreateBlockedRole("gift_participant")).toBe(true);
    });

    it("볼 아이가 있는 viewer는 종전대로 가족 화면에 남는다 (안내가 필요 없다)", () => {
      expect(
        planAfterHouseholdJoin({
          householdId: "household-empty",
          children: [daon],
          currentChildId: daon.id,
          role: "viewer"
        })
      ).toEqual({ kind: "keep", href: "/family" });
    });

    it("그 가구에 아이가 이미 있으면 viewer도 그 아이로 전환한다 (등록 권한과 무관하다)", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-new",
        children: [tunt],
        currentChildId: null,
        role: "viewer"
      });
      expect(plan.kind === "select" ? plan.childId : null).toBe(tunt.id);
    });

    it("안내는 재시도를 권하지 않고, 실제로 통하는 다음 행동을 말한다 (INVITE_FORBIDDEN_MESSAGE 선례)", () => {
      expect(HOUSEHOLD_JOIN_VIEWER_NOTICE).not.toContain("다시 시도");
      expect(HOUSEHOLD_JOIN_VIEWER_NOTICE).toContain("관리자");
      expect(HOUSEHOLD_JOIN_VIEWER_NOTICE).toMatch(/요\.$/);
    });
  });

  describe("막다른 길 ② 아이 목록 조회 실패 (라운드 60 #3)", () => {
    it("조회 실패는 '아이 없음'으로 단정하지 않는다 — 온보딩으로 보내지 않는다 (중복 아이 방지)", () => {
      const plan = planAfterHouseholdJoin({
        householdId: "household-new",
        children: null,
        currentChildId: null,
        childrenLoadFailed: true
      });
      expect(plan).toEqual({ kind: "retry", notice: HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE, href: "/family" });
      expect(plan.href).not.toBe("/onboarding/child-status");
    });

    it("역할이 무엇이든 조회 실패가 먼저다 (viewer도 '아이 없음'이라 말하지 않는다)", () => {
      for (const role of ["viewer", "gift_participant", "co_parent", undefined]) {
        expect(
          planAfterHouseholdJoin({
            householdId: "household-new",
            children: null,
            currentChildId: null,
            role,
            childrenLoadFailed: true
          }).kind
        ).toBe("retry");
      }
    });

    it("데모 세션(조회하지 않음)은 실패가 아니라 종전대로 온보딩이다", () => {
      expect(
        planAfterHouseholdJoin({
          householdId: "household-new",
          children: null,
          currentChildId: null,
          childrenLoadFailed: false
        }).kind
      ).toBe("onboarding");
    });

    it("이미 보고 있는 아이가 있으면 조회가 실패해도 종전대로 가족 화면에 남는다", () => {
      expect(
        planAfterHouseholdJoin({
          householdId: "household-new",
          children: null,
          currentChildId: daon.id,
          childrenLoadFailed: true
        })
      ).toEqual({ kind: "keep", href: "/family" });
    });

    it("문구는 실패 사실만 말하고 재시도를 권한다 (권한 문구와 다른 문형)", () => {
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).toContain("불러오지 못했어요");
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).toContain("다시 시도");
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).not.toBe(HOUSEHOLD_JOIN_VIEWER_NOTICE);
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).not.toContain("아이가 없");
    });

    it("문구가 재시도만 권하지 않는다 — 탈출구를 함께 말한다 (라운드 60 리뷰 P1-1)", () => {
      // 이 실패의 가장 흔한 원인은 오프라인이라, "잠시 후 다시"만 권하면 되지 않는 버튼
      // 하나만 남긴 채 사용자를 이 화면에 묶어 둔다(참여는 이미 성공해 되돌릴 수도 없다).
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).not.toContain("잠시 후");
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).toContain("나중에");
      expect(HOUSEHOLD_JOIN_LOAD_FAILED_NOTICE).toMatch(/요\.$/);
    });

    it("재시도 갈래는 이동하지 않는다 — 화면에 머물며 다시 묻는다", () => {
      const retry = planAfterHouseholdJoin({
        householdId: "h",
        children: null,
        currentChildId: null,
        childrenLoadFailed: true
      });
      // 이 갈래의 href는 화면이 쓰지 않는다(카드가 그 자리에 선다). 탭 셸을 가리키지 않는
      // 것은 그대로다 -- 홈 도달 표시 없이 탭으로 보내면 게이트가 "/"로 되돌린다.
      expect(retry.href.startsWith("/(tabs)")).toBe(false);
    });
  });

  /**
   * 라운드 60 리뷰(P1-1·P1-2) — 두 갈래의 **착지**가 온보딩 게이트와 맞물린다.
   *
   * 탭 셸(`/(tabs)`)로 보내는 목적지는 `markHomeReached()`가 세워져야 게이트
   * (app/(tabs)/_layout.tsx의 `!hasReachedHome`)를 지난다. 그 목적지가 이제 셋이다:
   * select(종전) · blocked(P1-2) · 재시도 카드의 탈출구(P1-1, 계정 상태에 따라).
   */
  describe("탭 셸 착지와 홈 도달 표시 (라운드 60 리뷰)", () => {
    it("blocked도 탭 셸로 간다 — 화면은 select와 같이 markHomeReached()를 세운다", () => {
      const acceptSource = source("app/family/accept/[token].tsx");
      expect(acceptSource).toContain('if (plan.kind === "blocked") markHomeReached();');
      // onboarding 갈래는 탭 밖이라 종전 그대로 세우지 않는다.
      expect(acceptSource).not.toContain('if (plan.kind === "onboarding") markHomeReached();');
    });

    it("탈출구는 계정 상태로 목적지를 정한다 (아이 있음·홈 도달 → 탭, 아니면 온보딩)", () => {
      expect(householdJoinEscapePlan({ currentChildId: "child-1" })).toEqual({
        href: "/(tabs)",
        marksHomeReached: true
      });
      expect(householdJoinEscapePlan({ currentChildId: null, hasReachedHome: true })).toEqual({
        href: "/(tabs)",
        marksHomeReached: true
      });
      expect(householdJoinEscapePlan({ currentChildId: null, hasReachedHome: false })).toEqual({
        href: "/onboarding/child-status",
        marksHomeReached: false
      });
      expect(householdJoinEscapePlan({})).toEqual({ href: "/onboarding/child-status", marksHomeReached: false });
    });

    it("홈 도달 표시는 탭 셸 목적지에만 붙는다 (게이트를 지나는 목적지가 그것뿐이라)", () => {
      for (const input of [
        { currentChildId: "child-1" },
        { currentChildId: null, hasReachedHome: true },
        { currentChildId: null, hasReachedHome: false }
      ]) {
        const escape = householdJoinEscapePlan(input);
        expect(escape.marksHomeReached).toBe(escape.href.startsWith("/(tabs)"));
      }
    });

    it("재시도 카드에 탈출구 버튼이 실제로 있다 (막다른 길 방지 — 소스 계약)", () => {
      const acceptSource = source("app/family/accept/[token].tsx");
      expect(acceptSource).toContain("label={HOUSEHOLD_JOIN_ESCAPE_LABEL}");
      expect(acceptSource).toContain("householdJoinEscapePlan({ currentChildId: selectedChildId, hasReachedHome })");
      expect(acceptSource).toContain("if (escape.marksHomeReached) markHomeReached();");
      expect(acceptSource).toContain("router.replace(escape.href)");
      // 재시도 버튼은 그대로 남는다 -- 탈출구는 재시도를 **대체하지 않는다**.
      expect(acceptSource).toContain('accessibilityLabel="가족 정보 다시 불러오기"');
      expect(HOUSEHOLD_JOIN_ESCAPE_LABEL).toBe("나중에 하기");
    });

    it("기본 가구를 덮어쓰지 않는다 — 모를 때만 채운다 (P1-3 가구 복구 경로)", () => {
      const acceptSource = source("app/family/accept/[token].tsx");
      expect(acceptSource).toContain("if (!useSessionStore.getState().defaultHouseholdId) {");
      expect(acceptSource).toContain("useSessionStore.setState({ defaultHouseholdId: result.household.id });");
      // 조건 없는 덮어쓰기(종전 형태)가 되살아나면 아이 없는 원래 가구가 다시 소실된다 --
      // 기본 가구를 쓰는 자리는 이 가드 안의 한 줄뿐이다.
      expect(acceptSource.split("defaultHouseholdId: result.household.id").length - 1).toBe(1);
      // 알고 있는 가구 목록에 더하는 일은 setHouseholdRole이 진다(라운드 40 J-2).
      expect(acceptSource).toContain(
        "useSessionStore.getState().setHouseholdRole(result.household.id, result.household.role);"
      );
    });
  });

  it("아이 목록 + 아이 스코프 캐시 전부에 가구 구성원 목록까지 무효화한다", () => {
    expect(HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => key[0])).toEqual([
      "children",
      "home",
      "expenses",
      "expense",
      "budget",
      "items",
      "item-detail",
      "report",
      "household-members"
    ]);
    // R19-C 삭제/탈퇴 뒤처리의 단일 소스를 재사용한다 -- 새 아이 스코프 화면이 생기면 한 곳만 고친다.
    expect(HOUSEHOLD_JOIN_INVALIDATE_KEYS.length).toBe(CHILD_REMOVAL_INVALIDATE_KEYS.length + 1);
  });
});
