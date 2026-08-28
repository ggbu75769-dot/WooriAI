import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_ITEM_DIAPER, localProductLinkFixtures } from "../api/local-fixtures";
import {
  AFFILIATE_DISCLOSURE_CORE_TERMS,
  statesAffiliateCommission,
  AFFILIATE_DISCLOSURE_FALLBACK_TEXT,
  AFFILIATE_MARKER_CAPTION,
  AFFILIATE_MARKER_LABEL,
  EMPTY_PRODUCT_LINKS_TEXT,
  FALLBACK_PLATFORM_LABEL,
  GENERAL_MARKER_LABEL,
  hasPurchasableLink,
  primaryPurchaseLinkIndex,
  productLinkMarker,
  productLinksDisclosureText,
  productPlatformLabel,
  purchaseLinkShareMessage,
  SPONSORED_DISCLOSURE_FALLBACK_TEXT,
  SPONSORED_MARKER_CAPTION,
  SPONSORED_MARKER_LABEL,
  withAffiliateDisclosure
} from "./link-marker";
import { theme } from "../theme";

const mobileRoot = process.cwd();
const detailSource = () => readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");
const uiSource = () => readFileSync(join(mobileRoot, "src/ui.tsx"), "utf8");

describe("라운드 43 UX-V (C3): 구매 링크 표기 판정", () => {
  it("일반 링크에는 배지만 남기고 제휴 캡션을 붙이지 않는다", () => {
    const marker = productLinkMarker({ isAffiliate: false, isSponsored: false });

    expect(marker.badgeLabel).toBe(GENERAL_MARKER_LABEL);
    expect(marker.badgeTone).toBe("neutral");
    // 예전 화면은 여기에 "제휴 링크"를 찍었다 -- 배지("일반")와 정면으로 어긋나는 허위 표기.
    expect(marker.caption).toBeUndefined();
  });

  it("제휴 링크는 제휴임을 밝힌다 (DNC-010)", () => {
    const marker = productLinkMarker({ isAffiliate: true, isSponsored: false });

    expect(marker.badgeLabel).toBe(AFFILIATE_MARKER_LABEL);
    expect(marker.badgeTone).toBe("neutral");
    expect(marker.caption).toBe(AFFILIATE_MARKER_CAPTION);
  });

  it("스폰서 링크는 경고 톤 배지 + 광고 고지로 구분한다 (DNC-011)", () => {
    const marker = productLinkMarker({ isAffiliate: true, isSponsored: true });

    expect(marker.badgeLabel).toBe(SPONSORED_MARKER_LABEL);
    expect(marker.badgeTone).toBe("warning");
    expect(marker.caption).toBe(SPONSORED_MARKER_CAPTION);
  });

  it("제휴가 아니어도 스폰서면 광고 표시가 우선한다 (DNC-011)", () => {
    const marker = productLinkMarker({ isAffiliate: false, isSponsored: true });

    expect(marker.badgeLabel).toBe(SPONSORED_MARKER_LABEL);
    expect(marker.caption).toBe(SPONSORED_MARKER_CAPTION);
  });

  it("판매처 보조 문구는 응답의 platform 값에서만 나온다", () => {
    expect(productPlatformLabel("coupang")).toBe("쿠팡");
    expect(productPlatformLabel("naver")).toBe("네이버");
    expect(productPlatformLabel("custom")).toBe("기타");
    // 계약이 늘어나거나 값이 비어도 영문 코드/빈칸을 그대로 노출하지 않는다.
    expect(productPlatformLabel("eleven-street")).toBe(FALLBACK_PLATFORM_LABEL);
    expect(productPlatformLabel(undefined)).toBe(FALLBACK_PLATFORM_LABEL);
    expect(productPlatformLabel("")).toBe(FALLBACK_PLATFORM_LABEL);
  });

  it("배송 조건은 어디서도 주장하지 않는다 (API에 없는 값)", () => {
    for (const platform of ["coupang", "naver", "custom"]) {
      expect(productPlatformLabel(platform)).not.toContain("배송");
    }
    // 기본값 "무료배송"은 ITEM-002 픽셀 락 기준 이미지를 위해 컴포넌트에만 남아 있고,
    // 실제 데이터를 그리는 세션 경로는 넘겨받은 caption을 쓴다.
    expect(uiSource()).toContain("caption = \"무료배송\"");
    // 라운드 52 C-01: 세션 캡션에 가격 확인 시각이 덧붙지만(withLinkPriceCaption), 캡션의
    // **기본 재료는 여전히 플랫폼 라벨**이고 비세션 경로는 undefined 그대로다.
    expect(detailSource()).toContain(
      "caption={hasSession ? withLinkPriceCaption(productPlatformLabel(link.platform), linkPrice) : undefined}"
    );
  });

  it("화면이 배지·캡션을 직접 3분기하지 않고 모듈 판정을 쓴다", () => {
    const detail = detailSource();

    expect(detail).toContain("const linkMarker = productLinkMarker(link);");
    expect(detail).toContain("<StatusBadge label={linkMarker.badgeLabel} tone={linkMarker.badgeTone} />");
    // 예전 배선(캡션을 스폰서 여부로만 갈라 일반 링크까지 "제휴 링크"로 적던 삼항)은 없어야 한다.
    expect(detail).not.toContain('link.isSponsored ? "광고/스폰서" : "제휴 링크"');
    expect(detail).not.toContain("function marker(link: ProductLink)");
  });
});

