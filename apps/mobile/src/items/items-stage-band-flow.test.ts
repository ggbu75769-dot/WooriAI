import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { bandDefinitions, bandStages, itemMatchesBand } from "./stage-bands";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * ITEM-121 (B1): 준비템 시기 칩이 실제로 목록을 바꾸는지에 대한 회귀 가드.
 *
 * 이전 동작: 서버는 tab="now"에서 아이의 **현재 단계**만 필터하고, 화면이 그 결과에
 * itemMatchesBand로 밴드 필터를 한 번 더 걸었다. 현재 단계는 밴드 하나(둘)에만 속하므로
 * 나머지 칩은 항상 빈 화면이었다. 이제 칩 라벨을 서버로 넘기고(`stageBand`) 화면은
 * 그 결과를 그대로 신뢰한다.
 *
 * 라운드 21 리뷰 F2/F3: 단, 밴드 확대는 **다른 칩을 명시 선택한 미리보기에서만** 일어난다 --
 * 기본 칩(아이 현재 단계의 밴드)에서는 stageBand를 생략해 "지금 필요 = 정확히 현재 단계"를
 * 유지하고, 미리보기 중에는 여집합인 두 번째 탭 라벨을 "다른 시기"로 바꾼다.
 */
describe("items tab stage-band wiring", () => {
  /**
   * DSN-053 P2-B — 시기 칩이 **서버 파라미터에서 화면 안 판정 기준으로** 옮겼다.
   *
   * 왜: 승인 디자인의 "내 준비 목록"은 분류 섹션이 "2/6 보유"를 말하고 시기별 밴드 4종이 한
   * 화면에 함께 서는 구조다. 상태·시기로 거른 목록으로는 둘 다 구조적으로 불가능하다(보유한
   * 것과 아닌 것이 한 목록에 있어야 하고, 네 밴드가 동시에 채워져야 한다). 그래서 화면은
   * 거르지 않는 스냅샷(tab="all") 한 건을 받고, 칩은 그 위에서 "지금/곧/여유"를 가르는
   * 기준이자 준비율의 분모를 정하는 기준이 된다 -- 밴드 ↔ 스테이지 매핑은 여전히
   * src/items/stage-bands.ts 하나뿐이다.
   */
  it("목록은 상태로도 시기로도 거르지 않는 스냅샷 한 건이다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('listItems(authToken!, childId!, "all")');
    expect(itemsSource).toContain('queryKey: ["items", childId, "catalog"]');
    // 서버로 밴드를 보내던 배선은 남아 있지 않다(보내면 준비율 분모와 밴드가 함께 좁아진다).
    expect(itemsSource).not.toContain("requestedStageBand");
    expect(itemsSource).not.toContain("statusTab");
  });

  it("칩이 시기별 밴드 판정과 준비율의 기준이 된다", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("resolvePreparationTimelineBucket(rowItem, stageLabel)");
    expect(itemsSource).toContain("computeEssentialPrepProgress(items.data.items, stageLabel)");
    // 기본 칩은 사용자의 수동 선택과 무관하게 계산한다(다른 칩을 눌렀다가 되돌아와도 판별 가능).
    // 라운드 69 트랙 C: 판정이 `{ label, resolved }`를 돌려주므로 화면은 라벨을 따로 꺼낸다.
    expect(itemsSource).toMatch(/const defaultStageBand = resolveDefaultStageLabel\(\{[^]*?hasManualSelection: false/);
    expect(itemsSource).toContain("const defaultStageLabel = defaultStageBand.label;");
  });

  it("밴드 ↔ 스테이지 매핑을 화면에 복제하지 않는다 (판정은 어댑터 한 곳)", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).not.toContain("itemMatchesBand");
    expect(itemsSource).not.toContain("stageFilteredItems");
    // 판정은 어댑터가 stage-bands 모듈을 그대로 읽어서 한다.
    const adapter = source("src/preparation/catalog-contract.ts");
    expect(adapter).toContain('from "../items/stage-bands"');
    expect(adapter).toContain("itemMatchesBand(item, selectedBand)");
  });

  it("derives the chip labels from the band definitions instead of a hand-copied list", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("const tabOptions = bandDefinitions.map((band) => band.label);");
  });

  it("keeps the prep-progress snapshot band-agnostic (ITEM-123: 한 번의 tab=all, no stageBand)", () => {
    // 준비율은 밴드와 무관한 전 상태 스냅샷에서 계산한다 -- 여기에 stageBand를 넘기면
    // 분모가 좁아져 준비율이 틀어진다(computeEssentialPrepProgress가 밴드를 본다).
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('listItems(authToken!, childId!, "all")');
    expect(itemsSource).not.toContain("tabs.map((tab) => listItems(authToken!, childId!, tab))");
  });

  it("exposes the necessity chips and the name search only inside a real session (B2/B3)", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    // 픽셀 락 캡처는 비세션 미리보기를 먼저 반환하므로 두 컨트롤 모두 화면에 나오지 않는다.
    const previewReturnIndex = itemsSource.indexOf("if (!hasSession) {");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    expect(itemsSource.indexOf("NECESSITY_FILTER_OPTIONS.map")).toBeGreaterThan(previewReturnIndex);
    // 검색은 승인 디자인의 목록 컴포넌트가 들고 있고, 화면은 그 입력을 받아 좁히기만 한다.
    expect(itemsSource).toContain("onSearch={setSearchText}");
    expect(itemsSource).toContain("activeSearchQuery={searchText}");
    expect(source("src/preparation/PreparationListParity.tsx")).toContain('returnKeyType="search"');
  });
});

