import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";
import {
  CONSENT_UPDATE_FAILED_MESSAGE,
  DESTRUCTIVE_ACTION_FAILED_MESSAGE,
  DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES,
  DESTRUCTIVE_FLOW_MESSAGE_BY_CODE,
  destructiveFlowErrorMessage,
  destructiveFlowFallbackMessage,
  destructiveFlowOfflineMessage,
  type DestructiveFlowKind
} from "./destructive-flow-messages";

/**
 * 라운드 71 트랙 B(#2) — 되돌릴 수 없는 세 흐름(+ 되돌아올 길 하나)의 실패가 이름을 얻는다는 계약.
 *
 * 세 층으로 고정한다.
 *  1. 순수 단위 — 흐름 × 갈래의 문구 표. react-native가 필요 없다.
 *  2. **서버 소스 계약** — 이 표가 다루는 코드가 실제로 그 경로에서 던져지는가(반대 방향으로,
 *     그 경로가 던지는 코드가 표에 있거나 이유가 적힌 제외 목록에 있는가). 서버는 이 라운드에서
 *     **한 줄도 바뀌지 않는다** — 읽기만 한다(api-error.test.ts가 세운 그 형식).
 *  3. 배선 계약 — 화면은 vitest에서 렌더할 수 없으므로 이 저장소의 관례대로 소스 grep이다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const apiSource = (relativePath: string) => readFileSync(join(mobileRoot, "../../apps/api/src", relativePath), "utf8");

const online = { isOnline: true };
const offline = { isOnline: false };

/** client.ts의 requestJson이 실제로 던지는 값. */
const httpError = (status: number, code: string, message: string) =>
  new ApiHttpError(status, { error: { code, message, requestId: "req-1" } });

const DESTRUCTIVE_KINDS = ["child_profile_delete", "household_leave", "account_delete"] as const;
const ALL_KINDS: readonly DestructiveFlowKind[] = [...DESTRUCTIVE_KINDS, "consent_update"];

