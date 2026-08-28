import type { ItemStatus } from "@wooriai/domain";
import { itemStatusBadgeLabel } from "../items/item-labels";
import { isResolvedItemStatus } from "../items/prep-progress";
import type { HomeFirstRunGuideVariant } from "./first-run-guide";

/**
 * 라운드 51 #6 — 홈 준비템 카드(핵심 루프 3단계로 가는 한 장).
 *
 * ## 왜 필요한가
 *
 * 홈은 `/home` 응답에서 `recommendedItems`를 **매번** 받는다(서버가 이 아이의 지금 시기
 * "now" 탭을 스테이지 정렬해 최대 3건으로 잘라 준다 — apps/api/src/onboarding/
 * items-catalog.service.ts의 `recommendedItemsForChild` + reporting-store.service.ts의
 * `slice(0, 3)`). 그런데 화면이 그 배열로 하는 일은 **개수 게이트 하나**뿐이었다:
 * 첫 실행 안내 카드(`evaluateHomeFirstRunGuide`)가 "지금 시기 준비물 N개를 골라뒀어요"를
 * 만들 때 `countUnpreparedRecommendedItems`로 길이만 세고, 이름도 상태도 버렸다.
 *
 * 그 카드는 정의상 **막 시작한 사람**에게만 뜬다(이번 달 기록 0~2건 + 전체 기간 신호,
 * src/home/first-run-guide.ts의 F6/F3/H-5 게이트). 즉 기록이 몇 건만 쌓여도 홈은 이미 받아 둔
 * 준비템 정보를 통째로 버리고, 핵심 루프의 3단계(준비템 확인)로 가는 입구가 퀵액션 "추천템"
 * 아이콘 하나로 줄어든다. 이 모듈은 **같은 응답으로**(추가 요청 0) 그 자리에 카드 하나를
 * 만든다.
 *
 * ## 두 갈래
 *
 *  - `interested` — **찜 재발견**. 관심 표시만 해 두고 잊은 항목이 지금 시기 추천에 남아 있으면
 *    그 사실을 먼저 말한다. 사용자가 이미 의사를 표시한 항목이라 "골라뒀어요"보다 구체적인
 *    사실이고, 준비템 탭에 들어가야만 보이던 상태였다. 이 갈래의 줄에는 **관심 항목만** 선다
 *    (라운드 51 QA P3-12 — 제목이 말하는 것과 목록이 보여주는 것을 일치시킨다).
 *  - `recommended` — 그 외. 아직 준비 전인 추천 준비템의 이름을 그대로 보여준다.
 *
 * ## 접는 조건(중복 금지)
 *
 * 첫 실행 안내 카드가 **하나라도** 떠 있으면 이 카드는 만들지 않는다.
 *  - `first-items`: 같은 준비템을 같은 목적지(준비템 탭)로 말하고 있다 — 한 화면에서 같은 말을
 *    두 번 하지 않는다(마일스톤 ↔ 누적 총액 카드의 `hasMilestoneCard` 선례, F5/B2).
 *  - `first-expense` / `view-only`: 빈 홈에 "다음 한 걸음"이 **하나만** 서야 한다는 DNC-002
 *    규율 그대로다(first-run-guide.ts 헤더 "왜 카드가 하나인가"). 그 옆에 두 번째 큰 CTA를
 *    세우면 "어디부터?"라는 질문이 하나 더 생겨 루프가 오히려 흐려진다.
 * 판정은 호출부가 이미 갖고 있는 `firstRunGuide?.variant ?? null`을 그대로 받는다 — 여기서
 * 게이트를 다시 짐작하면 두 카드가 함께 뜨거나 함께 사라지는 상태가 생긴다.
 *
 * ## 허위 표시 방지 / 커머스 경계
 *
 * - **해결된 항목은 세지도 보여주지도 않는다**. "해결됨"의 정의는 준비템 탭 준비율과 같은
 *   도메인 규칙 하나뿐이다(`isResolvedItemStatus` = prepared/gifted/not_needed). 여기서 목록을
 *   다시 적으면 홈이 이름을 부르는 동안 준비템 탭이 "모두 마쳤어요"를 띄운다(라운드 35 F6와
 *   같은 어긋남). 서버 "now" 탭이 이미 그 셋을 빼 주지만, 데모/테스트 세션의 로컬 백엔드
 *   (src/api/local-backend.ts)는 같은 보장을 하지 않으므로 화면 쪽에서도 한 번 거른다.
 * - **상태 라벨을 여기서 짓지 않는다**. 문구는 목록 카드·상세와 같은 단일 소스
 *   (src/items/item-labels.ts의 `itemStatusBadgeLabel`)에서 온다. 그래서 `not_prepared`에는
 *   라벨이 붙지 않고(그 상태에는 알릴 사실이 없다는 것이 그 모듈의 판단이다), `interested`에는
 *   준비템 탭과 **한 글자도 다르지 않은** "관심"이 붙는다.
 * - **개수를 제목에 넣지 않는다**. 이 배열은 서버가 3건으로 자른 **일부**라, "준비템이 2개
 *   있어요"는 준비템 탭의 총량을 말하는 문장으로 읽힌다. 대신 고른 항목의 이름을 그대로
 *   보여준다 — 몇 개인지는 그 목록이 스스로 말한다.
 * - **여기는 커머스 표면이 아니다**. 가격도, 구매 링크도, 구매 CTA도 만들지 않는다. `/home`의
 *   `recommendedItems`는 id·name·status 셋뿐이라 스폰서 여부(DNC-011)도 제휴 고지 문구
 *   (DNC-010)도 실려 오지 않는다 — 그 표시 규율이 이미 살아 있는 준비템 탭·상세로 **보내기만**
 *   한다. 서버 랭킹은 그대로 두고 순서도 바꾸지 않는다(DNC-009 무접촉: 이 모듈은 점수를 읽지도
 *   만들지도 않는다).
 * - 톤은 해요체·사실 서술(DNC-018). 재촉("아직도 안 보셨어요")·평가는 넣지 않는다.
 *
 * React/react-native/네트워크에 의존하지 않는다 — 화면 밖에서 vitest로 검증하기 위해서다
 * (src/home/cumulative-total.ts와 같은 관례).
 */

