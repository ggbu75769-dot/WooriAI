import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FALLBACK_TEXT,
  AFFILIATE_MARKER_CAPTION,
  AFFILIATE_MARKER_LABEL,
  EMPTY_PRODUCT_LINKS_TEXT,
  FALLBACK_PLATFORM_LABEL,
  GENERAL_MARKER_LABEL,
  hasPurchasableLink,
  linkNeedsDisclosure,
  PRODUCT_LINKS_SECTION_TITLE,
  productLinkMarker,
  productLinksDisclosureText,
  productPlatformLabel,
  SPONSORED_DISCLOSURE_FALLBACK_TEXT,
  SPONSORED_MARKER_CAPTION,
  SPONSORED_MARKER_LABEL
} from "./link-marker";

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
    expect(detailSource()).toContain("caption={hasSession ? productPlatformLabel(link.platform) : undefined}");
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

  it("구매 CTA는 링크 유무 게이트를, 고지는 고지 대상 게이트를 쓴다", () => {
    const detail = detailSource();

    expect(detail).toContain("const hasProductLinks = hasPurchasableLink(visibleDetail.productLinks);");
    // 리뷰 M-1: 고지는 링크 **집합** 판정이 정한다(아래 M-1 describe 참고).
    expect(detail).toContain(
      "{affiliateDisclosureText ? <AffiliateDisclosure text={affiliateDisclosureText} /> : null}"
    );
    // 죽은 CTA(눌러도 productLinks[0]이 없어 아무 일도 없던 버튼)는 렌더 자체를 막는다.
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    const ctaGateIndex = detail.lastIndexOf("{hasProductLinks ? (", ctaIndex);
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
    expect(linkNeedsDisclosure(general)).toBe(false);
  });

  it("고지 대상이 없다는 판정은 링크 0개와 같은 근거다 (DNC-010 은닉 아님)", () => {
    expect(productLinksDisclosureText([])).toBeUndefined();
    expect(productLinksDisclosureText(undefined)).toBeUndefined();
    expect(productLinksDisclosureText(null)).toBeUndefined();
  });

  it("제휴가 하나라도 있으면 제휴 고지를 그린다 (DNC-010)", () => {
    expect(linkNeedsDisclosure(affiliate)).toBe(true);
    expect(productLinksDisclosureText([general, affiliate, general])).toBe("제휴 문구예요.");
  });

  it("스폰서가 섞이면 스폰서 문구가 우선한다 (DNC-011)", () => {
    expect(productLinksDisclosureText([affiliate, sponsored, general])).toBe("스폰서 문구예요.");
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
    expect(productLinksDisclosureText([general, affiliate])).toBe("제휴 문구예요.");
  });

  it("M-2: 스폰서 문구가 뜨는 화면에서도 제휴 링크 행은 제휴 사실을 남긴다 (DNC-010)", () => {
    const links = [affiliate, sponsored];
    expect(productLinksDisclosureText(links)).toBe("스폰서 문구예요.");

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

  it("ITEM-002 프리뷰는 제휴·스폰서를 함께 담아 고지가 계속 렌더된다 (픽셀 락 불변)", () => {
    const detail = detailSource();
    const preview = detail.slice(detail.indexOf("function previewDetail("), detail.indexOf("export default function"));

    expect(preview).toContain("isSponsored: true");
    expect(preview).toContain("isAffiliate: true");
    // 스폰서가 있으므로 프리뷰에 실제로 그려지는 문장이다 -- 해요체 + 광고/수수료 고지를 함께.
    expect(preview).toContain("스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.");
    expect(preview).not.toContain("광고/제휴 고지를 표시합니다");
  });
});

describe("라운드 43 UX-V (C4): 비교가 아닌 가격 비교", () => {
  it("세션 경로의 판매처 행에는 같은 가격대를 되풀이하지 않는다", () => {
    expect(detailSource()).toContain('price={hasSession ? "" : visibleDetail.priceBandText ?? ""}');
  });

  it("세션 경로 제목은 눌리지 않는 탭 흉내 대신 섹션 제목이다", () => {
    const detail = detailSource();

    expect(PRODUCT_LINKS_SECTION_TITLE).toBe("구매처");
    expect(detail).toContain("{PRODUCT_LINKS_SECTION_TITLE}");
    expect(detail).toContain('accessibilityRole="header"');
    // 프리뷰(ITEM-002 픽셀 락 캡처) 경로의 문구는 기준 이미지 그대로 남는다.
    expect(detail).toContain("가격 비교");
    expect(detail).toContain("제품 정보");
    const sessionBranchIndex = detail.indexOf("{hasSession ? (\n              <View style={{ borderBottomColor");
    expect(sessionBranchIndex).toBeGreaterThan(-1);
    // 두 문구는 그 삼항의 **프리뷰 가지**(`) : (` 이후)에만 렌더된다.
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
