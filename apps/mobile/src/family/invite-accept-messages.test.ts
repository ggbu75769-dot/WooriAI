import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
// 라운드 73 트랙 E: 이 화면의 두 실패 문장이 지나는 공용 단일 소스(문구를 여기 다시 적지 않는다).
import { LOAD_ERROR_NOTICE, LOAD_ERROR_RETRY_LABEL, resolveSaveErrorCopy } from "../offline/messages";
import {
  INVITE_UNAVAILABLE_ALREADY_JOINED_HINT,
  INVITE_UNAVAILABLE_CODES,
  INVITE_UNAVAILABLE_DETAIL,
  INVITE_UNAVAILABLE_ESCAPE_LABEL,
  INVITE_UNAVAILABLE_NEXT_STEP,
  INVITE_UNAVAILABLE_TITLE,
  inviteUnavailableAnnouncement,
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

  /**
   * 라운드 70 리뷰(S-5) — 이 자리에는 종전에 "랜딩 HTML을 그대로 복사하지 않았다"는 부정 단언이
   * 있었는데, 그 단언은 **마침표 한 글자**로 통과하고 있었다: 랜딩의 h1은 "초대가 만료되었거나
   * 유효하지 않아요"이고 앱의 제목은 거기에 마침표만 붙인 문장이다. 마침표·공백을 지우고 비교하면
   * 그대로 빨개진다 — 지키고 있던 것이 계약이 아니라 우연이었다는 뜻이다.
   *
   * 그래서 부정 단언을 지운다. "문자열을 서버에서 가져오지 않는다"가 실제로 뜻하는 것은
   * **런타임 의존이 없다**(서버 문구를 import하지도, 응답 본문에서 꺼내 쓰지도 않는다)이지
   * "같은 사실을 같은 한국어로 쓰지 못한다"가 아니다 — 뜻·톤이 같아야 한다는 것이 오히려 위
   * SHARED_FACTS 대조의 요구다. 여기서는 그 런타임 독립과, 앱이 **더 아는 사실 하나**를 고정한다.
   */
  it("문자열을 서버에서 가져오지 않는다 — 런타임 의존 0건 + 앱이 아는 사실 하나를 더한다", () => {
    const moduleSource = source("src/family/invite-accept-messages.ts");
    // 이 모듈의 유일한 의존은 봉투 코드 파서다(서버 문구를 실어 오는 경로가 없다).
    expect(moduleSource.match(/^import .*$/gm) ?? []).toEqual([
      'import { hasApiErrorCode } from "../api/api-error";'
    ]);
    // 앱이 아는 사실 하나를 더한다: 초대를 만들 수 있는 사람은 관리자뿐이다(assertOwner).
    expect(INVITE_UNAVAILABLE_NEXT_STEP).toContain("가족 관리자에게");
    expect(landingSource(), "랜딩은 그 사실을 모른 채 '가족에게'로 남는다(서버 무접촉)").toContain(
      "가족에게 새 초대 링크를 요청해주세요."
    );
    expect(runtimeSource()).toContain('code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요."');
  });

  it("DNC-018: 네 문장 모두 해요체이고 재시도를 권하지 않는다", () => {
    for (const copy of [
      INVITE_UNAVAILABLE_TITLE,
      INVITE_UNAVAILABLE_DETAIL,
      INVITE_UNAVAILABLE_NEXT_STEP,
      INVITE_UNAVAILABLE_ALREADY_JOINED_HINT
    ]) {
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
    // 라운드 70 리뷰(S-1): 세션이 있는 사람에게만 서는 한 줄.
    expect(INVITE_UNAVAILABLE_ALREADY_JOINED_HINT).toBe("이미 참여한 가족이라면 앱에서 바로 확인할 수 있어요.");
  });

  /**
   * 라운드 70 리뷰(S-1) — 이 한 줄이 **오라클이 되지 않는** 이유를 값으로 고정한다.
   *
   * 근거가 토큰이 아니라 **내 세션 상태**라는 것이 전부다: 같은 실패에서 로그인한 사람에게는
   * 언제나 서고, 비로그인 방문자에게는 언제나 서지 않는다 — 서버가 이 토큰에 대해 404를
   * 말했는지 400을 말했는지와 아무 관계가 없다.
   */
  it("S-1: 그 한 줄은 단정하지 않고, 토큰이 아니라 세션을 근거로 삼는다", () => {
    // 단정 금지 — "이미 참여했어요"가 아니라 "이미 참여한 가족이라면"이다.
    expect(INVITE_UNAVAILABLE_ALREADY_JOINED_HINT).toContain("이라면");
    expect(INVITE_UNAVAILABLE_ALREADY_JOINED_HINT).not.toContain("이미 참여했");
    // 토큰·초대의 상태를 말하지 않는다(말하는 순간 존재 오라클이 된다).
    expect(INVITE_UNAVAILABLE_ALREADY_JOINED_HINT).not.toMatch(/초대|링크|만료|토큰/);
    // 판정 함수는 이 문장을 알지 못한다 — 갈림은 오직 호출부의 세션 축이다.
    const moduleSource = source("src/family/invite-accept-messages.ts");
    const decide = moduleSource.slice(moduleSource.indexOf("export function isInviteUnavailableError("));
    expect(decide).not.toContain("INVITE_UNAVAILABLE_ALREADY_JOINED_HINT");
  });
});

