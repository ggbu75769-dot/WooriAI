import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES, ApiHttpError } from "../api/api-error";
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
   * 그 비교가 **거짓인** 순간(= 훅이 오프라인 문장을 골랐다)은 "서버가 아무 코드도 주지 않았다
   * **그리고** 폴이 오프라인이라고 답했다"가 둘 다 참인 순간이다. 서버가 코드를 준 실패는 그 앞
   * 갈래에서 갈라져 나가므로 비교는 참이 되고, 화면은 그 실패를 온라인으로 읽는다.
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

/**
 * 라운드 77 트랙 E(GAP-077 #5) — **화면이 훅의 문장을 쓴다.**
 *
 * 바로 위 단언("서버가 코드를 준 실패는 오프라인으로 읽히지 않는다")은 참이고, **참인 채로
 * 문장을 버렸다.** 화면은 훅이 만든 완성 문장을 `!== OFFLINE_SAVE_NOTICE`로 한 번 비교해 불리언
 * 한 칸으로 접은 뒤 버렸고, 그래서 서버가 코드로 말한 실패는 언제나 `isOnline: true`로만 도착해
 * 이 모듈의 **일반 폴백**으로 접혔다. 오늘 결함이 아닌 이유는 초대 생성이 받는 코드가 `FORBIDDEN`
 * 하나이고 그것을 **첫 갈래**가 이미 전용 문장으로 잡기 때문이다 — 두 판정이 오늘 같은 값으로
 * 수렴할 뿐, 표에 초대 관련 코드가 하나 오르는 날 이 화면만 조용히 어긋난다.
 *
 * 그래서 아래 단언들은 둘을 함께 고정한다: **오늘의 답이 바이트 불변**이라는 것과, **표가 자라면
 * 그 문장이 실제로 선다**는 것(후자가 이 트랙의 본체다). 라운드 76의 단언 문장들은 위에 그대로
 * 남아 있고 — 갈래만 하나 늘었다.
 */