/**
 * 라운드 69 트랙 C — **시기 밴드: 출처를 하나로, 모르면 모른다고.**
 *
 * 고치던 문제: 화면이 아이의 현재 단계를 `/home`에서만 읽었고, 그 응답이 실패하면 기본 칩이
 * 아무 말 없이 `"12-24개월"`이 되고 "출산 전" 칩이 통째로 사라졌다. 목록(`tab="all"`)은 그
 * 순간에도 성공하므로 화면은 완전히 건강해 보였다 — 탭의 이름이 곧 약속인 자리에서
 * (시기별 준비물, DNC-001) 그 약속이 침묵으로 깨지는 유일한 경로다.
 */
describe("라운드 69 C: 시기 밴드의 원천과 모름 고지", () => {
  it("시기 원천이 이미 구독 중인 ['children'] 캐시의 선택된 아이다 (새 요청 0건)", () => {
    const items = source("app/(tabs)/items.tsx");

    expect(items).toContain('queryKey: ["children"]');
    expect(items).toContain("const stageSourceChild = childrenQuery.data?.children.find((child) => child.id === childId);");
    expect(items).toContain("currentStage: stageSourceChild?.currentStage,");
    // 기본 칩과 "출산 전" 칩이 **같은 한 값**을 읽는다(둘 다 stageSourceChild).
    expect(items.match(/currentStage: stageSourceChild\?\.currentStage,/g)).toHaveLength(2);
  });

  it("두 원천이 서버에서 같은 함수(toChildDto)에서 온다는 근거가 소스에 적혀 있다", () => {
    // 출처를 바꾸는 변경의 정당성이 곧 이 사실이라, 다음 사람이 되돌리기 전에 읽을 수 있어야 한다.
    const items = source("app/(tabs)/items.tsx");
    expect(items).toContain("toChildDto");
    expect(source("src/items/stage-bands.ts")).toContain("toChildDto");
    // 서버에서도 그 함수가 한 벌인지 값으로 확인한다(이 트랙은 서버를 한 줄도 바꾸지 않는다).
    const storeShared = readFileSync(join(mobileRoot, "../api/src/onboarding/store-shared.ts"), "utf8");
    expect(storeShared).toContain("export function toChildDto(");
    for (const path of ["../api/src/onboarding/reporting-store.service.ts", "../api/src/onboarding/onboarding-core.service.ts"]) {
      expect(readFileSync(join(mobileRoot, path), "utf8"), path).toContain("toChildDto(");
    }
  });

  it("/home 쿼리는 이 화면에서 사라졌다 (소비처가 그 한 필드뿐이었다)", () => {
    const items = source("app/(tabs)/items.tsx");
    expect(items).not.toContain("getHome");
    expect(items).not.toContain('queryKey: ["home", childId]');
    expect(items).not.toContain("home.data");
    // 당겨서 새로고침의 ["home"] 무효화는 **남는다**: 여기서 누른 준비 상태를 홈 탭의 추천
    // 카드가 그리므로, 빼는 쪽이 오히려 홈의 동작을 바꾼다(이 트랙은 홈 화면 무접촉).
    expect(items).toContain('queryClient.invalidateQueries({ queryKey: ["home"] })');
    // 시기 원천이 옮겨 왔으므로 그 캐시도 당김의 대상이다 — 고지에서 벗어나는 길이 화면에 있어야 한다.
    expect(items).toContain('queryClient.invalidateQueries({ queryKey: ["children"] })');
  });

  it("모름 고지는 정착 뒤에만, 칩 줄 바로 위에 선다 (로딩 중에는 무언)", () => {
    const items = source("app/(tabs)/items.tsx");

    // 정착 판정은 새로 적지 않고 기존 술어 한 벌을 쓴다.
    expect(items).toContain("isChildrenSettled({ authToken, isSuccess: childrenQuery.isSuccess, isError: childrenQuery.isError })");
    expect(items).toContain("const showStageBandUnresolvedNotice =");
    // 네 게이트: 세션 · 픽셀락 아님 · 수동 선택 전 · 시기 모름.
    const gate = items.slice(
      items.indexOf("const showStageBandUnresolvedNotice ="),
      items.indexOf("const childSwitch = useChildSwitchSheet({")
    );
    expect(gate).toContain("hasSession");
    expect(gate).toContain("!isPixelLockMode");
    expect(gate).toContain("!hasManualStageSelection");
    expect(gate).toContain("!defaultStageBand.resolved");

    // 고지는 시기 칩 줄보다 **앞**에 그려진다(고를 대상이 바로 아래 있어야 한다).
    const noticeIndex = items.indexOf("{showStageBandUnresolvedNotice ? (");
    const chipRowIndex = items.indexOf("{tabOptions.map((option) => (", noticeIndex);
    expect(noticeIndex).toBeGreaterThan(-1);
    expect(chipRowIndex).toBeGreaterThan(noticeIndex);
    // 문구는 화면이 다시 적지 않는다(단일 소스는 stage-bands.ts).
    expect(items).toContain("{STAGE_BAND_UNRESOLVED_NOTICE}");
    expect(items).not.toContain('"지금 시기를 확인하지 못했어요');
  });

  it("비세션(ITEM-001 캡처) 렌더는 고지에 닿지 않는다", () => {
    const items = source("app/(tabs)/items.tsx");
    // 미리보기 렌더는 그 위에서 먼저 반환된다 -- 고지는 세션 렌더의 보조 칩 줄에만 있다.
    const previewReturnIndex = items.indexOf("if (!hasSession) {");
    const noticeIndex = items.indexOf("{showStageBandUnresolvedNotice ? (");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    expect(noticeIndex).toBeGreaterThan(previewReturnIndex);
    // 폴백 밴드 값 자체는 그대로다(ITEM-001 캡처 판정이 그 값에 걸려 있다).
    expect(items).toContain('const [stageLabel, setStageLabel] = useState<StageBandLabel>("12-24개월");');
    expect(items).toContain('fallback: "12-24개월"');
  });

  it("판정 모듈 셋은 무접촉이다 (입력 출처만 바뀐다)", () => {
    // pre-birth-filter / item-filters의 판정 규칙은 이번 라운드가 한 글자도 만지지 않는다.
    expect(source("src/items/pre-birth-filter.ts")).toContain(
      "return input.hasSession && isPreBirthStage(input.currentStage) && bandOffersPreBirthItems(input.selectedBand);"
    );
    const items = source("app/(tabs)/items.tsx");
    expect(items).toContain("const offersPreBirthFilter = shouldOfferPreBirthFilter({");
    expect(items).toContain("const preBirthFilterActive = isPreBirthFilterActive({");
    // 목록 요청·준비율·찜 칩도 그대로다.
    expect(items).toContain('listItems(authToken!, childId!, "all")');
    expect(items).toContain("computeEssentialPrepProgress(items.data.items, stageLabel)");
    expect(items).toContain("filterInterestedItems(visibleItems)");
  });
});

