import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computeEssentialPrepProgress } from "./prep-progress";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * ITEM-123 (B4): gifted 상태가 앱에서 완전히 죽어 있던 문제의 회귀 가드.
 *
 * 죽어 있던 3곳:
 *  (a) 서버 itemsForChild가 gifted를 어느 탭에도 반환하지 않았다 -> 준비완료 탭에 포함
 *      (apps/api/.../items-catalog.service.ts TAB_STATUSES, apps/api/test/items-commerce.e2e.test.ts).
 *  (b) 어느 화면에도 gifted로 바꾸는 버튼이 없었다 -> 아이템 상세의 "선물로 받았어요".
 *  (c) ITEM-114 준비율의 분모에서 빠졌다 -> 전 상태 스냅샷(tab="all")에 포함되면서 해소.
 */
describe("gifted 상태 진입점 (아이템 상세)", () => {
  const detailSource = () => source("app/items/[itemTemplateId].tsx");

  it("아이템 상세에 gifted 상태 버튼이 있다 (기존 상태 버튼과 같은 SecondaryButton 관례)", () => {
    const detail = detailSource();
    expect(detail).toContain('label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}');
    expect(detail).toContain('const isGifted = visibleDetail.status === "gifted";');
    // 라벨만 있는 버튼이 아니라 실제로 gifted를 서버에 기록한다.
    expect(detail).toContain('updateItemStatus(authToken!, childId!, itemTemplateId, status)');
    expect(detail).toContain('mutationFn: (status: "gifted" | "not_prepared") =>');
    // 되돌리기는 준비 전(not_prepared)으로 -- 찜해제와 같은 관례다.
    expect(detail).toContain('markGifted.mutate("not_prepared")');
    expect(detail).toContain('markGifted.mutate("gifted")');
  });

  it("확인 흐름(Alert)을 거친 뒤에만 상태가 바뀐다 -- 지출 삭제 등과 같은 관례", () => {
    const detail = detailSource();
    expect(detail).toContain('Alert.alert("선물로 받았어요"');
    expect(detail).toContain('Alert.alert("선물 받음을 취소할까요?"');
    expect(detail).toContain('{ text: "취소", style: "cancel" }');
    // 버튼은 확인 함수만 부르고, mutate는 Alert 콜백 안에서만 호출된다.
    expect(detail).toContain("onPress={confirmGiftedChange}");
    const confirmBlock = detail.slice(detail.indexOf("function confirmGiftedChange()"), detail.indexOf("const canCallLinkApi"));
    expect(confirmBlock).toContain('markGifted.mutate("gifted")');
    expect(detail.match(/markGifted\.mutate\(/g)).toHaveLength(2);
  });

  it("상태 변경 후 목록·상세·홈 캐시를 모두 무효화한다 (찜하기 토글과 같은 관례)", () => {
    const detail = detailSource();
    const mutationBlock = detail.slice(detail.indexOf("const markGifted = useMutation({"), detail.indexOf("const clickLink = useMutation({"));
    expect(mutationBlock).toContain('queryKey: ["item-detail"]');
    expect(mutationBlock).toContain('queryKey: ["items"]');
    expect(mutationBlock).toContain('queryKey: ["home"]');
    // ANA-103: 서버가 확인한 뒤에만 이벤트가 나간다(다른 상태 변경 경로와 동일).
    expect(mutationBlock).toContain("trackItemStatusChanged(status);");
  });

  it("DNC-010: 제휴 고지와 구매 CTA 사이에 끼어들지 않고 CTA 아래에 놓인다", () => {
    const detail = detailSource();
    const disclosureIndex = detail.indexOf("<AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    const giftedIndex = detail.indexOf('label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}');
    expect(disclosureIndex).toBeGreaterThan(-1);
    expect(ctaIndex).toBeGreaterThan(disclosureIndex);
    expect(giftedIndex).toBeGreaterThan(ctaIndex);
  });

  it("스크린 리더용 라벨에 준비템 이름을 담는다 (items 탭 상태 버튼과 같은 관례)", () => {
    expect(detailSource()).toContain("`${visibleDetail.name} 선물로 받았어요`");
    expect(detailSource()).toContain("`${visibleDetail.name} 선물 받음 취소`");
  });

  it("비세션 미리보기에서는 비활성이다 (로그인 없이 상태를 바꿀 수 없다)", () => {
    expect(detailSource()).toContain("disabled={!hasSession || markGifted.isPending}");
  });
});

describe("준비완료 탭의 선물 배지 (items 탭)", () => {
  it("gifted 항목은 순서와 무관하게 statusLabel 배지를 단다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('badge: index === 0 && item.status !== "gifted" ? "BEST" : statusLabel(item.status)');
    // 문구는 statusLabel 한 곳에서만 관리한다("선물 받음").
    expect(itemsSource).toContain('if (status === "gifted") return "선물 받음";');
  });
});

/**
 * ITEM-123 (B5): 준비템 탭 1회 진입 요청 수 회귀 가드.
 * 전: 상태탭 1 + 준비율 스냅샷 4(Promise.all) + 홈 1 = 6.
 * 후: 상태탭 1 + 스냅샷 1(tab="all") + 홈 1 = 3.
 */
describe("준비템 탭 진입 요청 수", () => {
  it("준비율 스냅샷이 단일 요청이다 (탭별 Promise.all 제거)", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('const response = await listItems(authToken!, childId!, "all");');
    expect(itemsSource).not.toContain('const tabs = ["now", "soon", "prepared", "not_needed"] as const;');
    expect(itemsSource).not.toContain("Promise.all(tabs.map");
  });

  it("화면 전체에서 나가는 목록/홈 요청은 3개다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // listItems 호출 지점 2곳(선택된 상태 탭 1 + 전체 스냅샷 1) + getHome 1곳.
    expect(itemsSource.match(/listItems\(authToken!/g)).toHaveLength(2);
    expect(itemsSource.match(/getHome\(authToken!/g)).toHaveLength(1);
  });
});

describe("local backend tab 계약 (서버 미러)", () => {
  beforeEach(async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
  });

  it("준비완료 탭에 gifted 항목이 함께 나오고 괜찮아요 탭은 그대로다", async () => {
    const { listItems, updateItemStatus } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const nowItems = listItems(LOCAL_CHILD_ID, "now").items;
    expect(nowItems.length).toBeGreaterThanOrEqual(2);
    const [giftedItem, preparedItem] = nowItems;
    updateItemStatus(LOCAL_CHILD_ID, giftedItem.id, "gifted");
    updateItemStatus(LOCAL_CHILD_ID, preparedItem.id, "prepared");

    const prepared = listItems(LOCAL_CHILD_ID, "prepared").items;
    expect(prepared.map((item) => item.id)).toEqual(expect.arrayContaining([giftedItem.id, preparedItem.id]));
    expect(prepared.find((item) => item.id === giftedItem.id)?.status).toBe("gifted");

    // "필요 없다고 판단했다"와 "선물로 받았다"는 다른 판단이라 탭을 섞지 않는다.
    expect(listItems(LOCAL_CHILD_ID, "not_needed").items.map((item) => item.id)).not.toContain(giftedItem.id);
    // 그리고 gifted는 계속 "지금 필요"에서 빠진다(도메인 규칙 그대로).
    expect(listItems(LOCAL_CHILD_ID, "now").items.map((item) => item.id)).not.toContain(giftedItem.id);
  });

  it('tab="all"은 네 상태 탭의 합집합과 같다 (중복 없음)', async () => {
    const { listItems, updateItemStatus } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const [giftedItem] = listItems(LOCAL_CHILD_ID, "now").items;
    updateItemStatus(LOCAL_CHILD_ID, giftedItem.id, "gifted");

    const unionIds = new Set(
      (["now", "soon", "prepared", "not_needed"] as const).flatMap((tab) =>
        listItems(LOCAL_CHILD_ID, tab).items.map((item) => item.id)
      )
    );
    const allItems = listItems(LOCAL_CHILD_ID, "all").items;

    expect(new Set(allItems.map((item) => item.id)).size).toBe(allItems.length);
    expect(new Set(allItems.map((item) => item.id))).toEqual(unionIds);
    expect(allItems.find((item) => item.id === giftedItem.id)?.status).toBe("gifted");
  });
});

