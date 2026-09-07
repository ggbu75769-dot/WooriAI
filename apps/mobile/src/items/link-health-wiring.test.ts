import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const detailSource = () => source("app/items/[itemTemplateId].tsx");

/**
 * COM-105 후속 — **서버가 아는 도달 실패를 화면이 말하게 하는 배선.**
 *
 * 고치는 문제(정찰 실측): 서버는 `product_links.health_status`로 도달 실패를 알고 있는데,
 * 그 값이 앱 DTO에 실리지 않아 모바일 전수에서 이 값을 **읽는 코드가 0건**이었다. broken 링크가
 * 앱에서 받는 대우는 ⓐ 정렬 강등(items-catalog.service.ts)과 ⓑ 공유 버튼 미노출(link-marker.ts)
 * 둘뿐이고 **둘 다 화면에 한 글자도 남기지 않는다**. 그래서 사용자는 우리가 도달 실패를 아는
 * 링크를 아무 말도 못 들은 채 눌러 앱 밖에서 404를 만났다.
 *
 * 이 파일이 무는 것은 세 가지다: 배선이 실재한다 · 그 배선이 **넘지 않는 선**(구매 경로를 막지
 * 않는다 · 픽셀 락 캡처를 건드리지 않는다) · 그리고 **일부러 하지 않은 것**(구매 확인 대기를
 * 끄지 않는다)이 뒤에서 조용히 되돌려지지 않는다.
 */
