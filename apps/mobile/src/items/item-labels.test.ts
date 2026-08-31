import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, NECESSITY_LEVELS } from "@wooriai/domain";
import { catalogItemStatusLabel, MOD_V1_ITEM_STATUS_LABELS } from "../design-system/item-status-vocabulary";
import { toCatalogPlanState } from "../preparation/catalog-contract";
import { NECESSITY_FILTER_OPTIONS } from "./item-filters";
import {
  itemStatusBadgeLabel,
  itemStatusLabel,
  ITEM_PRICE_BAND_FALLBACK_TEXT,
  necessityBadgeLabel
} from "./item-labels";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** `app/`·`src/` 아래의 .ts/.tsx 전수(테스트 포함) — 사문 부정 단언이 도는 모집단. */
function mobileSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      found.push(relative(mobileRoot, fullPath).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, "app"));
  walk(join(mobileRoot, "src"));
  return found;
}

describe("라운드 48 T1: 준비 상태 라벨", () => {
  it("어휘는 승인 캡처의 목록 pill과 같다(보유 · 알아보기 · 필요 · 선물)", () => {
    expect(itemStatusLabel("prepared")).toBe("보유");
    expect(itemStatusLabel("interested")).toBe("알아보기");
    expect(itemStatusLabel("not_prepared")).toBe("필요");
    expect(itemStatusLabel("gifted")).toBe("선물");
    expect(itemStatusLabel("not_needed")).toBe("필요 없음");
    for (const status of ITEM_STATUSES) {
      expect(itemStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("예전의 상세 전용 어휘는 어디에서도 나오지 않는다(화면끼리 갈라지던 원인)", () => {
    const shipped = ITEM_STATUSES.map((status) => itemStatusLabel(status));
    for (const stale of ["이미 준비", "관심", "준비 전", "선물 받음"]) {
      expect(shipped, `${stale}은 목록 어휘로 대체됐다`).not.toContain(stale);
    }
  });

  it("라벨 문자열은 어휘 모듈 하나에서만 나온다(목록 pill과 같은 값)", () => {
    // 목록 pill(modV1ItemStatuses)도 같은 소스를 읽는다. 그 파일은 react-native를 import해
    // vitest에서 실행할 수 없으므로 소스 계약으로 고정한다(design-system-restore.test.ts 관례).
    const primitives = source("src/design-system/components/ModV1Primitives.tsx");
    expect(primitives).toContain('label: MOD_V1_ITEM_STATUS_LABELS.owned');
    expect(primitives).toContain("return catalogItemStatusLabel(value);");
    expect(MOD_V1_ITEM_STATUS_LABELS.owned).toBe("보유");
    for (const status of ITEM_STATUSES) {
      expect(itemStatusLabel(status)).toBe(catalogItemStatusLabel(toCatalogPlanState(status)));
    }
    // 화면 모듈은 문구를 손으로 다시 적지 않는다 -- 라벨을 돌려주는 곳이 위임 한 줄뿐이다.
    const labelFn = source("src/items/item-labels.ts").slice(
      source("src/items/item-labels.ts").indexOf("export function itemStatusLabel"),
      source("src/items/item-labels.ts").indexOf("export function itemStatusBadgeLabel")
    );
    expect(labelFn).toContain("catalogItemStatusLabel(toCatalogPlanState(status)");
    expect(labelFn).not.toMatch(/return "[^"]+";/);
  });

  it("design-system 배럴은 itemStatusLabel을 내보내지 않는다(이름 충돌로 다른 어휘가 새는 길을 막는다)", () => {
    const barrel = source("src/design-system/index.ts");
    expect(barrel).toContain("./components/ModV1Primitives");
    expect(barrel).not.toContain("itemStatusLabel,");
    expect(barrel).toContain("catalogItemStatusLabel");
  });

  it("배지로는 준비 전(기본값)을 알리지 않는다", () => {
    expect(itemStatusBadgeLabel("not_prepared")).toBeUndefined();
    for (const status of ITEM_STATUSES.filter((entry) => entry !== "not_prepared")) {
      expect(itemStatusBadgeLabel(status)).toBe(itemStatusLabel(status));
    }
  });
});

describe("라운드 48 T1: 필수도 배지", () => {
  it("문구는 목록 필수도 칩과 같은 단어를 쓴다(두 UI가 갈라지지 않게)", () => {
    for (const level of NECESSITY_LEVELS) {
      const chipLabel = NECESSITY_FILTER_OPTIONS.find((option) => option.value === level)?.label;
      expect(chipLabel).toBeTruthy();
      if (level === "optional") continue;
      expect(necessityBadgeLabel(level)).toBe(chipLabel);
    }
    expect(necessityBadgeLabel("essential")).toBe("필수");
  });

  it("선택(optional)에는 배지를 달지 않는다", () => {
    expect(necessityBadgeLabel("optional")).toBeUndefined();
  });
});

/**
 * 라운드 86 A — **목록이 필수도를 말한다.**
 *
 * 종전에는 이 자리에 `itemListBadgeLabel`(상태가 있으면 상태 라벨, 없으면 필수도 라벨)의 계약이
 * 서 있었다. 그런데 DSN-053 P2-B가 목록을 승인 디자인의 타일 그리드로 옮기면서 **상태 절반은
 * 타일의 상태 pill이 이어받았고**, 나머지 절반(필수도)은 이어받은 자리가 **0건**이었다 --
 * 즉 그 함수의 호출부는 저장소에서 사라졌는데 계약만 초록으로 남아 있었다. 화면이 부르지 않는
 * 판정을 단언해 두면 다음 사람은 그 초록을 *"화면이 그렇게 그린다"* 로 읽는다(라운드 72 E가
 * 죽은 프롭 셋에서 쓴 그 판단).
 *
 * 그래서 이 라운드는 판정을 **살아 있는 자리로** 옮겼다: 목록의 footer 슬롯이 상세가 이미 쓰는
 * `necessityBadgeLabel`을 그대로 부르고, 사문이 된 이름은 걷었다. 아래 넷이 무는 것은 그 사실
 * 자체다 -- 배선(호출부가 있다) · 어휘(칩과 배지가 같은 글자다) · 부정(사문 이름이 없다) ·
 * 머리말(거짓이 된 근거가 다시 근거로 쓰이지 않는다).
 */
describe("라운드 86 A: 목록이 필수도를 말한다", () => {
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it("목록 소스가 필수도 판정을 실제로 부른다(호출부 0건인 판정을 남기지 않는다)", () => {
    const items = itemsSource();
    expect(items).toContain('from "../../src/items/item-labels"');
    expect(items).toContain("const necessityLabel = necessityBadgeLabel(item.necessityLevel);");
    // 타일(승인 디자인) 안이 아니라 **화면이 소유한 타일 아래 슬롯**에 선다.
    const footerAt = items.indexOf("renderItemFooter={(parityItem) => {");
    expect(footerAt, "footer 슬롯이 화면에 있다").toBeGreaterThan(-1);
    expect(items.indexOf("const necessityLabel = necessityBadgeLabel(")).toBeGreaterThan(footerAt);
    expect(items).toContain("{necessityLabel ? <StatusBadge label={necessityLabel} /> : null}");
  });

  it("문구는 화면이 다시 적지 않는다 -- 배지 글자가 필수도 칩과 같다", () => {
    const items = itemsSource();
    for (const option of NECESSITY_FILTER_OPTIONS) {
      expect(items, `"${option.label}"는 모듈이 정한다`).not.toContain(`label="${option.label}"`);
    }
    for (const level of NECESSITY_LEVELS) {
      const chipLabel = NECESSITY_FILTER_OPTIONS.find((option) => option.value === level)?.label;
      // "선택"에는 배지가 붙지 않는다 -- 모든 타일이 배지를 달면 배지가 아무것도 구분하지 못한다.
      if (level === "optional") {
        expect(necessityBadgeLabel(level)).toBeUndefined();
        continue;
      }
      expect(necessityBadgeLabel(level)).toBe(chipLabel);
    }
  });

  it("어떤 입력으로도 근거 없는 평가 문구를 만들지 않는다", () => {
    for (const evaluative of ["BEST", "NEW"]) {
      for (const necessityLevel of NECESSITY_LEVELS) {
        expect(necessityBadgeLabel(necessityLevel)).not.toBe(evaluative);
      }
      for (const status of ITEM_STATUSES) {
        expect(itemStatusLabel(status)).not.toBe(evaluative);
        expect(itemStatusBadgeLabel(status)).not.toBe(evaluative);
      }
    }
  });

  /**
   * ⚠️ 이 파일 하나만 모집단에서 뺀다 -- 사문의 이름이 여기 남는 이유는 **부정 단언의 바늘**과
   * 그것을 설명하는 산문뿐이기 때문이다(대장이 자기 이름을 적는 자리와 같은 모양). 그래서
   * "바늘 말고는 없다"를 곧바로 이어 문다: import도 호출도 0건.
   */
  it("사문이 된 itemListBadgeLabel은 소스에도 계약에도 남지 않는다", () => {
    const deadFunctionName = "itemListBadgeLabel";
    const selfPath = "src/items/item-labels.test.ts";
    const offenders = mobileSourceFiles()
      .filter((path) => path !== selfPath)
      .filter((path) => source(path).includes(deadFunctionName));
    expect(offenders, "호출부 없는 판정은 이름째로 걷는다").toEqual([]);

    const self = source(selfPath);
    expect(self, "바늘로만 남는다 -- 부르지 않는다").not.toMatch(new RegExp(`${deadFunctionName}\\s*\\(`));
    expect(self, "바늘로만 남는다 -- 들여오지 않는다").not.toContain(`import { ${deadFunctionName}`);
    expect(self).not.toContain(`  ${deadFunctionName},`);
  });

  it("머리말은 거짓이 된 근거를 다시 근거로 내놓지 않는다", () => {
    const labels = source("src/items/item-labels.ts");
    // 라운드 48이 적어 둔 그 문장은 DSN-053 P2-B 이후 거짓이었다(선행 확인 3ⓑ①).
    expect(labels).not.toContain("배지는 이제 응답에 실제로 있는 두 값만 말한다");
    // 대신 **두 값을 오늘 어디가 그리는지**가 값으로 적혀 있다(다음 라운드가 세어 볼 수 있게).
    expect(labels).toContain("renderItemFooter");
    expect(labels).toContain("ModV1Primitives");
  });
});

describe("라운드 48 T1: 목록 화면 배선", () => {
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it('실서버 항목에서 "BEST" 배지와 순환 사진이 사라졌다', () => {
    const items = itemsSource();
    // 순서(index)로 배지를 정하던 판정도, 그 판정이 쓰던 이미지 순환 배열도 남지 않는다.
    expect(items).not.toContain('index === 0 && item.status !== "gifted" ? "BEST"');
    expect(items).not.toContain("recommendationPreviewImages[index % recommendationPreviewImages.length]");
    expect(items).not.toContain("const recommendationPreviewImages");
    /**
     * DSN-053 P2-B: 세션 목록이 승인 디자인의 준비 타일(아이콘 + 이름 + 상태 pill)이 되면서
     * 타일에 붙일 배지도 사진도 없어졌다 -- 근거 없는 평가가 들어올 자리 자체가 사라졌다.
     * 배지·상태 문구는 여전히 화면 밖(디자인 시스템/모듈)에서만 온다.
     *
     * 라운드 86 A: 그 타일 **아래 슬롯**에 필수도 배지가 섰지만 `badge` 프롭은 여전히 0건이다
     * (타일 렌더는 승인 자산이라 이 트랙이 열지 않는다). 종전에 여기 있던 사문 판정의 배선
     * 부정 단언은 **그 이름을 저장소 전수에서 세는** 단언으로 올라갔다(이 파일 마지막 describe).
     */
    expect(items).not.toContain('badge="');
    expect(items).toContain('from "../../src/items/item-labels"');
  });

  it("비세션 미리보기(ITEM-001 픽셀 락)의 배지·사진·캡션은 그대로다", () => {
    const items = itemsSource();
    // 프리뷰 분기와 픽스처 값은 손대지 않는다(캡처 픽셀 불변).
    expect(items).toContain("return { badge: item.badgeText, caption: item.caption, image: item.image };");
    expect(items).toContain('badgeText: "BEST"');
    expect(items).toContain('badgeText: "NEW"');
    expect(items).toContain("image: recommendationBabyCarrierImage");
    expect(items).toContain("image: recommendationDiaperImage");
    expect(items).toContain("image: recommendationBlocksImage");
    // 프리뷰 픽스처 전용 함수라 실서버 항목이 이 경로로 들어올 수 없다.
    expect(items).toContain("function getRecommendationDisplay(item: RecommendationPreviewItem) {");
  });

  it("가격대가 없을 때의 문구는 눌리는 행동처럼도, 약속처럼도 읽히지 않는다", () => {
    expect(ITEM_PRICE_BAND_FALLBACK_TEXT).toBe("가격 정보가 없어요");
    const items = itemsSource();
    expect(items).toContain("price={item.priceBandText ?? ITEM_PRICE_BAND_FALLBACK_TEXT}");
    expect(items).not.toContain("가격 정보 확인");
    // 라운드 48 QA(P3-5): "준비 중"은 곧 채워진다는 약속인데, 그 약속을 지킬 장치가 앱에 없다.
    expect(ITEM_PRICE_BAND_FALLBACK_TEXT).not.toContain("준비 중");
    expect(ITEM_PRICE_BAND_FALLBACK_TEXT).not.toContain("곧");
  });

  it("상태 문구는 화면에 인라인하지 않는다(목록·상세 단일 소스)", () => {
    const items = itemsSource();
    expect(items).not.toContain('if (status === "gifted") return "선물 받음";');
    expect(items).not.toContain("function statusLabel(");
  });
});

describe("라운드 48 T1: 상세 화면 상태 줄", () => {
  it("목록과 같은 라벨 모듈을 쓰고 세션에서만 그린다", () => {
    const detail = source("app/items/[itemTemplateId].tsx");
    expect(detail).toContain('from "../../src/items/item-labels"');
    expect(detail).toContain("itemStatusBadgeLabel");
    // 라운드 51 C-10: 라벨의 근거가 서버 값에서 **낙관 반영을 거친 값**으로 바뀌었다
    // (displayStatus = 대기 중인 변경이 있으면 그 값, 없으면 종전과 같은 서버 값).
    expect(detail).toContain("const statusBadgeLabel = itemStatusBadgeLabel(displayStatus);");
    expect(detail).toContain("{hasSession && statusBadgeLabel ? <StatusBadge label={statusBadgeLabel} /> : null}");
    // DSN-053 P2-B: "제품 정보" 탭의 상태 줄도 같은 모듈이 문구를 정한다.
    expect(detail).toContain('facts.push({ label: "내 준비 상태", value: itemStatusLabel(displayStatus) });');
    // 문구를 화면에서 다시 적지 않는다.
    expect(detail).not.toContain('label="이미 준비"');
    expect(detail).not.toContain('label="선물 받음"');
  });
});
