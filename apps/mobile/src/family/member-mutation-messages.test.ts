import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES, ApiHttpError } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";
import {
  INVITE_CANCEL_FAILED_ALERT_TITLE,
  INVITE_CANCEL_FAILED_MESSAGE,
  MEMBER_MANAGE_FORBIDDEN_MESSAGE,
  MEMBER_REMOVE_FAILED_ALERT_TITLE,
  MEMBER_REMOVE_FAILED_MESSAGE,
  familyErrorCodeOf,
  memberMutationAlertTitle,
  memberMutationErrorMessage
} from "./member-mutation-messages";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
/** 서버 소스는 **읽기만** 한다(이 트랙은 서버 0건 · 제품 소스 0건). */
const apiSource = (relativePath: string) => readFileSync(join(mobileRoot, "../../apps/api/src", relativePath), "utf8");

const online = { isOnline: true };
const offline = { isOnline: false };

/** client.ts의 requestJson이 실제로 던지는 값. */
const httpError = (status: number, code: string, message: string) =>
  new ApiHttpError(status, { error: { code, message, requestId: "req-1" } });

/** 옛 관례(그리고 지금도 invite-permissions가 파싱하는 형태) — 봉투 JSON을 message에 담은 Error. */
const legacyError = (code: string) => new Error(JSON.stringify({ error: { code, message: "..." } }));

describe("라운드 52 C-05 실패 코드 판별", () => {
  it("ApiHttpError와 옛 JSON-메시지 Error를 모두 알아본다", () => {
    expect(familyErrorCodeOf(httpError(403, "FORBIDDEN", "가족 초대는 관리자만 할 수 있어요."))).toBe("FORBIDDEN");
    expect(familyErrorCodeOf(legacyError("INVITE_NOT_PENDING"))).toBe("INVITE_NOT_PENDING");
  });

  it("코드가 없는 실패는 null — 네트워크 오류·데모 백엔드의 평문 Error", () => {
    expect(familyErrorCodeOf(new Error("Network request failed"))).toBeNull();
    expect(familyErrorCodeOf(new Error("초대를 찾을 수 없어요."))).toBeNull();
    expect(familyErrorCodeOf(undefined)).toBeNull();
    expect(familyErrorCodeOf(null)).toBeNull();
    expect(familyErrorCodeOf("FORBIDDEN")).toBeNull();
  });
});

