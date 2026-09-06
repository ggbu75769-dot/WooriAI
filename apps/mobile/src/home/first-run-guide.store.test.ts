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

  /**
   * 라운드 101 F5 — 시기 전환 회고 카드의 닫음 목록. 같은 스토어에 얹힌 이유(같은 성질의
   * 관찰 이력)는 스토어 머리말에 있고, 아래는 준비템 안내 닫기와 같은 세 성질(멱등 · null
   * 무시 · sanitize)이 새 목록에도 서 있다는 계약이다.
   */
  it("회고 카드 닫기는 전환 식별자 키로 남고, 같은 키를 두 번 닫아도 목록이 늘지 않는다", () => {
    const { dismissStageRetrospective } = useHomeFirstRunGuideStore.getState();
    dismissStageRetrospective("stage_retrospective:child-a:2026-09-03");
    dismissStageRetrospective("stage_retrospective:child-a:2026-09-03");

    expect(useHomeFirstRunGuideStore.getState().dismissedStageRetrospectiveKeys).toEqual([
      "stage_retrospective:child-a:2026-09-03"
    ]);
  });

  it("회고 카드 닫기: 키가 없으면(null/undefined) 아무것도 기록하지 않는다", () => {
    const { dismissStageRetrospective } = useHomeFirstRunGuideStore.getState();
    dismissStageRetrospective(null);
    dismissStageRetrospective(undefined);

    expect(useHomeFirstRunGuideStore.getState().dismissedStageRetrospectiveKeys).toEqual([]);
  });

  it("회고 닫음 목록도 sanitize를 지난다 — 라운드 101 이전 blob(칸 없음)은 빈 목록으로 읽힌다", () => {
    const merge = useHomeFirstRunGuideStore.persist.getOptions().merge!;
    const current = useHomeFirstRunGuideStore.getState();

    expect(merge({ dismissedItemsGuideChildIds: ["child-a"] }, current)).toMatchObject({
      dismissedItemsGuideChildIds: ["child-a"],
      dismissedStageRetrospectiveKeys: []
    });
    expect(
      merge({ dismissedStageRetrospectiveKeys: ["stage_retrospective:child-a:2026-09-03", 7, null] }, current)
    ).toMatchObject({
      dismissedStageRetrospectiveKeys: ["stage_retrospective:child-a:2026-09-03"]
    });
  });

  it("reset은 두 목록을 함께 비운다 (PRIV-104 teardown이 부르는 그 reset)", () => {
    const { dismissItemsGuide, dismissStageRetrospective } = useHomeFirstRunGuideStore.getState();
    dismissItemsGuide("child-a");
    dismissStageRetrospective("stage_retrospective:child-a:2026-09-03");

    useHomeFirstRunGuideStore.getState().reset();

    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual([]);
    expect(useHomeFirstRunGuideStore.getState().dismissedStageRetrospectiveKeys).toEqual([]);
  });
});
