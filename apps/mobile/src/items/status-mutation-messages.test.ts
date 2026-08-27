import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  isItemStatusConnectionError,
  ITEM_STATUS_GIFT_FAILED_MESSAGE,
  ITEM_STATUS_INTEREST_FAILED_MESSAGE,
  ITEM_STATUS_OFFLINE_MESSAGE,
  ITEM_STATUS_PREPARE_FAILED_MESSAGE,
  ITEM_STATUS_SKIP_FAILED_MESSAGE,
  ITEM_STATUS_UNGIFT_FAILED_MESSAGE,
  ITEM_STATUS_UNINTEREST_FAILED_MESSAGE,
  itemStatusMutationErrorMessage,
  type ItemStatusActionKind
} from "./status-mutation-messages";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const ALL_KINDS: ItemStatusActionKind[] = ["prepare", "interest", "uninterest", "gift", "ungift", "skip"];

describe("ITEM-124 상태 변경 실패 문구 (순수 모듈)", () => {
  it("조작마다 무엇이 저장되지 않았는지 말한다", () => {
    const serverError = new Error('{"error":{"code":"INTERNAL","message":"boom"}}');
    expect(itemStatusMutationErrorMessage("prepare", serverError)).toBe(ITEM_STATUS_PREPARE_FAILED_MESSAGE);
    expect(itemStatusMutationErrorMessage("interest", serverError)).toBe(ITEM_STATUS_INTEREST_FAILED_MESSAGE);
    expect(itemStatusMutationErrorMessage("uninterest", serverError)).toBe(ITEM_STATUS_UNINTEREST_FAILED_MESSAGE);
    expect(itemStatusMutationErrorMessage("gift", serverError)).toBe(ITEM_STATUS_GIFT_FAILED_MESSAGE);
    expect(itemStatusMutationErrorMessage("ungift", serverError)).toBe(ITEM_STATUS_UNGIFT_FAILED_MESSAGE);
    expect(itemStatusMutationErrorMessage("skip", serverError)).toBe(ITEM_STATUS_SKIP_FAILED_MESSAGE);
    // 조작별 문구는 서로 달라야 한다 -- 다 같은 말이면 무엇이 실패했는지 알 수 없다.
    expect(new Set(ALL_KINDS.map((kind) => itemStatusMutationErrorMessage(kind, serverError))).size).toBe(
      ALL_KINDS.length
    );
  });

  it("서버 응답 본문이나 내부 오류 메시지를 그대로 노출하지 않는다", () => {
    const leaky = new Error('{"error":{"code":"FORBIDDEN","message":"child not in household"}}');
    for (const kind of ALL_KINDS) {
      const message = itemStatusMutationErrorMessage(kind, leaky);
      expect(message).not.toContain("FORBIDDEN");
      expect(message).not.toContain("household");
      expect(message).not.toContain("{");
    }
  });

  it("연결 문제(네트워크 거절·타임아웃)는 연결을 언급하는 문구로 모은다", () => {
    const timeout = Object.assign(new Error("요청 시간이 초과되었어요(10초)"), { name: "ApiTimeoutError" });
    const rnNetwork = new TypeError("Network request failed");
    const webNetwork = new TypeError("Failed to fetch");
    const aborted = Object.assign(new Error("Aborted"), { name: "AbortError" });

    for (const error of [timeout, rnNetwork, webNetwork, aborted]) {
      expect(isItemStatusConnectionError(error)).toBe(true);
      expect(itemStatusMutationErrorMessage("prepare", error)).toBe(ITEM_STATUS_OFFLINE_MESSAGE);
      expect(itemStatusMutationErrorMessage("skip", error)).toBe(ITEM_STATUS_OFFLINE_MESSAGE);
    }

    // 응답이 왔다는 건 연결은 됐다는 뜻이다 -- 서버 오류를 연결 문제로 부르지 않는다.
    expect(isItemStatusConnectionError(new Error('{"error":{"code":"INTERNAL"}}'))).toBe(false);
    expect(isItemStatusConnectionError(undefined)).toBe(false);
    expect(isItemStatusConnectionError("something else")).toBe(false);
  });

  it("이 경로는 오프라인 아웃박스가 없으므로 '자동 반영'을 약속하지 않는다", () => {
    // 지출 저장과 달리 상태 변경은 큐에 쌓이지 않는다(src/offline/sync-engine.ts는 지출만 다룬다).
    // "연결되면 자동으로 반영할게요"(OFFLINE_SAVED_MESSAGE)라고 말하면 그대로 유실된다.
    expect(ITEM_STATUS_OFFLINE_MESSAGE).not.toContain("자동");
    expect(ITEM_STATUS_OFFLINE_MESSAGE).toContain("아직 저장하지 못했어요");
    expect(ITEM_STATUS_OFFLINE_MESSAGE).toContain("다시");
  });

  it("DNC-018 톤: 해요체 존댓말 + 다음 행동 안내, 사용자를 탓하지 않는다", () => {
    const messages = [ITEM_STATUS_OFFLINE_MESSAGE, ...ALL_KINDS.map((kind) => itemStatusMutationErrorMessage(kind, new Error("x")))];
    for (const message of messages) {
      expect(message.endsWith("요.")).toBe(true);
      expect(message).toMatch(/다시/);
      for (const blame of ["잘못", "실패했습니다", "오류가 발생했습니다", "당신"]) {
        expect(message, `"${blame}" must not appear in "${message}"`).not.toContain(blame);
      }
    }
  });
});

