import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_MARKER_CAPTION,
  AFFILIATE_MARKER_LABEL,
  EMPTY_PRODUCT_LINKS_TEXT,
  FALLBACK_PLATFORM_LABEL,
  GENERAL_MARKER_LABEL,
  hasPurchasableLink,
  PRODUCT_LINKS_SECTION_TITLE,
  productLinkMarker,
  productPlatformLabel,
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

  it("구매 CTA와 제휴 고지가 같은 게이트를 공유한다", () => {
    const detail = detailSource();

    expect(detail).toContain("const hasProductLinks = hasPurchasableLink(visibleDetail.productLinks);");
    expect(detail).toContain(
      "{hasProductLinks ? <AffiliateDisclosure text={visibleDetail.productLinks[0]?.disclosureText} /> : null}"
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