/**
 * ITEM-123 (B4-3): prep-progress.ts의 "API가 gifted를 노출하면 코드 변경 없이 자동 정합"
 * 이라는 약속이 실제로 성립하는지 -- 계산 코드는 그대로 두고, 스냅샷에 gifted가 들어온
 * 상태로 준비율을 계산해 분모·분자에 함께 잡히는지 확인한다.
 */
describe("준비율에 gifted가 잡힌다 (ITEM-114 x ITEM-123)", () => {
  beforeEach(async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
  });

  it("gifted 필수템이 분모와 분자에 함께 들어간다", async () => {
    const { listItems, updateItemStatus } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const before = computeEssentialPrepProgress(listItems(LOCAL_CHILD_ID, "all").items, "12-24개월");
    expect(before).not.toBeNull();

    const essential = listItems(LOCAL_CHILD_ID, "all").items.find(
      (item) => item.necessityLevel === "essential" && item.status === "not_prepared"
    );
    expect(essential).toBeDefined();
    updateItemStatus(LOCAL_CHILD_ID, essential!.id, "gifted");

    const after = computeEssentialPrepProgress(listItems(LOCAL_CHILD_ID, "all").items, "12-24개월");
    // 분모는 그대로(항목이 사라지지 않는다), 분자만 1 늘어난다 -- 예전에는 gifted가 응답에서
    // 통째로 빠져 분모까지 함께 줄었다.
    expect(after!.totalCount).toBe(before!.totalCount);
    expect(after!.resolvedCount).toBe(before!.resolvedCount + 1);
  });
});
