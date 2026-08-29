import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 07 mobile items and commerce contract", () => {
  it("exposes item, status, and product-link API client functions", async () => {
    const client = await import("./api/client");

    expect(client.listItems).toEqual(expect.any(Function));
    expect(client.getItemDetail).toEqual(expect.any(Function));
    expect(client.updateItemStatus).toEqual(expect.any(Function));
    expect(client.clickProductLink).toEqual(expect.any(Function));
  });

  it("creates locked item/commerce route files while preserving the fixed tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"],
      ["app/(tabs)/items.tsx", "ITEM-001"],
      ["app/(tabs)/items.tsx", "listItems"],
      ["app/(tabs)/items.tsx", "updateItemStatus"],
      ["app/items/[itemTemplateId].tsx", "ITEM-002"],
      ["app/items/[itemTemplateId].tsx", "ITEM-003"],
      ["app/items/[itemTemplateId].tsx", "ITEM-004"],
      ["app/items/[itemTemplateId].tsx", "getItemDetail"],
      ["app/items/[itemTemplateId].tsx", "clickProductLink"],
      ["app/items/[itemTemplateId].tsx", "disclosureText"],
      // 라운드 43 UX-V (C3): 배지/캡션 문구는 화면에 인라인하지 않는다 -- 순수 모듈이 단일
      // 소스다(expense-link-prompt와 같은 관례). 화면은 그 판정을 쓰는지만 확인하고, 문구
      // 자체는 아래 모듈 쪽에서 확인한다.
      ["app/items/[itemTemplateId].tsx", "productLinkMarker"],
      ["src/items/link-marker.ts", "스폰서"],
      ["src/items/link-marker.ts", "제휴"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });

  it("renders the reasonText and skipReasonText sections on the item detail screen (COM-101)", () => {
    const productDetailSource = readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");

    // Section headings and copy from the design contract (round5a-sprint1-plan.md §6).
    expect(productDetailSource).toContain("왜 필요해요?");
    expect(productDetailSource).toContain("이런 경우엔 안 사도 돼요");
    expect(productDetailSource).toContain("visibleDetail.reasonText");
    expect(productDetailSource).toContain("visibleDetail.skipReasonText");

    // skipReasonText must be conditionally rendered (section hidden when null/empty), while
    // reasonText (always present) must not be gated behind the same guard.
    expect(productDetailSource).toContain("{visibleDetail.skipReasonText ? (");
    expect(productDetailSource).toMatch(/{visibleDetail\.skipReasonText \? \(\s*<Card[^]*?<\/Card>\s*\) : null}/);

    // Both sections use accessible headings and sit above the purchase CTA row, below the
    // price/necessity info card. Anchor on the `{visibleDetail.reasonText}` /
    // `{visibleDetail.skipReasonText}` interpolations, which are unique in the file, and look
    // backwards for the heading that immediately precedes each.
    const infoCardIndex = productDetailSource.indexOf("productDetailInfoCardStyle()");
    const reasonSectionIndex = productDetailSource.indexOf("{visibleDetail.reasonText}");
    const skipSectionIndex = productDetailSource.indexOf("{visibleDetail.skipReasonText}");
    const ctaRowIndex = productDetailSource.indexOf("바로 구매하기");
    expect(infoCardIndex).toBeGreaterThan(-1);
    expect(reasonSectionIndex).toBeGreaterThan(infoCardIndex);
    expect(skipSectionIndex).toBeGreaterThan(reasonSectionIndex);
    expect(ctaRowIndex).toBeGreaterThan(skipSectionIndex);

    const reasonHeadingBlock = productDetailSource.slice(reasonSectionIndex - 400, reasonSectionIndex);
    const skipHeadingBlock = productDetailSource.slice(skipSectionIndex - 400, skipSectionIndex);
    expect(reasonHeadingBlock).toContain('accessibilityRole="header"');
    expect(reasonHeadingBlock).toContain("왜 필요해요?");
    expect(skipHeadingBlock).toContain('accessibilityRole="header"');
    expect(skipHeadingBlock).toContain("이런 경우엔 안 사도 돼요");

    // Affiliate CTA disclosure position/copy must be unchanged (still directly after the new
    // sections, right before the cart/purchase buttons).
    //
    // 라운드 43 UX-V (C2) → 리뷰 M-1: 위치는 그대로고, **고지 대상이 있을 때만** 렌더된다는
    // 게이트가 앞에 붙었다 -- 제휴도 스폰서도 없는 화면에는 고지할 대상 자체가 없다
    // (DNC-010은 "고지를 숨기지 않는다"는 계약이지 "제휴가 없는 자리에도 띄운다"가 아니다).
    expect(productDetailSource).toMatch(
      /{affiliateDisclosureText \? <AffiliateDisclosure text={affiliateDisclosureText} \/> : null}/
    );
    const affiliateDisclosureIndex = productDetailSource.indexOf("<AffiliateDisclosure");
    expect(affiliateDisclosureIndex).toBeGreaterThan(skipSectionIndex);
    expect(affiliateDisclosureIndex).toBeLessThan(ctaRowIndex);
  });

  it("flows reasonText and skipReasonText from the local data layer into ItemDetail for every seeded item (COM-101)", async () => {
    const { getItemDetail } = await import("./api/local-backend");
    const { localItemTemplateFixtures, LOCAL_CHILD_ID } = await import("./api/local-fixtures");

    expect(localItemTemplateFixtures.length).toBeGreaterThan(0);

    for (const fixture of localItemTemplateFixtures) {
      const detail = getItemDetail(LOCAL_CHILD_ID, fixture.id);
      expect(detail.reasonText).toBe(fixture.reasonText);
      expect(typeof detail.reasonText).toBe("string");
      expect(detail.reasonText.length).toBeGreaterThan(0);
      expect(detail.skipReasonText).toBe(fixture.skipReasonText);
    }
  });

  it("treats a missing skipReasonText as a value that hides the skip section, without affecting reasonText (COM-101)", () => {
    // Mirrors the exact guard used in app/items/[itemTemplateId].tsx: `visibleDetail.skipReasonText ? (...) : null`.
    const withSkipReason = { reasonText: "필요한 이유", skipReasonText: "생략 가능한 경우" };
    const withoutSkipReason = { reasonText: "필요한 이유", skipReasonText: null as string | null | undefined };
    const withEmptySkipReason = { reasonText: "필요한 이유", skipReasonText: "" };

    expect(withSkipReason.skipReasonText ? "shown" : null).toBe("shown");
    expect(withoutSkipReason.skipReasonText ? "shown" : null).toBeNull();
    expect(withEmptySkipReason.skipReasonText ? "shown" : null).toBeNull();

    // reasonText itself is never gated: it is always present per the design contract.
    expect(withoutSkipReason.reasonText ? "shown" : null).toBe("shown");
  });

  it("falls back to a share-link + retry UI when Linking.openURL fails, using only the RN built-in Share module (COM-106)", () => {
    const productDetailSource = readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");

    // No new dependency (e.g. expo-clipboard) may be introduced for this fallback.
    expect(productDetailSource).not.toContain("expo-clipboard");
    expect(productDetailSource).not.toContain("Clipboard");

    // Uses RN's built-in Share module (already imported for the header share button).
    expect(productDetailSource).toContain('import { Image, Linking, Pressable, Share, Text, View } from "react-native";');

    // Fallback state is set from the catch branch of the click-open flow (covers both a
    // thrown openURL and canOpenURL() resolving false, since the `throw` is unconditional
    // for canOpen === false and openURL failures both land in the same catch).
    // GAP-060 #4: 실패 문구는 공용 갈래(showLinkFailure -- 오프라인이면 OFFLINE_RETRY_NOTICE)를
    // 지나고, 폴백 상태에는 눌린 링크가 함께 담긴다(재시도로 열렸을 때 구매 확인 대기를 남기려면
    // 그때 그 링크를 알아야 한다). 담기는 redirectUrl/disclosureText는 종전 그대로다.
    // 라운드 67 #4: 그 상태에 **밖으로 내보내는 URL**(result.shareUrl)이 함께 담긴다 —
    // 여는 URL(redirectUrl)과 다른 값이라 한 칸으로 합칠 수 없다.
    expect(productDetailSource).toContain("linkOpenFallback");
    expect(productDetailSource).toMatch(
      /catch\s*{[\s\S]{0,400}?showLinkFailure\([^;]*\);\s*setLinkOpenFallback\(\{\s*redirectUrl: result\.redirectUrl,\s*shareUrl: result\.shareUrl,\s*disclosureText: result\.disclosureText,\s*link\s*\}\);\s*}/
    );

    // Retry re-attempts Linking.openURL against the same stored redirect URL.
    expect(productDetailSource).toContain("const retryOpenFallbackLink = async () => {");
    expect(productDetailSource).toMatch(/retryOpenFallbackLink[\s\S]*?Linking\.canOpenURL\(linkOpenFallback\.redirectUrl\)[\s\S]*?Linking\.openURL\(linkOpenFallback\.redirectUrl\)/);

    // Share uses RN's Share.share (not a new dependency).
    //
    // 라운드 64 #5ⓐ: 그 메시지에 **제휴 고지가 함께** 실린다(DNC-010) -- 앱 밖으로 나간 링크에는
    // "구매 CTA 인접"이라 부를 자리가 없어, 문장을 함께 보내는 것 말고 그 계약을 지킬 방법이
    // 없다. 조립은 순수 모듈 한 자리(src/items/link-marker.ts의 purchaseLinkShareMessage)이고
    // 문구 계약은 link-marker.test.ts가 진다.
    //
    // 라운드 67 #4: **나가는 URL은 서버가 준 공유 URL**(`shareUrl`)이다 — 그것이 우리 집계를
    // 지나고, 어드민이 내린 링크는 그 주소에서 404가 된다.
    // 앱이 문자열을 스스로 잇지 않는다는 것도 함께 못 박는다(조립은 서버 한 자리).
    //
    // 라운드 68 C(#4): **폴백이 사라졌다.** 서버는 워커가 4xx를 확인한 링크(broken)에
    // `shareUrl`을 싣지 않으므로, 원문 URL로 떨어지는 폴백은 "우리가 죽은 줄 아는 주소를
    // 집계도 회수도 없이 내보내는" 길이 된다. 그래서 나가는 값은 `shareUrl` 하나뿐이고,
    // 그 값이 없으면 공유 자체를 하지 않는다(아래 렌더 계약).
    expect(productDetailSource).toContain("const shareFallbackLink = () => {");
    expect(productDetailSource).toMatch(
      /shareFallbackLink[\s\S]*?Share\.share\(\{\s*message: purchaseLinkShareMessage\(\{\s*url: linkOpenFallback\.shareUrl,/
    );
    expect(productDetailSource).not.toContain("linkOpenFallback.shareUrl ?? linkOpenFallback.redirectUrl");
    expect(productDetailSource).not.toMatch(/Share\.share\(\{ message: linkOpenFallback\.redirectUrl \}\)/);
    // 앱이 `/r/` 주소를 짓지 않는다(베이스도 경로도 서버의 것이다).
    expect(productDetailSource).not.toContain("/api/v1/r/");

    // **여는** URL은 종전 그대로다 — `/r/`로 열면 이 화면의 클릭 행과 리다이렉트의 익명 행이
    // 겹쳐 한 번의 클릭이 두 번 세어진다.
    expect(productDetailSource).toMatch(/Linking\.openURL\(result\.redirectUrl\)/);
    expect(productDetailSource).not.toMatch(/Linking\.openURL\([^)]*shareUrl/);

    // The fallback card renders both a share action and a "다시 시도" (retry) action.
    expect(productDetailSource).toMatch(/{linkOpenFallback \? \([\s\S]*?링크 공유하기[\s\S]*?다시 시도[\s\S]*?\) : null}/);

    // 라운드 68 C(#4): 그 공유 버튼은 **내보낼 주소가 있을 때만** 선다(같은 판정
    // `canSharePurchaseLink` — 클릭 응답에 `shareUrl`이 없으면 서버가 깨진 줄 아는 링크이거나
    // 애초에 코드가 없는 행이다). 버튼이 말없이 사라지지 않도록 그 자리에서 사실을 한 줄로
    // 말하고, 재시도는 두 갈래 모두에 그대로 남는다.
    expect(productDetailSource).toMatch(
      /{canSharePurchaseLink\(linkOpenFallback\.shareUrl\) \? \([\s\S]*?링크 공유하기[\s\S]*?\) : \([\s\S]*?LINK_SHARE_UNAVAILABLE_NOTICE[\s\S]*?\)}/
    );
  });
});