describe("라운드 77 트랙 E 초대 생성 실패가 서버 문장까지 지난다", () => {
  const forbidden403 = new ApiHttpError(403, {
    error: { code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요.", requestId: "req-1" }
  });
  const envelopeOf = (code: string) =>
    new ApiHttpError(400, { error: { code, message: "서버 원문(화면에 그대로 쓰지 않는다)", requestId: "req-1" } });

  /**
   * **화면의 배선 그대로**다: 훅을 한 번 부르고(`useSaveErrorCopy` → `resolveSaveErrorCopy`),
   * 그 답 하나에서 두 인자가 나온다 — 연결 사실(파생)과 문장(그 답 자체).
   */
  const asScreenWires = (error: unknown, isOnline: boolean) => {
    const serverCopy = resolveSaveErrorCopy({ isOnline, error });
    return inviteCreateErrorMessage(error, { isOnline: serverCopy !== OFFLINE_SAVE_NOTICE, serverCopy });
  };

  it("ⓐ 오늘 도달 가능한 모든 입력에서 답이 바이트 불변이다", () => {
    // 403 — 연결 판정이 어느 쪽이든 전용 문장이다(서버가 답했다는 사실이 곧 연결이 있었다는 뜻).
    expect(asScreenWires(forbidden403, true)).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(asScreenWires(forbidden403, false)).toBe(INVITE_FORBIDDEN_MESSAGE);
    // client.ts의 requestJson이 던지던 옛 모양(봉투 JSON 문자열)도 같은 답이다.
    expect(asScreenWires(new Error(JSON.stringify({ error: { code: "FORBIDDEN" } })), true)).toBe(
      INVITE_FORBIDDEN_MESSAGE
    );
    // 모르는 실패 — 온라인이면 초대 전용 폴백, 오프라인이면 공용 오프라인 문장(라운드 76 그대로).
    for (const error of [new Error("boom"), new Error("Network request failed"), undefined, null, "FORBIDDEN"]) {
      expect(asScreenWires(error, true)).toBe(INVITE_CREATE_FAILED_MESSAGE);
      expect(asScreenWires(error, false)).toBe(OFFLINE_RETRY_NOTICE);
    }
    // 훅의 두 폴백 문장은 이 자리에 서지 않는다 — 이 여정의 말은 위 두 문장이다.
    expect(asScreenWires(new Error("boom"), true)).not.toBe(SAVE_ERROR_NOTICE);
    expect(asScreenWires(new Error("boom"), false)).not.toBe(OFFLINE_SAVE_NOTICE);
  });

  it("ⓑ 표에 코드가 하나 늘면 그 문장이 화면에 실제로 선다 (이 트랙의 본체)", () => {
    // 오늘 초대 생성 경로에는 오지 않는 코드로 재현한다 — 내일 표에 오를 코드가 지날 길이 이 길이다.
    const alreadyMember = envelopeOf("HOUSEHOLD_ALREADY_MEMBER");
    expect(asScreenWires(alreadyMember, true)).toBe(API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER);
    // ⚠️ 종전 배선(문장을 버리고 불리언 한 칸만 넘기던 그 모양)이었다면 같은 실패가 일반 폴백으로
    // 접혔다 — 이 한 줄이 이 트랙이 무엇을 고쳤는지를 값으로 남긴다.
    expect(inviteCreateErrorMessage(alreadyMember, { isOnline: true })).toBe(INVITE_CREATE_FAILED_MESSAGE);
    // 연결 판정이 어긋난 창에서도 같다(훅의 순서가 아는 코드를 먼저 갈라 놓는다).
    expect(asScreenWires(alreadyMember, false)).toBe(API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER);

    // 전수: 표의 **아무 코드로나** 재현된다(표가 자라도 이 사실이 함께 따라온다).
    for (const [code, copy] of Object.entries(API_ERROR_MESSAGES)) {
      if (code === "FORBIDDEN") continue;
      expect(asScreenWires(envelopeOf(code), true), code).toBe(copy);
    }
    // 그 표에서 403만 예외다 — 초대 자리의 전용 문장이 표의 중립 문구보다 앞선다(첫 갈래).
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(asScreenWires(envelopeOf("FORBIDDEN"), true)).toBe(INVITE_FORBIDDEN_MESSAGE);
  });

  it("ⓒ 판정 순서는 네 칸이다 — 403 → 오프라인 → 서버 문장 → 초대 전용 폴백", () => {
    const tableCopy = API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER;
    // ① 403은 나머지 셋 전부보다 앞이다.
    expect(inviteCreateErrorMessage(forbidden403, { isOnline: false, serverCopy: tableCopy })).toBe(
      INVITE_FORBIDDEN_MESSAGE
    );
    // ② 오프라인은 서버 문장보다 앞이다 — 연결이 없었다면 그 문장은 이 실패의 것이 아니다.
    expect(inviteCreateErrorMessage(new Error("boom"), { isOnline: false, serverCopy: tableCopy })).toBe(
      OFFLINE_RETRY_NOTICE
    );
    // ③ 서버 문장은 초대 전용 폴백보다 앞이다(라운드 77이 더한 칸).
    expect(inviteCreateErrorMessage(new Error("boom"), { isOnline: true, serverCopy: tableCopy })).toBe(tableCopy);
    // ④ 훅도 모르는 실패면 종전 폴백 그대로다 — 훅의 두 문장·빈 값은 셋째 칸을 통과하지 못한다.
    for (const serverCopy of [SAVE_ERROR_NOTICE, OFFLINE_SAVE_NOTICE, undefined, ""]) {
      expect(inviteCreateErrorMessage(new Error("boom"), { isOnline: true, serverCopy })).toBe(
        INVITE_CREATE_FAILED_MESSAGE
      );
    }
  });
});

/**
 * 라운드 79 트랙 C — **네 모듈 중 셋째의 판정 순서**(known-limitations L-1의 답).
 *
 * 넷 중 **이 모듈만 오프라인이 표보다 앞**이다. 그것이 오늘 결함이 아닌 이유는 하나뿐이고,
 * 그 이유는 이 파일이 아니라 **화면**에 있다: 이 자리의 `isOnline`은 독립된 연결 폴이 아니라
 * `inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE` — **훅의 답에서 파생한 값**이다
 * (`app/family/invite.tsx`). 훅의 순서가 **아는 코드 → 오프라인 → 모르는 실패**라, 서버가 코드를
 * 준 실패는 훅에서 이미 표의 문장으로 갈라져 나오고 그 비교는 참이 된다 — 그래서 오프라인
 * 갈래를 지나간다.
 *
 * ⚠️ **화면이 그 파생을 독립 폴로 바꾸는 날, 이 순서는 즉시 결함이 된다**(서버가 403을 준
 * 실패가 어긋난 폴 한 번 때문에 오프라인 문장으로 접힌다). 아래 단언이 그날 빨개진다.
 *
 * 여정 전체의 코드 스윕(네 출구의 합집합)은 `src/api/api-error.test.ts`가 진다.
 */
describe("라운드 79 트랙 C — 모듈 ③의 순서와, 오프라인이 앞이어도 되는 유일한 근거", () => {
  const journeyError = (code: string) =>
    new ApiHttpError(400, { error: { code, message: "서버 원문(앱은 그대로 쓰지 않는다)", requestId: "req-1" } });
  /** 화면의 배선 그대로 — 훅을 **한 번** 부르고 그 답 하나에서 두 인자가 나온다. */
  const asScreenWires = (error: unknown, polledOnline: boolean) => {
    const serverCopy = resolveSaveErrorCopy({ isOnline: polledOnline, error });
    return inviteCreateErrorMessage(error, { isOnline: serverCopy !== OFFLINE_SAVE_NOTICE, serverCopy });
  };

  it("ⓒ 순서는 403 → 오프라인 → 훅의 답 → 초대 폴백이고, 넷 중 이 모듈만 오프라인이 표보다 앞이다", () => {
    const forbidden = journeyError("FORBIDDEN");
    const tableCode = "HOUSEHOLD_ALREADY_MEMBER";
    // ① 403이 맨 앞이다.
    expect(inviteCreateErrorMessage(forbidden, { isOnline: false, serverCopy: API_ERROR_MESSAGES[tableCode] })).toBe(
      INVITE_FORBIDDEN_MESSAGE
    );
    // ② 오프라인이 **훅의 답보다 앞**이다 — 형제 셋(표가 오프라인보다 앞)과 정반대 순서다.
    expect(
      inviteCreateErrorMessage(new Error("boom"), { isOnline: false, serverCopy: API_ERROR_MESSAGES[tableCode] })
    ).toBe(OFFLINE_RETRY_NOTICE);
    // ③ 훅의 답이 초대 폴백보다 앞이다. ④ 훅도 모르면 초대 폴백이다.
    expect(
      inviteCreateErrorMessage(new Error("boom"), { isOnline: true, serverCopy: API_ERROR_MESSAGES[tableCode] })
    ).toBe(API_ERROR_MESSAGES[tableCode]);
    expect(inviteCreateErrorMessage(new Error("boom"), { isOnline: true, serverCopy: SAVE_ERROR_NOTICE })).toBe(
      INVITE_CREATE_FAILED_MESSAGE
    );
  });

  it("ⓒ 그 순서가 결함이 아닌 이유 — isOnline이 훅의 답에서 파생하므로 코드 있는 실패는 오프라인으로 접히지 않는다", () => {
    // 연결 폴이 **오프라인이라고 답한 창**에서도, 서버가 코드를 준 실패는 훅에서 먼저 갈라진다.
    expect(asScreenWires(journeyError("FORBIDDEN"), false)).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(asScreenWires(journeyError("HOUSEHOLD_ALREADY_MEMBER"), false)).toBe(
      API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER
    );
    // ⚠️ **독립 폴이었다면** 같은 실패가 오프라인 문장으로 접힌다 — 그 차이가 이 갈래의 전부다.
    expect(inviteCreateErrorMessage(journeyError("HOUSEHOLD_ALREADY_MEMBER"), { isOnline: false })).toBe(
      OFFLINE_RETRY_NOTICE
    );
    // 코드가 없는 실패에서만 오프라인 갈래가 선다(그때는 그 문장이 유일하게 옳다).
    expect(asScreenWires(new Error("Network request failed"), false)).toBe(OFFLINE_RETRY_NOTICE);
  });

  it("ⓒ 그 파생이 화면에 실재한다 — 독립 폴로 바뀌는 날 여기가 빨개진다", () => {
    const inviteSource = source("app/family/invite.tsx");
    // 훅은 한 번만 부른다 — 두 인자는 **같은 답 하나**에서 나온다.
    expect(inviteSource.match(/useSaveErrorCopy\(/g) ?? []).toHaveLength(1);
    expect(inviteSource).toContain("const inviteSaveErrorCopy = useSaveErrorCopy(invite.isError, invite.error);");
    expect(inviteSource).toContain("isOnline: inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE,");
    // ⚠️ 독립된 연결 판정이 이 화면에 0건이라는 것이 위 근거의 전부다(셋 중 하나라도 생기면 빨개진다).
    for (const independentPoll of ["isCurrentlyOnline", "useErrorTimeConnectivity", "NetInfo"]) {
      expect(inviteSource, `${independentPoll}가 이 화면에 생겼다 — 오프라인이 앞인 순서를 다시 봐야 한다`).not.toContain(
        independentPoll
      );
    }
  });

  it("ⓓ 관측 — 초대 생성 경로에 닿는 서버 코드는 둘이고, 앱이 답을 가진 것은 하나다", () => {
    const runtime = readFileSync(join(mobileRoot, "../../apps/api/src/households/household-runtime.service.ts"), "utf8");
    // createInvite는 두 관문을 지난다: 역할(assertOwner) → 가구 실재(requireHousehold).
    expect(runtime).toContain("async createInvite(user: AuthenticatedUser, householdId: string,");
    expect(runtime).toContain('code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요."');
    expect(runtime).toContain('code: "HOUSEHOLD_NOT_FOUND", message: "가족을 찾을 수 없어요."');

    // 앞은 전용 문장을 받고, 뒤는 **아무 출구도 없어** 초대 폴백으로 접힌다 — 그 코드가 여정
    // 스윕에서 이유와 함께 제외된 그것이고(api-error.test.ts), 이 줄이 그 제외의 **대가**다.
    expect(asScreenWires(journeyError("FORBIDDEN"), true)).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(asScreenWires(journeyError("HOUSEHOLD_NOT_FOUND"), true)).toBe(INVITE_CREATE_FAILED_MESSAGE);
    expect(API_ERROR_MESSAGES.HOUSEHOLD_NOT_FOUND).toBeUndefined();

    // ⓓ FORBIDDEN 하나가 앱에서 세 갈래로 갈린다 — 가르는 축은 코드가 아니라 **호출부**다.
    // 여기는 그 셋 중 초대 생성 갈래이고, 중립 문장과 반드시 다른 문장이어야 한다.
    expect(INVITE_FORBIDDEN_MESSAGE).not.toBe(API_ERROR_MESSAGES.FORBIDDEN);
    expect(INVITE_FORBIDDEN_MESSAGE).toContain("가족 관리자에게");
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
    /**
     * 계약은 **한 쌍**이다: 실패 색 노드 하나가 이 모듈이 고른 값을 그린다. ⚠️ 그 노드에 붙는
     * **접근성 프롭은 이 계약의 단위가 아니다**(레이아웃도 문장도 아니다 — 낭독 여부의 계약은
     * `src/a11y-contract.test.ts`가 대장에서 파생해 따로 진다). 그래서 여는 태그의 프롭에
     * 관대하고, 쌍 자체에는 그대로 엄격하다.
     */
    expect(inviteSource).toMatch(/<Text[^>]*style=\{\{ color: theme\.colors\.danger \}\}>\{inviteCreateErrorText\}<\/Text>/);
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

  /**
   * 라운드 77 트랙 E(GAP-077 #5) — **버리던 값을 넘긴다(한 줄).**
   *
   * 훅 호출은 여전히 하나이고 판정도 여전히 모듈 하나다. 달라지는 것은 그 답을 **두 번** 쓴다는
   * 사실뿐이다: 라운드 76의 파생(`!== OFFLINE_SAVE_NOTICE` — 연결 사실)은 한 글자도 바뀌지 않고,
   * 같은 값이 `serverCopy`로 함께 간다. 이 자리가 다시 불리언 한 칸으로 좁아지면 여기서 걸린다.
   */
  it("라운드 77 트랙 E: 화면이 훅의 문장을 버리지 않고 함께 넘긴다", () => {
    const inviteSource = source("app/family/invite.tsx");

    // 훅은 한 번만 부른다 — 두 인자는 **같은 답 하나**에서 나온다(두 번 물으면 서로 어긋난다).
    expect(inviteSource.match(/useSaveErrorCopy\(/g) ?? []).toHaveLength(1);
    expect(inviteSource).toContain("isOnline: inviteSaveErrorCopy !== OFFLINE_SAVE_NOTICE,");
    expect(inviteSource).toContain("serverCopy: inviteSaveErrorCopy");
    // 그리는 자리는 종전 그대로 하나다(실패 줄이 늘지도 갈라지지도 않는다).
    expect(inviteSource.match(/\{inviteCreateErrorText\}/g) ?? []).toHaveLength(1);

    // 화면은 여전히 판정을 하지 않는다 — 표를 직접 뒤지거나 공용 판정을 다시 부르지 않는다.
    const rendered = inviteSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(rendered).not.toContain("resolveSaveErrorCopy(");
    expect(rendered).not.toContain("apiErrorMessageForCode(");
    expect(rendered).not.toContain("hasApiErrorCode(");
  });
});
