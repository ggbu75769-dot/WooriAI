import { describe, expect, it } from "vitest";
import { CHILD_REMOVAL_INVALIDATE_KEYS } from "./child-deletion";
import {
  acceptInviteHref,
  HOUSEHOLD_JOIN_INVALIDATE_KEYS,
  INVITE_RESUME_PARAM,
  loginHrefForInvite,
  planAfterHouseholdJoin,
  resumeHrefAfterLogin
} from "./household-join";

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
      notice: "튼튼이(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요.",
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

  it("목록 조회 실패/데모 세션(null)은 허위 전환 안내 없이 기존 동작 유지", () => {
    expect(planAfterHouseholdJoin({ householdId: "household-new", children: null, currentChildId: null })).toEqual({
      kind: "keep",
      href: "/family"
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
