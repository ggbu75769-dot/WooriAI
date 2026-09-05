import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFLINE_SAVED_MESSAGE } from "../offline/messages";
import { itemStatusLabel } from "./item-labels";
import {
  GIFTED_RESET_CONFIRM_ACTION_LABEL,
  GIFTED_RESET_CONFIRM_CANCEL_LABEL,
  GIFTED_RESET_CONFIRM_TITLE,
  giftedResetConfirmMessage,
  ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE,
  ITEM_STATUS_QUEUED_MESSAGE,
  ITEM_STATUS_SYNC_FAILED_HINT
} from "./status-mutation-messages";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 51 C-10 — ITEM-124가 고정해 둔 계약이 **뒤집힌** 자리다.
 *
 * 그때의 규칙은 "자동 반영을 약속하지 않는다"였고, 근거는 준비 상태 변경이 오프라인 아웃박스를
 * 타지 않는다는 사실이었다(실패 = 유실). C-10이 그 사실을 바꿨으므로 문구도 함께 바뀐다.
 * 이 describe는 새 계약을 같은 강도로 못박는다: 이제 **약속을 해야** 하고, 그 약속은 실제로
 * 지켜진다(src/offline/sync-engine.ts의 flushItemStatusPass).
 */
describe("C-10 준비템 상태 변경 문구 (순수 모듈)", () => {
  it("대기 중인 변경에는 자동 반영을 약속한다 -- 지출 저장과 같은 말로", () => {
    expect(ITEM_STATUS_QUEUED_MESSAGE).toBe("연결되면 자동으로 반영할게요.");
    // 지출 저장 문구가 쓰는 바로 그 약속 문장을 그대로 잇는다(같은 동작을 다른 말로 부르지 않는다).
    expect(OFFLINE_SAVED_MESSAGE).toContain(ITEM_STATUS_QUEUED_MESSAGE);
  });

  it("ITEM-124의 '다시 눌러 주세요'는 사라졌다 -- 이제 다시 누를 필요가 없다", () => {
    // 큐가 없던 시절의 문구를 되살리면 사용자가 같은 값을 두 번 큐에 넣게 만든다.
    expect(ITEM_STATUS_QUEUED_MESSAGE).not.toContain("다시");
    const moduleSource = source("src/items/status-mutation-messages.ts");
    expect(moduleSource).not.toContain("연결이 끊겨 아직 저장하지 못했어요");
    expect(moduleSource).not.toContain("잠시 후 다시 시도해 주세요");
  });

  it("서버가 거절한 행에는 다음 행동만 알려준다 (사유는 행의 lastError가 이미 말한다)", () => {
    expect(ITEM_STATUS_SYNC_FAILED_HINT).toBe("동기화 상태에서 다시 시도하거나 되돌릴 수 있어요.");
  });

  it("기기 저장 실패만은 다시 누르라고 말한다 -- 연결을 언급하지 않는다", () => {
    expect(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE).toContain("다시 눌러 주세요");
    expect(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE).not.toContain("연결");
  });

  it("DNC-018 톤: 해요체 존댓말, 사용자를 탓하지 않는다", () => {
    for (const message of [
      ITEM_STATUS_QUEUED_MESSAGE,
      ITEM_STATUS_SYNC_FAILED_HINT,
      ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE
    ]) {
      expect(message.endsWith("요.")).toBe(true);
      for (const blame of ["잘못", "실패했습니다", "오류가 발생했습니다", "당신"]) {
        expect(message, `"${blame}" must not appear in "${message}"`).not.toContain(blame);
      }
    }
  });
});

