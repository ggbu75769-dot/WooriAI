import { beforeEach, describe, expect, it } from "vitest";
import { useHomeFirstRunGuideStore } from "./first-run-guide.store";

describe("UX-G useHomeFirstRunGuideStore", () => {
  beforeEach(() => {
    useHomeFirstRunGuideStore.getState().reset();
  });

  it("닫기 전에는 안내가 살아 있다", () => {
    expect(useHomeFirstRunGuideStore.getState().isItemsGuideDismissed("child-a")).toBe(false);
  });

  it("닫으면 그 아이의 안내만 꺼진다 -- 둘째는 자기 안내를 따로 받는다", () => {
    useHomeFirstRunGuideStore.getState().dismissItemsGuide("child-a");

    expect(useHomeFirstRunGuideStore.getState().isItemsGuideDismissed("child-a")).toBe(true);
    expect(useHomeFirstRunGuideStore.getState().isItemsGuideDismissed("child-b")).toBe(false);
  });

  it("같은 아이를 여러 번 닫아도 목록이 늘어나지 않는다", () => {
    const { dismissItemsGuide } = useHomeFirstRunGuideStore.getState();
    dismissItemsGuide("child-a");
    dismissItemsGuide("child-a");

    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual(["child-a"]);
  });

  it("아이가 선택되지 않은 상태(null/undefined)는 아무것도 기록하지 않는다", () => {
    const { dismissItemsGuide, isItemsGuideDismissed } = useHomeFirstRunGuideStore.getState();
    dismissItemsGuide(null);
    dismissItemsGuide(undefined);

    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual([]);
    expect(isItemsGuideDismissed(null)).toBe(false);
    expect(isItemsGuideDismissed(undefined)).toBe(false);
  });

  it("1회성 플래그는 persist된다 -- 앱을 다시 켜도 안내가 되살아나지 않는다", () => {
    expect(useHomeFirstRunGuideStore.persist).toBeDefined();
    expect(useHomeFirstRunGuideStore.persist.getOptions().name).toBe("wooriai-home-first-run-guide");
  });

  it("디스크에 남은 이상한 값이 들어와도 문자열 id만 살아남는다 (MOB-107 관례)", () => {
    const merge = useHomeFirstRunGuideStore.persist.getOptions().merge!;
    const current = useHomeFirstRunGuideStore.getState();

    expect(merge({ dismissedItemsGuideChildIds: ["child-a", 7, null] }, current)).toMatchObject({
      dismissedItemsGuideChildIds: ["child-a"]
    });
    expect(merge({ dismissedItemsGuideChildIds: "child-a" }, current)).toMatchObject({
      dismissedItemsGuideChildIds: []
    });
    expect(merge(undefined, current)).toMatchObject({ dismissedItemsGuideChildIds: [] });
  });
});
