import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 08 mobile family invite contract", () => {
  it("exposes household member and invite API client functions", async () => {
    const client = await import("./api/client");

    expect(client.listHouseholdMembers).toEqual(expect.any(Function));
    expect(client.createInvite).toEqual(expect.any(Function));
    expect(client.getInvite).toEqual(expect.any(Function));
    expect(client.acceptInvite).toEqual(expect.any(Function));
  });

  it("creates the locked family routes without changing the bottom tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"],
      ["app/family/index.tsx", "FAM-001"],
      ["app/family/index.tsx", "listHouseholdMembers"],
      // 라운드 52 C-04: 가족 화면의 `createInvite` 기대는 뺐다 -- 그 화면이 초대를 만들면 응답으로만
      // 볼 수 있는 링크를 보여 줄 자리가 없어 그대로 유실된다. 생성은 초대 화면 한 곳이고(아래),
      // 가족 화면이 그 경로를 다시 들이지 않는다는 계약은 src/family/invite-flow.test.ts가 진다.
      ["app/family/index.tsx", "inviteScreenHref"],
      ["app/family/invite.tsx", "FAM-002"],
      ["app/family/invite.tsx", "createInvite"],
      ["app/family/accept/[token].tsx", "FAM-003"],
      ["app/family/accept/[token].tsx", "getInvite"],
      ["app/family/accept/[token].tsx", "acceptInvite"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});

describe("FAM-121A 초대 수락 여정 배선 (source contract -- 화면은 vitest에서 렌더할 수 없어\n  기존 login-screen-contract.test.ts의 source-grep 관례를 따른다)", () => {
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("비로그인 방문자에게 데드엔드 문구 대신 로그인 경로를 준다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    // 예전: "로그인 후 가족에 참여할 수 있어요." 텍스트 + 비활성 버튼만 있고 갈 곳이 없었다.
    expect(acceptSource).toContain("로그인하고 참여하기");
    expect(acceptSource).toContain("const loginHref = loginHrefForInvite(token);");
    // FIX-121C(F4): replace여야 한다 -- 로그인 성공 후 login.tsx가 이 수락 화면을 다시 replace로
    // 열기 때문에, push면 수락 화면이 스택에 두 겹 남아 뒤로가기로 되돌아온 사용자가 이미 참여한
    // 초대를 다시 눌러 409(HOUSEHOLD_ALREADY_MEMBER)를 맞는다.
    expect(acceptSource).toContain("router.replace(loginHref)");
    expect(acceptSource).not.toContain("router.push(loginHref)");
    expect(acceptSource).not.toContain("로그인 후 가족에 참여할 수 있어요.");
  });

  it("로그인 화면이 초대 파라미터를 읽어 수락 화면으로 되돌린다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain(
      'import { INVITE_RESUME_PARAM, resumeHrefAfterLogin } from "../../src/children/household-join";'
    );
    expect(loginSource).toContain("const inviteResumeHref = resumeHrefAfterLogin(params[INVITE_RESUME_PARAM]);");
    // 카카오/개발 스텁 경로와 테스트 로그인 경로 둘 다 재개하되, 초대가 없으면 기존 목적지 그대로.
    // 실기기 피드백 1: 테스트 로그인의 기본 목적지가 "/(tabs)"에서 "/"로 바뀌었다 -- 데모 세션도
    // 온보딩을 마쳐야 탭에 들어가고, 그 판정은 app/index.tsx 한 곳에만 있다.
    // 라운드 99 트랙 F1(H) — ⚠️ 두 시점: 종전에는 실세션 갈래만 `?? "/onboarding/child-status"`로
    // 갈라져 있었다(기존 사용자의 재로그인이 진행도를 묻지 않고 온보딩으로 가 중복 아이를 만들던
    // 길). 이제 두 갈래 모두 `?? "/"`로 app/index.tsx의 진행도 판정에 위임한다 — 같은 문자열이
    // 두 번(실세션 login() + 테스트 로그인) 서는 것이 이 계약이다.
    expect(loginSource.match(/router\.replace\(inviteResumeHref \?\? "\/"\);/g) ?? []).toHaveLength(2);
    expect(loginSource).not.toContain('router.replace(inviteResumeHref ?? "/onboarding/child-status");');
  });

  it("수락 성공이 R19-C 관례대로 캐시 무효화 + 아이 재선택 + 안내를 수행한다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain("HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))");
    expect(acceptSource).toContain("await listChildren(authToken!)");
    expect(acceptSource).toContain("planAfterHouseholdJoin({");
    expect(acceptSource).toContain("setSelectedChildId(plan.childId);");
    expect(acceptSource).toContain("announceForA11y(plan.notice);");
    expect(acceptSource).toContain("router.replace(plan.href)");
    // 예전에는 defaultHouseholdId만 바꾸고 무조건 /family로 갔다.
    expect(acceptSource).not.toContain('router.replace("/family")');
  });

  it("FIX-121C(F4): 탭 셸로 보내기 전에 온보딩 게이트를 통과시킨다 (참여 직후 온보딩 되돌림 방지)", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    const gateSource = source("app/(tabs)/_layout.tsx");

    // 게이트가 여전히 hasReachedHome을 본다는 전제 -- 이 조건이 바뀌면 아래 수정도 재검토해야 한다.
    // 실기기 피드백 1: 데모 세션 예외가 빠져 이제 모든 세션이 같은 관문을 지난다.
    expect(gateSource).toContain("if (!hasReachedHome) {");
    // 카카오/OIDC 로그인 경로는 markHomeReached를 세우지 않는다(테스트 로그인 경로만 세운다).
    // 따라서 수락 화면이 직접 세워 주지 않으면 "/(tabs)" 진입이 곧바로 "/"로 되돌려진다.
    expect(acceptSource).toContain("state.markHomeReached");
    // select 분기(= 참여한 가구에 아이가 있음) 안에서, 이동 전에 호출돼야 한다.
    const selectBranch = acceptSource.slice(
      acceptSource.indexOf('if (plan.kind === "select") {'),
      acceptSource.indexOf("router.replace(plan.href)")
    );
    expect(selectBranch).toContain("markHomeReached();");
  });

  it("FIX-121C(F9-a): 초대 만료 문구는 memberLabels 단일 소스만 쓴다 (3벌 분기 제거)", () => {
    for (const relativePath of ["app/family/invite.tsx", "app/family/accept/[token].tsx"]) {
      const screenSource = source(relativePath);
      expect(screenSource).toContain("formatInviteExpiry");
      expect(screenSource).toContain("family/memberLabels");
      // 로컬 복제본과 그 문구("...유효해요")는 남아 있으면 안 된다 -- 만료된 초대에도
      // "유효해요"라고 말하던 허위 표시가 그 복제본에서 나왔다.
      expect(screenSource).not.toContain("function formatInviteExpiry");
      expect(screenSource).not.toContain("일까지 유효해요");
    }
  });
});

