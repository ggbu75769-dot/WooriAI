import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { bandDefinitions, bandStages } from "./stage-bands";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * ITEM-121 (B1): 준비템 시기 칩이 실제로 목록을 바꾸는지에 대한 회귀 가드.
 *
 * 이전 동작: 서버는 tab="now"에서 아이의 **현재 단계**만 필터하고, 화면이 그 결과에
 * itemMatchesBand로 밴드 필터를 한 번 더 걸었다. 현재 단계는 밴드 하나(둘)에만 속하므로
 * 나머지 칩은 항상 빈 화면이었다. 이제 칩 라벨을 서버로 넘기고(`stageBand`) 화면은
 * 그 결과를 그대로 신뢰한다.
 */
describe("items tab stage-band wiring", () => {
  it("sends the selected chip to the server as the stageBand query argument", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("listItems(authToken!, childId!, statusTab, stageLabel)");
  });

  it("no longer re-filters the server list by band on the client (the old double filter)", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).not.toContain("itemMatchesBand");
    expect(itemsSource).not.toContain("stageFilteredItems");
  });

  it("derives the chip labels from the band definitions instead of a hand-copied list", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("const tabOptions = bandDefinitions.map((band) => band.label);");
  });

  it("keeps the prep-progress snapshot band-agnostic (all four tabs, no stageBand)", () => {
    // 준비율은 밴드와 무관한 전 상태 스냅샷의 합집합에서 계산한다 -- 여기에 stageBand를
    // 넘기면 분모가 좁아져 준비율이 틀어진다(computeEssentialPrepProgress가 밴드를 본다).
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("tabs.map((tab) => listItems(authToken!, childId!, tab))");
  });

  it("exposes the necessity chips and the name search only inside a real session (B2/B3)", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // 픽셀 락 캡처는 비세션 미리보기를 찍으므로 두 컨트롤 모두 화면에 나오지 않는다.
    expect(itemsSource).toMatch(/{hasSession \? \(\s*<View[^]*?NECESSITY_FILTER_OPTIONS\.map/);
    expect(itemsSource).toMatch(/{hasSession \? \(\s*<TextInput[^]*?accessibilityLabel="준비템 이름으로 검색"/);
    expect(itemsSource).toContain('returnKeyType="search"');
  });
});

describe("local backend listItems(stageBand)", () => {
  beforeEach(async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
  });

  it("filters the loginless test session's fixtures by the requested band, not by the child's stage", async () => {
    const { listItems } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID, LOCAL_ITEM_BLOCKS } = await import("../api/local-fixtures");

    const newbornBand = listItems(LOCAL_CHILD_ID, "now", "0-6개월").items;
    const olderBand = listItems(LOCAL_CHILD_ID, "now", "24개월+").items;

    // 픽스처는 toddler_1_3 / kid_4_7 항목뿐이라 신생아 밴드는 비고, 24개월+ 밴드에는
    // kid_4_7 항목(원목 블록 세트)이 들어온다 -- 예전에는 어떤 칩을 눌러도 같은 목록이었다.
    expect(newbornBand).toEqual([]);
    expect(olderBand.map((item) => item.id)).toContain(LOCAL_ITEM_BLOCKS);
  });

  it("keeps the band-less call identical to the child's current stage (하위호환)", async () => {
    const { listItems } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const withoutBand = listItems(LOCAL_CHILD_ID, "now").items.map((item) => item.id);
    expect(withoutBand.length).toBeGreaterThan(0);
    // 밴드를 주지 않은 호출은 kid_4_7 전용 항목을 포함하지 않는다(현재 단계가 걸음마기).
    const currentStageOnly = listItems(LOCAL_CHILD_ID, "now", "12-24개월").items.map((item) => item.id);
    expect(withoutBand).toEqual(currentStageOnly);
  });

  it("treats soon as the complement of the selected band", async () => {
    const { listItems } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

    const nowIds = listItems(LOCAL_CHILD_ID, "now", "12-24개월").items.map((item) => item.id);
    const soonIds = listItems(LOCAL_CHILD_ID, "soon", "12-24개월").items.map((item) => item.id);

    expect(nowIds.length).toBeGreaterThan(0);
    expect(soonIds.length).toBeGreaterThan(0);
    expect(nowIds.filter((id) => soonIds.includes(id))).toEqual([]);
  });
});

describe("band definitions", () => {
  it("covers every chip label with at least one stage code", () => {
    for (const band of bandDefinitions) {
      expect(bandStages(band.label).length, `${band.label} must map to at least one stage`).toBeGreaterThan(0);
    }
  });
});
