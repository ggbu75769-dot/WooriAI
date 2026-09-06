import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coerceStageBandLabel,
  customItemBodyFingerprint,
  customItemCreatedNotice,
  customItemDeleteAccessibilityLabel,
  customItemDeleteConfirmCopy,
  customItemDeleteEntryLabel,
  customItemEditAccessibilityLabel,
  customItemEditEntryLabel,
  customItemEntryLabel,
  customItemLimitExceededMessage,
  customItemListMarkerText,
  customItemMaxPerChild,
  customItemMutationErrorMessage,
  customItemNameMaxLength,
  customItemNecessityOptions,
  customItemNotFoundMessage,
  customItemSaveAccessibilityLabel,
  customItemSheetCopy,
  customItemStageBandOptions,
  customItemUpdatedNotice,
  generateCustomItemIdempotencyKey,
  getOrCreateCustomItemKey,
  initialCustomItemDraft,
  isCustomItemInList,
  normalizeCustomItemName,
  rotateCustomItemKey,
  validateCustomItemName,
  withoutCustomItemTemplateId,
  type CustomItemKeyHolder
} from "./custom-item-form";
import type { NecessityLevel } from "@wooriai/domain";
import { NECESSITY_FILTER_OPTIONS } from "./item-filters";
import { bandDefinitions } from "./stage-bands";

const mobileRoot = process.cwd();
const repoFile = (relativePath: string) =>
  readFileSync(join(mobileRoot, "..", "..", relativePath), "utf8");
const contractsSource = () => repoFile("packages/contracts/src/schemas.ts");
const localBackendSource = () => readFileSync(join(mobileRoot, "src", "api", "local-backend.ts"), "utf8");

/**
 * 라운드 100 T3 — 커스텀 품목 입력의 검증·문구·기본값·조사·멱등 키 계약
 * (설계 문서 docs/5차/round100-custom-items-design.md §4.2 · §6.5 · §9.6).
 *
 * 이 모듈의 값은 짓는 값이 아니라 **미러**다: 수치는 packages/contracts(수기 단일 소스)와,
 * 실패 문장은 로컬 대역(src/api/local-backend.ts — 서버 §9.3과 같은 해요체)과 맞대는 드리프트
 * 가드를 여기 세운다(text-limits.test.ts · contracts-mirror.test.ts와 같은 관례).
 */
