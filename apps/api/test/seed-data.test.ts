import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calculateRecommendationScore,
  type ChildStageCode,
  type ItemStatus,
  type NecessityLevel
} from "@wooriai/domain";
import { STAGE_BAND_LABELS, STAGE_BAND_STAGES } from "../src/items-commerce/stage-bands";
// 라운드 82 리뷰 L-9: 순서는 **화면이 부르는 그 랭커**가 낸다(테스트가 두 번째 사본을 만들지 않는다).
import { rankItemsForTab } from "../src/onboarding/item-ranking";
import {
  mergeRanges,
  overlaps,
  parseBandLabelMonths,
  parseTimingLabelMonths,
  stageNotationRanges,
  type MonthRange
} from "../src/onboarding/timing-label-range";

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

/**
 * 라운드 82 트랙 B — **이름으로 적은 예외 목록을 측정 대장 + 래칫으로 바꾼다.**
 *
 * 종전(라운드 81까지)의 모양: 아래 `LEGACY_…` 일곱 이름이 "링크 ≥1" 규칙에서 면제됐다.
 * 그 목록이 진 세 가지 문제 —
 *
 *  1. **실측과 어긋났다.** 일곱 중 셋(`car_seat`·`baby_bath`·`stroller`)은 이미 링크가 있었다.
 *     목록은 "링크가 없는 품목"이 아니라 "언젠가 링크가 없던 품목의 이름"이었다.
 *  2. **래칫이 없었다.** 새 품목이 링크 없이 들어와도 목록에 이름 한 줄만 더하면 초록이었다.
 *  3. ⚠️ **그래서 실제 공백이 보이지 않았다.** 링크 0건 넷 중 둘(`pregnancy_vitamin`·
 *     `diaper_stock`)이 `essential`이고, 도메인 점수(`packages/domain/src/recommendation.ts`)로
 *     재면 자기 시기 "지금 필요" 목록의 **머리**에 선다 — 홈의 추천 카드 첫 줄이 곧 그것이다.
 *     핵심 루프 4단계(구매 링크 클릭)가 임신 초기·중기의 1순위에서 시작되지 않았는데
 *     이 파일은 초록이었고, 그 초록의 이유가 **그 품목의 이름이 여기 적혀 있어서**였다.
 *
 * 새 모양은 **대장**이다: 키가 링크 0건 품목의 집합이고, 값이 그 이유다.
 * 세 계약이 이 대장을 문다(라운드 73 E의 두 방향 계약 · 라운드 78 E → 80 E의 슬라이스 가드
 * 래칫과 같은 규율) — ① 대장의 키 집합 = **실측한** 링크 0건 집합(어느 방향으로 어긋나도
 * 빨개진다), ② 각 항목에 빈 문자열이 아닌 이유, ③ 대장의 크기는 오늘 값을 **넘을 수 없다**.
 *
 * ⚠️ 오늘 이 대장은 **비어 있다**(래칫 0). 지워서 빈 것이 아니라 **재서** 빈 것이다 —
 * 트랙 B가 링크 0건 넷에 일반 링크(비제휴·비스폰서) 넷을 더했고, 그래서 62개 품목이
 * 전부 링크를 갖는다. 다시 하나라도 비면 ①이 "대장에 없는 링크 0건 품목"으로 먼저 빨개지고,
 * 그것을 대장에 적어 면제하려 하면 ③이 그 다음에 빨개진다.
 */
const ITEM_CODES_WITHOUT_PRODUCT_LINK: Record<string, string> = {};

/**
 * 래칫 상한 — **오늘 실측값**이다. 늘리는 변경은 이 숫자를 고치는 손이 함께 있어야 하고,
 * 그 손은 왜 그 품목이 구매 경로 없이 목록에 서는지를 위 대장에 값으로 적게 된다.
 */
const ITEM_CODES_WITHOUT_PRODUCT_LINK_MAX = 0;

