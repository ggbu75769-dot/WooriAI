/**
 * G2 (FAM-121A/B): 가족 초대·수락 여정 -- 가족 화면(app/family/index.tsx, invite.tsx,
 * accept/[token].tsx)이 실제로 부르는 모듈만으로 흐름을 끝까지 걸어 본다: 공개 API 클라이언트
 * (src/api/client.ts) + LOCAL_SESSION_TOKEN, 라벨 단일 소스(src/family/memberLabels.ts),
 * 순수 계획 로직(src/children/household-join.ts), 그리고 캐시 무효화를 관찰하기 위한 실제
 * @tanstack/react-query QueryClient. demo-user-journey.test.ts / children-management-journey.test.ts
 * 와 같은 관례다: 하나의 순서 있는 describe, 각 it은 앞 단계가 남긴 상태 위에서 이어지고,
 * beforeAll이 resetLocalBackendForTests()로 로컬 백엔드를 비운다.
 *
 * 왜 필요한가: src/family-invite-flow.test.ts는 화면 소스를 grep해 "배선"만 고정하고
 * (vitest에서 .tsx를 렌더할 수 없기 때문), src/family/pending-invites.test.ts는 local-backend
 * 함수를 직접 부른다. 그래서 "초대를 만들고 → 목록에서 보고 → 취소하면 그 링크가 죽고" /
 * "수락하면 멤버 목록에 반영되고 아이 재선택 계획이 선다"는 **동작**은 어느 쪽에서도 실행된
 * 적이 없었다. 이 여정이 그 사각을 채운다.
 *
 * 로컬(데모) 백엔드에서 재현할 수 없는 단계는 SKIPPED-STEP으로 인라인 표기한다:
 *
 *   SKIPPED STEP (수락자 신원) -- 데모 백엔드의 acceptInvite는 언제나 고정된 초대 대상
 *   (LOCAL_DAD_USER_ID = "아빠")으로 참여한다. 실제 서버처럼 "제3의 사용자가 자기 계정으로
 *   수락"하는 상황은 apps/api/test/family-invite.e2e.test.ts가 실제 계정 두 개로 덮는다.
 *
 *   SKIPPED STEP (다른 가구로 참여) -- 데모 세션은 가구가 하나뿐이라 수락 화면이 의도적으로
 *   planAfterHouseholdJoin에 `children: null`을 넘긴다(허위 전환 안내 금지, FIX-118B(F3)와
 *   같은 정직성 규칙). 아래 5단계는 그 데모 분기와, 서버 경로가 넘기게 될 실제 `GET /children`
 *   응답 모양(= listChildren이 돌려주는 바로 그 행)을 모두 통과시킨다.
 *
 *   SKIPPED STEP (만료 경계) -- 로컬 백엔드에는 초대 만료 시각을 되돌릴 수 있는 경로가 없다
 *   (createInvite가 항상 지금+7일로 못박는다). 만료 직전/직후의 수락·목록·취소는
 *   apps/api/test/family-invite.e2e.test.ts의 "G2: 만료 경계" 케이스가 실제 DB로 덮는다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  LOCAL_SESSION_TOKEN,
  acceptInvite,
  cancelHouseholdInvite,
  createInvite,
  getInvite,
  listChildren,
  listHouseholdInvites,
  listHouseholdMembers,
  removeHouseholdMember,
  type Child,
  type HouseholdMember
} from "../api/client";
import { resetLocalBackendForTests, seedLocalDemoFixturesForTests } from "../api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_DAD_USER_ID, LOCAL_HOUSEHOLD_ID } from "../api/local-fixtures";
import { HOUSEHOLD_JOIN_INVALIDATE_KEYS, planAfterHouseholdJoin } from "../children/household-join";
import { formatInviteExpiry, memberBadge } from "../family/memberLabels";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";

const token = LOCAL_SESSION_TOKEN;
const householdId = LOCAL_HOUSEHOLD_ID;

/** 초대 링크에서 토큰만 떼어낸다 (수락 화면이 라우트 파라미터로 받는 값). */
function tokenFromInviteUrl(inviteUrl: string) {
  const value = inviteUrl.split("/invite/")[1];
  expect(value).toBeTruthy();
  return value;
}

