import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INVITE_CREATE_FAILED_MESSAGE,
  INVITE_FORBIDDEN_MESSAGE,
  INVITE_OWNER_ONLY_CAPTION,
  inviteCreateErrorMessage,
  isInviteEntryPointLocked,
  isInviteForbiddenError
} from "./invite-permissions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("UX-Q(A) 초대 권한 판정", () => {
  it("실세션에서 owner가 아니면 진입점을 잠근다", () => {
    for (const myRole of ["co_parent", "viewer", "gift_participant"]) {
      expect(isInviteEntryPointLocked({ hasSession: true, myRole })).toBe(true);
    }
  });

  it("owner는 잠그지 않는다", () => {
    expect(isInviteEntryPointLocked({ hasSession: true, myRole: "owner" })).toBe(false);
  });

  it("역할을 모르는 실세션은 잠근다 — 모르는 쪽으로 열어 두면 403 무반응이 되살아난다", () => {
    expect(isInviteEntryPointLocked({ hasSession: true, myRole: undefined })).toBe(true);
    expect(isInviteEntryPointLocked({ hasSession: true, myRole: null })).toBe(true);
  });

  it("⚠ 픽셀락 FAM-001: 비로그인 미리보기는 절대 잠그지 않는다", () => {
    // 캡처가 찍는 화면이 바로 이 상태다. 여기서 행이 사라지거나 캡션이 붙으면 락이 깨진다.
    expect(isInviteEntryPointLocked({ hasSession: false, myRole: undefined })).toBe(false);
    expect(isInviteEntryPointLocked({ hasSession: false, myRole: "co_parent" })).toBe(false);
  });

  it("canManageMembers(owner 여부)의 단순 부정이 아니다", () => {
    const canManageMembers = (hasSession: boolean, myRole?: string) => hasSession && myRole === "owner";
    // 비로그인 미리보기에서 두 판정이 갈리는 것이 이 함수의 존재 이유다.
    expect(canManageMembers(false, undefined)).toBe(false);
    expect(isInviteEntryPointLocked({ hasSession: false, myRole: undefined })).toBe(false);
  });
});