describe("리뷰 F2 gifted 해제 확인 문구", () => {
  it("무엇이 바뀌는지를 상태 이름으로 알려준다(목록 pill과 같은 어휘)", () => {
    expect(giftedResetConfirmMessage("prepare")).toBe("지금은 선물 받음으로 표시돼 있어요. 계속하면 보유 상태로 바뀌어요.");
    expect(giftedResetConfirmMessage("interest")).toContain("알아보기 상태로 바뀌어요.");
    expect(giftedResetConfirmMessage("skip")).toContain("필요 없음 상태로 바뀌어요.");
    // 문구가 가리키는 상태를 화면이 다른 단어로 부르면 안 된다 -- 라벨은 한 소스에서만 나온다.
    for (const [kind, status] of [["prepare", "prepared"], ["interest", "interested"], ["skip", "not_needed"]] as const) {
      expect(giftedResetConfirmMessage(kind)).toContain(`${itemStatusLabel(status)} 상태로 바뀌어요.`);
    }
  });

  /**
   * 라운드 24 L7: 확인이 뜨는 경우는 지금 상태가 gifted일 때뿐인데, status가 단일 컬럼이라
   * 그때는 interested도 gifted도 "동시에"일 수 없다. 즉 gifted에서 출발하는 조작에 "찜해제"
   * (uninterest)나 "선물 받음 취소"(ungift)라는 것이 존재하지 않는다.
   */
  it("gifted에서 출발할 수 있는 조작만 받는다 (uninterest/gift/ungift는 타입에서 제외)", () => {
    const messagesSource = source("src/items/status-mutation-messages.ts");
    expect(messagesSource).toContain(
      'export type GiftedResetActionKind = Extract<ItemStatusActionKind, "prepare" | "interest" | "skip">;'
    );
    const labelTable = messagesSource.slice(
      messagesSource.indexOf("const GIFTED_RESET_TARGET_STATUS"),
      messagesSource.indexOf("export function giftedResetConfirmMessage")
    );
    expect(labelTable).not.toContain("uninterest");
    expect(labelTable).not.toContain("ungift");
    // 표는 상태 값만 들고, 사람이 읽는 라벨은 item-labels가 만든다.
    expect(labelTable).not.toContain('"보유"');
  });

  it("겁주지 않는 안내 톤이고, 취소/실행 라벨은 앱 Alert 관례를 따른다", () => {
    expect(GIFTED_RESET_CONFIRM_TITLE).toBe("선물받은 상태가 해제돼요");
    expect(GIFTED_RESET_CONFIRM_CANCEL_LABEL).toBe("취소");
    expect(GIFTED_RESET_CONFIRM_ACTION_LABEL).toBe("계속하기");
    for (const kind of ["prepare", "interest", "skip"] as const) {
      const message = giftedResetConfirmMessage(kind);
      expect(message.endsWith("요.")).toBe(true);
      expect(message).not.toContain("삭제");
      expect(message).not.toContain("사라집니다");
    }
  });
});

/**
 * C-10 화면 배선 계약 (source verification — react-native 화면은 vitest에서 렌더할 수 없어
 * 이 저장소의 관례대로 소스 grep으로 확인한다: src/expenses/save-error-wiring.test.ts,
 * src/offline/ui-wiring.test.ts 참고).
 *
 * ITEM-124가 고정하던 것은 "네 뮤테이션 모두 onError가 있다"였다. 이제 고정할 것은 그 위 층이다:
 * **애초에 서버 왕복에 매달리지 않는다.**
 */
