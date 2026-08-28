import { SYNC_ROW_FAILED_LABEL, SYNC_ROW_PENDING_LABEL } from "../offline/messages";
import type { ItemStatusOutboxRow, ItemStatusValue } from "../offline/types";
import { ITEM_STATUS_QUEUED_MESSAGE, ITEM_STATUS_SYNC_FAILED_HINT } from "./status-mutation-messages";

/**
 * 라운드 51 C-10 — "아직 서버에 반영되지 않은 준비 상태"를 화면이 읽는 방법(순수 모듈).
 *
 * ## 왜 필요한가
 *
 * 준비 상태 변경이 오프라인 아웃박스를 타면서(src/offline/types.ts의 ItemStatusOutboxRow) 화면이
 * 그리는 상태와 서버가 아는 상태가 잠깐 달라진다. 그 사이를 두 가지로 메운다.
 *
 * 1. **낙관 반영** — 누른 값이 즉시 목록/상세에 보인다. 저장 경로가 로컬 우선이므로 사용자가
 *    보는 것이 곧 이 기기의 진실이다(지출 기록과 같은 계약).
 * 2. **대기 표시** — 그 값이 아직 서버에 닿지 않았다는 사실도 같이 말한다. 지출 기록 탭이 쓰는
 *    문구를 **그대로** 재사용한다(src/offline/messages.ts의 SYNC_ROW_PENDING_LABEL /
 *    SYNC_ROW_FAILED_LABEL) — 같은 상태를 화면마다 다른 말로 부르면 사용자는 서로 다른 것으로
 *    읽는다(REC-123 H4가 정리한 그 문제다).
 *
 * 화면(react-native)은 vitest에서 렌더할 수 없으므로 판정·문구는 전부 여기에 두고, 화면은
 * 그리기만 한다. 배선은 소스 grep 계약 테스트가 맡는다(이 저장소의 관례).
 */

/** 큐 한 줄이 화면에서 갖는 뜻. `null`이면 이 준비템에는 대기 중인 변경이 없다. */
export type PendingItemStatusView = {
  /** 낙관 반영에 쓸 상태값(사용자가 마지막으로 누른 값). */
  status: ItemStatusValue;
  /** 대기/전송 중/실패 — 배지 문구가 이 값으로 갈린다. */
  syncState: ItemStatusOutboxRow["syncState"];
  /** 지출 대기 행과 **같은 문구**의 배지 라벨. */
  badgeLabel: string;
  /** 배지 아래 한 줄. 대기면 자동 반영 약속, 실패면 서버가 준 사유 + 다음 행동. */
  noticeText: string;
};

/**
 * 지금 선택된 아이의 대기 행만 골라 `itemTemplateId → 행`으로 색인한다.
 *
 * 아이로 한 번 거르는 것이 핵심이다: 큐는 계정 단위라 다른 아이의 대기 행도 함께 들고 있는데,
 * 준비템 id는 카탈로그 템플릿 id라 **아이가 달라도 같은 값**이다. 거르지 않으면 첫째에게 누른
 * "준비했어요"가 둘째의 목록에도 반영된 것처럼 보인다.
 */
export function buildPendingItemStatusIndex(
  rows: ReadonlyArray<ItemStatusOutboxRow> | null | undefined,
  childId: string | null | undefined
): ReadonlyMap<string, ItemStatusOutboxRow> {
  const index = new Map<string, ItemStatusOutboxRow>();
  if (!rows || !childId) return index;
  for (const row of rows) {
    if (row.childId !== childId) continue;
    // 같은 준비템에 행이 둘일 수 있는 경우는 전송 중 행 + 그 뒤에 누른 새 행뿐이다
    // (outbox-merge.ts). 그때 사용자가 마지막으로 원한 값은 **나중 행**이다.
    index.set(row.itemTemplateId, row);
  }
  return index;
}

/**
 * 화면에 그릴 상태. 대기 행이 있으면 그 값이 서버 응답을 이긴다 -- 사용자가 방금 누른 값이
 * 이 기기의 진실이고, 서버 응답은 아직 그 사실을 모르는 옛 값이기 때문이다.
 */
export function effectiveItemStatus<TStatus extends string>(
  serverStatus: TStatus,
  pending: ItemStatusOutboxRow | undefined
): TStatus | ItemStatusValue {
  return pending ? pending.status : serverStatus;
}

/** 대기/실패 행의 배지·안내 문구. 큐에 없으면 null이라 화면에 아무것도 늘어나지 않는다. */
export function pendingItemStatusView(row: ItemStatusOutboxRow | undefined): PendingItemStatusView | null {
  if (!row) return null;
  if (row.syncState === "failed") {
    return {
      status: row.status,
      syncState: "failed",
      badgeLabel: SYNC_ROW_FAILED_LABEL,
      // 서버가 준 사유(lastError)는 이미 한국어 안내 문구다(remote-api.ts의 apiErrorMessage).
      // 그 문장이 없을 때만 힌트 한 줄로 떨어진다 -- 원문 JSON이 새어 나갈 자리는 없다.
      noticeText: row.lastError ? `${row.lastError} ${ITEM_STATUS_SYNC_FAILED_HINT}` : ITEM_STATUS_SYNC_FAILED_HINT
    };
  }
  return {
    status: row.status,
    syncState: row.syncState,
    badgeLabel: SYNC_ROW_PENDING_LABEL,
    noticeText: ITEM_STATUS_QUEUED_MESSAGE
  };
}

/**
 * 낙관 반영을 **react-query 캐시에도** 적어 두기 위한 순수 패치.
 *
 * 위 색인만으로도 렌더는 맞지만, 캐시까지 갱신해 두면 전송이 성공한 뒤 큐 행이 사라지고
 * (색인이 비고) 무효화된 목록이 다시 도착하기까지의 짧은 구간에서 **방금 바꾼 값이 잠깐 옛
 * 값으로 되돌아 보이는 깜빡임**이 없다.
 *
 * 준비템 캐시는 세 모양으로 존재한다(app/(tabs)/items.tsx, app/items/[itemTemplateId].tsx):
 *  - 목록 응답 `{ items: ItemSummary[] }`
 *  - 준비율 스냅샷 `ItemSummary[]` (queryFn이 `response.items`를 그대로 돌려준다)
 *  - 상세 응답 `ItemDetail`(= 단일 객체)
 * 셋 다 여기서 다루고, 그 밖의 모양은 **손대지 않고 그대로 돌려준다**(모르는 캐시를 추측해서
 * 고치지 않는다).
 */
export function patchItemStatusInQueryData(
  data: unknown,
  itemTemplateId: string,
  status: ItemStatusValue
): unknown {
  if (Array.isArray(data)) {
    return data.map((entry) => patchOneItem(entry, itemTemplateId, status));
  }
  if (data && typeof data === "object") {
    const shape = data as { items?: unknown; id?: unknown };
    if (Array.isArray(shape.items)) {
      return { ...data, items: shape.items.map((entry) => patchOneItem(entry, itemTemplateId, status)) };
    }
    if (shape.id === itemTemplateId) {
      return { ...data, status };
    }
  }
  return data;
}

function patchOneItem(entry: unknown, itemTemplateId: string, status: ItemStatusValue): unknown {
  if (!entry || typeof entry !== "object") return entry;
  if ((entry as { id?: unknown }).id !== itemTemplateId) return entry;
  return { ...entry, status };
}