describe("UX-Q(A) 403 판별과 문구", () => {
  // src/api/client.ts의 requestJson이 던지는 형태 그대로 — 서버 봉투를 JSON.stringify 해서 Error에 담는다.
  const forbiddenError = new Error(
    JSON.stringify({ error: { code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요.", requestId: "req-1" } })
  );

  it("FORBIDDEN 봉투를 알아본다", () => {
    expect(isInviteForbiddenError(forbiddenError)).toBe(true);
  });

  it("다른 실패는 권한 문제로 단정하지 않는다", () => {
    expect(isInviteForbiddenError(new Error(JSON.stringify({ error: { code: "INTERNAL_ERROR" } })))).toBe(false);
    expect(isInviteForbiddenError(new Error("Network request failed"))).toBe(false);
    expect(isInviteForbiddenError(new Error(JSON.stringify({ code: "FORBIDDEN" })))).toBe(false);
    expect(isInviteForbiddenError(undefined)).toBe(false);
    expect(isInviteForbiddenError(null)).toBe(false);
    expect(isInviteForbiddenError("FORBIDDEN")).toBe(false);
  });

  it("403 문구는 재시도를 권하지 않는다", () => {
    expect(inviteCreateErrorMessage(forbiddenError)).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(INVITE_FORBIDDEN_MESSAGE).not.toContain("다시 시도");
    // 일반 실패 문구와 반드시 다른 문장이어야 한다(둘을 분리하는 것이 이 티켓의 요점).
    expect(INVITE_FORBIDDEN_MESSAGE).not.toBe(INVITE_CREATE_FAILED_MESSAGE);
  });

  it("나머지 실패는 기존 일반 재시도 문구를 그대로 쓴다", () => {
    expect(inviteCreateErrorMessage(new Error("boom"))).toBe(INVITE_CREATE_FAILED_MESSAGE);
    expect(INVITE_CREATE_FAILED_MESSAGE).toBe("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("원문 오류 메시지를 그대로 노출하지 않는다", () => {
    expect(inviteCreateErrorMessage(new Error("TypeError: undefined is not a function"))).not.toContain("TypeError");
  });

  it("DNC-018: 문구는 해요체를 유지한다", () => {
    for (const copy of [INVITE_OWNER_ONLY_CAPTION, INVITE_FORBIDDEN_MESSAGE, INVITE_CREATE_FAILED_MESSAGE]) {
      expect(copy).toMatch(/(요|요\.)$/);
    }
  });
});

describe("UX-Q(A) 화면 배선 (source contract — 화면은 vitest에서 렌더할 수 없다)", () => {
  it("가족 화면이 세 진입점을 같은 판정 하나로 잠근다", () => {
    const familySource = source("app/family/index.tsx");

    expect(familySource).toContain("const inviteLocked = isInviteEntryPointLocked({ hasSession, myRole });");
    // 픽셀락 회귀 방지: canManageMembers로 진입점을 가리면 비세션 프리뷰에서 행이 사라진다.
    expect(familySource).not.toContain("canManageMembers ? undefined : openInvite");
    expect(familySource).not.toContain("!canManageMembers ? INVITE_OWNER_ONLY_CAPTION");

    // ① 아바타 줄의 `+` ② "링크로 초대" 행 ③ 아래 "가족 초대하기" 버튼 — 세 곳 모두.
    expect(familySource.match(/onPress=\{inviteLocked \? undefined : openInvite\}/g)).toHaveLength(3);
    expect(familySource.match(/disabled=\{inviteLocked\}/g)).toHaveLength(2);
    expect(familySource).toContain("caption={inviteLocked ? INVITE_OWNER_ONLY_CAPTION : undefined}");

    // FamilyInviteRow는 caption/onPress 없이도 예전 그대로 그려져야 한다(비활성 행 관례).
    expect(familySource).toContain("disabled={!onPress}");
    expect(familySource).toContain("accessibilityState={{ disabled: !onPress }}");

    // A11Y-101이 고정한 라벨 형태는 그대로 두고, 비활성 이유는 힌트로 붙인다.
    expect(familySource).toContain('accessibilityLabel="가족 초대하기"');
    expect(familySource).toContain("accessibilityLabel={value ? `${title}, ${value}` : title}");
    expect(familySource.match(/accessibilityHint=\{inviteLocked \? INVITE_OWNER_ONLY_CAPTION : undefined\}/g)).toHaveLength(2);
    expect(familySource).toContain("accessibilityHint={caption}");
  });

  /**
   * 라운드 52 C-04: 이 자리에는 원래 "quickInvite 뮤테이션에 onError가 있는가"라는 계약이 있었다.
   * 그 뮤테이션이 통째로 사라졌으므로(가족 화면은 더 이상 초대를 만들지 않는다 —
   * src/family/invite-flow.ts) 같은 사실을 더 강한 형태로 바꿔 적는다: 실패를 말할 자리가 없는
   * 화면에서는 **애초에 초대를 만들지 않는다.**
   */
  it("가족 화면에는 실패를 말하지 못하는 초대 생성 경로가 남아 있지 않다", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).not.toContain("const quickInvite = useMutation({");
    expect(familySource).not.toContain("createInvite(");
  });

  it("초대 만들기 화면이 403을 일반 재시도 문구와 분리해서 말한다", () => {
    const inviteSource = source("app/family/invite.tsx");
    expect(inviteSource).toContain('import { inviteCreateErrorMessage } from "../../src/family/invite-permissions";');
    expect(inviteSource).toContain("{inviteCreateErrorMessage(invite.error)}");
    // 문구 복제본은 남기지 않는다 — 단일 소스는 invite-permissions.ts다.
    expect(inviteSource).not.toContain('const createFailedText = "');
  });
});