async function memberFor(userId: string): Promise<HouseholdMember | undefined> {
  return (await listHouseholdMembers(token, householdId)).members.find((member) => member.userId === userId);
}

// 순서 있는 단계들이 공유하는 여정 컨텍스트(vitest는 파일 내 it을 선언 순서대로 실행한다).
const journey: {
  cancelledInviteToken: string | null;
  acceptedInviteToken: string | null;
  invitedUserId: string | null;
  queryClient: QueryClient;
} = {
  cancelledInviteToken: null,
  acceptedInviteToken: null,
  invitedUserId: null,
  queryClient: new QueryClient()
};

describe("G2: 가족 초대·수락 여정 (local backend)", () => {
  beforeAll(() => {
    resetLocalBackendForTests();
    // 실기기 피드백 1: 테스트 로그인은 이제 데이터 0에서 시작한다. 이 여정은 "이미 아이와
    // 가족이 있는 세션"에서의 초대·수락을 검증하므로, 그 상태를 arrange로 직접 만들어 둔다.
    seedLocalDemoFixturesForTests();
    useSessionStore.getState().clearSession();
    useSessionStore.getState().startTestSession();
  });

  // -------------------------------------------------------------------------
  // 1단계 -- 가족 화면(FAM-001)의 출발 상태
  // -------------------------------------------------------------------------
  it("step 1: 가족 화면은 활성 멤버만, 역할별 배지와 함께 보여 준다", async () => {
    const { members } = await listHouseholdMembers(token, householdId);

    expect(members.map((member) => member.role)).toEqual(["owner", "co_parent"]);
    expect(members.every((member) => member.status === "active")).toBe(true);
    expect(members.every((member) => member.householdId === householdId)).toBe(true);
    // FAM-121B(E3): 관리자와 그 외를 "멤버"로 뭉뚱그리지 않고 역할별로 구분해 읽어 준다.
    expect(members.map((member) => memberBadge(member.role, member.status))).toEqual([
      { label: "관리자", tone: "warning" },
      { label: "공동부모", tone: "neutral" }
    ]);

    // 아직 대기 중인 초대는 없다.
    expect((await listHouseholdInvites(token, householdId)).invites).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 2단계 -- 초대 생성(FAM-002) -> 대기 목록
  // -------------------------------------------------------------------------
  it("step 2: 만든 초대가 대기 목록에 뜨고, 링크·토큰은 목록에 절대 실리지 않는다", async () => {
    const created = await createInvite(token, householdId, "viewer", "link");
    journey.cancelledInviteToken = tokenFromInviteUrl(created.inviteUrl);

    const { invites } = await listHouseholdInvites(token, householdId);
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      householdId,
      role: "viewer",
      channel: "link",
      status: "pending",
      // 토큰이 해시로만 저장되는 서버와 같은 계약: 링크 재공유는 불가능하며, 정직한 복구
      // 경로는 "취소 후 재생성"이다.
      canReshareLink: false
    });

    const serialized = JSON.stringify(invites[0]);
    expect(serialized).not.toContain(journey.cancelledInviteToken!);
    expect(serialized).not.toContain("/invite/");

    // 목록 행이 실제로 읽어 주는 문구(FIX-121C(F9-a)의 단일 소스). 방금 만든 초대는 7일 뒤
    // 만료이므로 "만료됨"이 될 수 없다.
    const expiryText = formatInviteExpiry(invites[0].expiresAt);
    expect(expiryText).not.toBe("만료됨");
    expect(expiryText).toContain("일까지");

    // 아직 아무도 수락하지 않았으므로 멤버 목록은 그대로다.
    expect((await listHouseholdMembers(token, householdId)).members).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 3단계 -- 초대 취소 -> 그 링크로는 수락 불가
  // -------------------------------------------------------------------------
  it("step 3: 취소한 초대는 목록에서 사라지고 그 링크로는 참여할 수 없다", async () => {
    const inviteId = (await listHouseholdInvites(token, householdId)).invites[0].id;
    const inviteToken = journey.cancelledInviteToken!;

    expect(await cancelHouseholdInvite(token, householdId, inviteId)).toEqual({ success: true });
    expect((await listHouseholdInvites(token, householdId)).invites).toEqual([]);

    // 핵심: 취소된 링크는 만료된 링크만큼 확실히 죽어 있어야 한다.
    await expect(acceptInvite(token, inviteToken)).rejects.toThrow();
    // 그리고 취소가 멤버를 늘리거나 줄이지 않았다.
    expect((await listHouseholdMembers(token, householdId)).members).toHaveLength(2);

    // 같은 초대를 두 번 취소하는 것은 조용히 성공하지 않는다.
    await expect(cancelHouseholdInvite(token, householdId, inviteId)).rejects.toThrow();

    /**
     * 여정 관찰(여기서 고치지 않는다 -- 테스트 전용): 데모 백엔드의 getInvitePreview는 상태를
     * 보지 않아서, 취소된 초대도 미리보기는 계속 돌려준다. 실제 서버는 이 경로를 400
     * INVITE_NOT_PENDING으로 닫는다(apps/api/test/family-invite.e2e.test.ts의 취소/만료
     * 케이스). 수락 화면 입장에서 위험한 쪽 -- 실제 참여 -- 은 위에서 이미 막혀 있으므로,
     * 데모의 미리보기 관대함은 현재 동작 그대로 고정만 해 둔다.
     */
    await expect(getInvite(inviteToken)).resolves.toMatchObject({ role: "viewer" });
  });

  // -------------------------------------------------------------------------
  // 4단계 -- 재초대 -> 수락 -> 멤버 목록 반영
  // -------------------------------------------------------------------------
  it("step 4a: 관리자가 공동부모를 내보내면 멤버 목록에서 즉시 빠진다", async () => {
    const coParent = await memberFor(LOCAL_DAD_USER_ID);
    expect(coParent).toBeDefined();
    journey.invitedUserId = coParent!.userId;

    expect(await removeHouseholdMember(token, householdId, coParent!.id)).toEqual({ success: true });

    const { members } = await listHouseholdMembers(token, householdId);
    expect(members.map((member) => member.role)).toEqual(["owner"]);
    expect(await memberFor(journey.invitedUserId!)).toBeUndefined();

    // 본인(관리자)은 이 경로로 나갈 수 없다 -- 가구가 주인 없이 남는 것을 막는다.
    await expect(removeHouseholdMember(token, householdId, members[0].id)).rejects.toThrow();
  });

  it("step 4b: 새 초대를 수락하면 초대한 역할 그대로 멤버 목록에 다시 나타난다", async () => {
    const created = await createInvite(token, householdId, "gift_participant", "kakao");
    journey.acceptedInviteToken = tokenFromInviteUrl(created.inviteUrl);

    // 수락 화면이 먼저 보여 주는 미리보기(FAM-003 상단 카드)와 실제 수락 결과가 일치한다.
    const preview = await getInvite(journey.acceptedInviteToken!);
    expect(preview).toMatchObject({ householdName: created.householdName, role: "gift_participant" });

    const accepted = await acceptInvite(token, journey.acceptedInviteToken!);
    expect(accepted.household).toMatchObject({ id: householdId, role: "gift_participant" });

    // 멤버 목록 반영: 내보냈던 사람이 "선물 참여"로 다시 들어와 있다.
    const rejoined = await memberFor(journey.invitedUserId!);
    expect(rejoined).toMatchObject({ role: "gift_participant", status: "active", householdId });
    expect(memberBadge(rejoined!.role, rejoined!.status)).toEqual({ label: "선물 참여", tone: "neutral" });
    expect((await listHouseholdMembers(token, householdId)).members.map((member) => member.role)).toEqual([
      "owner",
      "gift_participant"
    ]);

    // 수락된 초대는 대기 목록에서 빠지고, 같은 링크는 두 번 쓸 수 없다(1회용 토큰).
    expect((await listHouseholdInvites(token, householdId)).invites).toEqual([]);
    await expect(acceptInvite(token, journey.acceptedInviteToken!)).rejects.toThrow();
    // 실패한 재수락이 멤버를 중복 생성하지 않았다.
    expect((await listHouseholdMembers(token, householdId)).members).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 5단계 -- 수락 성공 뒤처리: 캐시 무효화 + 아이 재선택 계획
  // -------------------------------------------------------------------------
  it("step 5a: 수락 성공은 아이 스코프 캐시와 가족 구성원 캐시를 함께 무효화한다", async () => {
    const queryClient = journey.queryClient;
    // 참여 직전 화면들이 들고 있었을 캐시를 심는다(가족 화면의 두 쿼리 키 + 아이 스코프들).
    for (const key of HOUSEHOLD_JOIN_INVALIDATE_KEYS) {
      queryClient.setQueryData([...key, LOCAL_CHILD_ID], { seeded: true });
      queryClient.setQueryData([...key], { seeded: true });
    }
    queryClient.setQueryData(["household-invites", householdId], { seeded: true });
    expect(queryClient.getQueryState(["household-members"])!.isInvalidated).toBe(false);

    // 수락 화면(app/family/accept/[token].tsx)의 onSuccess와 같은 무효화.
    await Promise.all(
      HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );

    for (const key of HOUSEHOLD_JOIN_INVALIDATE_KEYS) {
      expect(queryClient.getQueryState([...key])!.isInvalidated).toBe(true);
      expect(queryClient.getQueryState([...key, LOCAL_CHILD_ID])!.isInvalidated).toBe(true);
    }
    // 가족 구성원 목록이 이 집합에 포함돼 있다는 것이 FAM-121A의 요점이다 -- 방금 구성원이 된
    // 가구의 멤버 목록이 예전 응답으로 남으면 안 된다.
    expect(HOUSEHOLD_JOIN_INVALIDATE_KEYS.some((key) => key[0] === "household-members")).toBe(true);
  });

  it("step 5b: 참여한 가구에 아이가 있으면 그 아이로 전환하는 계획이 선다", async () => {
    // 서버 경로가 planAfterHouseholdJoin에 넘기는 값 = GET /children 응답 그대로.
    const { children } = await listChildren(token);
    expect(children.map((child: Child) => child.householdId)).toEqual([householdId]);

    useSelectedChildStore.getState().clearSelectedChildId();
    const plan = planAfterHouseholdJoin({
      householdId,
      children,
      currentChildId: useSelectedChildStore.getState().selectedChildId
    });

    expect(plan).toEqual({
      kind: "select",
      childId: LOCAL_CHILD_ID,
      notice: `${children[0].nickname}(으)로 전환했어요. 설정 > 아이 관리에서 바꿀 수 있어요.`,
      href: "/(tabs)"
    });
    if (plan.kind !== "select") throw new Error("unreachable");

    // 화면이 하는 일: 계획대로 아이를 고르고 이동한다.
    useSelectedChildStore.getState().setSelectedChildId(plan.childId);
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);
  });

  it("step 5c: 이미 그 가구 아이를 보고 있거나 고를 아이를 모르면 선택을 건드리지 않는다", async () => {
    const { children } = await listChildren(token);

    // 이미 새 가구의 아이를 보고 있다 -- 전환도 안내도 없다(허위 전환 안내 금지).
    expect(planAfterHouseholdJoin({ householdId, children, currentChildId: LOCAL_CHILD_ID })).toEqual({
      kind: "keep",
      href: "/family"
    });

    // 데모 세션의 실제 경로: 수락 화면이 children에 null을 넘긴다(위 SKIPPED-STEP 참고).
    // 라운드 49 QA(P3-10): 그때 보고 있는 아이도 없으면 /family는 막다른 길(탭 밖 + 온보딩
    // 게이트)이라 온보딩 시작점으로 잇는다. 아이가 있으면 종전대로 가족 화면에 남는다.
    expect(planAfterHouseholdJoin({ householdId, children: null, currentChildId: null })).toEqual({
      kind: "onboarding",
      notice: "아직 볼 수 있는 아이가 없어요. 아이 정보를 등록하면 바로 시작할 수 있어요.",
      href: "/onboarding/child-status"
    });
    expect(planAfterHouseholdJoin({ householdId, children: null, currentChildId: LOCAL_CHILD_ID })).toEqual({
      kind: "keep",
      href: "/family"
    });

    // 다른 가구의 아이만 있는 응답도 마찬가지 -- 남의 가구 아이로 전환하지 않는다.
    expect(
      planAfterHouseholdJoin({
        householdId: "other-household",
        children,
        currentChildId: LOCAL_CHILD_ID
      })
    ).toEqual({ kind: "keep", href: "/family" });

    // 선택은 5b가 고른 아이 그대로 살아 있다.
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);
  });
});