/**
 * 라운드 79 트랙 C — **네 모듈 중 넷째의 판정 순서**(known-limitations L-1의 답).
 *
 * 이 모듈의 순서는 **한 칸**이다: **코드 둘 → 한 문장.** 형제 셋에 다 있는 오프라인 갈래가
 * 여기에는 없고, 표도 없다(코드 목록 둘이 전부다). 그 셋과 다른 이유가 각각 있다.
 *  ⓐ **오프라인 갈래가 없는 이유** — 이 모듈이 하는 일은 하나다: *재시도로 절대 풀리지 않는*
 *     두 코드를 가려내는 것. 나머지 실패(네트워크·5xx)는 **호출부의 종전 문구 그대로**이고,
 *     오프라인은 그 호출부가 훅으로 앞에서 가른다(화면의 `acceptSaveErrorCopy` 갈래).
 *     여기서 새 문구를 하나라도 끼우면 라운드 70의 회귀 계약이 깨진다.
 *  ⓑ **표가 아니라 코드 목록인 이유** — 두 코드를 **일부러 한 문장으로** 받는다. 조회
 *     엔드포인트가 무인증 공개라, 문장을 가르는 순간 앱이 *존재 오라클*이 된다.
 *     ⚠️ 그래서 이 여정은 라운드 78 S-1의 질문(*"코드 하나가 문장 여럿을 나르면?"*)의 **반대편
 *     답**도 갖고 있다: 서버가 두 코드로 문장 **넷**을 나르는데 앱은 **하나**로 받는다.
 *     가르는 것도 합치는 것도 **부르는 자리의 판단**이지 표의 단위가 아니다.
 *
 * 여정 전체의 코드 스윕(네 출구의 합집합)은 `src/api/api-error.test.ts`가 진다.
 */
