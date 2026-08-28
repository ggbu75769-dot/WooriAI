import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildShareCopyText, hasShareUrl, shareCopyHint } from "./link-share";
// 라운드 64 M-1의 대조가 진짜 대조이려면 두 경로를 **실제로 실행**해야 한다. 그래서
// 테스트에서만 서버의 규칙 모듈(순수 함수)과 앱의 조립기를 그대로 불러온다 — 수기 미러
// 계약 테스트가 다른 패키지 소스를 읽는 기존 관례와 같은 자리다(known-limitations §D).
import { withCommissionDisclosure } from "../../../api/src/items-commerce/share-disclosure";
import { purchaseLinkShareMessage, statesAffiliateCommission } from "../../../mobile/src/items/link-marker";

/**
 * GAP-064 #8 + DNC-010: 공개 리다이렉트 URL을 어드민이 뿌리기 시작하면 고지가 앱 밖에
 * 남지 않는다. 그래서 복사 동작은 URL만 복사하지 않는다 — 고지 대상 링크는 문구와
 * URL을 한 덩어리로 복사한다. 반대로 없는 고지를 지어내지도 않는다.
 */
const SHARE_URL = "https://wooriai.example/api/v1/r/0123456789ab";

describe("buildShareCopyText", () => {
  it("고지 대상 링크는 고지 문구와 URL을 두 줄로 함께 복사한다 (DNC-010)", () => {
    expect(
      buildShareCopyText({
        redirectShareUrl: SHARE_URL,
        shareDisclosureText: "제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요.",
        disclosureText: "제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요."
      })
    ).toBe(`제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요.\n${SHARE_URL}`);
  });

  it("고지 대상이 아닌 일반 링크는 URL 한 줄 그대로다 (없는 고지를 지어내지 않는다)", () => {
    expect(buildShareCopyText({ redirectShareUrl: SHARE_URL, shareDisclosureText: null, disclosureText: null })).toBe(
      SHARE_URL
    );
    expect(buildShareCopyText({ redirectShareUrl: SHARE_URL, shareDisclosureText: "   ", disclosureText: null })).toBe(
      SHARE_URL
    );
  });

  /**
   * 라운드 64 M-1: 복사에 실리는 것은 편집용 원문이 아니라 **공유 전용 문구**다. 서버가
   * 제휴 링크에 수수료 문장을 붙여 준 값이 있으면 그쪽이 나간다.
   */
  it("공유 전용 문구가 있으면 그 값이 복사된다 (편집용 원문이 아니다)", () => {
    expect(
      buildShareCopyText({
        redirectShareUrl: SHARE_URL,
        disclosureText: "쿠팡 파트너스 활동의 일환이에요.",
        shareDisclosureText: "쿠팡 파트너스 활동의 일환이에요. 제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요."
      })
    ).toBe(
      `쿠팡 파트너스 활동의 일환이에요. 제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요.\n${SHARE_URL}`
    );
  });

  it("구버전 응답(공유 전용 문구 없음)에서는 고지를 잃지 않고 원문으로 물러선다", () => {
    expect(buildShareCopyText({ redirectShareUrl: SHARE_URL, disclosureText: "스폰서 광고 상품이에요." })).toBe(
      `스폰서 광고 상품이에요.\n${SHARE_URL}`
    );
  });

  it("공유 URL이 없으면 null이다 — 화면이 죽은 복사 버튼을 만들지 않는다", () => {
    expect(
      buildShareCopyText({ redirectShareUrl: null, shareDisclosureText: "제휴 링크예요.", disclosureText: null })
    ).toBeNull();
    expect(buildShareCopyText({ redirectShareUrl: undefined, shareDisclosureText: null, disclosureText: null })).toBeNull();
    expect(hasShareUrl({ redirectShareUrl: null })).toBe(false);
    expect(hasShareUrl({ redirectShareUrl: SHARE_URL })).toBe(true);
  });
});