/**
 * 라운드 81까지 이름으로 면제되던 일곱. **지우지 않는다** — 이 이름들이 사라지면 다음 라운드가
 * 같은 넷을 "새 결함"으로 다시 줍고, 면제가 있었다는 사실도 함께 없어진다. 이제 이 목록이 지는
 * 계약은 면제가 아니라 그 반대다: **일곱이 전부 링크를 갖는다**(= 예외 목록의 은퇴 증서).
 */
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
 * 라운드 74 트랙 B — `timingLabel`을 읽는 첫 계약. **라운드 76 트랙 E: 판정을 모듈로 옮겼다.**
 *
 * 왜 필요했나: 상세 화면은 `timingLabel`을 **사실 줄로 승격**해 그대로 읽어 주고
 * (apps/mobile/app/items/[itemTemplateId].tsx의 "준비 시기"), 목록은 그 값을 보지 않고
 * `stageCodes`로만 고른다(밴드 표 — apps/api/src/items-commerce/stage-bands.ts).
 * 두 값을 잇는 단언이 하나도 없어서, 열 건이 화면 둘에서 **서로 다른 나이**를 말하고 있었다
 * (생후 8개월 부모가 "6-12개월" 목록에서 연 안전문의 상세가 "12~24개월"이라고 적혀 있었다).
 *
 * ⚠️ 개월 수를 이 파일에 손으로 다시 적지 않는다. 스테이지의 개월 경계는 `packages/domain`의
 * `calculateChildStage`를 **나이로 훑어** 파생시키고(`stageNotationRanges`), 밴드의 개월
 * 경계는 밴드 라벨 네 문자열 자신에서 파싱한다. 도메인이 경계를 옮기면 이 계약이 따라 옮긴다.
 *
 * ⚠️ 라운드 76 트랙 E: 이 판정들은 **테스트 파일 안에만 살아서 시드만 물었다** — 어드민 CMS가
 * 넣는 `timingLabel`은 어떤 대조도 지나지 않았다. 그래서 `../src/onboarding/timing-label-range`로
 * **로직 그대로** 옮기고 여기서는 import한다(아래 단언은 한 줄도 바뀌지 않았다 — 계약이
 * 약해지지 않았다는 증거다). 이제 저장 경로(items-catalog.service)와 검토 경로
 * (admin/content-revisions.service)가 같은 판정을 지난다.
 */

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

  it("링크 0건 대장이 실측과 두 방향으로 일치하고, 크기가 오늘 값을 넘지 않는다", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    const measured = itemTemplateSeeds
      .filter((item) => !linkedCodes.has(item.code))
      .map((item) => item.code)
      .sort();
    const ledger = Object.keys(ITEM_CODES_WITHOUT_PRODUCT_LINK).sort();

    // 방향 1 — 대장에 없는데 실제로 링크가 0건인 품목(공백이 조용히 들어온 경우).
    expect(
      measured.filter((code) => !(code in ITEM_CODES_WITHOUT_PRODUCT_LINK)),
      "링크가 0건인데 대장에 없다 — 이유를 값으로 적거나 링크를 더할 것"
    ).toEqual([]);
    // 방향 2 — 대장에 적혀 있는데 이미 링크가 있는 품목(라운드 81까지 셋이 이 상태였다).
    expect(
      ledger.filter((code) => linkedCodes.has(code)),
      "대장에 적혀 있는데 이미 링크가 있다 — 낡은 면제는 지울 것"
    ).toEqual([]);
    // 대장의 키는 실재하는 품목 코드여야 한다(오타 하나가 면제를 통째로 무력화하지 않게).
    const itemCodes = new Set(itemTemplateSeeds.map((item) => item.code));
    expect(ledger.filter((code) => !itemCodes.has(code)), "대장에 없는 품목 코드가 있다").toEqual([]);
    expect(ledger).toEqual(measured);

    // 각 항목에 빈 문자열이 아닌 이유.
    for (const [code, reason] of Object.entries(ITEM_CODES_WITHOUT_PRODUCT_LINK)) {
      expect(reason.trim().length, `${code}: 대장의 이유가 비어 있다`).toBeGreaterThan(0);
    }

    // 래칫 — 늘 수 없다.
    expect(ledger.length).toBeLessThanOrEqual(ITEM_CODES_WITHOUT_PRODUCT_LINK_MAX);
  });

  it("이름으로 면제되던 일곱이 전부 링크를 갖는다 (예외 목록의 은퇴)", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    const itemCodes = new Set(itemTemplateSeeds.map((item) => item.code));

    // no-op 방지: 일곱이 전부 실재하는 품목이어야 이 절이 무언가를 문다.
    expect(LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT).toHaveLength(7);
    for (const code of LEGACY_ITEM_CODES_WITHOUT_LINK_REQUIREMENT) {
      expect(itemCodes.has(code), `${code}가 카탈로그에 없다`).toBe(true);
      expect(linkedCodes.has(code), `${code}는 더 이상 면제 대상이 아니다 — 링크가 있어야 한다`).toBe(true);
    }
  });

  /**
   * 라운드 82 트랙 B ⓒ — **이 앱이 스스로 "필수"라고 부르는 등급에는 구매 경로가 있다.**
   *
   * 필수도는 카탈로그가 사용자에게 "이건 꼭 준비하세요"라고 말하는 등급이다. 그 등급에
   * 판매처 행이 하나도 없으면 화면은 정직하게 "아직 등록된 구매처가 없어요"라고 말하고
   * (apps/mobile/src/items/link-marker.ts) 사용자가 이 앱에 온 이유의 절반이 거기서 끝난다.
   * ⚠️ 이 단언은 라운드 82 이전 시드에서 **둘**(`pregnancy_vitamin`·`diaper_stock`)로 빨갰다.
   */
  it("essential 품목은 예외 없이 링크 ≥1", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    const essentials = itemTemplateSeeds.filter((item) => item.necessityLevel === "essential");

    expect(essentials.length, "essential 품목이 없으면 이 절은 아무것도 묻지 않는다").toBeGreaterThan(0);
    for (const item of essentials) {
      expect(
        linkedCodes.has(item.code),
        `${item.code}는 essential인데 구매 링크가 0건이다 (예외 없음)`
      ).toBe(true);
    }
  });

  /**
   * 라운드 82 트랙 B ⓓ — **"지금 필요"의 머리에 서는 품목이 링크 0건이면 빨개진다.**
   *
   * ⚠️ 여기서 순위를 새로 매기지 않는다. 순서는 **화면이 부르는 그 함수**(`rankItemsForTab` →
   * 도메인 `sortRecommendedItems`)를 불러서 나오고, 점수도 도메인
   * (`packages/domain/src/recommendation.ts`)의 `calculateRecommendationScore`가 낸다. 이 파일에는
   * 정찰이 잰 수치가 한 자리도 적히지 않는다(두 번째 채점기를 만드는 순간 두 순서가 갈린다).
   * 링크 유무는 **점수에 들어가지 않는다** — 그것은 DNC-009의 인접 영역이고, 이 절은 점수를
   * 읽기만 한다.
   *
   * ⚠️ **라운드 82 리뷰 L-9 정정 — 후보 집합을 손으로 좁히지 않는다.** 종전 이 절은 후보를
   * `stageCodes.includes(stageCode)`로 **미리 걸러서** 넘겼다. 그러면 `stageMatches`가 전원 참인
   * 상수가 되어 점수의 축 셋 중 하나가 접히고, 최고점 무리는 정의상 "그 시기의 `essential` 전부"가
   * 된다 — 바로 위 *"essential 품목은 예외 없이 링크 ≥1"* 이 이미 단언한 집합이라 **항진명제**였다.
   * 게다가 그 필터는 화면의 후보 집합을 **테스트가 다시 구현한 두 번째 사본**이기도 했다.
   * 이제 `itemsForChild`가 하는 것과 **똑같이** 활성 카탈로그 전체를 `rankItemsForTab`에 넘기고,
   * 탭 술어(`now`)와 `stageMatches` 계산은 그 모듈이 한다.
   *
   * 그리고 축이 **실제로 갈리는 창**을 함께 문다: 시기 밴드(ITEM-121 `stageBand`)로 다음 시기를
   * 미리 보는 화면에서는 후보에 "지금 시기가 아닌" 항목이 섞이므로 `stageMatches`가 참·거짓으로
   * 나뉜다. 그 창에서 이 절이 새로 묻는 것이 있다 — **머리에 서는 것은 언제나 시기가 맞는
   * 항목이다**(시기 일치 35점이 필수도 한 칸 10점보다 크다는 계약의 화면판). 점수에서
   * `stageMatches`가 빠지거나 후보 집합이 밴드로 잘못 좁혀지면 이 단언이 빨개진다.
   *
   * 왜 "1위 하나"가 아니라 **동점 무리 전부**인가: 도메인의 동점 파괴자는 `id.localeCompare`이고
   * 그 `id`는 DB가 만드는 UUID다(시드에는 없다). 시드에서 1위를 하나로 못 박으면 그것은 실제
   * 화면의 1위가 아니라 코드 문자열이 정한 가짜 1위가 된다. 그래서 최고점 무리를 통째로 문다 —
   * 실제 1위는 반드시 그 안에 있다.
   *
   * 상태는 `not_prepared`(모든 항목의 기본값 · 온보딩 직후 홈이 보는 상태)로 고정한다.
   */
  it("각 시기 '지금 필요' 최고점 무리에 링크 0건 품목이 없다 (화면의 랭커 파생)", async () => {
    const { itemTemplateSeeds, productLinkSeeds } = await loadSeedData();

    const linkedCodes = new Set(productLinkSeeds.map((link) => link.itemTemplateCode));
    // `itemsForChild`가 넘기는 것과 같은 모양 — **활성 카탈로그 전체**다(코드를 id 자리에 쓰는 것만
    // 다르다: 시드에는 UUID가 없고, 동점 파괴자는 아래에서 무리 전체를 무는 것으로 우회한다).
    const catalog = itemTemplateSeeds
      .filter((item) => item.active)
      .map((item, index) => ({
        id: item.code,
        stageCodes: item.stageCodes as ChildStageCode[],
        necessityLevel: item.necessityLevel as NecessityLevel,
        status: "not_prepared" as ItemStatus,
        displayOrder: index
      }));
    expect(catalog.length, "활성 준비템이 없으면 이 절은 아무것도 묻지 않는다").toBeGreaterThan(0);

    const topTierOf = (ranked: typeof catalog, stageCode: ChildStageCode) => {
      // 점수는 도메인 함수가 낸다 — 랭커가 넘긴 것과 **같은 세 입력**이다(item-ranking.ts).
      const scoreOf = (entry: (typeof catalog)[number]) =>
        calculateRecommendationScore({
          stageMatches: entry.stageCodes.includes(stageCode),
          necessityLevel: entry.necessityLevel,
          status: entry.status
        });
      const topScore = scoreOf(ranked[0]);
      return { topScore, topTier: ranked.filter((entry) => scoreOf(entry) === topScore) };
    };

    let judgedStages = 0;
    let judgedTopItems = 0;
    let bandsWithSplitAxis = 0;

    for (const stageCode of ALL_STAGE_CODES as ChildStageCode[]) {
      // ⓐ 홈의 추천 셋이 곧 이 목록의 앞 셋이다(recommendedItemsForChild → tab="now").
      const now = rankItemsForTab(catalog, { tab: "now", stageCode });
      expect(now.length, `stage ${stageCode}의 "지금 필요"가 비어 있다`).toBeGreaterThan(0);
      // 후보를 손으로 좁히지 않았다는 사실 자체를 고정한다 — 탭 술어가 실제로 걸렀다.
      expect(now.length, `stage ${stageCode}: 탭 술어가 아무것도 거르지 않았다`).toBeLessThan(catalog.length);

      const { topScore, topTier } = topTierOf(now, stageCode);
      judgedStages += 1;
      judgedTopItems += topTier.length;
      for (const entry of topTier) {
        expect(
          linkedCodes.has(entry.id),
          `${stageCode}의 "지금 필요" 머리(${entry.id} · ${topScore}점)가 구매 링크 0건이다 — ` +
            `홈의 추천 카드가 곧 이 목록의 앞 셋이다`
        ).toBe(true);
      }

      // ⓑ 시기 칩으로 다른 밴드를 미리 보는 창 — 여기서 `stageMatches`가 실제로 갈린다.
      for (const stageBand of STAGE_BAND_LABELS) {
        const banded = rankItemsForTab(catalog, { tab: "now", stageCode, stageBand });
        if (banded.length === 0) continue;
        const matching = banded.filter((entry) => entry.stageCodes.includes(stageCode));
        const bandTop = topTierOf(banded, stageCode);

        for (const entry of bandTop.topTier) {
          expect(
            linkedCodes.has(entry.id),
            `${stageCode}/${stageBand} 머리(${entry.id} · ${bandTop.topScore}점)가 구매 링크 0건이다`
          ).toBe(true);
        }

        if (matching.length > 0 && matching.length < banded.length) {
          bandsWithSplitAxis += 1;
          // 축이 살아 있다: 시기가 맞지 않는 항목은 필수도가 무엇이든 머리에 서지 못한다
          // (시기 일치 35 > 필수도 한 칸 10 — 도메인 계약의 화면판).
          for (const entry of bandTop.topTier) {
            expect(
              entry.stageCodes.includes(stageCode),
              `${stageCode}/${stageBand}: 시기가 맞지 않는 ${entry.id}가 머리에 섰다`
            ).toBe(true);
          }
        }
      }
    }

    // no-op 방지: 열 시기가 전부 판정되고, 최고점 무리가 실제로 세어진다.
    expect(judgedStages).toBe(ALL_STAGE_CODES.length);
    expect(judgedTopItems).toBeGreaterThanOrEqual(20);
    // 그리고 `stageMatches`가 **실제로 갈린 창**이 존재한다 — 이것이 없으면 위 ⓑ는 다시 항진명제다.
    expect(bandsWithSplitAxis, "stageMatches가 참·거짓으로 갈린 (시기, 밴드) 조합이 없다").toBeGreaterThan(0);
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