describe("리뷰 F2 gifted 해제 확인 문구", () => {
  it("무엇이 바뀌는지를 상태 이름으로 알려준다", () => {
    expect(giftedResetConfirmMessage("prepare")).toBe("지금은 선물 받음으로 표시돼 있어요. 계속하면 이미 준비 상태로 바뀌어요.");
    expect(giftedResetConfirmMessage("interest")).toContain("관심 상태로 바뀌어요.");
    expect(giftedResetConfirmMessage("skip")).toContain("필요 없음 상태로 바뀌어요.");
    expect(giftedResetConfirmMessage("uninterest")).toContain("준비 전 상태로 바뀌어요.");
  });

  it("겁주지 않는 안내 톤이고, 취소/실행 라벨은 앱 Alert 관례를 따른다", () => {
    expect(GIFTED_RESET_CONFIRM_TITLE).toBe("선물받은 상태가 해제돼요");
    expect(GIFTED_RESET_CONFIRM_CANCEL_LABEL).toBe("취소");
    expect(GIFTED_RESET_CONFIRM_ACTION_LABEL).toBe("계속하기");
    for (const kind of ["prepare", "interest", "uninterest", "skip"] as const) {
      const message = giftedResetConfirmMessage(kind);
      expect(message.endsWith("요.")).toBe(true);
      expect(message).not.toContain("삭제");
      expect(message).not.toContain("사라집니다");
    }
  });
});

/**
 * ITEM-124 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어
 * 이 저장소의 관례대로 소스 grep으로 확인한다: src/expenses/save-error-wiring.test.ts,
 * src/offline/ui-wiring.test.ts 참고).
 *
 * 이 티켓 이전의 상태는 "네 뮤테이션 모두 onSuccess만 있고 onError가 없다"였다. 오프라인이거나
 * 서버가 5xx를 주면 화면은 아무 말도 하지 않았고, 이 경로는 아웃박스도 타지 않아 그대로 유실됐다.
 */
