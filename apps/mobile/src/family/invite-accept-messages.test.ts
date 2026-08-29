import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
import {
  INVITE_UNAVAILABLE_CODES,
  INVITE_UNAVAILABLE_DETAIL,
  INVITE_UNAVAILABLE_ESCAPE_LABEL,
  INVITE_UNAVAILABLE_NEXT_STEP,
  INVITE_UNAVAILABLE_TITLE,
  isInviteUnavailableError
} from "./invite-accept-messages";

const mobileRoot = process.cwd();
const repoRoot = join(mobileRoot, "..", "..");
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
/** 서버 소스는 **읽기만** 한다(이 트랙은 서버 0건) — link-marker.test.ts와 같은 관례. */
const apiSource = (relativePath: string) => readFileSync(join(repoRoot, "apps", "api", relativePath), "utf8");

/** client.ts의 requestJson이 실제로 던지는 값. */
const httpError = (status: number, code: string, message: string) =>
  new ApiHttpError(status, { error: { code, message, requestId: "req-1" } });

const acceptSource = () => source("app/family/accept/[token].tsx");
const landingSource = () => apiSource("src/households/invite-landing.controller.ts");
const runtimeSource = () => apiSource("src/households/household-runtime.service.ts");

/** 만료·사용된 초대 카드가 실제로 그려지는 블록(그 앞뒤는 다른 갈래다). */
function unavailableCardBlock(): string {
  const src = acceptSource();
  const start = src.indexOf("{inviteUnavailable ? (");
  const end = src.indexOf("{invite.data && !inviteUnavailable ? (");
  expect(start, "만료 초대 카드가 화면에서 사라졌다").toBeGreaterThan(-1);
  expect(end, "초대 미리보기 카드가 화면에서 사라졌다").toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("라운드 70 A — 끝난 초대 판정 (오라클 금지)", () => {
  it("두 코드가 **같은 판정**을 받는다 — 앱은 토큰의 존재 여부를 알려 주지 않는다", () => {
    // 조회 404: 그런 토큰이 없다 / 조회 400: 있었지만 이제 못 쓴다.
    expect(isInviteUnavailableError(httpError(404, "INVITE_NOT_FOUND", "초대 링크를 찾을 수 없어요."))).toBe(true);
    expect(isInviteUnavailableError(httpError(400, "INVITE_NOT_PENDING", "사용할 수 없는 초대 링크예요."))).toBe(true);
    // 수락 400도 같은 코드다(household-runtime.service.ts의 CAS 실패).
    expect(isInviteUnavailableError(httpError(400, "INVITE_NOT_PENDING", "이미 사용했거나 만료된 초대예요."))).toBe(true);
    expect([...INVITE_UNAVAILABLE_CODES]).toEqual(["INVITE_NOT_FOUND", "INVITE_NOT_PENDING"]);
  });

  it("두 코드가 **같은 문장**을 받는다 — 문장이 갈리면 그 순간 오라클이 된다", () => {
    // 문구는 코드가 아니라 판정 하나에서 나온다(화면에 갈래별 문자열이 없다).
    const notFoundCopy = isInviteUnavailableError(httpError(404, "INVITE_NOT_FOUND", "..."))
      ? [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP]
      : [];
    const notPendingCopy = isInviteUnavailableError(httpError(400, "INVITE_NOT_PENDING", "..."))
      ? [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP]
      : [];
    expect(notFoundCopy).toEqual(notPendingCopy);
    expect(notFoundCopy).toHaveLength(3);
    // 화면에도 코드별 분기가 없어야 한다 — 판정은 한 벌이다.
    expect(acceptSource()).not.toContain('"INVITE_NOT_FOUND"');
    expect(acceptSource()).not.toContain('"INVITE_NOT_PENDING"');
  });

  it("재시도로 풀리는 실패와 이미 구성원인 실패는 이 갈래가 아니다", () => {
    expect(isInviteUnavailableError(new Error("Network request failed"))).toBe(false);
    expect(isInviteUnavailableError(httpError(500, "INTERNAL_ERROR", "..."))).toBe(false);
    expect(isInviteUnavailableError(httpError(409, "HOUSEHOLD_ALREADY_MEMBER", "..."))).toBe(false);
    expect(isInviteUnavailableError(httpError(403, "FORBIDDEN", "..."))).toBe(false);
    expect(isInviteUnavailableError(undefined)).toBe(false);
    expect(isInviteUnavailableError(null)).toBe(false);
    expect(isInviteUnavailableError("INVITE_NOT_PENDING")).toBe(false);
  });

  it("데모 세션은 종전 그대로다 — local-backend는 코드 없는 평문 Error를 던진다", () => {
    // src/api/local-backend.ts의 getInvitePreview / acceptInvite가 실제로 던지는 두 문자열.
    expect(isInviteUnavailableError(new Error("초대 정보를 찾을 수 없어요."))).toBe(false);
    expect(isInviteUnavailableError(new Error("사용할 수 없는 초대 링크예요."))).toBe(false);
    const localBackend = source("src/api/local-backend.ts");
    expect(localBackend).toContain('throw new Error("초대 정보를 찾을 수 없어요.");');
    expect(localBackend).toContain('throw new Error("사용할 수 없는 초대 링크예요.");');
  });

  it("판정 코드 목록이 서버가 실제로 던지는 코드에서 파생된다 (서버는 읽기만)", () => {
    const runtime = runtimeSource();
    const requirePending = runtime.slice(runtime.indexOf("private async requirePendingInvite("));
    expect(requirePending).toContain('code: "INVITE_NOT_FOUND"');
    expect(requirePending).toContain('code: "INVITE_NOT_PENDING"');
    for (const code of INVITE_UNAVAILABLE_CODES) {
      expect(requirePending, `${code}가 서버에서 사라졌다 — 앱 판정도 다시 봐야 한다`).toContain(`code: "${code}"`);
    }
    // 수락 경로의 CAS 실패도 같은 코드다(= 세 갈래가 두 코드로 닫힌다).
    expect(runtime).toContain('code: "INVITE_NOT_PENDING", message: "사용할 수 없는 초대 링크예요."');
    // 이미 구성원인 실패는 **다른 사건**이라 이 목록에 들어오지 않는다.
    expect([...INVITE_UNAVAILABLE_CODES]).not.toContain("HOUSEHOLD_ALREADY_MEMBER");
  });
});

describe("라운드 70 A — 앱 문장과 초대 랜딩 페이지가 같은 사실을 말한다", () => {
  /**
   * 문자열을 공유하지 않는다(서버 문구를 앱이 그대로 쓰는 길은 src/api/api-error.ts가 세 이유로
   * 거절했다). 대신 **같은 사실 세 가지**가 두 표면에 모두 있는지를 계약으로 고정한다 —
   * 링크를 보낸 사람(브라우저에서 확인)과 받은 사람(앱)이 다른 이야기를 듣지 않게.
   */
  const SHARED_FACTS: ReadonlyArray<{ fact: string; app: string; needle: RegExp }> = [
    { fact: "① 이 초대는 만료됐거나 유효하지 않다", app: INVITE_UNAVAILABLE_TITLE, needle: /만료|유효하지 않/ },
    { fact: "② 이미 사용했거나 기간이 지났을 수 있다", app: INVITE_UNAVAILABLE_DETAIL, needle: /이미 사용|지난 초대/ },
    { fact: "③ 새 초대 링크를 요청하면 된다", app: INVITE_UNAVAILABLE_NEXT_STEP, needle: /새 초대 링크를 요청/ }
  ];

  it("랜딩 페이지의 세 사실이 앱에도 그대로 있다", () => {
    const unavailablePage = landingSource().slice(landingSource().indexOf("function renderUnavailableInvitePage("));
    for (const { fact, app, needle } of SHARED_FACTS) {
      expect(unavailablePage, `${fact} — 랜딩 페이지 쪽`).toMatch(needle);
      expect(app, `${fact} — 앱 쪽`).toMatch(needle);
    }
  });

  it("두 표면 모두 단정하지 않는다 — 존재하지 않는 토큰에도 '만료됐다'고 말하지 않는다", () => {
    const unavailablePage = landingSource().slice(landingSource().indexOf("function renderUnavailableInvitePage("));
    expect(unavailablePage).toContain("일 수 있어요");
    expect(INVITE_UNAVAILABLE_DETAIL).toContain("일 수 있어요");
  });

  it("랜딩 컨트롤러는 여전히 세 갈래를 한 페이지로 접는다 (앱이 거울로 삼는 그 결정)", () => {
    const landing = landingSource();
    expect(landing).toContain("No existence oracle");
    expect(landing).toContain("return renderUnavailableInvitePage();");
    // 실패 갈래별 페이지가 생기면(= 오라클) 앱의 한 문장 규칙도 함께 재검토해야 한다.
    expect(landing.split("renderUnavailableInvitePage(").length - 1).toBe(2);
  });

  it("문자열을 서버에서 가져오지 않는다 — 앱은 자기 톤으로 다시 쓴다", () => {
    const landing = landingSource();
    for (const copy of [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP]) {
      expect(landing, `랜딩 HTML을 그대로 복사한 문장: ${copy}`).not.toContain(copy);
    }
    // 앱이 아는 사실 하나를 더한다: 초대를 만들 수 있는 사람은 관리자뿐이다(assertOwner).
    expect(INVITE_UNAVAILABLE_NEXT_STEP).toContain("가족 관리자에게");
    expect(runtimeSource()).toContain('code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요."');
  });

  it("DNC-018: 세 문장 모두 해요체이고 재시도를 권하지 않는다", () => {
    for (const copy of [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP]) {
      expect(copy, copy).toMatch(/요\.$/);
      expect(copy, copy).not.toMatch(/확인하세요|하십시오|오류|에러|네트워크|토큰|error|invite_/i);
      // "잠시 후 다시 시도해 주세요"는 기다릴 대상이 있다는 뜻이다 — 여기엔 없다.
      expect(copy, copy).not.toContain("다시 시도");
      expect(copy, copy).not.toContain("잠시 후");
    }
    expect(INVITE_UNAVAILABLE_ESCAPE_LABEL).not.toMatch(/오류|에러|error/i);
  });

  it("문구 실측값 고정", () => {
    expect(INVITE_UNAVAILABLE_TITLE).toBe("초대가 만료되었거나 유효하지 않아요.");
    expect(INVITE_UNAVAILABLE_DETAIL).toBe("이미 사용했거나 기간이 지난 초대 링크일 수 있어요.");
    expect(INVITE_UNAVAILABLE_NEXT_STEP).toBe("가족 관리자에게 새 초대 링크를 요청해 주세요.");
    expect(INVITE_UNAVAILABLE_ESCAPE_LABEL).toBe("앱 둘러보기");
  });
});

/** 화면은 vitest에서 렌더할 수 없으므로 배선은 소스 계약으로 고정한다(member-mutation-messages와 같은 관례). */
describe("라운드 70 A — FAM-003 네 갈래 배선 (source contract)", () => {
  it("갈래 1·2·3(조회 404 · 조회 400 · 수락 400)이 **같은 노드 하나**를 본다", () => {
    const src = acceptSource();
    expect(src).toContain('} from "../../../src/family/invite-accept-messages";');
    // 판정이 하나다 — 세 갈래가 같은 문장을 읽는다는 보장이 문자열 비교가 아니라 구조다.
    expect(src).toContain(
      "const inviteUnavailable = isInviteUnavailableError(invite.error) || isInviteUnavailableError(accept.error);"
    );
    expect(src.split("{inviteUnavailable ? (").length - 1, "만료 초대 카드는 하나여야 한다").toBe(1);

    const card = unavailableCardBlock();
    for (const constant of ["INVITE_UNAVAILABLE_TITLE", "INVITE_UNAVAILABLE_DETAIL", "INVITE_UNAVAILABLE_NEXT_STEP"]) {
      expect(card).toContain(`{${constant}}`);
    }
    // 낭독: 실패 카드는 alert로 읽힌다(라운드 60 재시도 카드와 같은 관례).
    expect(card).toContain('<View accessibilityRole="alert">');
  });

  it("그 갈래에서 [다시 시도]가 사라진다 — 다시 눌러 풀리는 것이 없다", () => {
    const card = unavailableCardBlock();
    expect(card).not.toContain("다시 시도");
    expect(card).not.toContain("invite.refetch()");
    expect(card).not.toContain("accept.mutate()");
    // 대신 탈출구 하나를 준다(라운드 60 #3이 수락 **후** 막다른 길에 세운 것과 같은 형식).
    expect(card).toContain("label={INVITE_UNAVAILABLE_ESCAPE_LABEL}");
    expect(card).toContain("householdJoinEscapePlan({ currentChildId: selectedChildId, hasReachedHome })");
    expect(card).toContain("if (escape.marksHomeReached) markHomeReached();");
    expect(card).toContain("router.replace(escape.href)");
  });

  it("로그인 CTA가 그 갈래에서 접힌다 — 지킬 수 없는 약속을 하지 않는다", () => {
    const src = acceptSource();
    expect(src).toContain("{inviteUnavailable ? null : !authToken ? (");
    // 그 약속 문장과 참여 버튼은 살아 있되(정상 초대), 끝난 초대에서는 그려지지 않는다.
    const ctaBlock = src.slice(src.indexOf("{inviteUnavailable ? null : !authToken ? ("));
    expect(ctaBlock).toContain("로그인하면 이 초대로 바로 돌아와서 참여할 수 있어요.");
    expect(ctaBlock).toContain("로그인하고 참여하기");
    expect(ctaBlock).toContain('label={accept.isPending ? "참여하는 중..." : "가족에 참여하기"}');
    // 끝난 초대에서는 미리보기 카드도 접힌다(세 갈래의 화면이 완전히 같아진다).
    expect(src).toContain("{invite.data && !inviteUnavailable ? (");
  });

  it("갈래 4(네트워크·5xx)는 종전과 바이트 단위로 같다", () => {
    const src = acceptSource();
    expect(src).toContain('const loadFailedText = "초대 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";');
    expect(src).toContain("{invite.isError && !inviteUnavailable ? (");
    const retryCard = src.slice(src.indexOf("{invite.isError && !inviteUnavailable ? ("), src.indexOf("{inviteUnavailable ? ("));
    expect(retryCard).toContain("<Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>");
    expect(retryCard).toContain('<SecondaryButton label="다시 시도" onPress={() => invite.refetch()} />');
  });

  it("HOUSEHOLD_ALREADY_MEMBER 갈래는 문구도 판정도 한 글자도 바뀌지 않는다", () => {
    const src = acceptSource();
    expect(src).toContain('const alreadyMemberText = "이미 이 가족의 구성원이에요.";');
    expect(src).toContain('const acceptFailedText = "가족에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.";');
    expect(src).toContain(
      'return hasApiErrorCode(error, "HOUSEHOLD_ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;'
    );
    expect(src).toContain("{accept.isError && !inviteUnavailable ? (");
    expect(src).toContain("{acceptErrorText(accept.error)}");
  });

  it("수락 성공 후 뒤처리 실패 카드(라운드 60 #3)는 무접촉이다", () => {
    const src = acceptSource();
    expect(src).toContain("{joinRetryNotice && joinedResult ? (");
    expect(src).toContain('accessibilityLabel="가족 정보 다시 불러오기"');
    expect(src).toContain('accessibilityLabel="나중에 하고 앱 둘러보기"');
    expect(src).toContain("label={HOUSEHOLD_JOIN_ESCAPE_LABEL}");
    // 그 카드는 자기 문구를 그대로 쓴다 — 이 라운드의 문구는 그 위 카드의 것이다.
    expect(src).toContain("<Text style={{ color: theme.colors.danger }}>{joinRetryNotice}</Text>");
  });

  it("서버 0건 · 트랙 C 소유 파일 무접촉 (이 화면은 역할 설명을 세우지 않는다)", () => {
    const src = acceptSource();
    expect(src).not.toContain("invite-flow");
    expect(src).not.toContain("INVITE_ROLE");
  });
});