/** 카드에 이름을 그릴 최대 개수. 서버가 이미 3건으로 자르지만 상한을 화면 쪽에도 명시한다. */
export const HOME_PREP_NUDGE_MAX_ITEMS = 3;

export const HOME_PREP_NUDGE_TEST_ID = "home-prep-nudge";

/** 카드가 데려가는 곳 — 첫 실행 안내 카드의 준비템 갈래와 **같은 경로**다. */
export const HOME_PREP_NUDGE_ROUTE = "/(tabs)/items" as const;

/** CTA 문구. 눌렀을 때 실제로 열리는 화면을 그대로 예고한다(마일스톤 카드 F1과 같은 규칙). */
export const HOME_PREP_NUDGE_CTA_LABEL = "준비템 탭에서 확인하기";

export const HOME_PREP_NUDGE_INTERESTED_TITLE = "관심 표시해 둔 준비템이 있어요";
export const HOME_PREP_NUDGE_RECOMMENDED_TITLE = "지금 시기 준비템을 골라뒀어요";

export type HomePrepNudgeVariant = "interested" | "recommended";

export type HomePrepNudgeItem = {
  id: string;
  name: string;
  /**
   * 준비 상태 배지 문구. 알릴 사실이 없으면 없다(`not_prepared`) — 판정과 문구 모두
   * src/items/item-labels.ts의 `itemStatusBadgeLabel`이 정한다.
   */
  statusLabel?: string;
};

export type HomePrepNudge = {
  variant: HomePrepNudgeVariant;
  /** 카드 제목 — 개수를 말하지 않는다(위 "허위 표시 방지" 참고). */
  title: string;
  /** 고른 준비템 이름 줄. 상태 라벨이 있는 항목은 "이름(관심)" 꼴로 함께 밝힌다. */
  subtitle: string;
  ctaLabel: string;
  route: typeof HOME_PREP_NUDGE_ROUTE;
  /** 화면이 필요하면 행으로 그릴 수 있게 원본도 함께 준다(테스트가 보는 값이기도 하다). */
  items: HomePrepNudgeItem[];
  testID: string;
  /** TalkBack이 카드 전체를 한 덩어리로 읽을 문장. */
  accessibilityLabel: string;
};

/**
 * `/home`의 `recommendedItems` 한 건(src/api/client.ts의 `HomeSummary`와 구조 호환).
 *
 * `status`를 넓은 `string`으로 받는 이유는 `countUnpreparedRecommendedItems`의
 * `RecommendedItemLike`와 같다: 데모/테스트 세션의 로컬 백엔드가 같은 자리에 좁혀지지 않은
 * 문자열을 돌려주므로, 홈이 두 소스를 같은 함수로 읽을 수 있어야 한다.
 */
export type PrepNudgeRecommendedItem = {
  id: string;
  name: string;
  status: ItemStatus | (string & {});
};

export type HomePrepNudgeInput = {
  /**
   * 로그인 + 아이 선택이 끝난 실제 세션인지. 비세션 미리보기(previewHome)는 픽셀락 HOME-001
   * 캡처의 원본이라 카드가 하나도 늘면 안 된다(UX-A 카드들과 같은 게이트).
   */
  hasSession: boolean;
  /** `/home` 응답의 `recommendedItems`. 아직 없으면 null/undefined(그때는 카드도 없다). */
  recommendedItems: readonly PrepNudgeRecommendedItem[] | null | undefined;
  /** 지금 홈에 떠 있는 첫 실행 안내 카드의 종류(`firstRunGuide?.variant ?? null`). */
  guideVariant: HomeFirstRunGuideVariant | null | undefined;
};