describe("라운드 71 B(#2) 오프라인 갈래 — 이 트랙의 본체", () => {
  it("요청이 서버에 닿지 못했다는 사실을 말하고, 공용 문장으로 끝난다", () => {
    expect(destructiveFlowErrorMessage("account_delete", new Error("Network request failed"), offline)).toBe(
      `계정 삭제 요청이 서버에 닿지 못했어요. ${OFFLINE_RETRY_NOTICE}`
    );
    expect(destructiveFlowErrorMessage("child_profile_delete", new Error("Network request failed"), offline)).toBe(
      `아이 프로필 삭제 요청이 서버에 닿지 못했어요. ${OFFLINE_RETRY_NOTICE}`
    );
    expect(destructiveFlowErrorMessage("household_leave", new Error("Network request failed"), offline)).toBe(
      `가구 탈퇴 요청이 서버에 닿지 못했어요. ${OFFLINE_RETRY_NOTICE}`
    );
    expect(destructiveFlowErrorMessage("consent_update", new Error("Network request failed"), offline)).toBe(
      `동의 저장 요청이 서버에 닿지 못했어요. ${OFFLINE_RETRY_NOTICE}`
    );
    // 뒷문장은 라운드 52가 세운 공용 단일 소스 그대로다(같은 상황을 화면마다 다르게 부르지 않는다).
    expect(OFFLINE_RETRY_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.");
  });

  it("네 흐름 모두 자기 요청의 이름을 말한다 — 무엇을 눌렀는지 문장이 되짚어 준다", () => {
    const messages = ALL_KINDS.map((kind) => destructiveFlowOfflineMessage(kind));
    expect(new Set(messages).size, "흐름마다 다른 문장").toBe(ALL_KINDS.length);
    for (const message of messages) {
      expect(message, message).toContain("서버에 닿지 못했어요.");
      expect(message.endsWith(OFFLINE_RETRY_NOTICE), message).toBe(true);
    }
  });

  /**
   * ⚠️ 이 트랙이 말할 수 있는 것의 **상한**. 응답을 받지 못한 앱이 아는 것은 "닿지 못했다"까지다 —
   * "그래서 되돌려졌다 · 계정은 그대로다 · 아무 일도 일어나지 않았다"는 확인한 적 없는 사실이고,
   * 연결 판정은 point-in-time 폴 한 번이라 어긋날 수도 있다.
   */
  it("되돌려졌다고 단언하지 않는다 (부정 단언)", () => {
    for (const kind of ALL_KINDS) {
      const message = destructiveFlowOfflineMessage(kind);
      expect(message, message).not.toMatch(/되돌렸|되돌려졌|취소됐|취소되었|그대로 남아|아무 일도|삭제되지 않|나가지 않/);
    }
  });
});

describe("라운드 71 B(#2) 영구 실패 갈래 — 재시도를 권하지 않는다", () => {
  it("403은 지금 상태를 말한다 (아이 삭제 · 가구 탈퇴)", () => {
    expect(destructiveFlowErrorMessage("child_profile_delete", httpError(403, "FORBIDDEN", "아이 프로필 접근 권한이 없어요."), online)).toBe(
      "이 아이 프로필을 삭제할 권한이 없어요. 보기 전용 역할이거나 이 가족의 구성원이 아닐 수 있어요."
    );
    expect(destructiveFlowErrorMessage("household_leave", httpError(403, "FORBIDDEN", "가족 접근 권한이 없어요."), online)).toBe(
      "이 가족의 구성원이 아니에요. 관리자가 내보냈거나 다른 기기에서 이미 나갔을 수 있어요."
    );
  });

  it("대상 없음(404)은 이미 그렇게 돼 있다는 사실을 말한다", () => {
    expect(
      destructiveFlowErrorMessage(
        "child_profile_delete",
        httpError(404, "CHILD_NOT_FOUND", "아이 프로필을 찾을 수 없어요."),
        online
      )
    ).toBe("이 아이 프로필은 이미 없어요. 다른 기기에서 먼저 삭제됐을 수 있어요.");
    expect(
      destructiveFlowErrorMessage(
        "household_leave",
        httpError(404, "HOUSEHOLD_MEMBER_NOT_FOUND", "Household member was not found."),
        online
      )
    ).toBe("이미 이 가족에서 나와 있어요. 다른 기기에서 먼저 나갔을 수 있어요.");
  });

  it("영구 실패 문구 어디에도 '다시 시도'·'잠시 후'가 없다", () => {
    for (const kind of ALL_KINDS) {
      for (const [code, message] of Object.entries(DESTRUCTIVE_FLOW_MESSAGE_BY_CODE[kind])) {
        expect(message, `${kind}/${code}`).not.toContain("다시 시도");
        expect(message, `${kind}/${code}`).not.toContain("잠시 후");
      }
    }
  });

  it("서버가 답을 준 실패는 오프라인으로 말하지 않는다 — 답이 왔다는 건 연결이 있었다는 뜻이다", () => {
    // 판정 폴이 뒤늦게 offline을 돌려준 경우에도 서버 사유가 우선한다.
    expect(destructiveFlowErrorMessage("household_leave", httpError(403, "FORBIDDEN", "..."), offline)).toBe(
      DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.household_leave.FORBIDDEN
    );
    expect(
      destructiveFlowErrorMessage("child_profile_delete", httpError(404, "CHILD_NOT_FOUND", "..."), offline)
    ).toBe(DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.child_profile_delete.CHILD_NOT_FOUND);
  });
});

describe("라운드 71 B(#2) 모르는 실패 — 종전과 바이트 단위로 같다", () => {
  it("세 확정의 폴백은 종전 화면 리터럴 그대로다", () => {
    expect(DESTRUCTIVE_ACTION_FAILED_MESSAGE).toBe("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    for (const kind of DESTRUCTIVE_KINDS) {
      expect(destructiveFlowFallbackMessage(kind), kind).toBe(DESTRUCTIVE_ACTION_FAILED_MESSAGE);
      // 5xx · 타임아웃 · 데모 세션의 평문 Error · 모르는 코드 — 넷 다 종전 문장이다.
      expect(destructiveFlowErrorMessage(kind, new Error("boom"), online), kind).toBe(DESTRUCTIVE_ACTION_FAILED_MESSAGE);
      expect(destructiveFlowErrorMessage(kind, httpError(500, "INTERNAL_SERVER_ERROR", "..."), online), kind).toBe(
        DESTRUCTIVE_ACTION_FAILED_MESSAGE
      );
      expect(destructiveFlowErrorMessage(kind, httpError(400, "SETTINGS_CONFIRMATION_REQUIRED", "..."), online), kind).toBe(
        DESTRUCTIVE_ACTION_FAILED_MESSAGE
      );
      expect(destructiveFlowErrorMessage(kind, undefined, online), kind).toBe(DESTRUCTIVE_ACTION_FAILED_MESSAGE);
    }
  });

  it("동의 저장의 폴백도 종전 화면 리터럴 그대로다", () => {
    expect(CONSENT_UPDATE_FAILED_MESSAGE).toBe("동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(destructiveFlowErrorMessage("consent_update", new Error("boom"), online)).toBe(CONSENT_UPDATE_FAILED_MESSAGE);
  });

  /**
   * 계정 삭제·동의 저장의 **대상 없음 칸이 비어 있는 것**은 판단이다: 404 기본 코드(`NOT_FOUND`)는
   * 라우트 부재까지 뜻해서 "대상이 사라졌다"로 읽으면 없는 사실을 지어내게 된다.
   */
  it("404 도메인 코드가 없는 두 흐름은 종전 문장으로 떨어지고, 그 이유가 값으로 적혀 있다", () => {
    for (const kind of ["account_delete", "consent_update"] as const) {
      expect(destructiveFlowErrorMessage(kind, httpError(404, "NOT_FOUND", "요청한 API를 찾을 수 없어요."), online), kind).toBe(
        destructiveFlowFallbackMessage(kind)
      );
      const reason = DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES[kind];
      expect(reason, `${kind}: 빈칸에는 이유가 있어야 한다`).toBeTruthy();
      expect(reason!.length, kind).toBeGreaterThan(40);
    }
    // 도메인 코드가 있는 두 흐름은 빈칸이 아니므로 이유도 없다(유령 줄 금지).
    expect(DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES.child_profile_delete).toBeUndefined();
    expect(DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES.household_leave).toBeUndefined();
  });

  it("원문 오류 메시지를 그대로 노출하지 않는다", () => {
    const raw = new Error("TypeError: undefined is not a function");
    for (const kind of ALL_KINDS) {
      expect(destructiveFlowErrorMessage(kind, raw, online), kind).not.toContain("TypeError");
      expect(
        destructiveFlowErrorMessage(kind, httpError(404, "HOUSEHOLD_MEMBER_NOT_FOUND", "Household member was not found."), online),
        kind
      ).not.toContain("Household member");
    }
  });
});

describe("라운드 71 B(#2) 세 흐름 × 네 갈래가 모두 답을 갖는다", () => {
  it("어떤 (흐름, 갈래)에도 빈 문자열이 없고, 갈래가 서로 뒤섞이지 않는다", () => {
    for (const kind of DESTRUCTIVE_KINDS) {
      const branches = {
        forbidden: destructiveFlowErrorMessage(kind, httpError(403, "FORBIDDEN", "..."), online),
        absentTarget: destructiveFlowErrorMessage(
          kind,
          httpError(404, kind === "child_profile_delete" ? "CHILD_NOT_FOUND" : "HOUSEHOLD_MEMBER_NOT_FOUND", "..."),
          online
        ),
        offline: destructiveFlowErrorMessage(kind, new Error("Network request failed"), offline),
        unknown: destructiveFlowErrorMessage(kind, new Error("boom"), online)
      };
      for (const [branch, message] of Object.entries(branches)) {
        expect(message.length, `${kind}/${branch}`).toBeGreaterThan(0);
      }
      // 오프라인 갈래는 계정 삭제까지 포함해 늘 자기 문장이다(종전에는 이 자리가 폴백뿐이었다).
      expect(branches.offline, kind).not.toBe(branches.unknown);
      expect(branches.forbidden, kind).not.toBe(branches.offline);
    }
  });

  it("DNC-018: 해요체 사실 서술이고 기술 용어·지시형·비난 표현을 쓰지 않는다", () => {
    const copies = [
      ...ALL_KINDS.flatMap((kind) => Object.values(DESTRUCTIVE_FLOW_MESSAGE_BY_CODE[kind])),
      ...ALL_KINDS.map((kind) => destructiveFlowOfflineMessage(kind)),
      ...ALL_KINDS.map((kind) => destructiveFlowFallbackMessage(kind))
    ];
    for (const copy of copies) {
      expect(copy, copy).toMatch(/요\.$/);
      expect(copy, copy).not.toMatch(/확인하세요|하십시오|오류|에러|네트워크|error|forbidden|404|403/i);
    }
  });
});

/**
 * **서버 소스 계약** — 표의 반대편. 서버 파일을 **읽기만** 한다(이 라운드의 서버 변경은 0건).
 *
 * 세 확정과 동의 저장이 지나는 서버 경로에서 던지는 코드를 긁어, 각 코드가 그 흐름의 표에 있거나
 * **이유가 적힌 제외 목록**에 있는지 묻는다. 서버가 이 경로에 코드를 새로 만들면 이 단언이
 * 빨개지고, 만든 사람이 "그때 사용자가 무엇을 보는가"에 답해야 한다.
 */
describe("라운드 71 B(#2) 서버가 실제로 던지는 코드 (source contract)", () => {
  /** 클래스 멤버 하나의 본문. 다음 멤버(2칸 들여쓰기 식별자/데코레이터)를 만나면 끝난다. */
  function methodBody(fileSource: string, signature: string): string {
    const start = fileSource.indexOf(signature);
    expect(start, `${signature} — 서버에서 이 자리를 찾지 못했다`).toBeGreaterThan(-1);
    const rest = fileSource.slice(start + signature.length);
    const end = rest.search(/\n {2}[a-zA-Z_@]/);
    return end === -1 ? rest : rest.slice(0, end);
  }

  /**
   * 라운드 71 리뷰 P-4 — 모듈 스코프 함수의 본문(들여쓰기 0의 닫는 중괄호까지).
   * 위 `methodBody`의 종료 규칙(다음 클래스 멤버)은 클래스 밖 함수에는 통하지 않는다.
   */
  function functionBody(fileSource: string, signature: string): string {
    const start = fileSource.indexOf(signature);
    expect(start, `${signature} — 서버에서 이 자리를 찾지 못했다`).toBeGreaterThan(-1);
    const rest = fileSource.slice(start + signature.length);
    const end = rest.indexOf("\n}");
    return end === -1 ? rest : rest.slice(0, end);
  }

  /** `throw new XxxException({ code: "...", ... })`의 그 리터럴. */
  const codesIn = (text: string) => [...text.matchAll(/\bcode: "([A-Z0-9_]+)"/g)].map((match) => match[1]);

  const householdSource = apiSource("households/household-runtime.service.ts");
  const coreSource = apiSource("onboarding/onboarding-core.service.ts");
  const childAccessSource = apiSource("onboarding/child-access.service.ts");
  const settingsControllerSource = apiSource("settings/settings.controller.ts");

  /**
   * 흐름별로 **실제로 지나는 자리**만 읽는다(파일 전체를 긁으면 초대·구성원 관리 코드가 섞인다).
   *
   * 라운드 71 리뷰 P-4: 컨트롤러 둘만 그 규율에서 빠져 있었다 — `codesIn(settingsControllerSource)`는
   * 파일 **전체**라, 아이 삭제 핸들러가 던지는 코드가 생기면 그것이 가구 탈퇴·계정 삭제의
   * 스윕에도 섞여 들어온다(오늘은 컨트롤러가 코드를 하나만 던져 값이 같지만, 같은 병이다).
   * 이제 두 흐름 모두 **자기 확정 핸들러 + 둘이 공유하는 확인 텍스트 검증 함수**만 읽는다.
   */
  const sweptByKind: Record<DestructiveFlowKind, string[]> = {
    child_profile_delete: [
      ...codesIn(methodBody(childAccessSource, "async requireChildAccess(")),
      ...codesIn(methodBody(coreSource, "async confirmChildProfileDeletion(")),
      ...codesIn(methodBody(coreSource, "private assertConfirmation("))
    ],
    household_leave: [
      ...codesIn(methodBody(householdSource, "async leaveHousehold(")),
      ...codesIn(methodBody(householdSource, "private assertMember(")),
      ...codesIn(methodBody(settingsControllerSource, "async householdLeaveConfirm(")),
      ...codesIn(functionBody(settingsControllerSource, "function assertConfirmation("))
    ],
    account_delete: [
      ...codesIn(methodBody(householdSource, "async withdrawUser(")),
      ...codesIn(methodBody(settingsControllerSource, "async accountDeleteConfirm(")),
      ...codesIn(functionBody(settingsControllerSource, "function assertConfirmation("))
    ],
    consent_update: [...codesIn(methodBody(coreSource, "async upsertConsents("))]
  };

  /** 표에 넣지 않는 코드와 그 이유. 비우면 안 된다 — 이유 없는 제외가 곧 다음 라운드의 빈칸이다. */
  const excludedWithReason: Readonly<Record<string, string>> = {
    SETTINGS_CONFIRMATION_REQUIRED:
      "앱은 미리보기 응답이 준 confirmationText를 그대로 되돌려 보낸다(privacy.tsx의 mutationFn) — 사용자가 고칠 수 있는 값이 아니라 안내할 행동이 없다. 종전 문장 그대로 둔다."
  };

  it("각 흐름이 지나는 코드는 그 흐름의 표에 있거나, 이유가 적힌 제외 목록에 있다", () => {
    const swept = new Set(Object.values(sweptByKind).flat());
    // 스윕이 실제로 무언가를 읽었는지부터 확인한다(정규식이 조용히 0건이 되면 계약이 사라진다).
    expect(swept.size, "스윕이 읽은 코드 수").toBeGreaterThanOrEqual(4);

    for (const kind of ALL_KINDS) {
      for (const code of sweptByKind[kind]) {
        const known = Object.prototype.hasOwnProperty.call(DESTRUCTIVE_FLOW_MESSAGE_BY_CODE[kind], code);
        const excluded = Object.prototype.hasOwnProperty.call(excludedWithReason, code);
        expect(
          known || excluded,
          `${kind}/${code}: 표에 없고 제외 이유도 없다. 이 코드를 받은 사용자는 "${destructiveFlowFallbackMessage(kind)}"만 본다.`
        ).toBe(true);
      }
    }
    for (const code of Object.keys(excludedWithReason)) {
      expect(excludedWithReason[code].length, code).toBeGreaterThan(20);
      // 라운드 71 리뷰 P-4: 좁힌 스윕이 그 코드를 여전히 읽는지도 본다 — 범위를 좁히면서
      // 코드를 시야 밖으로 밀어내면 제외 이유가 조용히 유령이 된다.
      expect(swept.has(code), `${code}는 좁힌 스윕이 더는 읽지 않는다`).toBe(true);
    }
  });

  it("표의 대상 없음 줄은 그 경로가 실제로 던지는 코드다 (유령 줄 금지)", () => {
    expect(sweptByKind.child_profile_delete).toContain("CHILD_NOT_FOUND");
    expect(sweptByKind.child_profile_delete).toContain("FORBIDDEN");
    expect(sweptByKind.household_leave).toContain("HOUSEHOLD_MEMBER_NOT_FOUND");
    expect(sweptByKind.household_leave).toContain("FORBIDDEN");
    // 서버 원문이 영어인 갈래도 사용자가 보는 것은 이 표의 한국어 한 문장이다.
    expect(householdSource).toContain('code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found."');
  });

  it("계정 삭제·동의 저장 경로에는 던지는 코드가 없다 — 빈칸의 근거", () => {
    expect(codesIn(methodBody(householdSource, "async withdrawUser("))).toEqual([]);
    expect(codesIn(methodBody(coreSource, "async upsertConsents("))).toEqual([]);
    // 그 경로에 404 도메인 코드가 생기면 위 근거가 깨지고 이 단언이 빨개진다.
    for (const kind of ["account_delete", "consent_update"] as const) {
      expect(sweptByKind[kind].filter((code) => code.endsWith("_NOT_FOUND")), kind).toEqual([]);
    }
  });
});

/** 화면은 vitest에서 렌더할 수 없으므로 배선은 소스 계약으로 고정한다. */
describe("라운드 71 B(#2) SET-004 배선 (source contract)", () => {
  const privacySource = source("app/settings/privacy.tsx");

  it("네 실패 자리 모두 순수 모듈의 문구를 그린다 (화면에 실패 리터럴이 남지 않는다)", () => {
    expect(privacySource).toContain('src/settings/destructive-flow-messages"');
    expect(privacySource).toContain(
      'const childDeleteFailureText = useFlowFailureText("child_profile_delete", childDelete.isError, childDelete.error);'
    );
    expect(privacySource).toContain(
      'const householdLeaveFailureText = useFlowFailureText("household_leave", householdLeave.isError, householdLeave.error);'
    );
    expect(privacySource).toContain(
      'const accountDeleteFailureText = useFlowFailureText("account_delete", accountDelete.isError, accountDelete.error);'
    );
    expect(privacySource).toContain('useFlowFailureText(\n    "consent_update",');
    expect(privacySource).toContain("{childDeleteFailureText}");
    expect(privacySource).toContain("{householdLeaveFailureText}");
    expect(privacySource).toContain("{accountDeleteFailureText}");
    expect(privacySource).toContain("{consentUpdateFailureText}");
    // 종전 리터럴 셋은 화면에서 사라졌다(문구가 두 벌이 되는 순간 표가 무의미해진다).
    expect(privacySource).not.toContain("const actionFailedText");
    expect(privacySource).not.toContain("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(privacySource).not.toContain("동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  /**
   * 라운드 72 리뷰 M-2 — **그 폴은 이제 이 화면에 적혀 있지 않다.**
   *
   * 종전에는 이 화면이 `useState` + `isCurrentlyOnline().then((online) => {…})` + cancelled
   * 가드를 손으로 들고 있었고, 이 계약이 그 세 줄을 글자로 붙들었다. 라운드 72 트랙 E가 같은
   * 배선을 `useErrorTimeConnectivity` 한 벌로 모을 때 이 자리가 빠진 이유는 스윕이
   * `.then(set…)` 한 형태만 봤기 때문이다(리뷰 M-2가 그 그물을 호출 자리 단위로 넓혔다).
   *
   * 그래서 이 계약이 붙드는 것도 옮긴다: **폴의 모양**이 아니라 **그 한 벌을 부르는가**다.
   * 가드·복원의 사실 자체는 공용 훅 쪽 계약이 진다(`src/shared-decision-wiring.test.ts` ⓐ-1).
   */
  it("연결 판정은 공용 배선 한 벌에서 오고, 이 화면에 사본이 없다", () => {
    expect(privacySource).toContain(
      'import { useErrorTimeConnectivity } from "../../src/offline/use-load-error-copy";'
    );
    expect(privacySource).toContain("const isOnline = useErrorTimeConnectivity(isError && !isDemoSession);");
    // 재구현이 남지 않는다 — 폴도 가드도 이 화면의 **코드**에 없다(옛 배선을 이력으로 인용하는
    // 주석과, 그 배선을 실제로 적는 코드는 다르다).
    const privacyCode = privacySource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(privacyCode).not.toContain("isCurrentlyOnline");
    expect(privacyCode).not.toContain("let cancelled = false;");
    // 새 폴러·새 타이머 0건 — 조회/저장 실패 훅과 같은 point-in-time 폴이다.
    expect(privacySource).not.toContain("setInterval");
    expect(privacySource).not.toContain("startConnectivityWatcher");
  });

  /**
   * 라운드 71 리뷰 S-4 — **데모(로컬 토큰) 세션에는 닿지 못한 서버가 없다.**
   *
   * 데모의 요청은 기기 안에서 답한다(src/api/local-backend.ts). 그런데 연결 판정이 보는 것은
   * **기기의 연결 상태**라, 비행기 모드에서 데모를 둘러보다 실패하면 "…요청이 서버에 닿지
   * 못했어요"라는, 일어난 적 없는 일을 말하게 된다. 그 세션에서는 갈래를 아예 건너뛰고 종전
   * 문장(모르는 실패)으로 떨어진다 — 데모 거울을 손대지 않는다는 이 트랙의 계약 그대로다.
   */
  it("데모 세션에서는 오프라인 갈래를 건너뛴다 (닿지 못한 서버가 애초에 없다)", () => {
    expect(privacySource).toContain(
      "const isDemoSession = useSessionStore((state) => !state.accessToken && state.isTestSession);"
    );
    // 라운드 72 리뷰 M-2: 그 갈래는 이제 공용 훅에 넘기는 **인자 하나**다(동치 — 데모 세션이면
    // 폴을 돌리지 않고 판정이 true로 남는다). 종전의 `if (!isError || isDemoSession) {` 가드가
    // 하던 일과 같고, 문구를 고르는 자리도 그대로다.
    expect(privacySource).toContain("const isOnline = useErrorTimeConnectivity(isError && !isDemoSession);");
    expect(privacySource).toContain("destructiveFlowErrorMessage(kind, error, { isOnline: isDemoSession || isOnline });");
    // 그때 서는 문장은 종전 그대로다 — 데모 거울이 던지는 평문 Error에는 코드가 없어 모르는
    // 실패 갈래로 떨어지고, 그 값은 화면의 옛 리터럴과 바이트 단위로 같다.
    for (const kind of DESTRUCTIVE_KINDS) {
      expect(destructiveFlowErrorMessage(kind, new Error("boom"), online), kind).toBe(DESTRUCTIVE_ACTION_FAILED_MESSAGE);
    }
    expect(destructiveFlowErrorMessage("consent_update", new Error("boom"), online)).toBe(CONSENT_UPDATE_FAILED_MESSAGE);
    // 판정 자체는 한 글자도 바뀌지 않았다 — 실세션의 오프라인은 종전대로 그 문장이다.
    expect(destructiveFlowErrorMessage("account_delete", new Error("boom"), offline)).toBe(
      destructiveFlowOfflineMessage("account_delete")
    );
  });

  /**
   * 라운드 70 D가 방금 세운 자리(상자)와 그 위의 2단계는 **이 트랙이 만지지 않는다.**
   * 이 트랙이 만지는 것은 그 아래, 버튼이 실패했을 때의 한 줄뿐이다.
   */
  it("상자·확인 문구·2단계·성공 뒤 처리는 한 글자도 바뀌지 않았다", () => {
    expect(privacySource).toContain("<Text style={previewTitleStyle}>진행하면 이렇게 돼요</Text>");
    expect(privacySource).toContain("{preview.impact.map((line) => (");
    expect(privacySource).toContain("{preview.requiresSecondStep ? (");
    expect(privacySource).toContain("한 번 더 확인한 다음에 진행할 수 있어요.");
    expect(privacySource).toContain("childPreview.data?.confirmationText ?? \"\"");
    expect(privacySource).toContain("householdPreview.data?.confirmationText ?? \"\"");
    expect(privacySource).toContain("accountPreview.data?.confirmationText ?? \"\"");
    expect(privacySource).toContain('Alert.alert("정말 나갈까요?"');
    // 성공 뒤 세션 정리·라우팅 무변경.
    expect(privacySource).toContain('await finishChildRemoval("아이 프로필을 삭제했어요.");');
    expect(privacySource).toContain('await finishChildRemoval("가구에서 나갔어요.");');
    expect(privacySource).toContain('router.replace("/launch-animation");');
    expect(privacySource).toContain("clearSession();");
  });

  it("이 트랙이 지나지 않는 두 자리는 종전 그대로다 — 조회 실패와 약관 링크 실패", () => {
    // 조회 실패의 오프라인 배선은 OFFLINE_AWARE_LOAD_ERROR_SCREENS의 몫이다(무접촉).
    expect(privacySource).toContain('const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";');
    expect(privacySource).toContain("{privacy.isError ? (");
    // 라운드 71 리뷰 S-2: 여는 규칙만 공용 모듈로 옮겼고(문구·동작 불변), 이 트랙은 여전히
    // 그 자리를 지나지 않는다.
    expect(privacySource).toContain(
      "openExternalUrl(url, { failTitle: LEGAL_LINK_FAILED_TITLE, failMessage: LEGAL_LINK_FAILED_MESSAGE });"
    );
    expect(privacySource).not.toContain("useLoadErrorCopy");
  });

  it("서버·데모 거울은 무접촉이다 (impact 배열은 상자의 계약, 실패 문구는 앱의 것)", () => {
    const localBackend = source("src/api/local-backend.ts");
    for (const kind of ALL_KINDS) {
      for (const message of Object.values(DESTRUCTIVE_FLOW_MESSAGE_BY_CODE[kind])) {
        expect(localBackend, message).not.toContain(message);
      }
      expect(localBackend).not.toContain(destructiveFlowOfflineMessage(kind));
    }
    expect(apiSource("settings/settings.controller.ts")).not.toContain("닿지 못했어요");
  });
});
