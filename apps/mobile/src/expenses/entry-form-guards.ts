/**
 * UX-K(B) — 기록 시트에서 "사용자가 친 것"을 지키는 두 개의 작은 판정.
 *
 * 둘 다 화면(app/expenses/new.tsx)에 인라인으로 쓰면 조건이 조용히 뒤집혀도 아무도 못 잡는
 * 종류의 규칙이라, 순수 함수로 떼어 vitest로 고정한다.
 */

export type QuickExpenseInputSnapshot = {
  itemName: string;
  amountText: string;
  memo: string;
};

/**
 * (a) 닫기(×)를 눌렀을 때 임시 저장(초안)을 지워도 되는지 판단하기 위한 술어.
 *
 * 종전에는 닫기가 무조건 `clearQuickExpenseDraft()`를 부르고 back 했다. 그런데 이 화면은
 * 입력 중인 값을 500ms 디바운스로 계속 저장해 두고(draft-storage), 다음 진입 시 복원한다 --
 * 즉 "실수로 닫았을 때 살려 주는" 장치가 이미 있는데 닫기 버튼이 그것을 스스로 지우고
 * 있었다(전화가 와서 시트를 닫으면 친 내용이 통째로 사라진다).
 *
 * 그래서 품목명·금액·메모 중 **하나라도** 남아 있으면 초안을 지우지 않고 닫는다. 아무것도
 * 안 친 채로 닫았으면 남길 것도 없으므로 종전대로 지운다(빈 초안이 남아 다음 진입을
 * 방해하지 않는다). 확인 Alert은 일부러 띄우지 않는다 -- 닫기를 한 번 더 확인시키는 것은
 * 이 시트가 지향하는 "빠른 기록" 흐름을 되레 무겁게 만든다.
 *
 * 공백만 친 것은 안 친 것으로 본다(금액은 숫자만 남는 필드라 trim이 사실상 무해하다).
 * 카테고리·날짜·선물 여부는 여기서 보지 않는다 -- 전부 기본값이 있는 필드라, 그것만으로
 * "쓰다 만 기록"이라고 부를 수 없다.
 */
export function hasQuickExpenseInput({ itemName, amountText, memo }: QuickExpenseInputSnapshot): boolean {
  return [itemName, amountText, memo].some((value) => value.trim().length > 0);
}

export type TileItemNameFillInput = {
  /** 지금 품목명 입력칸에 있는 값. */
  itemName: string;
  /** 직전에 카테고리 타일이 자동으로 넣어 둔 라벨. 타일이 넣은 적이 없거나, 그 뒤 사용자가
   * 직접 타이핑했거나, 최근/자동완성 칩이 이름을 갈아끼웠으면 null. */
  lastTileFilledItemName: string | null;
};

/**
 * (b) 카테고리 타일을 탭했을 때 품목명을 타일 라벨로 채워도 되는지 판단한다.
 *
 * 종전에는 타일 탭이 언제나 `setItemName(category.label)`을 실행했다. "하기스 밴드형 4단계"를
 * 다 쳐 놓고 분류만 바꾸려고 타일을 누르면 그 이름이 경고 없이 "의류"로 덮였다 -- 사용자가
 * 알아채지 못하면 실제로 산 물건과 다른 이름이 기록으로 남는다.
 *
 * 채워도 되는 경우는 두 가지뿐이다.
 *  1. 품목명이 비어 있다(공백만 있는 것도 빈 것으로 본다) -- 아직 지울 사용자의 입력이 없다.
 *  2. 지금 값이 **직전에 타일이 넣은 라벨 그대로**다 -- 타일 -> 타일로 분류를 고르는 중이라
 *     "기저귀"가 "의류"로 바뀌는 것이 자연스럽다(사용자가 친 글자는 하나도 없다).
 *
 * 그 외에는 그대로 둔다. 분류만 바뀌고 이름은 사용자가 친 것이 남는다.
 */
export function shouldTileFillItemName({ itemName, lastTileFilledItemName }: TileItemNameFillInput): boolean {
  if (itemName.trim().length === 0) return true;
  return lastTileFilledItemName !== null && itemName === lastTileFilledItemName;
}
