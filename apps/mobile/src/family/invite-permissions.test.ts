import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE, OFFLINE_SAVE_NOTICE, resolveSaveErrorCopy, SAVE_ERROR_NOTICE } from "../offline/messages";
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
    expect(inviteCreateErrorMessage(forbiddenError, { isOnline: true })).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(INVITE_FORBIDDEN_MESSAGE).not.toContain("다시 시도");
    // 일반 실패 문구와 반드시 다른 문장이어야 한다(둘을 분리하는 것이 이 티켓의 요점).
    expect(INVITE_FORBIDDEN_MESSAGE).not.toBe(INVITE_CREATE_FAILED_MESSAGE);
  });

  it("나머지 실패는 기존 일반 재시도 문구를 그대로 쓴다", () => {
    expect(inviteCreateErrorMessage(new Error("boom"), { isOnline: true })).toBe(INVITE_CREATE_FAILED_MESSAGE);
    expect(INVITE_CREATE_FAILED_MESSAGE).toBe("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("원문 오류 메시지를 그대로 노출하지 않는다", () => {
    expect(inviteCreateErrorMessage(new Error("TypeError: undefined is not a function"), { isOnline: true })).not.toContain(
      "TypeError"
    );
  });

  it("DNC-018: 문구는 해요체를 유지한다", () => {
    for (const copy of [INVITE_OWNER_ONLY_CAPTION, INVITE_FORBIDDEN_MESSAGE, INVITE_CREATE_FAILED_MESSAGE]) {
      expect(copy).toMatch(/(요|요\.)$/);
    }
  });
});

/**
 * 라운드 76 트랙 A(GAP-076 #1) — **가족 참여 여정의 첫 단추가 오프라인에 거짓말하지 않는다.**
 *
 * 이 판정에는 갈래가 하나 빠져 있었다: 요청이 서버에 **닿지도 못한** 실패에서도 "잠시 후 다시
 * 시도해 주세요."라고 말했다. 기다릴 대상이 없는 사람에게 기다리라고 하는 것이라, 403에 재시도를
 * 권하던 그 거짓말과 같은 모양이다(이 파일이 이미 그것을 고쳤다 — 위 describe).
 *
 * 형제 모듈(`src/family/member-mutation-messages.ts`)이 라운드 52 C-05에 지나간 그 관례를 그대로
 * 들여온다. **새 문구는 0건**이고, 온라인 갈래의 두 문장은 바이트 불변이다.
 */