describe("C-10 준비템 상태 변경 오프라인 배선", () => {
  const detail = source("app/items/[itemTemplateId].tsx");
  const items = source("app/(tabs)/items.tsx");
  const screens = [
    ["app/items/[itemTemplateId].tsx", detail],
    ["app/(tabs)/items.tsx", items]
  ] as const;

  it("두 화면 모두 상태 변경을 오프라인 컨트롤러로 보낸다 (직접 PATCH 금지)", () => {
    for (const [path, screenSource] of screens) {
      expect(screenSource, `${path} routes through the offline queue`).toContain("updateItemStatusOffline(");
      // 예전의 직접 호출은 남아 있으면 안 된다 -- 남으면 그 경로만 유실이 되살아난다.
      expect(screenSource, `${path} must not call the raw PATCH`).not.toContain(
        "updateItemStatus(authToken!, childId!"
      );
    }
  });

  it("저장 직후 서버에 다시 묻지 않는다 (낙관 반영이 되돌아가는 재조회 금지)", () => {
    // 서버는 아직 옛 값을 들고 있다 -- 여기서 무효화하면 방금 누른 값이 되돌아온다.
    // 재조회는 전송이 확정된 뒤 sync-controller가 한 번만 한다.
    const controller = source("src/offline/sync-controller.ts");
    const writeBody = controller.slice(
      controller.indexOf("export async function updateItemStatusOffline"),
      controller.indexOf("export async function retryOfflineItemStatus")
    );
    expect(writeBody).toContain("setQueriesData");
    expect(writeBody).not.toContain("invalidateQueries");

    const flushBody = controller.slice(
      controller.indexOf("if (summary.itemStatusSynced > 0)"),
      controller.indexOf("async function flushInBackground")
    );
    expect(flushBody).toContain('invalidateQueries({ queryKey: ["items"] })');
    expect(flushBody).toContain('invalidateQueries({ queryKey: ["item-detail"] })');
  });

  it("대기/실패 상태는 순수 모듈이 정한 배지·문구로만 그린다", () => {
    for (const [path, screenSource] of screens) {
      expect(screenSource, `${path} reads the pending overlay`).toContain("pendingItemStatusView(");
      expect(screenSource, `${path} uses the shared badge copy`).toContain("pendingStatus.badgeLabel");
      expect(screenSource, `${path} uses the shared notice copy`).toContain("pendingStatus.noticeText");
      // 문구 인라인 금지(ITEM-124부터 이어지는 관례).
      expect(screenSource, `${path} must not inline the copy`).not.toContain("연결되면 자동으로 반영할게요");
    }
  });

  it("낙관 반영: 대기 중인 값이 서버 응답을 이긴다", () => {
    expect(items).toContain("effectiveItemStatus(item.status, pendingStatusRow)");
    expect(detail).toContain("effectiveItemStatus(visibleDetail.status, pendingStatusRow)");
    // 상세 화면의 상태 라벨·찜 토글·gifted 판정이 모두 그 값을 본다.
    expect(detail).toContain("const isInterested = displayStatus === \"interested\";");
    expect(detail).toContain("const isGifted = displayStatus === \"gifted\";");
    expect(detail).toContain("itemStatusBadgeLabel(displayStatus)");
  });

  /**
   * 라운드 99 F2 M-1 — 목록 탭의 보정이 **필터·계산보다 상류**에 선다. 종전에는 타일
   * (sessionRows)에서만 보정해서, 재조회가 서버 옛 값으로 캐시를 덮으면 준비율 히어로 ·
   * 100% 축하 · 찜 필터 · "먼저 챙기면 좋아요"가 원시 status를 읽어 타일과 모순됐다.
   */
  it("낙관 반영: 목록 탭은 보정을 상류(effectiveStatusItems)에서 한 번만 하고 전 소비처가 그 목록을 읽는다", () => {
    const upstreamIndex = items.indexOf("const effectiveStatusItems");
    expect(upstreamIndex).toBeGreaterThan(-1);
    // 네 소비처 + 타일 목록이 전부 그 보정 목록(또는 그 파생 listedItems)을 읽는다.
    expect(items).toContain("computeEssentialPrepProgress(effectiveStatusItems, stageLabel)");
    expect(items).toContain("filterInterestedItems(effectiveStatusItems)");
    expect(items.indexOf("filterInterestedItems(effectiveStatusItems)")).toBeGreaterThan(upstreamIndex);
    expect(items).toContain("hasSession && showInterestedOnly ? filterInterestedItems(effectiveStatusItems) : effectiveStatusItems;");
    expect(items).toContain("const prepFocusIds = hasSession && !isPixelLockMode ? nextPrepFocusIds(listedItems) : null;");
    // 두 번째 보정(사본)이 남아 있지 않다 -- 타일은 상류에서 이미 보정된 항목을 그대로 쓴다.
    expect(items).toContain("rowItem: item,");
    expect(items.match(/effectiveItemStatus\(/g) ?? []).toHaveLength(1);
    // 준비율이 원시 스냅샷을 직접 읽는 형태로 되돌아가지 않는다.
    expect(items).not.toContain("computeEssentialPrepProgress(items.data.items");
    expect(items).not.toContain("filterInterestedItems(visibleItems)");
  });

  it("기기 저장 실패만 화면 안 배너로 알린다 (Toast tone=\"error\", accessibilityRole=alert)", () => {
    for (const [path, screenSource] of screens) {
      expect(screenSource, `${path} renders the banner`).toContain(
        '{statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}'
      );
      expect(screenSource, `${path} takes the copy from the shared module`).toContain(
        "setStatusErrorMessage(ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE)"
      );
    }
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

  /**
   * ITEM-124(L6)가 만든 행 단위 in-flight 잠금은 **서버 왕복 중 중복 PATCH**를 막는 장치였다.
   * 저장이 로컬이 되면서 기다릴 왕복이 없어졌고, 같은 준비템을 다시 눌러도 대기 행이 최신 값으로
   * 대체될 뿐이라(outbox-merge.ts) 잠글 이유가 사라졌다.
   */
  it("서버 왕복을 기다리는 버튼 잠금이 남아 있지 않다", () => {
    expect(items).not.toContain("pendingStatusIds");
    expect(items).not.toContain("isStatusUpdatePending");
    expect(detail).not.toContain("markGifted.isPending");
    expect(detail).not.toContain("markPrepared.isPending");
    expect(detail).not.toContain("toggleInterested.isPending");
    // 접근성 라벨과 버튼 자체는 그대로다(A11Y-115/a11y-contract).
    expect(items).toContain("accessibilityLabel={`${item.name} 준비했어요`}");
    expect(items).toContain("accessibilityLabel={`${item.name} 괜찮아요`}");
  });
});