/**
 * item-labels의 라벨 규칙이 실제로 아는 상태 값들.
 *
 * 낯선 문자열(로컬 백엔드·미래 서버가 넣을 수 있는 값)에 라벨을 붙이지 않기 위한 목록이다 —
 * `itemStatusLabel`은 모르는 값을 기본값 "준비 전"으로 떨어뜨리므로, 거르지 않으면 홈이 확인한
 * 적 없는 상태를 배지로 단언하게 된다. 미해결 판정(`isResolvedItemStatus`)은 낯선 값도 안전한
 * 쪽("아직 준비 안 됨")으로 떨어지므로 그대로 통과시킨다.
 */
const LABELLED_ITEM_STATUSES: readonly ItemStatus[] = [
  "not_prepared",
  "prepared",
  "gifted",
  "not_needed",
  "interested"
];

function statusBadgeLabel(status: string): string | undefined {
  if (!(LABELLED_ITEM_STATUSES as readonly string[]).includes(status)) return undefined;
  return itemStatusBadgeLabel(status as ItemStatus);
}

function usableName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 카드에 올릴 준비템을 고른다 — **서버 순서 그대로**, 아직 준비 행동이 남은 것만, 최대 3건.
 * 같은 id가 두 번 오면 첫 번째만 남긴다(준비율 계산과 같은 방어 — prep-progress.ts).
 */
export function selectPrepNudgeItems(
  items: readonly PrepNudgeRecommendedItem[] | null | undefined
): HomePrepNudgeItem[] {
  if (!items) return [];
  const seenIds = new Set<string>();
  const selected: HomePrepNudgeItem[] = [];
  for (const item of items) {
    if (selected.length >= HOME_PREP_NUDGE_MAX_ITEMS) break;
    const name = usableName(item?.name);
    if (!name) continue;
    const id = typeof item.id === "string" ? item.id : "";
    if (id.length === 0 || seenIds.has(id)) continue;
    if (isResolvedItemStatus(item.status as ItemStatus)) continue;
    seenIds.add(id);
    const statusLabel = statusBadgeLabel(String(item.status));
    selected.push(statusLabel ? { id, name, statusLabel } : { id, name });
  }
  return selected;
}

/** 홈 준비템 카드를 만든다. 보여줄 이유가 없으면 null(그 자리는 비어 있는다). */
export function evaluateHomePrepNudge(input: HomePrepNudgeInput): HomePrepNudge | null {
  if (!input.hasSession) return null;
  // 첫 실행 안내 카드가 떠 있으면 접는다(위 "접는 조건" — 준비템 갈래는 같은 말, 나머지 두
  // 갈래는 빈 홈의 단일 CTA 규율 DNC-002).
  if (input.guideVariant) return null;

  const items = selectPrepNudgeItems(input.recommendedItems);
  if (items.length === 0) return null;

  /**
   * 라운드 51 QA(P3-12) — 찜 갈래에서는 **목록도 관심 항목만** 남긴다.
   *
   * 예전에는 관심 항목이 하나라도 있으면 제목만 "관심 표시해 둔 준비템이 있어요"로 바뀌고 줄에는
   * 관심이 아닌 추천까지 함께 섰다. 제목이 목록 전체를 가리키는 문장으로 읽히므로, 관심 표시한
   * 적 없는 항목까지 찜한 것처럼 말하는 셈이었다(허위 표시 금지). 제목을 목록 전체에 맞게 넓히는
   * 대신 목록을 제목에 맞게 좁힌다 -- 이 갈래의 목적 자체가 "찜해 두고 잊은 것"의 재발견이고,
   * 관심이 아닌 추천은 다음번 recommended 갈래가 같은 자리에서 그대로 말한다.
   */
  const interestedLabel = itemStatusBadgeLabel("interested");
  const interestedItems = items.filter((item) => item.statusLabel === interestedLabel);
  const hasInterested = interestedItems.length > 0;
  const variant: HomePrepNudgeVariant = hasInterested ? "interested" : "recommended";
  const shownItems = hasInterested ? interestedItems : items;
  const title = hasInterested ? HOME_PREP_NUDGE_INTERESTED_TITLE : HOME_PREP_NUDGE_RECOMMENDED_TITLE;
  // 화면용 줄은 가운뎃점으로 잇고(홈의 다른 카드와 같은 구분자), 소리용 문장은 쉼표로 잇는다 --
  // "·"는 스크린리더에서 이름 경계로 읽히지 않는다(주간 카드·아기 카운터와 같은 판단).
  const subtitle = shownItems
    .map((item) => (item.statusLabel ? `${item.name}(${item.statusLabel})` : item.name))
    .join(" · ");
  const spokenItems = shownItems
    .map((item) => (item.statusLabel ? `${item.name} ${item.statusLabel}` : item.name))
    .join(", ");

  return {
    variant,
    title,
    subtitle,
    ctaLabel: HOME_PREP_NUDGE_CTA_LABEL,
    route: HOME_PREP_NUDGE_ROUTE,
    items: shownItems,
    testID: HOME_PREP_NUDGE_TEST_ID,
    accessibilityLabel: `${title}. ${spokenItems}. ${HOME_PREP_NUDGE_CTA_LABEL}`
  };
}