describe("라운드 76 트랙 A 초대 생성 실패의 오프라인 갈래", () => {
  const forbiddenError = new Error(JSON.stringify({ error: { code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요." } }));

  it("오프라인이면 없는 기다림을 약속하지 않는다 — 공용 문장 한 벌로 간다 (새 문구 0건)", () => {
    expect(inviteCreateErrorMessage(new Error("Network request failed"), { isOnline: false })).toBe(
      OFFLINE_RETRY_NOTICE
    );
    // 문장은 이 모듈이 짓지 않는다(src/offline/messages.ts의 단일 소스 그대로 — 라운드 52 C-05가
    // 같은 상황을 화면마다 다른 말로 부르지 않으려고 세운 그 문장이다).
    expect(OFFLINE_RETRY_NOTICE).not.toBe(INVITE_CREATE_FAILED_MESSAGE);
    expect(OFFLINE_RETRY_NOTICE).not.toContain("잠시 후 다시");
  });

  it("판정 순서는 403 → 오프라인 → 일반이다 — 연결 판정이 어긋나도 403이 가려지지 않는다", () => {
    // 서버가 403을 돌려줬다는 사실 자체가 연결이 있었다는 뜻이다(폴은 point-in-time 한 번이라
    // 어긋날 수 있다). 그 경우까지 오프라인으로 말하면 그것이 또 하나의 틀린 안내가 된다.
    expect(inviteCreateErrorMessage(forbiddenError, { isOnline: false })).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(inviteCreateErrorMessage(forbiddenError, { isOnline: true })).toBe(INVITE_FORBIDDEN_MESSAGE);
  });

  it("⚠ 온라인 갈래는 종전과 바이트 단위로 같다 (두 문자열 · 두 갈래 무변경)", () => {
    expect(INVITE_CREATE_FAILED_MESSAGE).toBe("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(INVITE_FORBIDDEN_MESSAGE).toBe("가족 초대는 관리자만 만들 수 있어요. 가족 관리자에게 초대를 부탁해 주세요.");
    for (const error of [new Error("boom"), new Error("Network request failed"), undefined, null, "FORBIDDEN"]) {
      expect(inviteCreateErrorMessage(error, { isOnline: true })).toBe(INVITE_CREATE_FAILED_MESSAGE);
    }
  });

  /**
   * ⚠️ 화면이 넘기는 `isOnline`은 공용 훅의 답에서 **파생**된다
   * (`useSaveErrorCopy(...) !== OFFLINE_SAVE_NOTICE`). 그 파생이 실제로 뜻하는 바를 여기서 값으로
   * 고정한다: `resolveSaveErrorCopy`의 순서가 **아는 코드 → 오프라인 → 모르는 실패**이므로,
   * 그 비교가 참인 순간은 "서버가 아무 코드도 주지 않았다"가 이미 참인 순간이다.
   */
  it("화면이 넘기는 연결 사실의 파생 — 서버가 코드를 준 실패는 오프라인으로 읽히지 않는다", () => {
    const forbidden403 = new ApiHttpError(403, {
      error: { code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요.", requestId: "req-1" }
    });
    const isOnlineFrom = (copy: string) => copy !== OFFLINE_SAVE_NOTICE;

    // 연결 판정이 어긋난 창(오프라인이라고 봤는데)에도 서버 코드가 도착하면 표가 앞선다.
    expect(isOnlineFrom(resolveSaveErrorCopy({ isOnline: false, error: forbidden403 }))).toBe(true);
    expect(inviteCreateErrorMessage(forbidden403, { isOnline: true })).toBe(INVITE_FORBIDDEN_MESSAGE);
    // 코드가 없는 실패에서만 오프라인 갈래가 선다.
    const offline = resolveSaveErrorCopy({ isOnline: false, error: new Error("Network request failed") });
    expect(offline).toBe(OFFLINE_SAVE_NOTICE);
    expect(isOnlineFrom(offline)).toBe(false);
    // 온라인에서의 모르는 실패는 종전 갈래 그대로다.
    const online = resolveSaveErrorCopy({ isOnline: true, error: new Error("Network request failed") });
    expect(online).toBe(SAVE_ERROR_NOTICE);
    expect(inviteCreateErrorMessage(new Error("Network request failed"), { isOnline: isOnlineFrom(online) })).toBe(
      INVITE_CREATE_FAILED_MESSAGE
    );
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
    expect(inviteSource).toContain("<Text style={{ color: theme.colors.danger }}>{inviteCreateErrorText}</Text>");
    // 문구 복제본은 남기지 않는다 — 단일 소스는 invite-permissions.ts다.
    expect(inviteSource).not.toContain('const createFailedText = "');
  });

  /**
   * 라운드 76 트랙 A(GAP-076 #1) — 실패 줄이 **연결도 확인한다**(자리는 그대로 하나다).
   *
   * 배선의 모양은 라운드 73 E가 초대 참여 화면에 쓴 그 두 줄과 같다: 판정은 공용 훅 한 벌에서
   * 오고(화면이 직접 폴을 띄우지 않는다), 문장은 여전히 이 모듈 한 곳에서 나온다. 화면이 더하는
   * 것은 **연결 사실 하나**다.
   */
  it("라운드 76 트랙 A: 실패 줄이 공용 훅에서 연결 사실을 받아 모듈에 넘긴다", () => {
    const inviteSource = source("app/family/invite.tsx");
    expect(inviteSource).toContain('import { OFFLINE_SAVE_NOTICE } from "../../src/offline/messages";');
    expect(inviteSource).toContain('import { useSaveErrorCopy } from "../../src/offline/use-load-error-copy";');
    expect(inviteSource).toContain("const inviteSaveErrorCopy = useSaveErrorCopy(invite.isError, invite.error);");
    expect(inviteSource).toContain("isOnline: inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE");
    // 화면이 직접 폴을 띄우지 않는다(언마운트·레이스 구멍이 그 자리였다 — 라운드 52 C-07).
    expect(inviteSource).not.toContain("isCurrentlyOnline()");
    // 화면이 문장을 고르지 않는다 — 두 문장 어느 쪽도 이 화면에 리터럴로 없다(주석 제외:
    // 이 화면의 주석은 자기가 무엇을 고쳤는지 설명하려고 옛 문장을 인용한다).
    const rendered = inviteSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(rendered).not.toContain("지금은 오프라인이에요");
    expect(rendered).not.toContain("초대 링크를 만들지 못했어요");
  });
});