/**
 * 라운드 96 T7 — 가족 여정 다듬기 (source contract, 같은 source-grep 관례).
 *
 * 넷을 고정한다: ① 파괴적 동작(구성원 삭제·초대 취소)의 **성공**이 낭독된다(실패는 라운드 52
 * C-05의 Alert이 이미 말한다 -- 성공은 행이 사라질 뿐이라 비시각 사용자에게 무음이었다),
 * ② 초대 링크 안내는 두 문장이고 복구 절차는 가족 화면의 한 벌에 위임한다, ③ 수락 화면의
 * 로딩은 텍스트 카드가 아니라 공용 스켈레톤이다(MOB-119 관례), ④ 진행 라벨에 말줄임표가 없다
 * (수락 참여 버튼의 "참여하는 중..."은 invite-accept-messages.test.ts가 바이트로 물고 있어
 * 이 라운드 무접촉이다).
 */
describe("라운드 96 T7 가족 여정 다듬기 (source contract)", () => {
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
  const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("구성원 삭제·초대 취소의 성공이 announceForA11y로 낭독된다", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain('announceForA11y("가족 구성원을 삭제했어요.");');
    expect(familySource).toContain('announceForA11y("초대를 취소했어요.");');
    // 실패 쪽 배선(C-05)은 그대로다 -- 성공 낭독이 그 자리를 대체하지 않는다.
    expect(familySource).toContain('onError: (error) => alertMutationFailure("remove_member", error)');
    expect(familySource).toContain('onError: (error) => alertMutationFailure("cancel_invite", error)');
  });

  it("초대 링크 안내는 두 문장이고, 복구 절차는 가족 화면의 안내 한 벌에 위임한다", () => {
    const inviteSource = source("app/family/invite.tsx");
    expect(inviteSource).toContain(
      "이 링크는 지금 화면에서만 볼 수 있어요. 지금 공유하거나 길게 눌러 복사해 두세요."
    );
    // 복구 절차 문장이 이 화면에 되살아나면 가족 화면의 안내와 두 벌이 되어 갈릴 날이 온다.
    expect(withoutComments(inviteSource)).not.toContain("잃어버리면");
    expect(source("app/family/index.tsx")).toContain(
      "보낸 링크는 보안을 위해 다시 볼 수 없어요. 링크를 잃어버렸다면 취소하고 새로 만들어 주세요."
    );
  });

  it("수락 화면의 로딩은 공용 스켈레톤이다 (텍스트 로딩 카드 잔존 금지)", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain('import { SkeletonCard } from "../../../src/ui/Skeleton";');
    expect(acceptSource).toContain("{invite.isLoading ? <SkeletonCard /> : null}");
    expect(withoutComments(acceptSource)).not.toContain("불러오는 중이에요");
  });

  it("진행 라벨에 말줄임표가 없다 (invite 링크 생성·accept 재시도)", () => {
    expect(source("app/family/invite.tsx")).toContain('invite.isPending ? "링크 만드는 중" : "초대 링크 만들기"');
    expect(source("app/family/invite.tsx")).not.toContain('"링크 만드는 중..."');
    expect(source("app/family/accept/[token].tsx")).toContain('isFinishingJoin ? "다시 시도하는 중" : "다시 시도"');
    expect(source("app/family/accept/[token].tsx")).not.toContain('"다시 시도하는 중..."');
  });

  it("가족 화면의 대기 초대 빈 상태는 맨 텍스트가 아니라 카드다", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain(
      "<Card>\n                <Text style={familyPendingInviteMetaStyle}>대기 중인 초대가 없어요.</Text>\n              </Card>"
    );
  });

  it("가족 화면 인라인 Pressable에 눌림 피드백이 있고, 휴지 상태는 픽셀 불변(opacity 1)이다", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain(
      "const familyPressedTextFeedback = ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.6 : 1 });"
    );
    expect(familySource).toContain("familyPressedRowFeedbackStyle");
    // 문자 링크·행 액션(뒤로가기 · 가구 전환/아이 추가/탈퇴 링크 · 삭제 · 취소 · 대기 초대 재시도).
    expect(familySource.match(/style=\{familyPressedTextFeedback\}/g) ?? []).toHaveLength(7);
    // 카드형 셋(+ 버튼 · 초대 행 · 아래 가족 초대하기 버튼).
    expect(familySource.match(/pressed \? familyPressedRowFeedbackStyle : null/g) ?? []).toHaveLength(3);
  });
});