describe("COM-105 후속: 링크 헬스 관찰 한 줄의 화면 배선", () => {
  it("화면은 판정을 짓지 않는다 — 단일 소스 하나만 부른다", () => {
    const detail = detailSource();

    expect(detail).toContain("purchaseLinkHealthNotice,");
    expect(detail).toContain(`} from "../../src/items/link-marker";`);
    expect(detail).toContain("const linkHealthNotice = hasSession ? purchaseLinkHealthNotice(link) : undefined;");

    // 판정이 화면에 흩어지지 않는다: 화면 소스는 헬스 값을 **직접 비교하지 않는다**.
    expect(detail).not.toContain(`healthStatus === "broken"`);
    expect(detail).not.toContain(`healthStatus === "unstable"`);
    expect(detail).not.toContain("link.healthStatus");
    // 문구도 화면이 짓지 않는다(두 벌이 되면 한쪽만 고쳐진다).
    expect(detail).not.toContain("마지막으로 확인했을 때는");

    // 부르는 자리는 하나뿐이다.
    expect(detail.match(/purchaseLinkHealthNotice\(/g) ?? []).toHaveLength(1);
  });

  it("한 줄은 그리되 구매 경로는 그대로 열려 있다 (판정이 틀렸을 때의 대가를 우리가 대신 치르지 않는다)", () => {
    const detail = detailSource();

    const rowStart = detail.indexOf("const linkHealthNotice = hasSession");
    expect(rowStart, "헬스 판정 자리를 찾지 못했다").toBeGreaterThan(-1);
    const rowEnd = detail.indexOf("</Card>", rowStart);
    expect(rowEnd, "판매처 카드의 끝을 찾지 못했다").toBeGreaterThan(rowStart);
    const rowBlock = detail.slice(rowStart, rowEnd);

    // 문구는 조건부로 선다.
    expect(rowBlock).toContain("{linkHealthNotice ? (");
    expect(rowBlock).toContain("{linkHealthNotice}</Text>");

    // ⓐ(숨기기)를 하지 않았다: 링크 행은 여전히 productLinks 전수를 그대로 그린다.
    expect(detail).toContain("visibleDetail.productLinks.map((link, index) => {");
    expect(rowBlock).not.toContain("linkHealthNotice ? null :");
    // 버튼을 끄지도 않는다 — 이 판정이 onPress·disabled 근처에 얼씬하지 않는다.
    expect(rowBlock).toContain("onPress={() => handleProductLinkPress(link)}");
    expect(rowBlock).not.toContain("disabled={linkHealthNotice");
    expect(rowBlock).not.toContain("!linkHealthNotice");
  });

  it("DNC-010: 제휴 고지와 구매 CTA 사이에 이 줄이 끼어들지 않는다", () => {
    const detail = detailSource();

    // 고지는 종전 자리 그대로이고, 그 바로 다음이 CTA 행이다(사이에 아무것도 없다).
    expect(detail).toContain(
      "{affiliateDisclosureText ? <AffiliateDisclosure text={affiliateDisclosureText} /> : null}\n" +
        `          <View style={{ flexDirection: "row", gap: 10 }}>`
    );
    // 헬스 줄은 그보다 위, 판매처 카드 **안**에서 산다.
    const noticeAt = detail.indexOf("{linkHealthNotice ? (");
    const disclosureAt = detail.indexOf("{affiliateDisclosureText ? <AffiliateDisclosure");
    expect(noticeAt).toBeGreaterThan(-1);
    expect(disclosureAt).toBeGreaterThan(noticeAt);
  });

  /**
   * ITEM-002는 픽셀 락 화면이고, 그 캡처는 **비세션 프리뷰**다 — app/pixel-lock.tsx가
   * `/items/preview-diaper-party-pack`으로 보내면서 세션과 선택 아이를 지우고 찍는다.
   * 그래서 `hasSession` 게이트 하나가 곧 캡처 불변의 근거다(링크 가격이 쓰는 그 관례).
   */
  it("ITEM-002 픽셀 락: 비세션 프리뷰에는 이 줄이 한 글자도 서지 않는다", () => {
    const pixelLock = source("app/pixel-lock.tsx");
    // 캡처 경로가 실제로 이 화면을 가리키고, 찍기 전에 세션을 지운다.
    expect(pixelLock).toContain(`"ITEM-002": "/items/preview-diaper-party-pack"`);
    expect(pixelLock).toContain("clearSession();");
    expect(pixelLock).toContain("clearSelectedChildId();");

    // 게이트는 세션이다 — 프리뷰 픽스처가 값을 갖고 있어도 판정이 돌지 않는다.
    expect(detailSource()).toContain("hasSession ? purchaseLinkHealthNotice(link) : undefined");

    // 그리고 그 픽스처는 애초에 헬스 값을 갖지 않는다(가드 둘이 겹친다).
    const detail = detailSource();
    const previewStart = detail.indexOf("function previewDetail(itemTemplateId: string): ItemDetail {");
    expect(previewStart, "previewDetail을 찾지 못했다").toBeGreaterThan(-1);
    const previewEnd = detail.indexOf("\n}", previewStart);
    expect(previewEnd).toBeGreaterThan(previewStart);
    expect(detail.slice(previewStart, previewEnd)).not.toContain("healthStatus");
  });

  /**
   * ⓒ(도달 실패로 관찰된 링크는 누른 뒤 구매 확인을 묻지 않는다)를 **일부러 하지 않았다.**
   *
   * 오탐의 대가가 한쪽으로 크게 기운다:
   *  - 우리 판정이 틀렸는데 대기를 끄면 → **실제로 산 사람에게 영영 묻지 않는다.** 그 지출은
   *    기록되지 않고, 그것이 이 앱의 핵심 루프("구매 후 기록") 자체다.
   *  - 우리 판정이 맞는데 대기를 남기면 → 404를 만난 사람이 몇 시간 뒤 **질문 하나**를 받고
   *    "아니요"로 답한다. 질문은 단정이 아니라서 그 자리에 허위 표시가 생기지 않는다.
   *
   * 게다가 그 순간 우리에게는 서로 다른 두 증거가 있다: 최대 24시간 묵은 데이터센터발 HEAD
   * 응답(워커는 405에서만 GET으로 재시도하므로 HEAD에 403으로 답하는 정상 쇼핑몰도 broken이
   * 된다)과, **방금 이 기기에서 실제로 열린 URL**이다. 더 새롭고 실제 경로에서 온 후자를
   * 묵은 전자로 덮지 않는다.
   */
  it("구매 확인 대기는 이 판정과 무관하다 — 열린 링크는 종전 그대로 등록된다", () => {
    const detail = detailSource();

    // 등록 자리는 종전 그대로 openURL 성공 바로 다음 줄이다(GAP-060 #4의 그 인접).
    expect(detail).toContain("await Linking.openURL(result.redirectUrl);\n        registerPurchaseFollowup(link);");
    // 등록 지점은 여전히 하나뿐이고, 헬스 판정이 그 자리에 조건으로 끼어들지 않았다.
    expect(detail.match(/usePurchaseFollowupStore\.getState\(\)\.recordLinkClick\(\{/g) ?? []).toHaveLength(1);
    expect(detail).not.toContain("if (!linkHealthNotice) registerPurchaseFollowup");
    expect(detail).not.toContain("linkHealthNotice ? null : registerPurchaseFollowup");

    const registerStart = detail.indexOf("const registerPurchaseFollowup = (link: ProductLink) => {");
    expect(registerStart, "registerPurchaseFollowup를 찾지 못했다").toBeGreaterThan(-1);
    const registerEnd = detail.indexOf("\n  };", registerStart);
    expect(registerEnd).toBeGreaterThan(registerStart);
    expect(detail.slice(registerStart, registerEnd)).not.toContain("healthStatus");
  });
});
