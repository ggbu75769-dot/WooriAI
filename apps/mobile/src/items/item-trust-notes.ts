/**
 * 라운드 48 T1: 준비템 상세의 **신뢰 안내 카드** 판정 + 문구.
 *
 * 서버는 이미 세 가지 사실을 준비템마다 들고 있었지만 앱은 하나도 그리지 않았다.
 *  - `usedSecondhandOk` — 중고/물려받기로도 충분한 품목인가 (지출을 줄이는 정보)
 *  - `safetyNote` — 살 때 확인할 안전 사항 (운영자가 카탈로그에 적어 둔 문장)
 *  - `medicalDisclaimerRequired` — 의료/영양제 성격이라 전문가 확인이 필요한가
 *
 * 이 파일은 "무엇을 언제 보여줄지"와 제목/보조 문구만 정한다. 안전 문구 본문은 서버 값을
 * 그대로 쓰고, 없는 사실을 만들어 내지 않는다.
 *
 * 문구 원칙
 *  - 해요체 · 쉬운 문장, 죄책감 유발 금지(DNC-018). "중고로도 괜찮아요"는 아껴도 된다는
 *    허락이지 중고를 사라는 지시가 아니다.
 *  - 진단·치료·효능을 단정하지 않는다(DNC-020). 의료 고지는 "상담해 주세요"까지만 말하고
 *    어떤 제품이 좋은지/필요한지는 말하지 않는다.
 *  - 구매를 재촉하지 않고, 추천 점수·정렬에는 관여하지 않는다(DNC-009 무접촉).
 */

export type ItemTrustNoteId = "medical" | "safety" | "secondhand";

export type ItemTrustNote = {
  id: ItemTrustNoteId;
  title: string;
  body: string;
};

export const MEDICAL_DISCLAIMER_TITLE = "구매 전에 확인해 주세요";
/** DNC-020: 효능/필요 여부를 단정하지 않고 전문가 상담으로만 연결한다. */
export const MEDICAL_DISCLAIMER_BODY = "복용이나 사용 여부는 의사·약사와 상담해 주세요.";

export const SAFETY_NOTE_TITLE = "안전하게 쓰려면";

export const SECONDHAND_OK_TITLE = "중고로 사도 괜찮은 품목이에요";
export const SECONDHAND_OK_BODY = "물려받거나 중고로 준비해도 충분해서, 예산을 아낄 수 있어요.";

export type ItemTrustNoteInput = {
  /**
   * 세션 게이트. 비세션 미리보기(ITEM-002 픽셀 락 캡처)는 픽스처가 값을 갖고 있어도 카드를
   * 그리지 않는다 — 기준 이미지가 한 픽셀도 바뀌면 안 되기 때문이다. 판정을 화면이 아니라
   * 여기서 하는 이유는, 세 카드가 각각 게이트를 다시 적으면 하나만 빠뜨려도 캡처가 깨져서다.
   */
  hasSession: boolean;
  usedSecondhandOk?: boolean;
  safetyNote?: string | null;
  medicalDisclaimerRequired?: boolean;
};

/**
 * 그릴 안내 카드 목록. 순서는 **확인해야 할 것 먼저, 아껴도 된다는 소식은 그 다음**이다
 * (의료 → 안전 → 중고). 해당 사실이 없으면 그 카드는 아예 나오지 않는다.
 */
export function itemTrustNotes(input: ItemTrustNoteInput): ItemTrustNote[] {
  if (!input.hasSession) return [];

  const notes: ItemTrustNote[] = [];
  if (input.medicalDisclaimerRequired === true) {
    notes.push({ id: "medical", title: MEDICAL_DISCLAIMER_TITLE, body: MEDICAL_DISCLAIMER_BODY });
  }
  const safetyNote = input.safetyNote?.trim();
  if (safetyNote) {
    notes.push({ id: "safety", title: SAFETY_NOTE_TITLE, body: safetyNote });
  }
  if (input.usedSecondhandOk === true) {
    notes.push({ id: "secondhand", title: SECONDHAND_OK_TITLE, body: SECONDHAND_OK_BODY });
  }
  return notes;
}