describe("라운드 52 C-05 구성원 삭제·초대 취소 실패 문구", () => {
  it("권한 실패는 재시도를 권하지 않는다", () => {
    for (const kind of ["remove_member", "cancel_invite"] as const) {
      const message = memberMutationErrorMessage(kind, httpError(403, "FORBIDDEN", "..."), online);
      expect(message).toBe(MEMBER_MANAGE_FORBIDDEN_MESSAGE);
      expect(message).not.toContain("다시 시도");
    }
  });

  it("서버가 사유를 말해 줬으면 그 사실을 말한다(영어 원문은 노출하지 않는다)", () => {
    expect(
      memberMutationErrorMessage("remove_member", httpError(404, "HOUSEHOLD_MEMBER_NOT_FOUND", "Household member was not found."), online)
    ).toBe("이미 가족에서 빠진 구성원이에요.");
    expect(
      memberMutationErrorMessage(
        "remove_member",
        httpError(400, "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN", "Owners cannot remove themselves."),
        online
      )
    ).toBe("가족 관리자는 목록에서 삭제할 수 없어요.");
    expect(memberMutationErrorMessage("cancel_invite", httpError(404, "INVITE_NOT_FOUND", "초대를 찾을 수 없어요."), online)).toBe(
      "이미 없는 초대예요."
    );
    expect(
      memberMutationErrorMessage("cancel_invite", httpError(400, "INVITE_NOT_PENDING", "이미 사용했거나 만료된 초대예요."), online)
    ).toBe("이미 사용했거나 만료된 초대예요.");
  });

  it("서버가 답을 준 실패는 오프라인으로 말하지 않는다 — 답이 왔다는 건 연결이 있었다는 뜻이다", () => {
    // 판정 폴이 뒤늦게 offline을 돌려준 경우에도 서버 사유가 우선한다.
    expect(memberMutationErrorMessage("cancel_invite", httpError(400, "INVITE_NOT_PENDING", "..."), offline)).toBe(
      "이미 사용했거나 만료된 초대예요."
    );
    expect(memberMutationErrorMessage("remove_member", httpError(403, "FORBIDDEN", "..."), offline)).toBe(
      MEMBER_MANAGE_FORBIDDEN_MESSAGE
    );
  });

  it("오프라인이면 기다릴 대상이 없다는 사실을 말한다(공용 단일 소스)", () => {
    expect(memberMutationErrorMessage("remove_member", new Error("Network request failed"), offline)).toBe(
      OFFLINE_RETRY_NOTICE
    );
    expect(memberMutationErrorMessage("cancel_invite", new Error("Network request failed"), offline)).toBe(
      OFFLINE_RETRY_NOTICE
    );
    expect(OFFLINE_RETRY_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.");
  });

  it("그 밖의 실패는 동작별 일반 문구로 갈린다", () => {
    expect(memberMutationErrorMessage("remove_member", new Error("boom"), online)).toBe(MEMBER_REMOVE_FAILED_MESSAGE);
    expect(memberMutationErrorMessage("cancel_invite", new Error("boom"), online)).toBe(INVITE_CANCEL_FAILED_MESSAGE);
    expect(MEMBER_REMOVE_FAILED_MESSAGE).not.toBe(INVITE_CANCEL_FAILED_MESSAGE);
  });

  it("원문 오류 메시지를 그대로 노출하지 않는다", () => {
    const message = memberMutationErrorMessage("remove_member", new Error("TypeError: undefined is not a function"), online);
    expect(message).not.toContain("TypeError");
  });

  it("Alert 제목은 무엇이 실패했는지 말한다", () => {
    expect(memberMutationAlertTitle("remove_member")).toBe(MEMBER_REMOVE_FAILED_ALERT_TITLE);
    expect(memberMutationAlertTitle("cancel_invite")).toBe(INVITE_CANCEL_FAILED_ALERT_TITLE);
    expect(MEMBER_REMOVE_FAILED_ALERT_TITLE).toBe("구성원을 삭제하지 못했어요");
    expect(INVITE_CANCEL_FAILED_ALERT_TITLE).toBe("초대를 취소하지 못했어요");
  });

  it("DNC-018: 모든 문구가 해요체이고 기술 용어·비난 표현을 쓰지 않는다", () => {
    const copies = [
      MEMBER_REMOVE_FAILED_ALERT_TITLE,
      INVITE_CANCEL_FAILED_ALERT_TITLE,
      MEMBER_REMOVE_FAILED_MESSAGE,
      INVITE_CANCEL_FAILED_MESSAGE,
      MEMBER_MANAGE_FORBIDDEN_MESSAGE,
      memberMutationErrorMessage("remove_member", httpError(404, "HOUSEHOLD_MEMBER_NOT_FOUND", "..."), online),
      memberMutationErrorMessage("cancel_invite", httpError(404, "INVITE_NOT_FOUND", "..."), online)
    ];
    for (const copy of copies) {
      expect(copy, copy).toMatch(/(요|요\.)$/);
      expect(copy, copy).not.toMatch(/확인하세요|하십시오|오류|에러|네트워크|error|forbidden/i);
    }
  });
});

/**
 * 라운드 79 트랙 C — **네 모듈 중 둘째의 판정 순서**(known-limitations L-1의 답).
 *
 * L-1은 세 라운드 동안 *"세 모듈이 같은 표를 같은 순서로 읽는가"* 를 물어 왔고, 실측의 답은
 * **모듈은 넷이고, 읽지 않으며, 그 분리에는 각각 이유가 있다**였다. 이 모듈의 이유가 가장
 * 또렷하다: 자기 표의 네 문장은 **서버 원문이 영어이거나 이 화면 맥락에서만 뜻이 통한다.**
 * 공용 표(`API_ERROR_MESSAGES`)는 앱 전역에서 중립적으로 읽혀야 하는 코드만 담으므로
 * **넷을 그리로 옮기는 순간 그 판단이 사라진다.**
 *
 * 여정 전체의 코드 스윕(`FAMILY_JOURNEY_SERVER_FILES` — 네 출구의 합집합)은
 * `src/api/api-error.test.ts`가 진다. 여기서 지는 것은 **이 모듈의 순서**다:
 * **403 → 자기 표(넷) → 오프라인 → 종류별 폴백.** 넷이 서로 다른 순서를 갖는다는 사실 자체가
 * 이 트랙의 판정이라, 순서를 한 파일에 모으지 않고 각자의 자리에 세운다.
 */
describe("라운드 79 트랙 C — 모듈 ②의 판정 순서와, 표를 합치지 않는 이유", () => {
  const journeyError = (code: string) => httpError(400, code, "서버 원문(앱은 그대로 쓰지 않는다)");
  /** 이 모듈이 **자기 표 밖**에서 돌려줄 수 있는 문장 전부. */
  const nonTableAnswers = [
    MEMBER_REMOVE_FAILED_MESSAGE,
    INVITE_CANCEL_FAILED_MESSAGE,
    MEMBER_MANAGE_FORBIDDEN_MESSAGE,
    OFFLINE_RETRY_NOTICE
  ];
  const answeredByOwnTable = (code: string) =>
    (["remove_member", "cancel_invite"] as const).every(
      (kind) => !nonTableAnswers.includes(memberMutationErrorMessage(kind, journeyError(code), online))
    );

  it("ⓒ 순서는 네 칸이다 — 403 → 자기 표 → 오프라인 → 종류별 폴백", () => {
    // ① 403은 나머지 셋 전부보다 앞이다(서버가 답했다는 사실이 곧 연결이 있었다는 뜻).
    expect(memberMutationErrorMessage("remove_member", journeyError("FORBIDDEN"), offline)).toBe(
      MEMBER_MANAGE_FORBIDDEN_MESSAGE
    );
    // ② 자기 표는 오프라인보다 앞이다 — 같은 근거다.
    expect(memberMutationErrorMessage("cancel_invite", journeyError("INVITE_NOT_FOUND"), offline)).toBe(
      "이미 없는 초대예요."
    );
    // ③ 표가 모르면 오프라인이 폴백보다 앞이다.
    expect(memberMutationErrorMessage("remove_member", journeyError("HOUSEHOLD_ALREADY_MEMBER"), offline)).toBe(
      OFFLINE_RETRY_NOTICE
    );
    // ④ 그 밖은 종류별 폴백이고, 두 종류가 서로 다른 문장을 받는다.
    expect(memberMutationErrorMessage("remove_member", journeyError("HOUSEHOLD_ALREADY_MEMBER"), online)).toBe(
      MEMBER_REMOVE_FAILED_MESSAGE
    );
    expect(memberMutationErrorMessage("cancel_invite", journeyError("HOUSEHOLD_ALREADY_MEMBER"), online)).toBe(
      INVITE_CANCEL_FAILED_MESSAGE
    );
  });

  it("ⓒ 자기 표가 답하는 여정 코드는 넷이고, 그 넷은 공용 표에 없다", () => {
    // 서버가 이 여정에서 던지는 일곱(api-error.test.ts의 스윕이 세는 그 집합).
    const journeyCodes = [
      "FORBIDDEN",
      "HOUSEHOLD_ALREADY_MEMBER",
      "HOUSEHOLD_MEMBER_NOT_FOUND",
      "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",
      "HOUSEHOLD_NOT_FOUND",
      "INVITE_NOT_FOUND",
      "INVITE_NOT_PENDING"
    ];
    expect(journeyCodes.filter(answeredByOwnTable)).toEqual([
      "HOUSEHOLD_MEMBER_NOT_FOUND",
      "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",
      "INVITE_NOT_FOUND",
      "INVITE_NOT_PENDING"
    ]);
    // ⚠️ 표를 합치지 않는다는 판정의 오늘 모습: 그 넷은 공용 표에 **한 줄도 없다**.
    for (const code of journeyCodes.filter(answeredByOwnTable)) {
      expect(API_ERROR_MESSAGES[code], `${code}가 공용 표에 생겼다 — 두 표가 같은 코드에 각자 답한다`).toBeUndefined();
    }
    // 반대로 공용 표가 답하는 둘은 이 모듈의 표에 없다(중복 없이 갈라져 있다).
    expect(answeredByOwnTable("FORBIDDEN")).toBe(false);
    expect(answeredByOwnTable("HOUSEHOLD_ALREADY_MEMBER")).toBe(false);
    expect(API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER).toBeTruthy();
  });

  it("ⓒ 합치면 안 되는 이유가 서버 원문에 있다 — 영문 둘 · 화면 맥락 전용 넷 (서버는 읽기만)", () => {
    const runtime = apiSource("households/household-runtime.service.ts");
    // ⓐ 서버 원문이 영어인 두 자리. 공용 표로 올리면 이 문장이 그대로 사용자에게 갈 위험이 아니라,
    //    **이 화면 밖에서도 같은 문장을 쓰게 되는 것**이 문제다(그 문장은 이 화면의 말이다).
    expect(runtime).toContain('code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found."');
    expect(runtime).toContain('code: "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",');
    expect(runtime).toContain("Owners cannot remove themselves.");
    // ⓑ 앱의 네 문장은 서버 원문을 그대로 쓰지 않는다(영문도, 한국어 원문도).
    for (const [code, serverText] of [
      ["HOUSEHOLD_MEMBER_NOT_FOUND", "Household member was not found."],
      ["HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN", "Owners cannot remove themselves."],
      ["INVITE_NOT_FOUND", "초대를 찾을 수 없어요."]
    ] as const) {
      const shown = memberMutationErrorMessage("remove_member", journeyError(code), online);
      expect(shown, code).not.toContain(serverText);
      expect(shown, code).toMatch(/요\.$/);
    }
    // ⓒ 그리고 그 문장들은 **이 화면 맥락**을 말한다 — 다른 화면에 그대로 세울 수 없는 말이다.
    expect(memberMutationErrorMessage("remove_member", journeyError("HOUSEHOLD_MEMBER_NOT_FOUND"), online)).toBe(
      "이미 가족에서 빠진 구성원이에요."
    );
    expect(memberMutationErrorMessage("cancel_invite", journeyError("INVITE_NOT_PENDING"), online)).toBe(
      "이미 사용했거나 만료된 초대예요."
    );
  });

  it("ⓓ 관측 — FORBIDDEN은 이 여정에서 문장 둘을 나르고, 이 자리는 호출부로 갈린 셋 중 하나다", () => {
    const runtime = apiSource("households/household-runtime.service.ts");
    // 서버 문장 둘(가족 접근 · 초대 권한). 코드는 하나다.
    expect(runtime).toContain('code: "FORBIDDEN", message: "가족 접근 권한이 없어요."');
    expect(runtime).toContain('code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요."');
    // 앱은 코드를 나누지 않고 **부르는 자리**로 가른다 — 여기는 구성원 관리 갈래다.
    expect(memberMutationErrorMessage("remove_member", journeyError("FORBIDDEN"), online)).toBe(
      MEMBER_MANAGE_FORBIDDEN_MESSAGE
    );
    expect(MEMBER_MANAGE_FORBIDDEN_MESSAGE).not.toBe(API_ERROR_MESSAGES.FORBIDDEN);
    // 그 전용 문장은 재시도를 권하지 않는다(다시 눌러도 결과가 같다).
    expect(MEMBER_MANAGE_FORBIDDEN_MESSAGE).not.toContain("잠시 후 다시");
  });
});

/** 화면은 vitest에서 렌더할 수 없으므로 배선은 소스 grep 계약으로 고정한다. */
describe("라운드 52 C-05 가족 화면 배선 (source contract)", () => {
  it("두 파괴적 동작 모두 onError를 달아 실패를 말한다", () => {
    const familySource = source("app/family/index.tsx");

    expect(familySource).toContain('src/family/member-mutation-messages"');
    expect(familySource).toContain('onError: (error) => alertMutationFailure("remove_member", error)');
    expect(familySource).toContain('onError: (error) => alertMutationFailure("cancel_invite", error)');
    // 실패한 그 순간의 연결 상태로 문구를 고른다(오프라인이면 "잠시 후 다시"가 거짓말이 된다).
    expect(familySource).toContain("isCurrentlyOnline()");
    expect(familySource).toContain("memberMutationErrorMessage(kind, error, { isOnline })");
    expect(familySource).toContain("Alert.alert(memberMutationAlertTitle(kind)");
  });

  it("두 뮤테이션 어디에도 onSuccess만 남은 자리가 없다", () => {
    const familySource = source("app/family/index.tsx");
    for (const mutation of ["const removeMember = useMutation({", "const cancelInvite = useMutation({"]) {
      const block = familySource.slice(familySource.indexOf(mutation), familySource.indexOf(mutation) + 400);
      expect(block, mutation).toContain("onError:");
      expect(block.indexOf("onError:"), `${mutation} — onError가 onSuccess보다 먼저 온다`).toBeLessThan(
        block.indexOf("onSuccess:")
      );
    }
  });

  it("조회 실패 카드는 공용 오프라인 인지 문구를 쓴다(offline-aware-screens 목록과 같은 사실)", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain("const loadErrorCopy = useLoadErrorCopy(members.isError);");
    expect(familySource).toContain("title={loadErrorCopy.title}");
    expect(familySource).toContain("actionLabel={loadErrorCopy.actionLabel}");
    expect(familySource).not.toContain('title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
  });
});