describe("ITEM-124 상태 변경 실패 배선", () => {
  const detail = source("app/items/[itemTemplateId].tsx");
  const items = source("app/(tabs)/items.tsx");

  it("네 뮤테이션 모두 실패 경로가 배선되어 있다", () => {
    const blocks: Array<[string, string]> = [
      ["markPrepared", detail.slice(detail.indexOf("const markPrepared = useMutation({"), detail.indexOf("// UX-5B-2:"))],
      ["toggleInterested", detail.slice(detail.indexOf("const toggleInterested = useMutation({"), detail.indexOf("/**\n   * ITEM-123 (B4):"))],
      ["markGifted", detail.slice(detail.indexOf("const markGifted = useMutation({"), detail.indexOf("const clickLink = useMutation({"))],
      ["updateStatus", items.slice(items.indexOf("const updateStatus = useMutation({"), items.indexOf("const hasSession ="))]
    ];

    for (const [name, block] of blocks) {
      expect(block.length, `${name} block found`).toBeGreaterThan(0);
      expect(block, `${name} handles failure`).toContain("onError:");
      // 다음 시도를 시작할 때 이전 오류를 지운다 -- 낡은 배너가 남아 있으면 안 된다.
      expect(block, `${name} clears the previous error`).toContain("onMutate: () => {");
      expect(block, `${name} clears the previous error`).toContain("setStatusErrorMessage(null);");
      expect(block, `${name} takes the copy from the shared module`).toContain("itemStatusMutationErrorMessage(");
    }
  });

  it("실패 원인별 문구를 조작에 맞게 고른다", () => {
    expect(detail).toContain('setStatusErrorMessage(itemStatusMutationErrorMessage("prepare", error));');
    expect(detail).toContain('itemStatusMutationErrorMessage(status === "interested" ? "interest" : "uninterest", error)');
    expect(detail).toContain('itemStatusMutationErrorMessage(status === "gifted" ? "gift" : "ungift", error)');
    expect(items).toContain('itemStatusMutationErrorMessage(variables.status === "prepared" ? "prepare" : "skip", error)');
  });

  it("문구는 순수 모듈에서만 온다 (화면 인라인 리터럴 금지)", () => {
    for (const [path, screenSource] of [
      ["app/items/[itemTemplateId].tsx", detail],
      ["app/(tabs)/items.tsx", items]
    ] as const) {
      expect(screenSource, `${path} imports the shared copy`).toContain(
        'from "../../src/items/status-mutation-messages"'
      );
      expect(screenSource, `${path} must not inline the copy`).not.toContain("준비 완료로 표시하지 못했어요");
      expect(screenSource, `${path} must not inline the copy`).not.toContain("연결이 끊겨 아직 저장하지 못했어요");
    }
  });

  it("오류는 화면 안 인라인 배너로 알린다 (Toast tone=\"error\", accessibilityRole=alert)", () => {
    for (const [path, screenSource] of [
      ["app/items/[itemTemplateId].tsx", detail],
      ["app/(tabs)/items.tsx", items]
    ] as const) {
      expect(screenSource, `${path} renders the banner`).toContain(
        '{statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}'
      );
    }
    // Toast는 alert 롤 + live region을 그대로 유지한다(A11Y-115).
    const uiSource = source("src/ui.tsx");
    const toastBlock = uiSource.slice(uiSource.indexOf("export function Toast"), uiSource.indexOf("export function AffiliateDisclosure"));
    expect(toastBlock).toContain('accessibilityRole="alert"');
    expect(toastBlock).toContain('tone === "error"');
  });

  it("DNC-010: 배너가 제휴 고지와 구매 CTA 사이에 끼어들지 않는다", () => {
    const disclosureIndex = detail.indexOf("<AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    const bannerIndex = detail.indexOf("{statusErrorMessage ?");
    expect(bannerIndex).toBeGreaterThan(ctaIndex);
    expect(ctaIndex).toBeGreaterThan(disclosureIndex);
  });

  it("목록 버튼은 항목 단위로만 비활성된다 (한 행이 목록 전체를 잠그지 않는다)", () => {
    expect(items).toContain("updateStatus.isPending && updateStatus.variables?.itemTemplateId === itemTemplateId");
    expect(items.match(/disabled={isStatusUpdatePending\(item\.id\)}/g)).toHaveLength(2);
    // 목록 전체를 잠그는 배선은 없어야 한다.
    expect(items).not.toContain("disabled={updateStatus.isPending}");
  });

  it("상세 버튼도 요청이 나가는 동안 다시 눌리지 않는다", () => {
    expect(detail).toContain("disabled={!hasSession || toggleInterested.isPending}");
    expect(detail).toContain("disabled={markGifted.isPending}");
    expect(detail).toContain("disabled={markPrepared.isPending}");
  });
});
