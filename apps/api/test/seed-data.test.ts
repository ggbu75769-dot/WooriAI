import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateChildStage, type ChildStageCode } from "@wooriai/domain";
import { STAGE_BAND_LABELS, STAGE_BAND_STAGES } from "../src/items-commerce/stage-bands";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaDir = join(apiRoot, "prisma");
const seedDataPath = join(prismaDir, "seed-data.ts");
const seedScriptPath = join(prismaDir, "seed.ts");

async function loadSeedData() {
  expect(existsSync(seedDataPath), `${seedDataPath} must exist`).toBe(true);
  if (!existsSync(seedDataPath)) {
    return { categorySeeds: [], itemTemplateSeeds: [], productLinkSeeds: [] };
  }

  return import(pathToFileURL(seedDataPath).href) as Promise<{
    categorySeeds: Array<{ code: string; name: string; iconName: string; displayOrder: number }>;
    itemTemplateSeeds: Array<{
      code: string;
      categoryCode: string;
      necessityLevel: string;
      timingLabel: string;
      reasonText: string;
      skipReasonText?: string | null;
      safetyNote?: string | null;
      medicalDisclaimerRequired: boolean;
      active: boolean;
      stageCodes: string[];
    }>;
    productLinkSeeds: Array<{
      itemTemplateCode: string;
      platform: string;
      url: string;
      affiliateUrl?: string | null;
      affiliatePartnerCode?: string | null;
      isAffiliate: boolean;
      isSponsored: boolean;
      sponsorLabel?: string | null;
      disclosureText?: string | null;
    }>;
  }>;
}

// Original 7 batch-03 items were seeded before every item was required to have a
// product link; they're grandfathered out of the "every item needs a link" rule
// added when the catalog was expanded to cover all life stages (see below).
const LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT = [
  "pregnancy_vitamin",
  "car_seat",
  "diaper_stock",
  "baby_bath",
  "stroller",
  "baby_food_maker",
  "first_books"
];

const ALL_STAGE_CODES = [
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "newborn_0_3",
  "infant_4_6",
  "infant_7_12",
  "toddler_1_3",
  "kid_4_7",
  "elementary",
  "middle_school"
];

/**
 * 라운드 74 트랙 B — `timingLabel`을 읽는 첫 계약.
 *
 * 왜 필요했나: 상세 화면은 `timingLabel`을 **사실 줄로 승격**해 그대로 읽어 주고
 * (apps/mobile/app/items/[itemTemplateId].tsx의 "준비 시기"), 목록은 그 값을 보지 않고
 * `stageCodes`로만 고른다(밴드 표 — apps/api/src/items-commerce/stage-bands.ts).
 * 두 값을 잇는 단언이 하나도 없어서, 열 건이 화면 둘에서 **서로 다른 나이**를 말하고 있었다
 * (생후 8개월 부모가 "6-12개월" 목록에서 연 안전문의 상세가 "12~24개월"이라고 적혀 있었다).
 *
 * ⚠️ 개월 수를 이 파일에 손으로 다시 적지 않는다. 스테이지의 개월 경계는 `packages/domain`의
 * `calculateChildStage`를 **나이로 훑어** 파생시키고(아래 `stageNotationRanges`), 밴드의 개월
 * 경계는 밴드 라벨 네 문자열 자신에서 파싱한다. 도메인이 경계를 옮기면 이 계약이 따라 옮긴다.
 */
const PROBE_TODAY = "2100-01-15";
/** 훑는 상한(개월). 스테이지 경계값이 아니라 탐침 범위다 — 마지막 스테이지는 열린 구간으로 본다. */
const PROBE_MAX_AGE_MONTHS = 600;

type MonthRange = { from: number; to: number };

