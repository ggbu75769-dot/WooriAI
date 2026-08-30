import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  itemTrustNotes,
  MEDICAL_DISCLAIMER_BODY,
  MEDICAL_DISCLAIMER_TITLE,
  SAFETY_NOTE_TITLE,
  SECONDHAND_OK_BODY,
  SECONDHAND_OK_TITLE
} from "./item-trust-notes";

const mobileRoot = process.cwd();
const detailSource = () => readFileSync(join(mobileRoot, "app/items/[itemTemplateId].tsx"), "utf8");

const session = { hasSession: true } as const;

describe("라운드 48 T1: 준비템 신뢰 안내 판정", () => {
  it("해당 사실이 없으면 카드도 없다", () => {
    expect(itemTrustNotes({ ...session, usedSecondhandOk: false })).toEqual([]);
    expect(itemTrustNotes({ ...session, usedSecondhandOk: false, safetyNote: null })).toEqual([]);
    // 공백만 있는 안전 문구는 없는 것과 같다(빈 카드 방지).
    expect(itemTrustNotes({ ...session, safetyNote: "   " })).toEqual([]);
    expect(itemTrustNotes({ ...session, medicalDisclaimerRequired: false })).toEqual([]);
  });

  it("중고 구매 OK는 아낄 수 있다는 소식으로만 말한다", () => {
    const notes = itemTrustNotes({ ...session, usedSecondhandOk: true });
    expect(notes).toEqual([{ id: "secondhand", title: SECONDHAND_OK_TITLE, body: SECONDHAND_OK_BODY }]);
    // DNC-018: 재촉·죄책감 유발 표현 금지.
    expect(SECONDHAND_OK_TITLE + SECONDHAND_OK_BODY).not.toMatch(/사세요|아껴야|낭비/);
  });

  it("안전 문구 본문은 서버 값 그대로다(앱이 지어내지 않는다)", () => {
    const notes = itemTrustNotes({ ...session, safetyNote: "허리 지지대와 안전벨트를 항상 확인해 주세요." });
    expect(notes).toEqual([
      { id: "safety", title: SAFETY_NOTE_TITLE, body: "허리 지지대와 안전벨트를 항상 확인해 주세요." }
    ]);
  });

  it("의료 고지는 상담으로만 연결한다(DNC-020)", () => {
    const notes = itemTrustNotes({ ...session, medicalDisclaimerRequired: true });
    expect(notes).toEqual([{ id: "medical", title: MEDICAL_DISCLAIMER_TITLE, body: MEDICAL_DISCLAIMER_BODY }]);
    expect(MEDICAL_DISCLAIMER_BODY).toContain("상담해 주세요");
    // 진단·치료·효능 단정 금지.
    expect(MEDICAL_DISCLAIMER_TITLE + MEDICAL_DISCLAIMER_BODY).not.toMatch(/효과|치료|예방|좋아요|필요해요/);
  });

  it("여러 사실이 겹치면 확인할 것을 먼저 말한다(의료 → 안전 → 중고)", () => {
    const notes = itemTrustNotes({
      ...session,
      usedSecondhandOk: true,
      safetyNote: "사용 연령을 확인해 주세요.",
      medicalDisclaimerRequired: true
    });
    expect(notes.map((note) => note.id)).toEqual(["medical", "safety", "secondhand"]);
  });

  it("비세션(픽셀 락 프리뷰)에서는 값이 있어도 한 장도 그리지 않는다", () => {
    expect(
      itemTrustNotes({
        hasSession: false,
        usedSecondhandOk: true,
        safetyNote: "피부에 닿는 제품은 사이즈와 소재를 확인해 주세요.",
        medicalDisclaimerRequired: true
      })
    ).toEqual([]);
  });
});

describe("라운드 48 T1: 상세 화면 배선", () => {
  it("세 값을 모두 모듈에 넘기고 문구는 화면에 인라인하지 않는다", () => {
    const detail = detailSource();
    expect(detail).toContain('import { itemTrustNotes } from "../../src/items/item-trust-notes";');
    expect(detail).toContain("usedSecondhandOk: visibleDetail.usedSecondhandOk");
    expect(detail).toContain("safetyNote: visibleDetail.safetyNote");
    expect(detail).toContain("medicalDisclaimerRequired: visibleDetail.medicalDisclaimerRequired");
    expect(detail).toContain("hasSession,");
    expect(detail).not.toContain(SECONDHAND_OK_TITLE);
    expect(detail).not.toContain(MEDICAL_DISCLAIMER_BODY);
  });

  it("제휴 고지와 구매 CTA 사이에 끼어들지 않는다(DNC-010 인접성)", () => {
    const detail = detailSource();
    const notesIndex = detail.indexOf("itemTrustNotes({");
    const disclosureIndex = detail.indexOf("{affiliateDisclosureText ? <AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    expect(notesIndex).toBeGreaterThan(-1);
    expect(disclosureIndex).toBeGreaterThan(notesIndex);
    expect(ctaIndex).toBeGreaterThan(disclosureIndex);
  });

  it("세션 경로에는 모든 품목에 붙던 기저귀 팩 히어로 사진이 없다", () => {
    const detail = detailSource();
    // DSN-053 P2-B: 히어로 **카드**는 승인 디자인대로 돌아왔지만, 세션 분기에 들어가는 것은
    // 상품 사진이 아니라 중립 글리프다(응답에 상품 이미지가 없으므로 그릴 사실이 없다).
    expect(detail).toContain("{hasSession ? (\n            <Card style={productDetailHeroCardStyle()}>");
    expect(detail).toContain('<AppIcon color={theme.colors.coral[600]} name="package-variant-closed" size={64} />');
    // 프리뷰(ITEM-002 픽셀 락)에서는 사진을 그대로 그린다 -- 분기가 살아 있어야 한다.
    expect(detail).toContain("<Image source={productImage} style={productDetailHeroImageStyle()} resizeMode=\"cover\" />");
    // 세션 경로에서 사진을 그리는 배선은 남아 있지 않다.
    // 라운드 78 트랙 E: 시작 표식이 스타일 **호출 모양**(`productDetailHeroCardStyle()`)까지
    // 담고 있어, 인자 하나만 받게 되어도 -1이 됐다. 그러면 구간이 빈 문자열이 되어 아래
    // 부정 단언이 아무것도 검사하지 않은 채 통과한다(끝점이 -1일 때보다 조용한 실패다).
    const heroBranchStart = detail.indexOf("{hasSession ? (\n            <Card style={productDetailHeroCardStyle");
    const heroBranchEnd = detail.indexOf(") : (", heroBranchStart);
    expect(heroBranchStart, "세션 히어로 카드 갈래를 찾지 못했어요").toBeGreaterThan(-1);
    expect(heroBranchEnd, "세션 히어로 카드 갈래의 끝을 찾지 못했어요").toBeGreaterThan(heroBranchStart);
    const sessionBranch = detail.slice(heroBranchStart, heroBranchEnd);
    expect(sessionBranch).not.toContain("productImage");
  });
});