describe("라운드 79 트랙 C — 모듈 ④의 순서(한 칸)와, 오프라인 갈래가 없는 이유", () => {
  const journeyError = (code: string) => httpError(400, code, "서버 원문(앱은 그대로 쓰지 않는다)");

  it("ⓒ 순서가 한 칸이다 — 판정에 연결 상태가 들어올 자리가 없다", () => {
    // 형제 셋은 전부 `{ isOnline }`을 받는다. 이 판정은 인자가 **하나**다(구조로 고정한다).
    expect(isInviteUnavailableError.length).toBe(1);
    // 같은 실패의 답이 연결 상태와 무관하다 — 넘길 자리가 없으므로 갈릴 자리도 없다.
    for (const code of INVITE_UNAVAILABLE_CODES) {
      expect(isInviteUnavailableError(journeyError(code)), code).toBe(true);
    }
    // 재시도로 풀리는 실패는 이 갈래가 아니고, 그 문장은 호출부의 것이다(이 모듈은 답하지 않는다).
    expect(isInviteUnavailableError(new Error("Network request failed"))).toBe(false);
    expect(isInviteUnavailableError(journeyError("HOUSEHOLD_NOT_FOUND"))).toBe(false);
  });

  it("ⓒ 오프라인 갈래는 호출부가 **앞에서** 가른다 — 이 모듈이 그 문장을 알지 못한다", () => {
    const moduleSource = source("src/family/invite-accept-messages.ts");
    // 이 모듈에는 오프라인 문구도, 그 문구를 만드는 모듈로 가는 길도 없다.
    expect(moduleSource).not.toContain("OFFLINE");
    expect(moduleSource).not.toContain("offline/messages");
    // 그 갈래는 화면에 있다(라운드 73 E가 세운 그 한 줄) — 아는 코드가 없을 때만 참이다.
    expect(acceptSource()).toContain(
      "{acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)}"
    );
    // 그리고 공용 훅의 순서가 그 사실을 보증한다: 아는 코드는 오프라인보다 앞에서 갈라진다.
    expect(resolveSaveErrorCopy({ isOnline: false, error: httpError(409, "HOUSEHOLD_ALREADY_MEMBER", "서버 원문") })).toBe(
      "이미 이 가족의 구성원이에요."
    );
  });

  it("ⓓ 관측 — 서버는 두 코드로 문장 넷을 나르고, 앱은 하나로 받는다 (오라클 금지의 대가이자 근거)", () => {
    const runtime = runtimeSource();
    const messagesOf = (code: string) =>
      new Set(
        [...runtime.matchAll(new RegExp(`\\bcode: "${code}",\\s*message: ("[^"]*")`, "g"))].map((match) => match[1])
      );
    // 2026-08-30 실측: 각 코드가 이 여정에서 서로 다른 문장 둘을 나른다(합계 넷).
    expect(messagesOf("INVITE_NOT_FOUND").size).toBe(2);
    expect(messagesOf("INVITE_NOT_PENDING").size).toBe(2);
    expect([...messagesOf("INVITE_NOT_PENDING")].sort()).toEqual([
      '"사용할 수 없는 초대 링크예요."',
      '"이미 사용했거나 만료된 초대예요."'
    ]);
    // 앱이 그 넷에 주는 답은 **한 벌**이다 — 코드로도, 원문으로도 갈리지 않는다.
    const answers = new Set(
      INVITE_UNAVAILABLE_CODES.flatMap((code) =>
        ["이미 사용했거나 만료된 초대예요.", "사용할 수 없는 초대 링크예요.", "초대를 찾을 수 없어요."].map((serverText) =>
          isInviteUnavailableError(httpError(400, code, serverText))
            ? `${INVITE_UNAVAILABLE_TITLE}|${INVITE_UNAVAILABLE_DETAIL}|${INVITE_UNAVAILABLE_NEXT_STEP}`
            : "종전 문구"
        )
      )
    );
    expect([...answers]).toEqual([`${INVITE_UNAVAILABLE_TITLE}|${INVITE_UNAVAILABLE_DETAIL}|${INVITE_UNAVAILABLE_NEXT_STEP}`]);
    // 그 결정의 근거는 **무인증 공개 조회**다(서버가 그 사실을 값으로 들고 있다 — 읽기만).
    expect(apiSource("src/households/households.controller.ts")).toContain('@Get("invites/:token")');
    expect(landingSource()).toContain("No existence oracle");
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
    // ⚠️ 계약은 **그 카드가 alert로 읽힌다**는 사실이지 여는 태그의 프롭 목록이 아니다 —
    // 같은 노드에 live region이 함께 걸려도(형제 카드들이 이미 그렇다) 이 사실은 그대로다.
    expect(card).toMatch(/<View[^>]*accessibilityRole="alert"/);
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
    // 라운드 70 리뷰(P-A): 형제 버튼들과 같은 관례로 낭독 라벨을 갖는다.
    expect(card).toContain('accessibilityLabel="초대 없이 앱 둘러보기"');
  });

  /**
   * 라운드 70 리뷰(M-1) — **탈출구에는 세션 축이 하나 더 있다.**
   *
   * `householdJoinEscapePlan`은 수락 **후** 카드에서 태어난 함수라 세션을 전제한다(두 목적지인
   * 탭 셸·온보딩 시작점은 모두 저장에 세션이 필요하다). 그런데 이 카드는 수락 **전** 막다른
   * 길이라 계정이 없는 방문자도 여기 선다(로그인 CTA는 이 갈래에서 접힌다) — 그 사람을
   * 온보딩으로 내려놓으면 아이 정보를 적게 한 뒤 저장에서 막히는, 이 라운드가 없애려던 바로
   * 그 형태의 막다른 길이 된다.
   */
  it("M-1: 비세션 방문자의 탈출구는 루트('/')다 — 저장할 수 없는 온보딩에 내려놓지 않는다", () => {
    const card = unavailableCardBlock();
    // 세션 축이 계획 함수보다 **먼저** 선다(계획 함수는 세션이 있는 사람의 두 목적지만 안다).
    expect(card).toContain("if (!authToken) {");
    expect(card).toContain('router.replace("/");');
    expect(card.indexOf("if (!authToken) {")).toBeLessThan(card.indexOf("householdJoinEscapePlan({"));
    // 비세션 갈래는 목적지를 스스로 고르지 않는다 — 판정의 단일 소스는 루트 화면이다.
    expect(card).not.toContain('router.replace("/onboarding/child-status")');
    expect(card).not.toContain('router.replace("/(tabs)")');
  });

  it("M-1: 그 단일 소스(app/index.tsx)가 실제로 비세션 목적지를 고른다", () => {
    // 루트가 만료 여부를 보고 /login 또는 /launch-animation을 고른다 — 이 화면이 그 판정을
    // 다시 적지 않는 근거다. 루트에서 이 분기가 사라지면 위 축도 함께 다시 봐야 한다.
    const indexSource = source("app/index.tsx");
    expect(indexSource).toContain("if (!accessToken && !isTestSession) {");
    expect(indexSource).toContain(
      'shouldShowSessionExpiredNotice({ accessToken, isTestSession, lastEndReason }) ? "/login" : "/launch-animation"'
    );
    // 그리고 순수 계획 함수는 종전 그대로 **세션이 있는 사람의 두 목적지**만 안다(무접촉).
    const planSource = source("src/children/household-join.ts");
    const escapePlan = planSource.slice(
      planSource.indexOf("export function householdJoinEscapePlan("),
      planSource.indexOf("export function planAfterHouseholdJoin(")
    );
    expect(escapePlan).toContain('return { href: "/(tabs)", marksHomeReached: true };');
    expect(escapePlan).toContain('return { href: "/onboarding/child-status", marksHomeReached: false };');
    expect(escapePlan).not.toContain("authToken");
  });

  it("S-1: 세션이 있을 때만 한 줄이 늘고, 비세션 렌더는 종전 그대로다", () => {
    const card = unavailableCardBlock();
    // 그 줄은 세션 축 뒤에 있다(비로그인 방문자의 카드는 세 문장 + 버튼 그대로다).
    expect(card).toContain(
      "{authToken ? <Text style={mutedTextStyle}>{INVITE_UNAVAILABLE_ALREADY_JOINED_HINT}</Text> : null}"
    );
    // 문장은 화면이 짓지 않는다(단일 소스는 문구 모듈이다).
    expect(card).not.toContain(INVITE_UNAVAILABLE_ALREADY_JOINED_HINT);
    // 판정(초대가 끝났는가)에는 손대지 않았다 — 세 갈래는 여전히 한 카드를 본다.
    expect(acceptSource()).toContain(
      "const inviteUnavailable = isInviteUnavailableError(invite.error) || isInviteUnavailableError(accept.error);"
    );
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

  /**
   * 라운드 73 트랙 E — 이 갈래의 **문장은** 여전히 종전과 바이트 단위로 같다. 바뀐 것은 하나다:
   * 연결이 아예 없을 때만 공용 오프라인 문장이 그 자리에 선다(그 판정·문구의 계약은
   * src/offline/messages.test.ts가 진다). 그래서 종전 리터럴을 소스에서 찾던 단언을
   * **값 단언**으로 바꾼다 — 접두 + 공용 문장이 종전 문자열과 정확히 같은지 본다(더 강한 형태다:
   * 공용 문장이 바뀌면 여기가 먼저 빨개진다).
   */
  it("갈래 4(네트워크·5xx)는 종전과 바이트 단위로 같다", () => {
    const src = acceptSource();
    expect(`초대 정보를 ${LOAD_ERROR_NOTICE}`).toBe("초대 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(LOAD_ERROR_RETRY_LABEL).toBe("다시 시도");
    expect(src).toContain(": `초대 정보를 ${inviteLoadErrorCopy.title}`");
    expect(src).toContain("{invite.isError && !inviteUnavailable ? (");
    const retryCard = src.slice(src.indexOf("{invite.isError && !inviteUnavailable ? ("), src.indexOf("{inviteUnavailable ? ("));
    expect(retryCard).toContain("<Text style={{ color: theme.colors.danger }}>{inviteLoadErrorText}</Text>");
    expect(retryCard).toContain(
      "<SecondaryButton label={inviteLoadErrorCopy.actionLabel} onPress={() => invite.refetch()} />"
    );
  });

  it("HOUSEHOLD_ALREADY_MEMBER 갈래는 문구도 판정도 한 글자도 바뀌지 않는다", () => {
    const src = acceptSource();
    expect(src).toContain('const alreadyMemberText = "이미 이 가족의 구성원이에요.";');
    expect(src).toContain('const acceptFailedText = "가족에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.";');
    expect(src).toContain(
      'return hasApiErrorCode(error, "HOUSEHOLD_ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;'
    );
    expect(src).toContain("{accept.isError && !inviteUnavailable ? (");
    // 라운드 73 트랙 E: 화면은 여전히 그 판정 함수를 그대로 지난다 — 앞에 서는 것은 오프라인
    // 갈래 하나뿐이고, 그 갈래는 **아는 코드가 없을 때만** 참이다(판정 순서가 이미 그렇다).
    expect(src).toContain(
      "{acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error)}"
    );
    expect(resolveSaveErrorCopy({ isOnline: false, error: httpError(409, "HOUSEHOLD_ALREADY_MEMBER", "서버 원문") })).toBe(
      "이미 이 가족의 구성원이에요."
    );
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

/**
 * 라운드 89 트랙 A — **끝난 초대 카드가 iOS에서도 소리로 나간다.**
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 라운드 79는 이 카드에 `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`를 걸었고,
 * 라운드 88 트랙 E가 그 대장에 **판정 칸**을 붙이면서 그 조합이 **안드로이드 한정**이라는 사실이
 * 값이 됐다(`accessibilityLiveRegion`은 `@platform android`이고 alert 역할에 대응하는 VoiceOver
 * 트레이트가 없다). 즉 **소리로 도달하지 않는 자리가 하나 있다**는 것을 저장소가 이미 알고
 * 있었고, 이 트랙은 그 판정이 만든 값을 고침으로 바꾼다.
 *
 * ⚠️ 이 화면은 **링크를 타고 들어오는 자리**다 — 딥링크로 열면 첫 프레임에 이 카드가 선다.
 * VoiceOver 사용자에게는 초대 링크를 열었는데 아무 일도 일어나지 않은 것처럼 들렸고, 무엇을
 * 해야 하는지(`INVITE_UNAVAILABLE_NEXT_STEP`)가 귀에 닿지 않았다.
 *
 * ## 이 계약이 붙드는 것
 *
 * ⓐ 낭독이 실재하고, **effect의 `if` 조건이 카드의 최내곽 JSX 갈래와 글자로 같다**(라운드 88
 * 리뷰 L-1의 사각 — 다르면 a11y-contract의 파생 판정이 `live-region`으로 떨어져 이 고침이
 * 조용히 무효가 된다). ⓑ 낭독 문장은 **카드가 그리는 상수들**에서 모듈이 짓는다(화면에 새
 * 한국어 리터럴 0건). ⓔ `inviteUnavailable`이 거짓인 창에서는 이 낭독이 0건이다. ⓓ·ⓕ 더한
 * effect와 import를 빼면 화면은 종전 바이트이고, 프롭 조합·문구 상수·탈출 버튼은 무접촉이다.
 */
describe("라운드 89 A — 끝난 초대 카드의 낭독 (두 플랫폼)", () => {
  /** 화면이 더한 것 — effect 한 벌. 이 바이트가 이 트랙의 전부다. */
  const ADDED_EFFECT = `  useEffect(() => {
    if (inviteUnavailable) {
      announceForA11y(inviteUnavailableAnnouncement({ hasSession: Boolean(authToken) }));
    }
  }, [authToken, inviteUnavailable]);`;
  /** 화면이 더한 것 — import 한 줄. */
  const ADDED_IMPORT = "  inviteUnavailableAnnouncement,\n";

  it("ⓑ 낭독 문장을 화면이 짓지 않는다 — 카드가 그리는 상수들에서 모듈이 짓는다", () => {
    // 비교값까지 전부 상수에서 온다(이 파일이 문구를 다시 적지 않는다 — 위 "문구 실측값 고정"이
    // 값을 붙들고, 여기서는 **구성**만 붙든다).
    expect(inviteUnavailableAnnouncement({ hasSession: false })).toBe(
      [INVITE_UNAVAILABLE_TITLE, INVITE_UNAVAILABLE_DETAIL, INVITE_UNAVAILABLE_NEXT_STEP].join(" ")
    );
    // 세션이 있는 사람의 카드는 한 줄을 더 그린다(라운드 70 리뷰 S-1) — 귀도 그 줄을 듣는다.
    expect(inviteUnavailableAnnouncement({ hasSession: true })).toBe(
      [
        INVITE_UNAVAILABLE_TITLE,
        INVITE_UNAVAILABLE_DETAIL,
        INVITE_UNAVAILABLE_NEXT_STEP,
        INVITE_UNAVAILABLE_ALREADY_JOINED_HINT
      ].join(" ")
    );
    // 눈과 귀가 갈리는 축은 카드가 이미 쓰는 그 축 하나다(세션) — 그 밖의 축이 없다.
    expect(inviteUnavailableAnnouncement({ hasSession: true })).toContain(
      inviteUnavailableAnnouncement({ hasSession: false })
    );
    // 탈출 버튼의 라벨은 낭독에 실리지 않는다 — 초점이 닿을 때 읽히는 이름이라 두 번 들린다.
    expect(inviteUnavailableAnnouncement({ hasSession: true })).not.toContain(INVITE_UNAVAILABLE_ESCAPE_LABEL);
  });

  it("ⓑ 모듈이 새 한국어 문장을 짓지 않는다 — 함수 본문에 문자열 리터럴 0건", () => {
    const moduleSource = source("src/family/invite-accept-messages.ts");
    const start = moduleSource.indexOf("export function inviteUnavailableAnnouncement(");
    expect(start, "낭독 문장을 짓는 함수").toBeGreaterThan(-1);
    const bodyEnd = moduleSource.indexOf("\n}\n", start);
    expect(bodyEnd, "함수 본문의 끝").toBeGreaterThan(start);
    const body = moduleSource.slice(start, bodyEnd);
    // 상수 넷을 잇는 것이 전부다 — 여기서 문장을 지으면 문구 단일 소스를 이 모듈이 스스로 깬다.
    for (const constantName of [
      "INVITE_UNAVAILABLE_TITLE",
      "INVITE_UNAVAILABLE_DETAIL",
      "INVITE_UNAVAILABLE_NEXT_STEP",
      "INVITE_UNAVAILABLE_ALREADY_JOINED_HINT"
    ]) {
      expect(body, constantName).toContain(constantName);
    }
    expect(body, "한국어 리터럴").not.toMatch(/[가-힣]/);
    // 판정 함수는 종전 그대로다 — 세션 축을 알지 못한다(S-1이 세운 그 사실 그대로).
    const decideAt = moduleSource.indexOf("export function isInviteUnavailableError(");
    expect(decideAt, "판정 함수").toBeGreaterThan(-1);
    const decide = moduleSource.slice(decideAt);
    expect(decide).not.toContain("hasSession");
    // ⚠️ 트랙 C가 `export const` 축을 모집단으로 들인다 — 이 라운드의 새 export는 **함수**다.
    expect(moduleSource).not.toContain("export const inviteUnavailableAnnouncement");
    expect(moduleSource).toContain("export function inviteUnavailableAnnouncement(");
  });

  it("ⓐ effect의 조건이 카드의 최내곽 갈래와 **글자로 같다** (다르면 판정이 live-region으로 떨어진다)", () => {
    const src = acceptSource();
    // 카드를 세우는 갈래를 **소스에서 파생**한다(손으로 적으면 이 계약이 사각을 못 본다).
    const cardGuard = /\{([^?{}]+?) \? \(\s*<View accessibilityLiveRegion="polite" accessibilityRole="alert">\s*<Card/.exec(
      src
    )?.[1];
    expect(cardGuard, "끝난 초대 카드를 세우는 최내곽 갈래").toBe("inviteUnavailable");
    // 그 갈래와 **같은 글자**의 조건에 낭독이 묶여 있다(a11y-contract의 파생 판정이 보는 그 대조).
    expect(src, "낭독 배선").toContain(`    if (${cardGuard}) {\n      announceForA11y(`);
    // 렌더 도중이 아니라 effect 안이고, 의존 배열이 조건과 세션 축을 든다(둘 다 문장을 바꾼다).
    expect(src, "effect 한 벌").toContain(ADDED_EFFECT);
  });

  it("ⓔ 소음 금지 — 그 낭독의 호출부는 하나이고, 전부 `if (inviteUnavailable)` 안에 있다", () => {
    const src = acceptSource();
    expect(src.split("announceForA11y(inviteUnavailableAnnouncement(").length - 1, "낭독 호출부").toBe(1);
    // 조건 밖(렌더 · 핸들러 · 다른 effect)에서 부르는 자리가 없다: 유일한 호출부가 그 if 안이다.
    const at = src.indexOf("announceForA11y(inviteUnavailableAnnouncement(");
    expect(at, "낭독 호출부 자리").toBeGreaterThan(-1);
    const guardAt = src.lastIndexOf("if (inviteUnavailable) {", at);
    expect(guardAt, "낭독을 덮는 조건").toBeGreaterThan(-1);
    expect(src.slice(guardAt, at), "조건과 낭독 사이").not.toContain("}");
    // 그리고 그 갈래가 거짓인 창의 화면은 종전 그대로다 — 카드도 낭독도 서지 않는다.
    expect(src).toContain("{invite.isError && !inviteUnavailable ? (");
    expect(src).toContain("{accept.isError && !inviteUnavailable ? (");
  });

  it("ⓓ 부정 — 더한 effect와 import를 빼면 화면은 종전 바이트다", () => {
    const src = acceptSource();
    const effectAt = src.indexOf(ADDED_EFFECT);
    expect(effectAt, "더한 effect").toBeGreaterThan(-1);
    const docAt = src.lastIndexOf("  /**", effectAt);
    expect(docAt, "effect 머리말 주석").toBeGreaterThan(-1);
    const stripped = (src.slice(0, docAt) + src.slice(effectAt + ADDED_EFFECT.length + "\n\n".length)).replace(
      ADDED_IMPORT,
      ""
    );
    // 이 라운드의 흔적이 0건이다 — 더한 것이 effect 한 벌과 import 한 줄뿐이라는 뜻이다.
    expect(stripped, "이 라운드의 흔적").not.toContain("inviteUnavailableAnnouncement");
    expect(stripped, "이 라운드의 흔적").not.toContain("라운드 89");
    // 그리고 종전 계약이 붙들던 바이트가 전부 제자리다(빼고 나면 라운드 88의 화면이다).
    expect(stripped).toContain(
      "  }, [accept.isError, accept.error, acceptSaveErrorCopy, inviteUnavailable]);\n\n  /**\n   * 참여 성공"
    );
    expect(stripped).toContain("  INVITE_UNAVAILABLE_TITLE,\n  isInviteUnavailableError\n");
    expect(stripped).toContain("{inviteUnavailable ? (");
    expect(stripped).toContain('<View accessibilityLiveRegion="polite" accessibilityRole="alert">');
  });

  it("ⓕ 바이트 불변 — 프롭 조합 · 문구 상수 · 탈출 버튼 · 종전 effect", () => {
    const src = acceptSource();
    // 프롭 조합은 대장(`ROUND79_ANNOUNCE_PROPS_ADDED`)의 `after` 바이트다 — 한 글자도 바뀌지 않았다.
    expect(
      src.split('<View accessibilityLiveRegion="polite" accessibilityRole="alert">').length - 1,
      "프롭 조합이 걸린 자리"
    ).toBe(2);
    // 종전 effect(라운드 79 리뷰 M-1)는 조건도 의존 배열도 그대로다.
    expect(src).toContain(
      "    if (accept.isError && !inviteUnavailable) {\n      announceForA11y(acceptSaveErrorCopy === OFFLINE_SAVE_NOTICE ? acceptSaveErrorCopy : acceptErrorText(accept.error));\n    }\n  }, [accept.isError, accept.error, acceptSaveErrorCopy, inviteUnavailable]);"
    );
    // 카드가 그리는 상수 다섯과 탈출 버튼의 낭독 라벨도 그대로다(눈에 보이는 화면은 무변화).
    const card = unavailableCardBlock();
    for (const constantName of [
      "INVITE_UNAVAILABLE_TITLE",
      "INVITE_UNAVAILABLE_DETAIL",
      "INVITE_UNAVAILABLE_NEXT_STEP",
      "INVITE_UNAVAILABLE_ALREADY_JOINED_HINT",
      "INVITE_UNAVAILABLE_ESCAPE_LABEL"
    ]) {
      expect(card, constantName).toContain(constantName);
    }
    expect(card).toContain('accessibilityLabel="초대 없이 앱 둘러보기"');
    // 뒤처리 실패 카드는 무접촉이다 — 그 자리의 사각은 그물의 것이지 화면의 것이 아니다
    // (핸들러가 상태를 세우며 같은 걸음에 읽어 주므로 오늘도 두 플랫폼 다 소리가 난다).
    expect(src).toContain("      setJoinRetryNotice(plan.notice);\n        announceForA11y(plan.notice);");
  });
});