function probeBirthDate(ageMonths: number): string {
  const [year, month, day] = PROBE_TODAY.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) - ageMonths;
  const probeYear = Math.floor(totalMonths / 12);
  const probeMonth = (totalMonths % 12) + 1;
  return [
    String(probeYear).padStart(4, "0"),
    String(probeMonth).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function stageForAgeMonths(ageMonths: number): ChildStageCode {
  return calculateChildStage({ stageMode: "born", birthDate: probeBirthDate(ageMonths), today: PROBE_TODAY })
    .stageCode;
}

/**
 * 출생 이후 스테이지의 **표기 구간**(개월). 카탈로그와 밴드 라벨이 쓰는 표기 관례를 그대로 따른다:
 * 구간의 시작 숫자는 "그 달이 되는 시점"이라 앞 스테이지의 마지막 개월과 같다
 * (밴드 `"6-12개월"`이 완료 개월 7~12인 `infant_7_12` 하나인 것이 그 관례의 증거다).
 * 그래서 시작값은 완료 개월 최소값 - 1이고, 마지막 스테이지의 끝은 열려 있다.
 */
function stageNotationRanges(): Map<ChildStageCode, MonthRange> {
  const completed = new Map<ChildStageCode, MonthRange>();
  for (let ageMonths = 0; ageMonths <= PROBE_MAX_AGE_MONTHS; ageMonths += 1) {
    const stage = stageForAgeMonths(ageMonths);
    const seen = completed.get(stage);
    completed.set(stage, { from: seen?.from ?? ageMonths, to: ageMonths });
  }

  const openEndedStage = stageForAgeMonths(PROBE_MAX_AGE_MONTHS);
  const notation = new Map<ChildStageCode, MonthRange>();
  for (const [stage, range] of completed) {
    notation.set(stage, {
      from: range.from === 0 ? 0 : range.from - 1,
      to: stage === openEndedStage ? Number.POSITIVE_INFINITY : range.to
    });
  }
  return notation;
}

/** `timingLabel`이 개월 구간을 말하면 그 구간을. 임신·연령(세)·서술 표기는 null(판정 대상 아님). */
function parseTimingLabelMonths(label: string): MonthRange | null {
  const span = /^(\d+)~(\d+)개월(?: 전후)?$/.exec(label);
  if (span) return { from: Number(span[1]), to: Number(span[2]) };
  const openEnded = /^(\d+)개월 이후$/.exec(label);
  if (openEnded) return { from: Number(openEnded[1]), to: Number.POSITIVE_INFINITY };
  return null;
}

/** 밴드 라벨 네 문자열이 스스로 말하는 개월 구간(`"24개월+"`는 열린 구간). */
function parseBandLabelMonths(label: string): MonthRange {
  const span = /^(\d+)-(\d+)개월$/.exec(label);
  if (span) return { from: Number(span[1]), to: Number(span[2]) };
  const openEnded = /^(\d+)개월\+$/.exec(label);
  expect(openEnded, `band label ${label} must state a month range`).not.toBeNull();
  return { from: Number(openEnded?.[1]), to: Number.POSITIVE_INFINITY };
}

/**
 * 라운드 73까지의 라벨 사전(62건 · 서로 다른 **24**개).
 *
 * 라운드 74 트랙 B의 부정 단언: 열 건을 정정하면서 **새 어휘를 0건** 들여왔다는 것을 값으로
 * 못 박는다. `"24개월 이후"`는 정정으로 사용처가 0이 됐지만 사전에는 남는다 — 이 목록은 "쓰이는
 * 라벨"이 아니라 "이 카탈로그가 허용해 온 표기"이고, 지우면 부정 단언의 기준점이 사라진다.
 */
const TIMING_LABEL_VOCABULARY_ROUND73 = [
  "임신 초기",
  "임신 초기부터",
  "임신 초기~중기",
  "임신 초기~후기",
  "임신 중기~후기",
  "임신 후기·출산 전",
  "출산 전후",
  "출산 직전~0개월",
  "외출이 늘어날 때",
  "0~3개월",
  "0~6개월",
  "0~12개월",
  "0~24개월",
  "4~6개월 전후",
  "4~12개월",
  "6~24개월",
  "7~12개월",
  "12~24개월",
  "24개월 이후",
  "4~7세",
  "4~7세~초등",
  "초등학생 시기",
  "초등~중등",
  "중학생 시기"
];

describe("Batch 03 seed data", () => {
  it("defines the locked 12 categories without duplicates", async () => {
    const { categorySeeds } = await loadSeedData();
    const expectedCodes = [
      "pregnancy_mother",
      "hospital_checkup",
      "birth_postpartum",
      "diaper_hygiene",
      "feeding_babyfood",
      "clothes_laundry",
      "sleep_furniture",
      "outing_mobility",
      "toys_books",
      "care_education",
      "insurance_savings",
      "etc"
    ];

    expect(categorySeeds.map((category) => category.code)).toEqual(expectedCodes);
    expect(new Set(categorySeeds.map((category) => category.code)).size).toBe(12);
    expect(categorySeeds.every((category) => category.name && category.iconName)).toBe(true);
  });

  it("covers stage-based item templates with all necessity levels and skip guidance", async () => {
    const { categorySeeds, itemTemplateSeeds } = await loadSeedData();
    const categoryCodes = new Set(categorySeeds.map((category) => category.code));
    const levels = new Set(itemTemplateSeeds.map((item) => item.necessityLevel));

    expect(levels).toEqual(new Set(["essential", "convenience", "optional"]));
    expect(itemTemplateSeeds.length).toBeGreaterThanOrEqual(6);
    expect(itemTemplateSeeds.every((item) => categoryCodes.has(item.categoryCode))).toBe(true);
    expect(itemTemplateSeeds.every((item) => item.reasonText.length > 0)).toBe(true);
    expect(itemTemplateSeeds.every((item) => item.stageCodes.length > 0)).toBe(true);
    expect(
      itemTemplateSeeds
        .filter((item) => item.necessityLevel !== "essential")
        .every((item) => Boolean(item.skipReasonText))
    ).toBe(true);
  });

  it("uses development-only product links with explicit affiliate and sponsored flags", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();
    const itemCodes = new Set(itemTemplateSeeds.map((item) => item.code));

    expect(productLinkSeeds.length).toBeGreaterThanOrEqual(3);
    expect(productLinkSeeds.every((link) => itemCodes.has(link.itemTemplateCode))).toBe(true);
    expect(productLinkSeeds.some((link) => link.isAffiliate)).toBe(true);
    expect(productLinkSeeds.some((link) => link.isSponsored && Boolean(link.sponsorLabel))).toBe(true);
    expect(productLinkSeeds.every((link) => link.url.startsWith("https://example.com/dev/"))).toBe(true);
    expect(productLinkSeeds.every((link) => link.affiliatePartnerCode == null)).toBe(true);
    expect(
      productLinkSeeds
        .filter((link) => link.isAffiliate)
        .every((link) => link.disclosureText?.includes("제휴"))
    ).toBe(true);
    expect(JSON.stringify(productLinkSeeds).toLowerCase()).not.toMatch(/secret|access_key|partner_id/);
    expect(JSON.stringify(productLinkSeeds).toLowerCase()).not.toMatch(/coupang\.com|naver\.com/);
  });

  it("keeps the seed script idempotent and out of expenses", () => {
    expect(existsSync(seedScriptPath), `${seedScriptPath} must exist`).toBe(true);
    const seedScript = existsSync(seedScriptPath) ? readFileSync(seedScriptPath, "utf8") : "";

    expect(seedScript).toContain("upsert");
    expect(seedScript).toContain("findFirst");
    expect(seedScript).not.toContain("expenses");
  });

  // ADM-007: re-running the seed (e.g. an idempotent bootstrap re-run) must never
  // roll back a rotated admin password or reactivate a deactivated account. Admin
  // credentials are seeded create-only.
  it("never resets an existing admin user's credentials on re-seed", () => {
    const seedScript = existsSync(seedScriptPath) ? readFileSync(seedScriptPath, "utf8") : "";

    expect(seedScript).toContain("createAdminUserIfMissing");
    expect(seedScript).not.toContain("adminUser.upsert");
  });

  it("covers every child stage with at least 5 active prepared items", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const activeItems = itemTemplateSeeds.filter((item) => item.active);

    for (const stageCode of ALL_STAGE_CODES) {
      const count = activeItems.filter((item) => item.stageCodes.includes(stageCode)).length;
      expect(count, `stage ${stageCode} should be covered by >=5 active items, found ${count}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("requires skip guidance for every convenience/optional item", async () => {
    const { itemTemplateSeeds } = await loadSeedData();

    const nonEssential = itemTemplateSeeds.filter(
      (item) => item.necessityLevel === "convenience" || item.necessityLevel === "optional"
    );

    for (const item of nonEssential) {
      expect(
        Boolean(item.skipReasonText && item.skipReasonText.trim().length > 0),
        `${item.code} (${item.necessityLevel}) must have skipReasonText`
      ).toBe(true);
    }
  });

  it("requires a safety note whenever a medical disclaimer is required", async () => {
    const { itemTemplateSeeds } = await loadSeedData();

    const medicalItems = itemTemplateSeeds.filter((item) => item.medicalDisclaimerRequired);
    expect(medicalItems.length).toBeGreaterThan(0);

    for (const item of medicalItems) {
      expect(
        Boolean(item.safetyNote && item.safetyNote.trim().length > 0),
        `${item.code} has medicalDisclaimerRequired=true but no safetyNote`
      ).toBe(true);
    }
  });

  it("gives every non-legacy item at least one product link", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    const itemsRequiringLinks = itemTemplateSeeds.filter(
      (item) => !LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT.includes(item.code)
    );

    for (const item of itemsRequiringLinks) {
      expect(linkedCodes.has(item.code), `${item.code} should have >=1 product link`).toBe(true);
    }
  });

  it("has no duplicate item template codes", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const codes = itemTemplateSeeds.map((item) => item.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses https URLs for every product link", async () => {
    const { productLinkSeeds } = await loadSeedData();

    for (const link of productLinkSeeds) {
      expect(link.url.startsWith("https://"), `${link.itemTemplateCode} link must use https`).toBe(true);
    }
  });
});

/**
 * 라운드 74 트랙 B — **준비 시기가 화면 둘에서 같은 나이를 말할 것.**
 *
 * 이 절이 무는 것은 시드뿐이다. 어드민 CMS(apps/admin/app/items/page.tsx)의 `timingLabel`
 * 자유 입력은 이 계약 밖이고, 그 사실은 그대로 남는다(운영자 입력까지 막는 것은 별도 결정이다).
 */
describe("준비템 timingLabel ↔ stageCodes (라운드 74 트랙 B)", () => {
  it("스테이지 경계를 도메인에서 파생시킨다 (이 파일이 개월 수를 손으로 적지 않는다는 증거)", () => {
    const notation = stageNotationRanges();

    // 출생 이후 스테이지 전부가 훑기로 나온다(하나라도 빠지면 아래 판정이 조용히 헐거워진다).
    expect([...notation.keys()]).toEqual([
      "newborn_0_3",
      "infant_4_6",
      "infant_7_12",
      "toddler_1_3",
      "kid_4_7",
      "elementary",
      "middle_school"
    ]);
    // 구간은 앞뒤가 맞물려 이어진다(앞 스테이지의 끝 = 다음 스테이지의 시작).
    const ordered = [...notation.values()];
    expect(ordered[0].from).toBe(0);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index].from, `stage #${index} must start where the previous one ends`).toBe(
        ordered[index - 1].to
      );
    }
    // 마지막 스테이지만 열려 있다.
    expect(ordered.at(-1)?.to).toBe(Number.POSITIVE_INFINITY);
    expect(ordered.slice(0, -1).every((range) => Number.isFinite(range.to))).toBe(true);
  });

  it("timingLabel이 말하는 개월 구간이 stageCodes가 덮는 개월 구간을 벗어나지 않는다", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const notation = stageNotationRanges();
    let judged = 0;

    for (const item of itemTemplateSeeds) {
      const labelRange = parseTimingLabelMonths(item.timingLabel);
      if (!labelRange) continue;

      const bornStages = item.stageCodes.filter((code): code is ChildStageCode =>
        notation.has(code as ChildStageCode)
      );
      expect(
        bornStages.length,
        `${item.code}: timingLabel "${item.timingLabel}"이 개월을 말하는데 출생 이후 스테이지가 없다`
      ).toBeGreaterThan(0);

      const covered: MonthRange = {
        from: Math.min(...bornStages.map((stage) => notation.get(stage)!.from)),
        to: Math.max(...bornStages.map((stage) => notation.get(stage)!.to))
      };

      expect(
        labelRange.from >= covered.from && labelRange.to <= covered.to,
        `${item.code}: "${item.timingLabel}" = [${labelRange.from}, ${labelRange.to}] ` +
          `is outside the months its stageCodes cover [${covered.from}, ${covered.to}] (${item.stageCodes.join(", ")})`
      ).toBe(true);
      judged += 1;
    }

    // 정규식이 조용히 아무것도 못 잡는 no-op이 되지 않게(오늘 실측 27건).
    expect(judged).toBeGreaterThanOrEqual(20);
  });

  it("라벨이 시기 칩의 이름을 그대로 말하면, 그 품목은 더 이른 칩에 서 있지 않는다", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const bandOrder = [...STAGE_BAND_LABELS];
    const bandMonths = bandOrder.map((label) => parseBandLabelMonths(label));
    let judgedPairs = 0;

    for (const item of itemTemplateSeeds) {
      const labelRange = parseTimingLabelMonths(item.timingLabel);
      if (!labelRange) continue;

      // 사용자는 상세의 "준비 시기: 12~24개월"을 칩 이름으로 읽는다(물결표/하이픈 차이는 눈에
      // 띄지 않는다). 그 라벨이 어떤 칩의 개월 구간과 정확히 같은데 품목이 그보다 이른 칩에도
      // 서 있으면, 그 이른 칩에서 연 사용자는 목록과 상세에서 다른 나이를 듣는다.
      const namedBandIndex = bandMonths.findIndex(
        (range) => range.from === labelRange.from && range.to === labelRange.to
      );
      if (namedBandIndex < 0) continue;

      for (const earlierBand of bandOrder.slice(0, namedBandIndex)) {
        const stagesInEarlierBand = STAGE_BAND_STAGES[earlierBand];
        judgedPairs += 1;
        expect(
          item.stageCodes.some((code) => stagesInEarlierBand.includes(code as ChildStageCode)),
          `${item.code}: "${item.timingLabel}"은 ${bandOrder[namedBandIndex]} 칩의 이름인데 ` +
            `이 품목은 더 이른 ${earlierBand} 칩에도 선다 (${item.stageCodes.join(", ")})`
        ).toBe(false);
      }
    }

    // no-op 방지: 오늘은 칩 이름을 그대로 말하는 라벨 아홉 건에서 열넷 쌍이 실제로 판정된다
    // (`"12~24개월"` 일곱 × 이른 칩 둘). 라벨과 칩의 표기가 함께 어긋나면 이 수가 먼저 0이 된다.
    expect(judgedPairs).toBeGreaterThanOrEqual(10);
  });

  it("정정한 라벨이 종전 라벨 사전 안에 있다 (새 어휘 0건)", async () => {
    const { itemTemplateSeeds } = await loadSeedData();

    for (const item of itemTemplateSeeds) {
      expect(
        TIMING_LABEL_VOCABULARY_ROUND73,
        `${item.code}: "${item.timingLabel}"은 종전 라벨 사전에 없는 새 어휘다`
      ).toContain(item.timingLabel);
    }
    // 사전 자체가 라벨을 다 담고 있다는 것만으로는 부족하다 — 사전에 없는 표기가 실제로
    // 걸리는지(= 이 단언이 no-op이 아닌지)를 값으로 남긴다.
    expect(TIMING_LABEL_VOCABULARY_ROUND73).not.toContain("24개월+");
    expect(new Set(TIMING_LABEL_VOCABULARY_ROUND73).size).toBe(TIMING_LABEL_VOCABULARY_ROUND73.length);
  });

  it("밴드 라벨 네 문자열은 이 정정에 한 바이트도 끌려가지 않는다", () => {
    // ITEM-001 픽셀락 캡처의 칩 라벨 · packages/contracts의 STAGE_BAND_LABELS · 서버 쿼리
    // 파라미터가 같은 네 문자열이다. 카탈로그 표기를 고치는 트랙이지 칩 이름을 고치는 트랙이 아니다.
    expect([...STAGE_BAND_LABELS]).toEqual(["0-6개월", "6-12개월", "12-24개월", "24개월+"]);
  });
});
