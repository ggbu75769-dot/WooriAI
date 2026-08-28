import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
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