describe("local backend listItems(stageBand)", () => {
  beforeEach(async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("filters the loginless test session's fixtures by the requested band, not by the child's stage", async () => {
    const { listItems } = await import("../api/local-backend");
    const { LOCAL_CHILD_ID, LOCAL_ITEM_BLOCKS, LOCAL_ITEM_CAR_SEAT } = await import("../api/local-fixtures");

    const newbornBand = listItems(LOCAL_CHILD_ID, "now", "0-6개월").items;
    const olderBand = listItems(LOCAL_CHILD_ID, "now", "24개월+").items;

    // 아이는 걸음마기(픽스처 ~24개월)인데도 밴드별로 **다른** 목록이 나온다 -- 예전에는 어떤
    // 칩을 눌러도 같은 목록이었다. 실기기 피드백 1로 카탈로그가 임신~첫돌까지 넓어져,
    // 0-6개월 밴드에는 그 시기 준비물(예: 카시트)이, 24개월+ 밴드에는 kid_4_7 항목(원목 블록
    // 세트)이 들어온다.
    expect(newbornBand.map((item) => item.id)).toContain(LOCAL_ITEM_CAR_SEAT);
    expect(newbornBand.map((item) => item.id)).not.toContain(LOCAL_ITEM_BLOCKS);
    expect(olderBand.map((item) => item.id)).toContain(LOCAL_ITEM_BLOCKS);
    expect(olderBand.map((item) => item.id)).not.toContain(LOCAL_ITEM_CAR_SEAT);
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

  it("0-6개월 밴드는 임신기 3단계까지 포함한다 -- 기본 칩에서 밴드를 보내면 안 되는 이유(F2)", () => {
    // 신생아(newborn_0_3) 부모의 기본 칩이 이 밴드다. 밴드를 그대로 서버에 보내면 임신 초/중/후기
    // 품목이 "지금 필요"에 섞여 들어온다 -- 그래서 기본 칩에서는 stageBand를 생략한다.
    expect(bandStages("0-6개월")).toEqual(
      expect.arrayContaining(["pregnancy_early", "pregnancy_mid", "pregnancy_late", "newborn_0_3"])
    );
    expect(itemMatchesBand({ stageCodes: ["pregnancy_early"] }, "0-6개월")).toBe(true);
  });
});
