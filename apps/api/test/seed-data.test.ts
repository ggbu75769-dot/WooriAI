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

/** 두 구간이 한 달이라도 겹치는가(표기 관례상 경계값은 앞뒤 구간이 함께 갖는다). */
function overlaps(a: MonthRange, b: MonthRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * 구간들의 **합집합**(맞물리는 것끼리 이어 붙인다).
 *
 * 라운드 74 리뷰(제안 채택): 종전 검사는 `min(from)`·`max(to)` 하나로 뭉쳐서, 불연속한
 * `stageCodes` 조합(예: 신생아 + 네 살)의 **사이 빈 구간까지** 덮은 것으로 셌다.
 */
function mergeRanges(ranges: MonthRange[]): MonthRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: MonthRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
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

/**
 * 라운드 74 적대적 리뷰 B-2 — **이 라운드가 들여온 새 어휘 전부**(오늘 하나).
 *
 * 어휘 선택 근거(한 줄): `["toddler_1_3", "kid_4_7"]`을 함께 지는 다섯은 `12-24개월` 칩과
 * `24개월+` 칩 **양쪽에 서므로**, 사전 안의 어떤 닫힌 표기(`"12~24개월"`)도 뒤 칩과, 어떤 늦은
 * 표기(`"24개월 이후"`)도 앞 칩과 어긋난다 — 두 칩을 함께 덮는 열린 표기가 필요했고, 그 표기는
 * 사전이 이미 쓰는 `"N개월 이후"` **꼴을 그대로** 따른다(새 꼴이 아니라 새 숫자 하나다).
 */
const TIMING_LABEL_VOCABULARY_ROUND74_ADDED = ["12개월 이후"];

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

      // 라운드 74 리뷰(제안 채택): 종전에는 min/max로 **하나의 구간**을 만들었다. 그래서
      // `["newborn_0_3", "kid_4_7"]`처럼 **불연속한** 스테이지 조합에서 그 사이의 빈 구간까지
      // "덮은 것"으로 세었다. 이제 실제 구간들의 **합집합**을 쓰고, 라벨은 그 조각 하나 안에
      // 들어와야 한다(오늘 두 방식의 판정이 갈리는 품목은 0건이다 — 그래서 지금 고쳐 둔다).
      const covered = mergeRanges(bornStages.map((stage) => notation.get(stage) as MonthRange));

      // 열린 라벨(`"N개월 이후"`)은 **끝을 말하지 않는다** — 말하지 않은 끝은 검사할 수 없다.
      // 그 라벨이 주장하는 것은 시작 하나이고, 오른쪽의 과잉 주장은 아래 대칭 절이 다시 문다
      // (스테이지 하나하나가 라벨과 겹쳐야 하므로, 라벨이 스테이지 전체를 앞질러 갈 수 없다).
      const withinSegment = covered.some((segment) =>
        Number.isFinite(labelRange.to)
          ? labelRange.from >= segment.from && labelRange.to <= segment.to
          : labelRange.from >= segment.from && labelRange.from < segment.to
      );

      expect(
        withinSegment,
        `${item.code}: "${item.timingLabel}" = [${labelRange.from}, ${labelRange.to}] ` +
          `is outside the months its stageCodes cover ` +
          `[${covered.map((segment) => `${segment.from}, ${segment.to}`).join("] [")}] (${item.stageCodes.join(", ")})`
      ).toBe(true);
      judged += 1;
    }

    // 정규식이 조용히 아무것도 못 잡는 no-op이 되지 않게(오늘 실측 27건).
    expect(judged).toBeGreaterThanOrEqual(20);
  });

  /**
   * 라운드 74 적대적 리뷰 B-2 — **겹침은 대칭이다: 앞뒤 양방향으로 본다.**
   *
   * 위 절은 한 방향만 봤다(라벨이 스테이지가 덮는 구간 **안에** 있는가). 그래서 트랙 B가
   * `"24개월 이후"` 다섯을 `"12~24개월"`로 내리면서 그 다섯이 지고 있던 `kid_4_7`
   * (47~95개월)을 **라벨이 한 달도 말하지 않게** 만들었는데 초록으로 통과했다. 그 다섯은
   * `24개월+` 칩에도 서므로, 네 살 아이의 부모가 그 칩에서 열어 본 상세가 "준비 시기:
   * 12~24개월"이라고 말하는 자리가 그대로 남아 있었던 것이다 — 트랙 B가 고치겠다고 한 바로
   * 그 모양(목록과 상세가 서로 다른 나이를 말한다)이 방향만 뒤집힌 채였다.
   *
   * 그래서 반대 방향을 함께 문다: **품목이 지는 스테이지 하나하나가 라벨과 겹쳐야 한다.**
   * `toddler_1_3`이 `12-24개월`·`24개월+` 두 칩에 함께 들어가는 **의도된 중복**은 이 형태에서
   * 자연히 면제된다(그 스테이지 자신이 라벨과 겹치기 때문이다 — 면제를 따로 적을 필요가 없다).
   */
  it("품목이 지는 스테이지 하나하나가 timingLabel과 겹친다 (뒤 방향 · 대칭 겹침 계약)", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const notation = stageNotationRanges();
    let judged = 0;

    for (const item of itemTemplateSeeds) {
      const labelRange = parseTimingLabelMonths(item.timingLabel);
      if (!labelRange) continue;

      for (const code of item.stageCodes) {
        const stageRange = notation.get(code as ChildStageCode);
        if (!stageRange) continue; // 임신 시기 스테이지는 개월 표기의 판정 대상이 아니다.
        judged += 1;
        expect(
          overlaps(labelRange, stageRange),
          `${item.code}: "${item.timingLabel}" = [${labelRange.from}, ${labelRange.to}]이 ` +
            `${code} = [${stageRange.from}, ${stageRange.to}]와 한 달도 겹치지 않는다 — ` +
            `그 시기의 목록에 서면서 상세는 다른 나이를 말한다`
        ).toBe(true);
      }
    }

    // no-op 방지(오늘 실측 39쌍).
    expect(judged).toBeGreaterThanOrEqual(30);
  });

  /**
   * 같은 계약을 **칩 밴드** 쪽에서 한 번 더 본다. 사용자가 실제로 보는 단위는 스테이지가 아니라
   * 칩이고, 칩은 스테이지 집합이라(`STAGE_BAND_STAGES`) 위 절과 같은 사실을 다른 낱말로 묻는다:
   * 라벨은 그 품목이 서는 칩 중 **적어도 하나**의 개월과 겹쳐야 하고, 그 칩이 라벨을 담는다.
   */
  it("timingLabel이 자기가 서는 칩 밴드 중 하나와는 반드시 겹친다 (앞 방향)", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    let judged = 0;

    for (const item of itemTemplateSeeds) {
      const labelRange = parseTimingLabelMonths(item.timingLabel);
      if (!labelRange) continue;

      const standingBands = [...STAGE_BAND_LABELS].filter((band) =>
        item.stageCodes.some((code) => STAGE_BAND_STAGES[band].includes(code as ChildStageCode))
      );
      expect(standingBands.length, `${item.code}: 어느 칩에도 서지 않는다`).toBeGreaterThan(0);
      judged += 1;
      expect(
        standingBands.some((band) => overlaps(labelRange, parseBandLabelMonths(band))),
        `${item.code}: "${item.timingLabel}"이 자기가 서는 칩(${standingBands.join("·")}) 어느 것과도 겹치지 않는다`
      ).toBe(true);
    }

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

    // no-op 방지: 오늘은 칩 이름을 그대로 말하는 라벨에서 네 쌍이 실제로 판정된다
    // (`"12~24개월"` 둘 × 이른 칩 둘). 라벨과 칩의 표기가 함께 어긋나면 이 수가 먼저 0이 된다.
    //
    // 라운드 74 리뷰 B-2: 종전 값은 열넷이었다 — `kid_4_7`까지 지면서 `"12~24개월"`이라고 적던
    // 다섯이 `"12개월 이후"`로 정정되며 이 절의 판정 대상에서 빠졌다(그 다섯은 이제 칩 이름을
    // 그대로 말하지 않는다). 그 다섯을 무는 것은 위의 **대칭 겹침** 절이다.
    expect(judgedPairs).toBeGreaterThanOrEqual(4);
  });

  it("정정한 라벨이 라벨 사전 안에 있다 (새 어휘는 값으로 적힌 하나뿐)", async () => {
    const { itemTemplateSeeds } = await loadSeedData();
    const vocabulary = [...TIMING_LABEL_VOCABULARY_ROUND73, ...TIMING_LABEL_VOCABULARY_ROUND74_ADDED];

    for (const item of itemTemplateSeeds) {
      expect(
        vocabulary,
        `${item.code}: "${item.timingLabel}"은 라벨 사전에 없는 새 어휘다`
      ).toContain(item.timingLabel);
    }
    // 새 어휘는 **최소**여야 한다: 늘어나는 순간 이 줄이 먼저 빨개지고, 늘린 사람이 위 주석에
    // 근거 한 줄을 적게 된다(사전을 조용히 넓히는 길을 막는다).
    expect(TIMING_LABEL_VOCABULARY_ROUND74_ADDED).toHaveLength(1);
    for (const added of TIMING_LABEL_VOCABULARY_ROUND74_ADDED) {
      expect(TIMING_LABEL_VOCABULARY_ROUND73, `${added}는 이미 사전에 있다`).not.toContain(added);
      // 새 어휘도 사전이 이미 쓰는 **꼴**을 따른다(새 문법이 아니라 새 숫자 하나다).
      expect(added).toMatch(/^\d+개월 이후$/);
      expect(itemTemplateSeeds.some((item) => item.timingLabel === added), `${added}가 쓰이지 않는다`).toBe(true);
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