describe("shareCopyHint", () => {
  it("고지가 함께 나가는 경우에만 그 사실을 말한다", () => {
    expect(shareCopyHint({ shareDisclosureText: "스폰서 광고 상품이에요.", disclosureText: null })).toContain("함께 복사");
    expect(shareCopyHint({ shareDisclosureText: null, disclosureText: null })).toBe("");
  });
});

/**
 * 라운드 64 M-1 — **앱 경로와 어드민 경로의 문구 대조**.
 *
 * 두 경로가 같은 링크를 앱 밖으로 내보낸다.
 *  - 앱: `purchaseLinkShareMessage`(모바일) — `withAffiliateDisclosure`를 지나 제휴 링크에는
 *    수수료 문장이 반드시 붙는다(라운드 44 N-2).
 *  - 어드민: `buildShareCopyText`(이 파일) — 서버가 정한 `shareDisclosureText`를 그대로 싣는다.
 *
 * 종전에는 어드민만 그 규율을 안 지나서, 수수료를 말하지 않는 커스텀 문구가 붙은 제휴 링크가
 * **앱보다 약한 고지**로 더 넓게 나갔다(DNC-010). 이 대조는 그 비대칭이 되돌아오는 순간을
 * 잡는다. 문자열이 글자까지 같기를 요구하지는 않는다 — 두 폴백 문장이 다르기 때문이다.
 * 요구하는 것은 **규율의 동등성**이다:
 *   ⓐ 제휴 링크면 어드민 복사에도 수수료 사실이 들어 있다(앱의 판정으로 확인한다).
 *   ⓑ 어드민 문구를 앱의 강화 규칙에 다시 넣어도 변하지 않는다(= 이미 앱 기준을 만족한다,
 *      같은 말이 두 번 붙지도 않는다).
 *   ⓒ 고지 대상이 아닌 링크에서는 두 경로가 **글자까지 같다**(둘 다 URL 한 줄).
 */