describe("라운드 43 UX-V (C2): 구매처가 없는 준비템", () => {
  it("링크 유무 판정은 한 함수가 한다", () => {
    expect(hasPurchasableLink([])).toBe(false);
    expect(hasPurchasableLink(undefined)).toBe(false);
    expect(hasPurchasableLink(null)).toBe(false);
    expect(hasPurchasableLink([{ id: "a" }])).toBe(true);
  });

  it("문구는 해요체 한 줄이다 (DNC-018)", () => {
    expect(EMPTY_PRODUCT_LINKS_TEXT).toBe("아직 등록된 구매처가 없어요.");
    expect(EMPTY_PRODUCT_LINKS_TEXT.split("\n")).toHaveLength(1);
  });

  it("구매 CTA는 열 링크 게이트를, 고지는 고지 대상 게이트를 쓴다", () => {
    const detail = detailSource();

    expect(detail).toContain("const hasProductLinks = hasPurchasableLink(visibleDetail.productLinks);");
    // 판매처 목록 자리(링크 0건이면 안내 한 줄)는 여전히 이 게이트가 정한다.
    expect(detail).toContain("{hasSession && detailTab === \"info\" ? null : hasProductLinks ? (");
    // 리뷰 M-1: 고지는 링크 **집합** 판정이 정한다(아래 M-1 describe 참고).
    expect(detail).toContain(
      "{affiliateDisclosureText ? <AffiliateDisclosure text={affiliateDisclosureText} /> : null}"
    );
    // 죽은 CTA(눌러도 productLinks[0]이 없어 아무 일도 없던 버튼)는 렌더 자체를 막는다.
    // 라운드 64 #1: 그 게이트가 `primaryPurchaseLink`(강조를 받을 링크)로 옮겨졌다 — 링크
    // 0건은 그 값이 undefined라 종전과 같은 결과이고, 전부 스폰서인 경우가 함께 닫힌다.
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    const ctaGateIndex = detail.lastIndexOf("{primaryPurchaseLink ? (", ctaIndex);
    expect(ctaIndex).toBeGreaterThan(-1);
    expect(ctaGateIndex).toBeGreaterThan(-1);
    expect(detail.slice(ctaGateIndex, ctaIndex)).not.toContain(") : null}");
  });

  it("링크가 없으면 그 자리에 안내 한 줄만 남는다", () => {
    expect(detailSource()).toContain("<Text style={{ color: theme.colors.gray600, fontSize: 13, lineHeight: 20 }}>{EMPTY_PRODUCT_LINKS_TEXT}</Text>");
  });

  it("DNC-010: 고지 → 구매 CTA 인접 순서는 그대로다", () => {
    const detail = detailSource();
    const disclosureIndex = detail.indexOf("<AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');

    expect(disclosureIndex).toBeGreaterThan(-1);
    expect(ctaIndex).toBeGreaterThan(disclosureIndex);
  });
});

describe("라운드 43 리뷰 M-1: 고지는 링크 집합이 정한다", () => {
  const general = { isAffiliate: false, isSponsored: false } as const;
  const affiliate = { isAffiliate: true, isSponsored: false, disclosureText: "제휴 문구예요." } as const;
  const sponsored = { isAffiliate: true, isSponsored: true, disclosureText: "스폰서 문구예요." } as const;

  it("일반 링크뿐이면 고지를 그리지 않는다 (허위 수수료 고지 제거)", () => {
    // 예전에는 productLinks[0].disclosureText가 없다는 이유로 컴포넌트 기본 문구
    // "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."가 그려졌다 -- 받지 않는 돈을
    // 받는다고 말하는 화면이었다(시드 링크 58개 중 34개가 일반 링크).
    expect(productLinksDisclosureText([general, general, general])).toBeUndefined();
  });

  it("고지 대상이 없다는 판정은 링크 0개와 같은 근거다 (DNC-010 은닉 아님)", () => {
    expect(productLinksDisclosureText([])).toBeUndefined();
    expect(productLinksDisclosureText(undefined)).toBeUndefined();
    expect(productLinksDisclosureText(null)).toBeUndefined();
  });

  it("제휴가 하나라도 있으면 제휴 고지를 그린다 (DNC-010)", () => {
    // N-2: 운영 커스텀 문구를 쓰되 수수료 문장은 반드시 남는다.
    expect(productLinksDisclosureText([general, affiliate, general])).toBe(
      `제휴 문구예요. ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`
    );
  });

  it("스폰서가 섞이면 스폰서 문구가 앞서되 수수료 고지를 지우지 않는다 (DNC-011 + DNC-010)", () => {
    expect(productLinksDisclosureText([affiliate, sponsored, general])).toBe(
      `스폰서 문구예요. ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`
    );
  });

  it("문구가 비어 있으면 종별 기본 문구로 떨어진다", () => {
    expect(productLinksDisclosureText([{ isAffiliate: true, isSponsored: false }])).toBe(
      AFFILIATE_DISCLOSURE_FALLBACK_TEXT
    );
    expect(productLinksDisclosureText([{ isAffiliate: false, isSponsored: true, disclosureText: "  " }])).toBe(
      SPONSORED_DISCLOSURE_FALLBACK_TEXT
    );
    // DNC-010의 고정 문구와 DNC-018 해요체를 지킨다. 스폰서 기본값은 광고 사실을 먼저 밝히고
    // 같은 수수료 문장을 그대로 잇는다.
    expect(AFFILIATE_DISCLOSURE_FALLBACK_TEXT).toBe("이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.");
    expect(SPONSORED_DISCLOSURE_FALLBACK_TEXT).toContain(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
    expect(SPONSORED_DISCLOSURE_FALLBACK_TEXT).toContain("광고");
    for (const text of [AFFILIATE_DISCLOSURE_FALLBACK_TEXT, SPONSORED_DISCLOSURE_FALLBACK_TEXT]) {
      expect(text).toContain("어요");
      expect(text.split("\n")).toHaveLength(1);
    }
  });

  it("M-2: 정렬 순서(index 0)에 기대지 않는다 — 헬스 정렬이 문구를 바꾸지 않는다", () => {
    // UX-W의 깨진 링크 후순위 정렬이 순서를 어떻게 바꾸든 같은 집합이면 같은 문구가 나온다.
    const set = [affiliate, sponsored, general];
    const reordered = [...set].reverse();
    const rotated = [set[2], set[0], set[1]];

    expect(productLinksDisclosureText(reordered)).toBe(productLinksDisclosureText(set));
    expect(productLinksDisclosureText(rotated)).toBe(productLinksDisclosureText(set));
    // 일반 링크가 맨 앞으로 와도 제휴 고지는 사라지지 않는다(예전 배선의 정반대 실패).
    expect(productLinksDisclosureText([general, affiliate])).toContain(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
  });

  it("M-2: 스폰서 문구가 뜨는 화면에서도 제휴 링크 행은 제휴 사실을 남긴다 (DNC-010)", () => {
    const links = [affiliate, sponsored];
    expect(productLinksDisclosureText(links)).toContain("스폰서 문구예요.");

    const markers = links.map((link) => productLinkMarker(link));
    expect(markers[0].badgeLabel).toBe(AFFILIATE_MARKER_LABEL);
    expect(markers[0].caption).toBe(AFFILIATE_MARKER_CAPTION);
    expect(markers[1].badgeLabel).toBe(SPONSORED_MARKER_LABEL);
    expect(markers[1].caption).toBe(SPONSORED_MARKER_CAPTION);
  });

  it("화면은 집합 판정을 쓰고, 컴포넌트는 더 이상 기본 문구를 만들지 않는다", () => {
    const detail = detailSource();
    const ui = uiSource();

    expect(detail).toContain("const affiliateDisclosureText = productLinksDisclosureText(visibleDetail.productLinks);");
    // 예전 배선(맨 앞 링크의 문구 + 컴포넌트 내부 기본값)은 둘 다 없어야 한다.
    expect(detail).not.toContain("text={visibleDetail.productLinks[0]?.disclosureText}");
    expect(ui).toContain("export function AffiliateDisclosure({ text }: { text: string })");
    expect(ui).not.toContain('text ?? "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."');
  });

  /**
   * 라운드 44 리뷰 N-7: 예전 제목은 "(픽셀 락 불변)"이었는데, 이 테스트가 못박는 것은
   * 불변이 **아니다** -- 프리뷰 고지 문구는 실제로 정정됐고(스펙 메모 → 실사용 문구),
   * ITEM-002 기준 이미지는 그 문구 자리에서 재캡처가 필요하다. 제목을 사실대로 고친다.
   */
  it("ITEM-002 프리뷰 고지 문구는 정정된 실사용 문구다 (기준 이미지 재캡처 대상)", () => {
    const detail = detailSource();
    const preview = detail.slice(detail.indexOf("function previewDetail("), detail.indexOf("export default function"));

    expect(preview).toContain("isSponsored: true");
    expect(preview).toContain("isAffiliate: true");
    // 스폰서가 있으므로 프리뷰에 실제로 그려지는 문장이다 -- 해요체 + 광고/수수료 고지를 함께.
    expect(preview).toContain("스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.");
    expect(preview).not.toContain("광고/제휴 고지를 표시합니다");
  });
});

/**
 * 라운드 44 리뷰 N-2: 스폰서 우선 규칙이 **수수료 고지를 대체**하던 자리.
 *
 * 종전에는 스폰서 링크에 disclosureText만 있으면 그 문장 하나로 끝났다. 그래서 제휴가 섞인
 * 집합(= 실제로 수수료를 받는 화면)에서 CTA 인접 수수료 고지가 통째로 사라졌다. 어드민이
 * 넣은 커스텀 문구도, 서버 시드의 기본값("스폰서 상품 예시예요.", seed-data.ts:1225)도
 * 수수료를 말하지 않으므로 둘 다 실재하는 경로다(DNC-010 위반).
 */
describe("라운드 44 리뷰 N-2: 제휴가 섞이면 수수료 고지가 항상 남는다", () => {
  const general = { isAffiliate: false, isSponsored: false } as const;
  const affiliate = { isAffiliate: true, isSponsored: false } as const;

  /** 조합 전수: [스폰서 문구, 그 문구가 수수료를 말하는가] */
  const sponsoredTexts: Array<[string | null, boolean]> = [
    ["스폰서 광고예요.", false], // 어드민 커스텀(수수료 언급 없음)
    ["스폰서 상품 예시예요.", false], // 서버 시드 기본값
    ["Sponsored listing.", false], // 서버 시드가 영문으로 남은 경우
    ["스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.", true],
    ["스폰서예요. 구매 시 수수료가 발생할 수 있어요.", true], // 다른 표현이지만 이미 고지함
    [null, true] // 문구 없음 → 종별 기본값(수수료 문장 포함)
  ];

  it("스폰서 문구가 무엇이든 제휴가 있으면 수수료 문장이 포함된다", () => {
    for (const [text, alreadyDiscloses] of sponsoredTexts) {
      const sponsored = { isAffiliate: false, isSponsored: true, disclosureText: text };
      const result = productLinksDisclosureText([sponsored, affiliate, general]);

      expect(result).toBeDefined();
      expect(statesAffiliateCommission(result!)).toBe(true);
      if (!alreadyDiscloses) {
        // 스폰서 사실도 지우지 않는다 -- 두 고지가 함께 남는다(DNC-011 + DNC-010).
        expect(result).toContain(text!);
        expect(result).toContain(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
      }
      // 같은 말을 두 번 적지 않는다.
      expect(result!.split(AFFILIATE_DISCLOSURE_FALLBACK_TEXT).length - 1).toBeLessThanOrEqual(1);
    }
  });

  it("스폰서 링크 자신이 제휴인 경우도 같은 규칙을 받는다", () => {
    const sponsoredAffiliate = { isAffiliate: true, isSponsored: true, disclosureText: "스폰서 상품 예시예요." };
    expect(productLinksDisclosureText([sponsoredAffiliate])).toBe(
      `스폰서 상품 예시예요. ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`
    );
  });

  it("제휴가 없는 스폰서 집합에는 수수료를 덧붙이지 않는다 (받지 않는 돈)", () => {
    const sponsoredOnly = { isAffiliate: false, isSponsored: true, disclosureText: "스폰서 광고예요." };
    expect(productLinksDisclosureText([sponsoredOnly, general])).toBe("스폰서 광고예요.");
  });

  it("제휴 커스텀 문구도 수수료를 말하지 않으면 이어붙인다", () => {
    const custom = { isAffiliate: true, isSponsored: false, disclosureText: "우리아이 제휴 파트너 링크예요" };
    // 종결부호가 없으면 문장 경계를 만들고 잇는다.
    expect(productLinksDisclosureText([custom])).toBe(
      `우리아이 제휴 파트너 링크예요. ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`
    );
    // 이미 수수료를 말하고 있으면(표현이 달라도) 그대로 둔다.
    const seeded = { isAffiliate: true, isSponsored: false, disclosureText: "제휴 링크 예시예요. 구매하시면 수수료가 발생할 수 있어요." };
    expect(productLinksDisclosureText([seeded])).toBe("제휴 링크 예시예요. 구매하시면 수수료가 발생할 수 있어요.");
  });

  it("라운드 45 O-6: '수수료'가 들어 있어도 우리가 받는 돈이 아니면 고지를 덧붙인다", () => {
    // 사용자가 내는 비용을 말하는 문구까지 "이미 고지함"으로 보면, 그 화면의 제휴 고지가
    // 통째로 사라진다(DNC-010). 낱말이 아니라 어절 결합으로 판정한다.
    const costOnly = { isAffiliate: true, isSponsored: false, disclosureText: "배송 수수료는 별도예요." };
    expect(productLinksDisclosureText([costOnly])).toBe(`배송 수수료는 별도예요. ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`);

    expect(statesAffiliateCommission("배송 수수료는 별도예요.")).toBe(false);
    expect(statesAffiliateCommission("카드 수수료 포함 금액이에요.")).toBe(false);
    // 실제로 쓰이는 두 고지(서버 시드 · 데모 픽스처)는 그대로 "이미 고지함"이다.
    expect(statesAffiliateCommission("제휴 링크 예시예요. 구매하시면 수수료가 발생할 수 있어요.")).toBe(true);
    expect(statesAffiliateCommission("이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.")).toBe(true);
    expect(AFFILIATE_DISCLOSURE_CORE_TERMS.length).toBeGreaterThan(1);
  });

  it("withAffiliateDisclosure는 빈 문구를 기본 고지로 떨어뜨린다", () => {
    expect(withAffiliateDisclosure("   ")).toBe(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
    expect(withAffiliateDisclosure(AFFILIATE_DISCLOSURE_FALLBACK_TEXT)).toBe(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
  });
});

/**
 * 라운드 46 리뷰 Q-3: "수수료가 발생" 어절이 **사용자 부담 비용** 문구까지 삼키던 자리.
 *
 * O-6이 "수수료" 한 낱말 판정을 어절 결합으로 좁혔지만, "수수료가 발생"만은 여전히 주체가
 * 비어 있었다. 그래서 운영이 `PUT /admin/disclosures/:key`나 링크 문구로 넣을 수 있는
 * "결제 취소 시 수수료가 발생할 수 있어요" 같은 문장이 "이미 고지함"으로 판정돼, 그 화면의
 * 제휴 고지가 통째로 사라졌다(DNC-010 위반 방향).
 *
 * 이 describe는 두 방향을 함께 못박는다.
 *  - 실재하는 문구(서버 시드 · 데모 픽스처 · 종별 폴백)는 **전부** 인식된다 → 이중 고지 없음.
 *  - 사용자 부담 비용 문구는 인식되지 않는다 → 승인 문구가 덧붙는다.
 */
describe("라운드 46 리뷰 Q-3: 수령 맥락이 있어야 '이미 고지함'이다", () => {
  const repoRoot = join(mobileRoot, "..", "..");
  const apiSeedDataPath = join(repoRoot, "apps", "api", "prisma", "seed-data.ts");
  const seedSource = () => readFileSync(apiSeedDataPath, "utf8");

  /** 서버 시드 파일에서 실제 문구 리터럴을 그대로 긁어온다(손으로 베끼면 드리프트한다). */
  function seedDisclosureTexts(): string[] {
    const source = seedSource();
    const texts = [...source.matchAll(/disclosureText: "([^"]+)"/g)].map((match) => match[1]);
    // 종별 기본값(disclosureSeeds) — 링크가 문구를 비워 두면 서버가 이 값을 실어 준다.
    const seedsStart = source.indexOf("export const disclosureSeeds");
    expect(seedsStart, "disclosureSeeds 블록을 찾지 못했다 — 시드가 옮겨졌다").toBeGreaterThan(-1);
    const seedsBlock = source.slice(seedsStart, source.indexOf("];", seedsStart));
    texts.push(...[...seedsBlock.matchAll(/text: "([^"]+)"/g)].map((match) => match[1]));
    return [...new Set(texts)];
  }

  it("시드 파일에서 실제 고지 문구를 읽어온다 (경로가 바뀌면 여기서 깨진다)", () => {
    expect(existsSync(apiSeedDataPath), `${apiSeedDataPath} must exist`).toBe(true);
    expect(seedDisclosureTexts().length).toBeGreaterThan(2);
  });

  it("수수료를 말하는 서버 시드 문구는 전부 인식된다 (이중 고지 없음)", () => {
    const commissionTexts = seedDisclosureTexts().filter((text) => text.includes("수수료"));
    // 서버 시드에서 "수수료"를 말하는 문구는 전부 **우리가 받는다**는 뜻이다.
    expect(commissionTexts.length).toBeGreaterThan(0);
    for (const text of commissionTexts) {
      expect(statesAffiliateCommission(text), `서버 시드 문구가 인식되지 않는다: ${text}`).toBe(true);
      // 인식되므로 승인 문구가 뒤에 덧붙지 않는다 — 같은 말이 두 번 적히지 않는다.
      expect(withAffiliateDisclosure(text)).toBe(text);
    }
  });

  it("종별 기본 고지(affiliate_purchase)는 한국어 해요체이고 인식된다 (Q-4 연동)", () => {
    const source = seedSource();
    const seedsBlock = source.slice(
      source.indexOf("export const disclosureSeeds"),
      source.indexOf("];", source.indexOf("export const disclosureSeeds"))
    );
    const affiliateSeed = /key: "affiliate_purchase",\s*\n\s*text: "([^"]+)"/.exec(seedsBlock);
    expect(affiliateSeed, "affiliate_purchase 시드를 찾지 못했다").not.toBeNull();

    const text = affiliateSeed![1];
    // 영문으로 두면 이 판정이 "고지 없음"으로 떨어져 영문 + 한국어 이중 고지가 된다(Q-4).
    expect(text).toMatch(/[가-힣]/);
    expect(text).toContain("어요");
    expect(statesAffiliateCommission(text)).toBe(true);

    // 실제 경로 재현: 서버가 이 문구를 실어 준 제휴 링크 하나짜리 화면.
    expect(productLinksDisclosureText([{ isAffiliate: true, isSponsored: false, disclosureText: text }])).toBe(text);
  });

  it("데모 픽스처와 종별 폴백 문구도 전부 인식된다", () => {
    for (const link of localProductLinkFixtures) {
      if (!link.disclosureText?.includes("수수료")) continue;
      expect(statesAffiliateCommission(link.disclosureText), link.disclosureText).toBe(true);
    }
    expect(statesAffiliateCommission(AFFILIATE_DISCLOSURE_FALLBACK_TEXT)).toBe(true);
    expect(statesAffiliateCommission(SPONSORED_DISCLOSURE_FALLBACK_TEXT)).toBe(true);
  });

  it("표현이 달라도 수령 맥락이 붙으면 인식된다 (운영이 쓸 법한 변형 전수)", () => {
    for (const text of [
      "제휴 링크 예시예요. 구매하시면 수수료가 발생할 수 있어요.", // 서버 시드
      "스폰서예요. 구매 시 수수료가 발생할 수 있어요.",
      "이 링크로 구매하면 수수료가 발생해요.",
      "구매하실 때 수수료가 발생할 수 있어요.",
      "이 링크를 통한 구매를 통해 수수료가 발생할 수 있어요.",
      "제휴 수수료가 발생할 수 있어요.",
      "제휴수수료가 발생할 수 있어요.",
      "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.",
      "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요."
    ]) {
      expect(statesAffiliateCommission(text), `인식돼야 한다: ${text}`).toBe(true);
      expect(withAffiliateDisclosure(text)).toBe(text);
    }
  });

  it("사용자가 내는 비용을 말하는 '수수료가 발생'은 인식하지 않는다 → 승인 문구를 덧붙인다", () => {
    for (const text of [
      "결제 취소 시 수수료가 발생할 수 있어요.",
      "해외 결제 수수료가 발생해요.",
      "환불 수수료가 발생할 수 있어요.",
      "배송 수수료는 별도예요."
    ]) {
      expect(statesAffiliateCommission(text), `인식되면 안 된다: ${text}`).toBe(false);
      // 제휴 링크에 이런 문구가 달려 있어도 승인 문구가 반드시 남는다(DNC-010).
      const link = { isAffiliate: true, isSponsored: false, disclosureText: text };
      expect(productLinksDisclosureText([link])).toBe(`${text} ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`);
    }
  });

  it("판정 표현 목록에 맨몸 '수수료가 발생'은 남아 있지 않다", () => {
    // 이 항목이 되살아나면 위 반례들이 다시 삼켜진다.
    expect(AFFILIATE_DISCLOSURE_CORE_TERMS).not.toContain("수수료가 발생");
    for (const term of AFFILIATE_DISCLOSURE_CORE_TERMS) {
      if (!term.includes("수수료가 발생")) continue;
      expect(term.length, `"${term}"에 수령 맥락 어절이 없다`).toBeGreaterThan("수수료가 발생".length);
    }
  });
});

/**
 * 라운드 44 리뷰 N-1: 데모(로컬) 백엔드의 **실픽스처**로 판정을 한 번 통과시킨다.
 *
 * 지금까지 이 파일의 테스트는 전부 손으로 만든 입력이었고, 그래서 데모 기저귀 상세의
 * 스폰서 링크가 개발 스펙 메모("…광고/제휴 고지를 표시합니다.")를 고지 문구로 들고 있는데도
 * 아무 테스트도 걸리지 않았다. 실제로 화면에 들어가는 값으로 확인한다.
 */
describe("라운드 44 리뷰 N-1: 데모 픽스처가 실제로 그리는 고지", () => {
  const diaperLinks = localProductLinkFixtures.filter((link) => link.itemTemplateId === LOCAL_ITEM_DIAPER);

  it("데모 기저귀 상세에는 제휴·스폰서 링크가 함께 있다", () => {
    expect(diaperLinks.length).toBeGreaterThan(1);
    expect(diaperLinks.some((link) => link.isSponsored)).toBe(true);
    expect(diaperLinks.some((link) => link.isAffiliate)).toBe(true);
  });

  it("그 화면의 고지에는 광고 사실과 수수료 문장이 함께 남는다 (DNC-010·DNC-011)", () => {
    const text = productLinksDisclosureText(diaperLinks);

    expect(text).toBeDefined();
    expect(text).toContain("광고");
    expect(statesAffiliateCommission(text!)).toBe(true);
    expect(text).toContain(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
  });

  it("고지 문구는 해요체 한 줄이고 스펙 문장이 아니다 (DNC-018)", () => {
    for (const link of localProductLinkFixtures) {
      if (!link.disclosureText) continue;
      expect(link.disclosureText).toContain("어요");
      // 합쇼체(…합니다/입니다)와 내부 스펙 어휘는 사용자 화면에 나올 문구가 아니다.
      expect(link.disclosureText).not.toMatch(/(합니다|입니다)/);
      expect(link.disclosureText).not.toContain("CTA");
      expect(link.disclosureText.split("\n")).toHaveLength(1);
    }

    const text = productLinksDisclosureText(diaperLinks)!;
    expect(text).toContain("어요");
    expect(text.split("\n")).toHaveLength(1);
  });
});

describe("라운드 43 UX-V (C4): 비교가 아닌 가격 비교", () => {
  // 라운드 52 QA P3-9: 테스트 이름을 실제 검사에 맞춘다. 이 케이스가 확인하는 것은 "가격대를
  // 되풀이하지 않는다"(그건 아래 '가격대 큰 글씨는 카드 상단에 한 번만 남는다'가 진다)가 아니라
  // **가격 칸에 무엇이 들어가는가**의 배선이다 -- 세션 경로는 링크별 스냅샷 가격, 프리뷰 경로는
  // 종전 가격대 문구.
  it("세션 경로의 가격 칸은 링크별 스냅샷 가격으로 채워진다(프리뷰는 종전 가격대 그대로)", () => {
    expect(detailSource()).toContain(
      'price={hasSession ? linkPrice?.priceText ?? "" : visibleDetail.priceBandText ?? ""}'
    );
  });

  /**
   * DSN-053 P2-B: 승인 디자인(ITEM-002)의 "가격 비교 / 제품 정보" 밴드가 돌아왔다. C4가
   * 금지한 것은 밴드가 아니라 **누를 수 없는 것을 탭처럼 그리는 일**이었으므로, 돌아온 밴드는
   * 실제로 눌려서 카드 아래 내용을 바꾼다(구매처 목록 ↔ 제품 정보 줄).
   */
  it("세션 경로의 탭 밴드는 실제로 눌리는 탭이다(죽은 탭 흉내 금지)", () => {
    const detail = detailSource();

    expect(detail).toContain('{ value: "price", label: "가격 비교" }');
    expect(detail).toContain('{ value: "info", label: "제품 정보" }');
    expect(detail).toContain('accessibilityRole="tablist"');
    expect(detail).toContain('accessibilityRole="tab"');
    expect(detail).toContain("accessibilityState={{ selected }}");
    expect(detail).toContain("onPress={() => setDetailTab(tab.value)}");
    // 탭을 옮기면 실제로 렌더가 갈린다 -- 두 갈래가 모두 있어야 탭이 하는 일이 있다.
    expect(detail).toContain('{hasSession && detailTab === "info" ? (');
    expect(detail).toContain('{hasSession && detailTab === "info" ? null : hasProductLinks ? (');

    // 프리뷰(ITEM-002 픽셀 락 캡처) 경로는 상태 없는 정적 밴드 그대로다.
    const sessionBranchIndex = detail.indexOf('{hasSession ? (\n              <View\n                accessibilityRole="tablist"');
    expect(sessionBranchIndex).toBeGreaterThan(-1);
    const previewBranchIndex = detail.indexOf(") : (", sessionBranchIndex);
    expect(detail.lastIndexOf("가격 비교")).toBeGreaterThan(previewBranchIndex);
    expect(detail.lastIndexOf("제품 정보")).toBeGreaterThan(previewBranchIndex);
  });

  it("가격대 큰 글씨는 카드 상단에 한 번만 남는다", () => {
    const detail = detailSource();
    // 상단 표시(fontSize 26)는 그대로, 행 쪽 중복 표시는 사라졌다.
    expect(detail).toContain("{visibleDetail.priceBandText}</Text>");
    expect(detail).not.toContain('price={visibleDetail.priceBandText ?? ""}');
  });
});

describe("채워진 구매 CTA 자리: 첫 비스폰서 링크 (DNC-011)", () => {
  it("스폰서가 없으면 종전대로 첫 줄이 채워진다", () => {
    expect(primaryPurchaseLinkIndex([{ isSponsored: false }, { isSponsored: false }])).toBe(0);
  });

  it("스폰서가 1위로 정렬되면 채움은 그 아래 첫 비스폰서 줄로 내려간다", () => {
    // 예전 규칙(index === 0)이면 광고 자리만 화면에서 가장 강한 버튼을 가졌다.
    expect(primaryPurchaseLinkIndex([{ isSponsored: true }, { isSponsored: false }, { isSponsored: false }])).toBe(1);
    expect(primaryPurchaseLinkIndex([{ isSponsored: true }, { isSponsored: true }, { isSponsored: false }])).toBe(2);
  });

  it("전부 스폰서면 채워진 버튼이 하나도 없다", () => {
    expect(primaryPurchaseLinkIndex([{ isSponsored: true }, { isSponsored: true }])).toBe(-1);
  });

  it("링크가 없거나 목록이 비면 -1이다", () => {
    expect(primaryPurchaseLinkIndex([])).toBe(-1);
    expect(primaryPurchaseLinkIndex(undefined)).toBe(-1);
    expect(primaryPurchaseLinkIndex(null)).toBe(-1);
  });

  it("판매처 채움 버튼은 mainCoral 기본값을 쓴다(흰 15/700 라벨 대비 확보)", () => {
    const ui = uiSource();
    expect(ui).toContain("backgroundColor: disabled ? theme.colors.gray300 : theme.colors.mainCoral");
    // coral[400](#F98060) 위 흰 글씨는 2.54:1로 WCAG AA 소형 텍스트 기준(4.5:1) 미달이었다.
    expect(ui).not.toContain("backgroundColor: theme.colors.coral[400], minWidth: 72");
  });
});

/**
 * 라운드 64 #1 — 이 판정이 **화면에서 가장 강한 버튼에도** 쓰이는가.
 *
 * 라운드 43~63 동안 위 describe는 `primaryPurchaseLinkIndex`의 **값**만 촘촘히 고정했고,
 * "그 값이 실제로 어디에 쓰이는가"는 판매처 행(primaryAction) 한 자리만 봤다. 그 빈칸으로
 * 전폭 "바로 구매하기"가 판정을 지나지 않고 `productLinks[0]`을 그대로 여는 배선이
 * 통과했다 — 같은 화면에서 스폰서 행은 외곽선으로 격하되고, 그 한 줄 아래 가장 큰 버튼이
 * 같은 스폰서 링크를 열었다(DNC-011 우회). 그래서 이 describe는 **배선**을 고정한다.
 */
describe("라운드 64 #1: 전폭 구매 CTA도 같은 판정을 지난다 (DNC-011)", () => {
  it("전폭 CTA가 여는 링크는 판정이 고른 링크다 — productLinks[0]을 직접 열지 않는다", () => {
    const detail = detailSource();

    expect(detail).toContain(
      "const primaryPurchaseLink =\n    filledPurchaseRowIndex >= 0 ? visibleDetail.productLinks[filledPurchaseRowIndex] : undefined;"
    );
    expect(detail).toContain("onPress={() => handleProductLinkPress(primaryPurchaseLink)}");
    // 예전 배선(첫 링크를 그대로 여는 길)은 한 자리도 남아 있지 않아야 한다.
    expect(detail).not.toContain("const firstLink = visibleDetail.productLinks[0];");
    expect(detail).not.toContain("visibleDetail.productLinks[0]");
  });

  it("판매처 행의 채움과 전폭 CTA는 **같은** 판정 하나를 읽는다(두 벌 금지)", () => {
    const detail = detailSource();

    expect(detail).toContain("const filledPurchaseRowIndex = primaryPurchaseLinkIndex(visibleDetail.productLinks);");
    expect(detail).toContain("primaryAction={hasSession && index === filledPurchaseRowIndex}");
    // 화면이 스폰서 여부를 자기 손으로 다시 판정하지 않는다(판정은 순수 모듈 하나뿐이다).
    expect(detail).not.toContain("isSponsored)");
    expect(detail.match(/primaryPurchaseLinkIndex\(/g)).toHaveLength(1);
  });

  it("전부 스폰서면 전폭 CTA가 사라진다 — 죽은 버튼도, 강조된 광고도 만들지 않는다", () => {
    // 판정 쪽: 시드의 그 다섯 품목(유일한 링크가 스폰서)이 여기에 해당한다.
    expect(primaryPurchaseLinkIndex([{ isSponsored: true }])).toBe(-1);
    // 배선 쪽: -1이면 링크가 undefined가 되고, 게이트가 그 값을 그대로 읽는다.
    const links = [{ isSponsored: true }, { isSponsored: true }];
    const index = primaryPurchaseLinkIndex(links);
    expect(index >= 0 ? links[index] : undefined).toBeUndefined();

    const detail = detailSource();
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    expect(detail.lastIndexOf("{primaryPurchaseLink ? (", ctaIndex)).toBeGreaterThan(-1);
  });

  it("구매 경로가 사라지는 것이 아니다 — 그 링크는 판매처 행에 스폰서 표기와 함께 남는다", () => {
    const sponsoredOnly = [{ isAffiliate: false, isSponsored: true }];
    const marker = productLinkMarker(sponsoredOnly[0]);

    expect(marker.badgeLabel).toBe(SPONSORED_MARKER_LABEL);
    expect(marker.caption).toBe(SPONSORED_MARKER_CAPTION);
    // 그 화면의 고지도 그대로 선다(광고 사실을 말하는 자리가 남는다).
    expect(productLinksDisclosureText(sponsoredOnly)).toBe(SPONSORED_DISCLOSURE_FALLBACK_TEXT);
  });

  it("ITEM-002 비세션 프리뷰는 판정이 0이라 렌더가 그대로다(픽셀락 불변)", () => {
    const detail = detailSource();
    const preview = detail.slice(detail.indexOf("function previewDetail("), detail.indexOf("export default function"));
    // 프리뷰 픽스처의 첫 링크는 비스폰서다 -- 판정이 0이므로 전폭 CTA가 종전대로 렌더된다.
    const firstSponsoredIndex = preview.indexOf("isSponsored: true");
    const firstNonSponsoredIndex = preview.indexOf("isSponsored: false");
    expect(firstNonSponsoredIndex).toBeGreaterThan(-1);
    expect(firstNonSponsoredIndex).toBeLessThan(firstSponsoredIndex);
    expect(
      primaryPurchaseLinkIndex([{ isSponsored: false }, { isSponsored: true }, { isSponsored: false }])
    ).toBe(0);
  });
});

/**
 * 라운드 64 #5ⓐ — 앱 밖으로 나가는 구매 링크에는 고지가 함께 나간다(DNC-010).
 */
describe("라운드 64 #5ⓐ: 공유 메시지의 제휴 고지", () => {
  const url = "https://example.test/r/abc123";
  const general = { isAffiliate: false, isSponsored: false } as const;
  const affiliate = { isAffiliate: true, isSponsored: false } as const;
  const sponsored = { isAffiliate: true, isSponsored: true } as const;

  it("제휴 링크는 고지 한 줄 + URL 두 줄로 나간다", () => {
    const message = purchaseLinkShareMessage({ url, link: affiliate });

    expect(message).toBe(`${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}\n${url}`);
    expect(message.split("\n")).toHaveLength(2);
    expect(message.endsWith(url)).toBe(true);
  });

  it("스폰서 링크는 광고 사실을 먼저 밝힌다 (DNC-011)", () => {
    expect(purchaseLinkShareMessage({ url, link: sponsored })).toBe(
      `${SPONSORED_DISCLOSURE_FALLBACK_TEXT}\n${url}`
    );
  });

  it("일반 링크는 종전 그대로 URL 한 줄이다 — 없는 고지를 지어내지 않는다", () => {
    expect(purchaseLinkShareMessage({ url, link: general })).toBe(url);
    expect(purchaseLinkShareMessage({ url, link: general, disclosureText: null })).toBe(url);
    // 빈 문구(공백만)도 고지가 아니다.
    expect(purchaseLinkShareMessage({ url, link: general, disclosureText: "   " })).toBe(url);
  });

  it("클릭 응답이 준 운영 문구가 링크 자신의 값보다 앞선다", () => {
    const message = purchaseLinkShareMessage({
      url,
      link: { ...affiliate, disclosureText: "링크에 적힌 옛 문구예요. 수수료를 받아요." },
      disclosureText: "운영이 편집한 문구예요. 수수료를 받아요."
    });

    expect(message).toContain("운영이 편집한 문구예요.");
    expect(message).not.toContain("옛 문구");
  });

  it("N-2의 수수료 규율이 공유 문구에서도 그대로 돈다 (DNC-010)", () => {
    // 수수료를 말하지 않는 커스텀 문구는 제휴 링크의 수수료 고지를 지우지 못한다.
    const message = purchaseLinkShareMessage({ url, link: affiliate, disclosureText: "우리아이 추천 상품이에요" });

    expect(message).toContain(AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
    expect(message.endsWith(url)).toBe(true);
  });

  it("문구는 화면의 고지와 **같은 판정**에서 나온다(두 벌 금지)", () => {
    // 링크 하나짜리 집합에 대한 화면 판정과 공유 문구의 첫 줄이 글자 그대로 같아야 한다.
    for (const link of [general, affiliate, sponsored]) {
      const screenText = productLinksDisclosureText([link]);
      const message = purchaseLinkShareMessage({ url, link });
      expect(message).toBe(screenText ? `${screenText}\n${url}` : url);
    }
  });

  it("화면은 이 조립기만 쓴다 — Share.share에 URL을 직접 넣지 않는다", () => {
    const detail = detailSource();

    expect(detail).toContain("message: purchaseLinkShareMessage({");
    expect(detail).toContain("url: linkOpenFallback.redirectUrl,");
    expect(detail).toContain("link: linkOpenFallback.link,");
    expect(detail).toContain("disclosureText: linkOpenFallback.disclosureText");
    expect(detail).not.toContain("Share.share({ message: linkOpenFallback.redirectUrl })");
  });
});

/**
 * 라운드 64 #6 — 커머스 상세의 플로팅 크롬 둘(뒤로가기·공유하기)이 저장소 자신의 최소 터치
 * 타깃(theme.touchTarget = 48)을 만족하는가. 레이아웃이 아니라 히트 영역만 본다.
 */
describe("라운드 64 #6: 커머스 크롬의 터치 타깃", () => {
  it("34dp 크롬 + hitSlop 7 = 48dp (theme.touchTarget)", () => {
    const detail = detailSource();

    expect(detail).toContain("height: 34,");
    expect(detail).toContain("const PRODUCT_DETAIL_CHROME_HIT_SLOP = 7;");
    expect(34 + 2 * PRODUCT_DETAIL_CHROME_HIT_SLOP).toBeGreaterThanOrEqual(theme.touchTarget);
    // 두 자리 모두 같은 상수를 쓴다(값을 다시 박지 않는다).
    expect(detail.match(/hitSlop={PRODUCT_DETAIL_CHROME_HIT_SLOP}/g)).toHaveLength(2);
    expect(detail).not.toContain("hitSlop={5}");
  });

  it("렌더는 한 픽셀도 바뀌지 않는다 — 레이아웃 속성은 그대로다 (ITEM-002 픽셀락)", () => {
    const detail = detailSource();
    const chromeStyle = detail.slice(
      detail.indexOf("const productDetailChromeButtonStyle = {"),
      detail.indexOf("const PRODUCT_DETAIL_CHROME_HIT_SLOP")
    );

    // 승인 캡처의 34 정사각·반지름 17이 그대로다(hitSlop은 레이아웃 속성이 아니다).
    expect(chromeStyle).toContain("borderRadius: 17,");
    expect(chromeStyle).toContain("height: 34,");
    expect(chromeStyle).toContain("width: 34");
    expect(chromeStyle).not.toContain("padding");
    expect(chromeStyle).not.toContain("minHeight");
  });
});

/** 크롬 히트 영역 계산에 쓰는 값 — 화면 소스의 상수와 같은 숫자여야 한다(위 테스트가 고정). */
const PRODUCT_DETAIL_CHROME_HIT_SLOP = 7;