describe("이름 상한 — 계약 대조(수기 미러 드리프트 가드)", () => {
  it("customItemNameMaxLength가 packages/contracts의 CUSTOM_ITEM_NAME_MAX_LENGTH와 같다", () => {
    const match = contractsSource().match(/export const CUSTOM_ITEM_NAME_MAX_LENGTH = (\d+);/);
    expect(match, "계약에서 CUSTOM_ITEM_NAME_MAX_LENGTH를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(customItemNameMaxLength());
  });

  it("customItemMaxPerChild가 packages/contracts의 CUSTOM_ITEM_MAX_PER_CHILD와 같다", () => {
    const match = contractsSource().match(/export const CUSTOM_ITEM_MAX_PER_CHILD = (\d+);/);
    expect(match, "계약에서 CUSTOM_ITEM_MAX_PER_CHILD를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(customItemMaxPerChild());
  });
});

describe("이름 검증 — 트림·80자, 이미 들어 있는 값도 판정(text-limits 관례)", () => {
  it("트림 후 빈 이름은 입력을 청한다(로컬 대역과 같은 문장)", () => {
    expect(validateCustomItemName("")).toBe("준비물 이름을 입력해 주세요.");
    expect(validateCustomItemName("   ")).toBe("준비물 이름을 입력해 주세요.");
    // 로컬 대역(requireCustomItemName)이 던지는 그 바이트다 — 데모 세션 저장 실패와 시트의
    // 사전 판정이 같은 실패를 다른 말로 부르지 않는다.
    expect(localBackendSource()).toContain('throw new Error("준비물 이름을 입력해 주세요.");');
  });

  it("상한 이하(트림 기준)는 통과하고, 넘으면 상한을 말한다", () => {
    expect(validateCustomItemName("아기 욕조")).toBeNull();
    expect(validateCustomItemName("가".repeat(customItemNameMaxLength()))).toBeNull();
    // 앞뒤 공백은 트림 후 판정한다 — 공백 때문에 유효한 이름이 거절되지 않는다.
    expect(validateCustomItemName(`  ${"가".repeat(customItemNameMaxLength())}  `)).toBeNull();
    expect(validateCustomItemName("가".repeat(customItemNameMaxLength() + 1))).toBe(
      `준비물 이름은 ${customItemNameMaxLength()}자까지 입력할 수 있어요.`
    );
  });

  it("normalizeCustomItemName은 서버의 트림 후 재검증(§9.2)과 같은 정규화다", () => {
    expect(normalizeCustomItemName("  아기 욕조  ")).toBe("아기 욕조");
  });
});

describe("시기 밴드·필수도 — 어휘의 단일 소스", () => {
  it("시기 밴드 칩은 bandDefinitions의 네 라벨 그대로다(복제 금지 — ITEM-121 규칙)", () => {
    expect(customItemStageBandOptions()).toEqual(bandDefinitions.map((band) => band.label));
    expect(customItemStageBandOptions()).toHaveLength(4);
  });

  it("coerceStageBandLabel: 밴드 라벨 원문은 그대로, 아니면 폴백이다", () => {
    expect(coerceStageBandLabel("6-12개월", "0-6개월")).toBe("6-12개월");
    expect(coerceStageBandLabel("12-24개월 필수 준비", "0-6개월")).toBe("0-6개월");
    expect(coerceStageBandLabel(undefined, "24개월+")).toBe("24개월+");
  });

  it("필수도 3칩은 §9.6 확정 어휘이고, 스토어 소개문의 세 단계와 같다", () => {
    expect(customItemNecessityOptions()).toEqual([
      { value: "essential", label: "꼭 필요해요" },
      { value: "convenience", label: "있으면 편해요" },
      { value: "optional", label: "선택이에요" }
    ]);
    // 어휘를 짓지 않았다 — 스토어 소개문(docs/store/play-listing.md)이 이미 쓰는 세 단계다.
    const listing = repoFile("docs/store/play-listing.md");
    expect(listing).toContain("꼭 필요해요");
    expect(listing).toContain("있으면 편해요");
    expect(listing).toContain("선택이에요");
  });

  /**
   * R100-R ② — 필수도 어휘 이원화의 대응표 계약.
   *
   * 같은 `necessityLevel` 축을 두 어휘가 말한다: 입력 3칩은 권유형 문장(꼭 필요해요/있으면
   * 편해요/선택이에요 — §9.6 확정값·스토어 소개문의 세 단계), 목록 필터 칩·배지는 축약 명사
   * (필수/편의/선택 — NECESSITY_FILTER_OPTIONS, necessityBadgeLabel이 같은 표를 읽는다).
   * 이원화는 의도다(문구 변경 금지) — 이 테스트는 두 어휘가 **같은 value 축의 일대일 대응**임을
   * 값으로 못 박아, 한쪽 어휘에만 단계가 늘거나 라벨 축이 조용히 바뀌면 빨개지게 한다.
   */
  it("입력 3칩과 필터 어휘(필수/편의/선택)는 같은 value 축의 일대일 대응이다(드리프트 가드)", () => {
    // 대응표가 이 계약의 본문이다 — 어느 쪽 라벨이 바뀌어도, 어느 쪽 value가 늘어도 여기서 깨진다.
    const correspondence: Array<{ value: NecessityLevel; inputLabel: string; filterLabel: string }> = [
      { value: "essential", inputLabel: "꼭 필요해요", filterLabel: "필수" },
      { value: "convenience", inputLabel: "있으면 편해요", filterLabel: "편의" },
      { value: "optional", inputLabel: "선택이에요", filterLabel: "선택" }
    ];
    // 입력 3칩 = 대응표의 (value, inputLabel) 그대로, 같은 순서.
    expect(customItemNecessityOptions()).toEqual(
      correspondence.map(({ value, inputLabel }) => ({ value, label: inputLabel }))
    );
    // 필터 칩 = "전체" + 대응표의 (value, filterLabel) 그대로 — 한쪽만 늘면 여기서 어긋난다.
    expect(NECESSITY_FILTER_OPTIONS).toEqual([
      { value: "all", label: "전체" },
      ...correspondence.map(({ value, filterLabel }) => ({ value, label: filterLabel }))
    ]);
  });

  it("초안 기본값: 시기 = 지금 보고 있는 칩, 필수도 = essential(§1.2 — 준비율 분모 편입)", () => {
    expect(initialCustomItemDraft({ stageBand: "6-12개월" })).toEqual({
      name: "",
      stageBand: "6-12개월",
      necessityLevel: "essential"
    });
    // 수정 시트는 기존 값을 그대로 이어받는다.
    expect(
      initialCustomItemDraft({ name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "optional" })
    ).toEqual({ name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "optional" });
  });
});

describe("문구 — §9.6 확정값 · 해요체(DNC-018) · 이름 조사는 값에서(§6.5)", () => {
  it("진입 버튼·목록 표식은 §9.6 확정 문자열이다", () => {
    expect(customItemEntryLabel()).toBe("준비물 직접 추가하기");
    expect(customItemListMarkerText()).toBe("직접 추가한 준비물");
  });

  it("시트 문구는 이 앱의 기존 낱말만 쓴다(준비 시기·필수도 — 상세 제품 정보 탭의 그 라벨)", () => {
    const create = customItemSheetCopy("create");
    expect(create.title).toBe("준비물 직접 추가");
    expect(create.nameLabel).toBe("준비물 이름");
    expect(create.namePlaceholder).toBe("예: 아기 욕조");
    expect(create.stageSectionLabel).toBe("준비 시기");
    expect(create.necessitySectionLabel).toBe("필수도");
    expect(create.saveLabel).toBe("추가하기");
    expect(create.cancelLabel).toBe("닫기");
    const edit = customItemSheetCopy("edit");
    expect(edit.title).toBe("준비물 수정");
    expect(edit.saveLabel).toBe("저장하기");
    // 저장 버튼의 낭독 문장 — 시트 제목이 시야 밖일 때도 무엇을 저장하는지 들린다.
    expect(customItemSaveAccessibilityLabel("create")).toBe("직접 추가할 준비물 저장");
    expect(customItemSaveAccessibilityLabel("edit")).toBe("직접 추가한 준비물 수정 저장");
  });

  it("성공 토스트의 조사는 받침에서 갈린다(korean-particles — 리터럴 조사 금지)", () => {
    // 받침 없음 → 를.
    expect(customItemCreatedNotice("아기 욕조")).toBe("『아기 욕조』를 준비 목록에 추가했어요.");
    // 받침 있음 → 을.
    expect(customItemCreatedNotice("수유등")).toBe("『수유등』을 준비 목록에 추가했어요.");
    expect(customItemUpdatedNotice("아기 욕조")).toBe("『아기 욕조』를 수정했어요.");
    expect(customItemUpdatedNotice("수유등")).toBe("『수유등』을 수정했어요.");
  });

  it("수정/삭제 진입 문구와 낭독은 이름을 함께 말한다(items 탭 상태 버튼 관례)", () => {
    expect(customItemEditEntryLabel()).toBe("수정하기");
    expect(customItemDeleteEntryLabel()).toBe("지우기");
    expect(customItemEditAccessibilityLabel("아기 욕조")).toBe("아기 욕조 수정하기");
    expect(customItemDeleteAccessibilityLabel("아기 욕조")).toBe("아기 욕조 지우기");
  });

  it("삭제 확인은 파괴 동작 확인 관례(질문형 제목 + 취소 + 실행)이고 조사를 값에서 고른다", () => {
    const noBatchim = customItemDeleteConfirmCopy("아기 욕조");
    expect(noBatchim.title).toBe("직접 추가한 준비물을 지울까요?");
    expect(noBatchim.message).toBe("『아기 욕조』를 목록에서 지워요. 준비 상태도 함께 사라져요.");
    expect(noBatchim.confirmLabel).toBe("지우기");
    expect(noBatchim.cancelLabel).toBe("취소");
    expect(customItemDeleteConfirmCopy("수유등").message).toBe(
      "『수유등』을 목록에서 지워요. 준비 상태도 함께 사라져요."
    );
  });

  it("사용자 문장은 전부 해요체다(DNC-018)", () => {
    const sentences = [
      customItemCreatedNotice("아기 욕조"),
      customItemUpdatedNotice("아기 욕조"),
      customItemDeleteConfirmCopy("아기 욕조").message,
      customItemLimitExceededMessage(),
      customItemNotFoundMessage(),
      validateCustomItemName("")!,
      validateCustomItemName("가".repeat(customItemNameMaxLength() + 1))!
    ];
    for (const sentence of sentences) {
      expect(sentence, sentence).toMatch(/요[.?]$/);
    }
  });
});

describe("실패 문구 — 커스텀 전용 두 코드 + 로컬 대역 문장 + 폴백(§9.3 · api-error 표 관례)", () => {
  const fallback = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

  it("한도 200·미존재 문장은 설계 §9.3의 그 바이트다(로컬 대역·설계 문서와 대조)", () => {
    expect(customItemLimitExceededMessage()).toBe("직접 추가할 수 있는 준비물은 아이당 200개까지예요.");
    expect(customItemNotFoundMessage()).toBe("직접 추가한 준비물을 찾을 수 없어요.");
    // 설계 문서 §9.3 표의 문장과 같다(세 트랙의 단일 소스).
    const designDoc = repoFile("docs/5차/round100-custom-items-design.md");
    expect(designDoc).toContain(customItemLimitExceededMessage());
    expect(designDoc).toContain(customItemNotFoundMessage());
    // 로컬 대역도 같은 문장을 던진다(미존재는 리터럴, 한도는 상수 낀 템플릿).
    expect(localBackendSource()).toContain('"직접 추가한 준비물을 찾을 수 없어요."');
    expect(localBackendSource()).toContain("개까지예요.`");
  });

  it("서버 코드(ApiHttpError 모양)를 알아본다 — 커스텀 두 코드는 앱 전역 표 밖이라 이 모듈이 진다", () => {
    expect(customItemMutationErrorMessage({ code: "CUSTOM_ITEM_LIMIT_EXCEEDED" }, fallback)).toBe(
      customItemLimitExceededMessage()
    );
    expect(customItemMutationErrorMessage({ code: "CUSTOM_ITEM_NOT_FOUND" }, fallback)).toBe(
      customItemNotFoundMessage()
    );
    // 봉투 body 모양(apiErrorCodeOf의 둘째 갈래)도 같은 답이다.
    expect(
      customItemMutationErrorMessage(
        { body: { error: { code: "CUSTOM_ITEM_LIMIT_EXCEEDED", message: "server text" } } },
        fallback
      )
    ).toBe(customItemLimitExceededMessage());
    // 이 두 코드가 앱 전역 표(api-error.ts)에 없다는 전제를 값으로 확인한다 — 표에 들어오는
    // 날 이 모듈의 층 1은 중복이 되고, 이 단언이 그 사실을 먼저 소리 낸다.
    const table = readFileSync(join(mobileRoot, "src", "api", "api-error.ts"), "utf8");
    expect(table).not.toContain("CUSTOM_ITEM_LIMIT_EXCEEDED:");
    expect(table).not.toContain("CUSTOM_ITEM_NOT_FOUND:");
  });

  it("로컬 대역의 코드 없는 Error는 아는 문장(정확 일치)만 그대로 올린다", () => {
    expect(
      customItemMutationErrorMessage(new Error("직접 추가할 수 있는 준비물은 아이당 200개까지예요."), fallback)
    ).toBe("직접 추가할 수 있는 준비물은 아이당 200개까지예요.");
    expect(customItemMutationErrorMessage(new Error("준비물 이름을 입력해 주세요."), fallback)).toBe(
      "준비물 이름을 입력해 주세요."
    );
    // 모르는 문장은 그대로 노출하지 않는다(내부 문장이 화면으로 새는 문을 막는다 — 화이트리스트 규율).
    expect(customItemMutationErrorMessage(new Error("ECONNRESET something internal"), fallback)).toBe(fallback);
  });

  it("모르는 실패·코드는 호출부 폴백 그대로다(오프라인 문장은 useSaveErrorCopy가 진다)", () => {
    expect(customItemMutationErrorMessage(undefined, fallback)).toBe(fallback);
    expect(customItemMutationErrorMessage({ code: "FORBIDDEN" }, fallback)).toBe(fallback);
  });
});

describe("지출 프리필 게이트 — 커스텀이면 itemTemplateId 키를 걷는다(§4.3)", () => {
  it("카탈로그 품목이면 파라미터가 한 글자도 바뀌지 않는다(같은 객체)", () => {
    const params = { itemName: "카시트", itemTemplateId: "tmpl-1", categoryId: "cat-1" };
    expect(withoutCustomItemTemplateId(params, false)).toBe(params);
  });

  it("커스텀이면 itemTemplateId 키만 사라지고 나머지(이름·분류·출처)는 그대로다", () => {
    const stripped = withoutCustomItemTemplateId(
      { itemName: "아기 욕조", itemTemplateId: "custom-item-1", categoryId: "cat-1", from: "items" },
      true
    );
    expect("itemTemplateId" in stripped).toBe(false);
    expect(stripped).toEqual({ itemName: "아기 욕조", categoryId: "cat-1", from: "items" });
  });

  it("isCustomItemInList: tab=all 스냅샷에서 isCustom 마커로만 판정한다", () => {
    const items = [
      { id: "tmpl-1" },
      { id: "custom-1", isCustom: true }
    ];
    expect(isCustomItemInList(items, "custom-1")).toBe(true);
    expect(isCustomItemInList(items, "tmpl-1")).toBe(false);
    expect(isCustomItemInList(items, "missing")).toBe(false);
    expect(isCustomItemInList(undefined, "custom-1")).toBe(false);
  });
});

describe("멱등 키 — 초안 단위 홀더 + 본문 지문 묶음(§2.3 · 라운드 99 F1 형식)", () => {
  it("같은 지문이면 같은 키를 재사용하고, 지문이 바뀌면 새 키다(409 루프 방지)", () => {
    const holder: CustomItemKeyHolder = { current: null };
    const first = getOrCreateCustomItemKey(holder, "fp-1");
    expect(getOrCreateCustomItemKey(holder, "fp-1")).toBe(first);
    const second = getOrCreateCustomItemKey(holder, "fp-2");
    expect(second).not.toBe(first);
  });

  it("성공 시 폐기(rotate)하면 다음 제출은 새 멱등 범위다", () => {
    const holder: CustomItemKeyHolder = { current: null };
    const first = getOrCreateCustomItemKey(holder, "fp-1");
    rotateCustomItemKey(holder);
    expect(holder.current).toBeNull();
    expect(getOrCreateCustomItemKey(holder, "fp-1")).not.toBe(first);
  });

  it("키 접두는 custom-item- 다(서버 멱등 기록에서 onb-child-·set-child-와 구별)", () => {
    expect(generateCustomItemIdempotencyKey()).toMatch(/^custom-item-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("지문은 키 순서에 무관하고 undefined 필드를 떨군다(정규화 — 같은 본문 = 같은 지문)", () => {
    const a = customItemBodyFingerprint({ name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "essential" });
    const b = customItemBodyFingerprint({ necessityLevel: "essential", stageBand: "0-6개월", name: "아기 욕조" });
    expect(a).toBe(b);
    expect(
      customItemBodyFingerprint({ name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "essential", extra: undefined })
    ).toBe(a);
    expect(
      customItemBodyFingerprint({ name: "아기 욕조2", stageBand: "0-6개월", necessityLevel: "essential" })
    ).not.toBe(a);
  });
});