describe("앱·어드민 두 경로 문구 대조 (라운드 64 M-1)", () => {
  /** 서버의 종별 기본 고지를 시드 파일에서 그대로 읽는다 — 손으로 베끼면 드리프트한다. */
  function seedDisclosureText(key: string): string {
    const source = readFileSync(
      join(process.cwd(), "..", "..", "apps", "api", "prisma", "seed-data.ts"),
      "utf8"
    );
    const seedsStart = source.indexOf("export const disclosureSeeds");
    expect(seedsStart, "disclosureSeeds 블록을 찾지 못했다 — 시드가 옮겨졌다").toBeGreaterThan(-1);
    const seedsBlock = source.slice(seedsStart, source.indexOf("];", seedsStart));
    const match = new RegExp(`key: "${key}",\\s*\\n\\s*text: "([^"]+)"`).exec(seedsBlock);
    expect(match, `${key} 시드를 찾지 못했다`).not.toBeNull();
    return match![1];
  }

  const affiliateDefault = () => seedDisclosureText("affiliate_purchase");
  const sponsoredDefault = () => seedDisclosureText("sponsored_product");

  /** 서버가 그 행에 실을 값 = 이미 해석된 고지 문구 + (제휴면) 수수료 문장. */
  function serverShareDisclosureText(link: {
    isAffiliate: boolean;
    isSponsored: boolean;
    resolvedDisclosureText: string | undefined;
  }): string | undefined {
    return link.isAffiliate
      ? withCommissionDisclosure(link.resolvedDisclosureText, affiliateDefault())
      : link.resolvedDisclosureText;
  }

  const cases = [
    {
      name: "제휴 링크 + 수수료를 말하지 않는 커스텀 문구 (이 후보가 든 바로 그 경우)",
      link: { isAffiliate: true, isSponsored: false },
      resolved: () => "쿠팡 파트너스 활동의 일환이에요"
    },
    {
      name: "제휴 링크 + 문구 없음 → 종별 기본 문구",
      link: { isAffiliate: true, isSponsored: false },
      resolved: () => affiliateDefault()
    },
    {
      name: "스폰서이면서 제휴인 링크 → 광고를 먼저 밝히고 수수료를 잇는다",
      link: { isAffiliate: true, isSponsored: true },
      resolved: () => sponsoredDefault()
    }
  ];

  for (const testCase of cases) {
    it(`${testCase.name}: 어드민 복사에도 수수료 사실이 남는다`, () => {
      const resolved = testCase.resolved();
      const shareDisclosureText = serverShareDisclosureText({ ...testCase.link, resolvedDisclosureText: resolved });
      const adminCopy = buildShareCopyText({
        redirectShareUrl: SHARE_URL,
        shareDisclosureText,
        disclosureText: resolved
      })!;
      const appCopy = purchaseLinkShareMessage({
        url: SHARE_URL,
        link: { ...testCase.link, disclosureText: null },
        disclosureText: resolved
      });

      // 두 경로 모두 URL을 마지막 줄로 함께 보낸다(고지가 링크와 떨어지지 않는다).
      expect(adminCopy.endsWith(`\n${SHARE_URL}`)).toBe(true);
      expect(appCopy.endsWith(`\n${SHARE_URL}`)).toBe(true);

      // ⓐ 어드민 문구도 앱의 판정으로 "수수료를 받는다"를 말한다.
      const adminNotice = adminCopy.slice(0, adminCopy.length - SHARE_URL.length - 1);
      const appNotice = appCopy.slice(0, appCopy.length - SHARE_URL.length - 1);
      expect(statesAffiliateCommission(adminNotice), `어드민 문구에 수수료 고지가 없다: ${adminNotice}`).toBe(true);
      expect(statesAffiliateCommission(appNotice)).toBe(true);

      // ⓑ 앱의 강화 규칙을 한 번 더 적용해도 변하지 않는다(이미 앱 기준을 만족한다).
      expect(purchaseLinkShareMessage({ url: SHARE_URL, link: testCase.link, disclosureText: adminNotice })).toBe(
        adminCopy
      );

      // 운영이 쓴 원문은 그대로 남아 있다(고지를 덧붙이되 지우지 않는다).
      expect(adminNotice.startsWith(resolved.replace(/[.!?…]$/, ""))).toBe(true);
    });
  }

  it("ⓒ 제휴도 스폰서도 아닌 일반 링크에서는 두 경로가 글자까지 같다 (URL 한 줄)", () => {
    const link = { isAffiliate: false, isSponsored: false };
    const shareDisclosureText = serverShareDisclosureText({ ...link, resolvedDisclosureText: undefined });
    const adminCopy = buildShareCopyText({ redirectShareUrl: SHARE_URL, shareDisclosureText, disclosureText: null });
    const appCopy = purchaseLinkShareMessage({ url: SHARE_URL, link: { ...link, disclosureText: null } });

    expect(adminCopy).toBe(SHARE_URL);
    expect(adminCopy).toBe(appCopy);
  });

  it("스폰서(비제휴) 링크에서도 두 경로가 글자까지 같다 — 없는 수수료를 지어내지 않는다", () => {
    const link = { isAffiliate: false, isSponsored: true };
    const resolved = sponsoredDefault();
    const shareDisclosureText = serverShareDisclosureText({ ...link, resolvedDisclosureText: resolved });
    const adminCopy = buildShareCopyText({
      redirectShareUrl: SHARE_URL,
      shareDisclosureText,
      disclosureText: resolved
    });
    const appCopy = purchaseLinkShareMessage({
      url: SHARE_URL,
      link: { ...link, disclosureText: null },
      disclosureText: resolved
    });

    expect(adminCopy).toBe(`${resolved}\n${SHARE_URL}`);
    expect(adminCopy).toBe(appCopy);
    expect(statesAffiliateCommission(shareDisclosureText!)).toBe(false);
  });
});
