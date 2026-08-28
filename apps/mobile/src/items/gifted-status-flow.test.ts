import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { itemListBadgeLabel } from "./item-labels";
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
    // 라운드 51 C-10: 판정 근거가 서버 응답에서 **대기 중인 값까지 반영한 상태**로 바뀌었다
    // (낙관 반영 — src/items/pending-status.ts). 대기 행이 없으면 종전과 같은 값이다.
    expect(detail).toContain('const isGifted = displayStatus === "gifted";');
    // 라벨만 있는 버튼이 아니라 실제로 gifted를 기록한다 -- 이제 오프라인 큐를 지난다.
    expect(detail).toContain('const markGifted = (status: "gifted" | "not_prepared") =>');
    expect(detail).toContain("applyStatusChange(status, { onSaved: () => trackItemStatusChanged(status) })");
    // 되돌리기는 준비 전(not_prepared)으로 -- 찜해제와 같은 관례다.
    expect(detail).toContain('markGifted("not_prepared")');
    expect(detail).toContain('markGifted("gifted")');
  });

  it("확인 흐름(Alert)을 거친 뒤에만 상태가 바뀐다 -- 지출 삭제 등과 같은 관례", () => {
    const detail = detailSource();
    expect(detail).toContain('Alert.alert("선물로 받았어요"');
    expect(detail).toContain('Alert.alert("선물 받음을 취소할까요?"');
    expect(detail).toContain('{ text: "취소", style: "cancel" }');
    // 버튼은 확인 함수만 부르고, mutate는 Alert 콜백 안에서만 호출된다.
    expect(detail).toContain("onPress={confirmGiftedChange}");
    const confirmBlock = detail.slice(detail.indexOf("function confirmGiftedChange()"), detail.indexOf("const canCallLinkApi"));
    expect(confirmBlock).toContain('markGifted("gifted")');
    expect(confirmBlock.match(/markGifted\("/g)).toHaveLength(2);
  });

  /**
   * 라운드 51 C-10: "성공 뒤 세 캐시를 무효화한다"가 뒤집힌 자리다. 저장이 로컬 우선이 되면서
   * 서버는 아직 옛 값을 들고 있고, 여기서 다시 물으면 방금 누른 값이 되돌아온다. 대신 낙관
   * 반영을 캐시에 적고(컨트롤러), 재조회는 전송이 확정된 뒤 한 번만 한다.
   */
  it("저장 직후에는 재조회하지 않고 낙관 반영만 한다 (재조회는 전송 확정 뒤 한 번)", () => {
    const detail = detailSource();
    const changeBlock = detail.slice(detail.indexOf("const applyStatusChange = ("), detail.indexOf("const toggleInterested ="));
    expect(changeBlock).toContain("updateItemStatusOffline(");
    expect(changeBlock).not.toContain("invalidateQueries");
    // ANA-103 이벤트는 그대로 나간다 -- 기준만 "서버 확정"에서 "기기 저장"으로 옮겼다.
    expect(changeBlock).toContain("options?.onSaved?.();");
    expect(detail).toContain("trackItemStatusChanged(status)");
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

  it("비세션 미리보기에는 아예 렌더되지 않는다 (픽셀 락 ITEM-002 캡처 불변 — 리뷰 F1)", () => {
    const detail = detailSource();
    // 예전 배선은 버튼을 무조건 렌더하고 hasSession을 disabled에만 걸었다. 그런데 픽셀 락은
    // 세션을 지운 비세션 프리뷰로 ITEM-002를 캡처하므로(app/pixel-lock.tsx), 캡처 화면에
    // 기준 이미지에 없던 버튼이 한 줄 더 들어갔다. 같은 화면군의 세션 전용 컨트롤 관례
    // (app/(tabs)/items.tsx의 `{hasSession ? ... : null}`)대로 렌더 자체를 막는다.
    expect(detail).not.toContain("disabled={!hasSession || markGifted.isPending}");

    const giftedIndex = detail.indexOf('label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}');
    expect(giftedIndex).toBeGreaterThan(-1);
    const gateIndex = detail.lastIndexOf("{hasSession ? (", giftedIndex);
    expect(gateIndex).toBeGreaterThan(-1);
    // 게이트와 버튼 사이에 다른 조건 블록이 닫히지 않는다 = 이 버튼을 감싸는 게이트가 맞다.
    expect(detail.slice(gateIndex, giftedIndex)).not.toContain(") : null}");
  });
});

/**
 * 리뷰 F2: gifted/interested/prepared/not_needed는 서로 배타적인 **단일 status 컬럼**이라,
 * 선물로 받았다고 정리해 둔 항목에서 다른 상태 버튼을 누르면 gifted가 아무 말 없이 사라진다.
 *  - 시나리오 A: 상세에서 선물 받음 표시 -> "찜하기" 탭 -> gifted 소멸.
 *  - 시나리오 B: 준비완료 탭의 gifted 행에서 "준비했어요"/"괜찮아요" 탭 -> 무확인 변환.
 * 두 경로 모두 확인(Alert)을 한 번 거치게 하고, 문구는 화면에 인라인하지 않고 단일 소스
 * (src/items/status-mutation-messages.ts)에서만 가져온다.
 */
describe("gifted를 잃게 만드는 조작은 확인을 거친다 (리뷰 F2)", () => {
  const detailSource = () => source("app/items/[itemTemplateId].tsx");
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it("상세: 찜하기와 '지출 없이 준비 완료로 표시'가 확인 함수를 거친다", () => {
    const detail = detailSource();
    expect(detail).toContain("function confirmGiftedReset(");
    // gifted가 아닐 때는 확인 없이 그대로 실행한다(조작 비용을 늘리지 않는다).
    expect(detail).toContain("if (!isGifted) {");
    expect(detail).toContain("Alert.alert(GIFTED_RESET_CONFIRM_TITLE, giftedResetConfirmMessage(kind), [");
    // 라운드 24 L7: 확인이 뜨는 경우는 gifted일 때뿐이고, status가 단일 컬럼이라 그때
    // isInterested는 항상 false다 -- 도달 불가 분기 대신 "interest"를 그대로 넘긴다.
    expect(detail).toContain('confirmGiftedReset("interest", () =>');
    expect(detail).not.toContain('isInterested ? "uninterest" : "interest"');
    expect(detail).toContain('confirmGiftedReset("prepare", () => markPrepared());');
    // 확인을 건너뛰던 예전 배선은 남아 있으면 안 된다.
    expect(detail).not.toContain('onPress={() => toggleInterested(isInterested ? "not_prepared" : "interested")}');
    expect(detail).not.toContain("if (authToken && childId) markPrepared();");
  });

  it("목록: 준비했어요/괜찮아요가 gifted 행에서만 확인을 거친다", () => {
    const items = itemsSource();
    expect(items).toContain('if (item.status !== "gifted") {');
    expect(items).toContain("Alert.alert(GIFTED_RESET_CONFIRM_TITLE, giftedResetConfirmMessage(kind), [");
    // 라운드 51 C-10: 확인 판정이 보는 상태도 낙관 반영을 거친 값이다(rowItem) -- 방금 "선물로
    // 받았어요"를 누르고 아직 전송되지 않은 행에서 준비했어요를 누르면 그때도 확인이 떠야 한다.
    expect(items).toContain('onPress={() => requestStatusChange(rowItem, "prepared")}');
    expect(items).toContain('onPress={() => requestStatusChange(rowItem, "not_needed")}');
    expect(items).not.toContain("updateStatus.mutate({");
  });

  it("확인 Alert은 앱 관례를 따른다 (취소 cancel 버튼 + 단일 소스 문구)", () => {
    for (const screen of ["app/items/[itemTemplateId].tsx", "app/(tabs)/items.tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} imports the shared copy`).toContain(
        'from "../../src/items/status-mutation-messages"'
      );
      expect(screenSource, `${screen} keeps a cancel button`).toContain(
        '{ text: GIFTED_RESET_CONFIRM_CANCEL_LABEL, style: "cancel" }'
      );
      expect(screenSource, `${screen} runs the change only from the confirm callback`).toContain(
        "{ text: GIFTED_RESET_CONFIRM_ACTION_LABEL, onPress: run }"
      );
      // 문구는 화면에 인라인하지 않는다 -- 두 화면이 같은 말을 해야 한다.
      expect(screenSource, `${screen} must not inline the confirm copy`).not.toContain("선물받은 상태가 해제돼요");
    }
  });

  it("gifted 해제(선물 받음 취소) 자체는 기존 확인 흐름을 그대로 쓴다", () => {
    const detail = detailSource();
    expect(detail).toContain('Alert.alert("선물 받음을 취소할까요?"');
    expect(detail).toContain("onPress={confirmGiftedChange}");
    // 선물 받음 버튼은 새 확인 흐름(confirmGiftedReset)을 타지 않는다 -- 이중 확인 방지.
    const giftedButtonBlock = detail.slice(
      detail.indexOf('label={isGifted ? "선물 받음 취소" : "선물로 받았어요"}'),
      detail.indexOf("{statusErrorMessage ?")
    );
    expect(giftedButtonBlock).not.toContain("confirmGiftedReset");
  });
});

describe("준비완료 탭의 선물 배지 (items 탭)", () => {
  /**
   * 라운드 48 T1(A3b): 배지 판정이 화면에서 순수 모듈로 나갔다
   * (src/items/item-labels.ts의 itemListBadgeLabel). ITEM-123 B4가 지키려던 사실은
   * 그대로다 -- 정리된 품목 밴드가 prepared와 gifted를 함께 보여주므로 gifted 항목은 순서와
   * 무관하게 "선물"로 구분돼야 한다.
   *
   * DSN-053 P2-B: 목록이 승인 디자인의 타일 그리드가 되면서 그 구분을 **타일의 상태 pill**이
   * 맡는다(design-system ModV1Primitives의 preparationStatusVisual — gifted는 성공 서피스의
   * "선물"). 어댑터가 상태를 그 어휘로 올려 주는지까지 여기서 함께 고정한다.
   */
  it("gifted 항목은 순서와 무관하게 상태 라벨을 단다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // 상태 문구는 화면에 인라인하지 않는다("선물 받음"/"선물"은 모듈이 정한다).
    expect(itemsSource).not.toContain('return "선물 받음";');
    expect(itemsSource).toContain("toPreparationParityItem(rowItem, {");
    // P1-4: 배지 어휘도 타일 pill과 같은 "선물"이다(예전에는 상세만 "선물 받음"이라 갈렸다).
    expect(itemListBadgeLabel({ status: "gifted", necessityLevel: "essential" })).toBe("선물");
    expect(itemListBadgeLabel({ status: "gifted", necessityLevel: "optional" })).toBe("선물");
    // 타일 pill의 문구도 어휘 모듈 한 곳에서만 온다.
    expect(source("src/design-system/components/ModV1Primitives.tsx")).toContain(
      '{ value: "gifted", label: MOD_V1_ITEM_STATUS_LABELS.gifted, icon: "gift-outline" }'
    );
  });
});

/**
 * ITEM-123 (B5): 준비템 탭 1회 진입 요청 수 회귀 가드.
 * 전: 상태탭 1 + 준비율 스냅샷 4(Promise.all) + 홈 1 = 6.
 * 그다음: 상태탭 1 + 스냅샷 1(tab="all") + 홈 1 = 3.
 * DSN-053 P2-B: 상태 탭 목록이 사라지고 **스냅샷 하나가 곧 목록**이 됐다 -- 목록 1(tab="all")
 * + 홈 1 = 2. 분류 이름은 다른 화면들과 공유하는 ["categories"] 캐시에서 읽는다.
 */
describe("준비템 탭 진입 요청 수", () => {
  it("준비율·목록·찜이 tab=\"all\" 스냅샷 한 건을 함께 쓴다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('listItems(authToken!, childId!, "all")');
    expect(itemsSource).not.toContain('const tabs = ["now", "soon", "prepared", "not_needed"] as const;');
    expect(itemsSource).not.toContain("Promise.all(tabs.map");
  });

  it("화면 전체에서 나가는 목록/홈 요청은 2개다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // listItems 호출 지점 1곳(전 상태 스냅샷) + getHome 1곳.
    expect(itemsSource.match(/listItems\(authToken!/g)).toHaveLength(1);
    expect(itemsSource.match(/getHome\(authToken!/g)).toHaveLength(1);
  });
});

describe("local backend tab 계약 (서버 미러)", () => {
  beforeEach(async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
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
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("gifted 필수템이 분모와 분자에 함께 들어간다", async () => {
    const { listItems, updateItemStatus } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const before = computeEssentialPrepProgress(listItems(LOCAL_CHILD_ID, "all").items, "12-24개월");
    expect(before).not.toBeNull();

    // 준비율을 계산하는 밴드와 **같은 밴드**의 필수템을 고른다 -- 다른 시기의 필수템을
    // 선물 처리해도 이 밴드의 분자는 움직이지 않는다(실기기 피드백 1로 카탈로그가 임신~첫돌
    // 시기까지 넓어졌다).
    const essential = listItems(LOCAL_CHILD_ID, "now", "12-24개월").items.find(
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
