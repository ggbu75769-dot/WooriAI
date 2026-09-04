import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyItemMemoSave,
  itemMemoSaveAccessibilityLabel,
  itemMemoSavedNotice,
  normalizeItemMemo,
  sanitizedItemMemos,
  ITEM_MEMO_CARD_TITLE,
  ITEM_MEMO_CLEARED_NOTICE,
  ITEM_MEMO_DEVICE_ONLY_NOTICE,
  ITEM_MEMO_INPUT_LABEL,
  ITEM_MEMO_INPUT_PLACEHOLDER,
  ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE,
  ITEM_MEMO_MAX_LENGTH,
  ITEM_MEMO_SAVE_LABEL,
  ITEM_MEMO_SAVED_NOTICE
} from "./item-memo";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 기능 라운드 1 트랙 D — 품목 메모(기기 보관)의 판정·문구 계약.
 *
 * 지켜야 하는 것:
 *  (a) 상한·트림·빈 메모 삭제·품목별 격리 — 저장 판정은 전부 이 순수 모듈의 것이다.
 *  (b) "이 기기에만 저장돼요" 고지 — 서버 동기화가 없다는 사실을 화면이 숨기지 않는다.
 *  (c) 가격을 말하지 않는다(준비템 가격 표시는 사용자 결정 대기 잠금).
 */
describe("메모 정규화와 상한", () => {
  it("앞뒤 공백을 지우고 200자 상한에서 자른다", () => {
    expect(ITEM_MEMO_MAX_LENGTH).toBe(200);
    expect(normalizeItemMemo("  산후조리원에서 준다고 함  ")).toBe("산후조리원에서 준다고 함");
    expect(normalizeItemMemo("가".repeat(500))).toHaveLength(ITEM_MEMO_MAX_LENGTH);
    // 공백뿐인 입력은 "메모 없음"이다 -- 트림이 상한 자르기보다 먼저다.
    expect(normalizeItemMemo("   \n\t  ")).toBe("");
  });

  it("상한 절단은 코드포인트 단위다 -- 이모지(서로게이트 쌍)를 반으로 자르지 않는다 (리뷰 L-1)", () => {
    // 두 시점: 종전 String.prototype.slice(0, 200)은 UTF-16 단위라 200번째 자리가 서로게이트
    // 쌍의 한가운데면 홀로 남은 high surrogate(U+D800대)가 저장됐다 -- 렌더에서 깨진 글자다.
    // 이제 Array.from(코드포인트 반복자) 절단이라 경계의 이모지는 통째로 남거나 통째로 잘린다.
    const exactly200 = "가".repeat(199) + "👶";
    expect(normalizeItemMemo(exactly200)).toBe(exactly200);
    expect(normalizeItemMemo(exactly200 + "뒤에 더")).toBe(exactly200);
    // 잘린 결과 어디에도 홀로 남은 서로게이트가 없다(well-formed — 짝 없는 high/low 검출).
    expect(normalizeItemMemo(exactly200 + "🍼")).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    );
    // 코드포인트 200개 기준이므로 UTF-16 길이는 200을 넘을 수 있다 -- 이것이 새 상한의 뜻이다.
    expect(Array.from(normalizeItemMemo(exactly200 + "🍼"))).toHaveLength(ITEM_MEMO_MAX_LENGTH);
  });
});

describe("저장 판정 (applyItemMemoSave)", () => {
  it("품목별로 격리된다 -- 한 품목의 저장이 다른 품목의 메모를 건드리지 않는다", () => {
    const first = applyItemMemoSave({}, "item-stroller", "언니네서 물려받기로");
    const both = applyItemMemoSave(first, "item-bottle", "선물 후보");
    expect(both).toEqual({ "item-stroller": "언니네서 물려받기로", "item-bottle": "선물 후보" });

    // 한쪽을 고쳐도 다른 쪽은 그대로다.
    const edited = applyItemMemoSave(both, "item-bottle", "이미 받음");
    expect(edited["item-stroller"]).toBe("언니네서 물려받기로");
    expect(edited["item-bottle"]).toBe("이미 받음");

    // 입력 표를 변형하지 않는다(새 표를 돌려준다).
    expect(both["item-bottle"]).toBe("선물 후보");
  });

  it("빈/공백 메모 저장은 그 품목의 메모 삭제다 (빈 문자열을 값으로 쌓지 않는다)", () => {
    const table = { "item-stroller": "언니네서 물려받기로", "item-bottle": "선물 후보" };
    const cleared = applyItemMemoSave(table, "item-bottle", "   ");
    expect(cleared).toEqual({ "item-stroller": "언니네서 물려받기로" });
    expect("item-bottle" in cleared).toBe(false);
  });

  it("바뀌는 것이 없으면 같은 객체를 돌려준다 (no-op 관례 -- 구독자가 헛돌지 않는다)", () => {
    const table = { "item-stroller": "언니네서 물려받기로" };
    // 없는 키를 빈 메모로 지우기 · 같은 값 다시 저장 · 빈 키 -- 셋 다 no-op.
    expect(applyItemMemoSave(table, "item-bottle", "")).toBe(table);
    expect(applyItemMemoSave(table, "item-stroller", "  언니네서 물려받기로  ")).toBe(table);
    expect(applyItemMemoSave(table, "   ", "값")).toBe(table);
  });

  it("저장 값은 정규화(트림·상한)를 지난다", () => {
    const saved = applyItemMemoSave({}, "item-stroller", `  ${"가".repeat(500)}  `);
    expect(saved["item-stroller"]).toHaveLength(ITEM_MEMO_MAX_LENGTH);
  });
});

describe("문구 계약 (DNC-018 해요체 · 가격 언급 금지)", () => {
  it("기기 보관 고지는 저장 위치의 사실과 가족 비공유를 함께 말한다", () => {
    expect(ITEM_MEMO_DEVICE_ONLY_NOTICE).toContain("이 기기에만 저장돼요");
    expect(ITEM_MEMO_DEVICE_ONLY_NOTICE).toContain("가족");
    // 서버에 저장되는 것처럼 읽히는 낱말 금지.
    expect(ITEM_MEMO_DEVICE_ONLY_NOTICE).not.toContain("서버");
    expect(ITEM_MEMO_DEVICE_ONLY_NOTICE).not.toContain("동기화돼요");
  });

  it("저장/삭제 안내가 실제 일어난 일을 말한다 (빈 메모는 저장이 아니라 삭제)", () => {
    expect(itemMemoSavedNotice("산후조리원에서 준다고 함")).toBe(ITEM_MEMO_SAVED_NOTICE);
    expect(itemMemoSavedNotice("   ")).toBe(ITEM_MEMO_CLEARED_NOTICE);
    expect(ITEM_MEMO_SAVED_NOTICE).toBe("메모를 저장했어요.");
    expect(ITEM_MEMO_CLEARED_NOTICE).toBe("메모를 지웠어요.");
  });

  it("기기 저장 실패 문구는 연결을 말하지 않고, 상태 저장 실패와 같은 꼴이다 (리뷰 M-3)", () => {
    // 두 시점: 종전 "메모가 이 기기에 저장되지 않았어요."는 같은 화면·같은 원인(기기 저장
    // 실패)의 상태 문구("준비 상태를 기기에 저장하지 못했어요.")와 문법이 갈렸다 -- 라운드
    // 76 A 대장의 바늘("저장하지 못했어요")을 피하려던 우회가 원인이다. 그 대장은 수 고정
    // 스윕이 아니라 **등재형**(이유가 적힌 면제 목록 -- offline-aware-screens.ts)이라, 이제
    // 같은 꼴로 맞추고 src/items/item-memo.ts를 면제 목록에 등재했다(상태 문구와 같은 사유).
    expect(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE).toBe("메모를 이 기기에 저장하지 못했어요. 다시 눌러 주세요.");
    expect(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE).toContain("다시 눌러 주세요");
    expect(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE).not.toContain("연결");
    expect(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE).not.toContain("잠시 후");
    expect(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE).not.toContain("불러오지 못했어요");
  });

  it("어느 문구도 가격을 말하지 않는다 (가격 표시는 사용자 결정 대기 잠금)", () => {
    for (const copy of [
      ITEM_MEMO_CARD_TITLE,
      ITEM_MEMO_DEVICE_ONLY_NOTICE,
      ITEM_MEMO_INPUT_LABEL,
      ITEM_MEMO_INPUT_PLACEHOLDER,
      ITEM_MEMO_SAVE_LABEL,
      ITEM_MEMO_SAVED_NOTICE,
      ITEM_MEMO_CLEARED_NOTICE,
      ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE
    ]) {
      // "원"은 금액 꼴(숫자 뒤)만 막는다 -- "산후조리원" 같은 낱말 속 글자는 가격이 아니다.
      expect(copy).not.toMatch(/[0-9,]\s*원|만\s*원|가격|₩/);
    }
  });

  it("저장 버튼의 낭독 문장은 품목 이름 + 고정 명사 꼬리다 (조사 분기 없음)", () => {
    expect(itemMemoSaveAccessibilityLabel("네이처러브 기저귀 팬티형")).toBe("네이처러브 기저귀 팬티형 메모 저장");
    expect(itemMemoSaveAccessibilityLabel("  ")).toBe(ITEM_MEMO_SAVE_LABEL);
  });
});

describe("persist 블롭 방어 (sanitizedItemMemos)", () => {
  it("문자열 키·문자열 값 쌍만 살리고 값은 정규화한다", () => {
    const sanitized = sanitizedItemMemos({
      memos: {
        "item-stroller": "  언니네서 물려받기로  ",
        "item-long": "가".repeat(500),
        "item-number": 123,
        "item-empty": "   ",
        "": "주인 없는 값"
      }
    });
    expect(sanitized).toEqual({
      "item-stroller": "언니네서 물려받기로",
      "item-long": "가".repeat(ITEM_MEMO_MAX_LENGTH)
    });
  });

  it("표 모양이 아니면 빈 표로 떨어진다 (손상 blob이 화면을 깨지 않는다)", () => {
    expect(sanitizedItemMemos(undefined)).toEqual({});
    expect(sanitizedItemMemos(null)).toEqual({});
    expect(sanitizedItemMemos("not-an-object")).toEqual({});
    expect(sanitizedItemMemos({ memos: "not-a-table" })).toEqual({});
    expect(sanitizedItemMemos({ memos: ["배", "열"] })).toEqual({});
  });
});

/**
 * 화면 배선 계약(최소 소스 계약 -- amount-presets-wiring.test.ts 관례). 슬라이스 앞에는
 * 존재 가드를 세운다: 앵커가 사라지면 -1 슬라이스 위에서 단언이 헛돌기 때문이다.
 */
describe("품목 상세 배선 (app/items/[itemTemplateId].tsx)", () => {
  const detail = () => source("app/items/[itemTemplateId].tsx");

  it("고지·상한·문구를 화면에 인라인하지 않고 이 모듈에서 가져다 쓴다", () => {
    const screen = detail();
    expect(screen).toContain('from "../../src/items/item-memo"');
    expect(screen).toContain('from "../../src/items/item-memo.store"');
    expect(screen).toContain("{ITEM_MEMO_DEVICE_ONLY_NOTICE}");
    expect(screen).toContain("maxLength={ITEM_MEMO_MAX_LENGTH}");
    expect(screen).toContain("{ITEM_MEMO_CARD_TITLE}");
    expect(screen).toContain("label={ITEM_MEMO_SAVE_LABEL}");
    expect(screen).toContain("accessibilityLabel={itemMemoSaveAccessibilityLabel(visibleDetail.name)}");
    // 고지 문장을 화면에 다시 적지 않는다(두 벌이 되면 한쪽만 고쳐진다).
    expect(screen).not.toContain('"이 메모는 이 기기에만 저장돼요');
  });

  it("메모 입력은 multiline TextInput이고 글꼴 배율을 막지 않는다", () => {
    const screen = detail();
    const inputAt = screen.indexOf("accessibilityLabel={ITEM_MEMO_INPUT_LABEL}");
    expect(inputAt, "메모 입력 칸").toBeGreaterThan(-1);
    const tagStart = screen.lastIndexOf("<TextInput", inputAt);
    const tagEnd = screen.indexOf("/>", inputAt);
    expect(tagStart).toBeGreaterThan(-1);
    expect(tagEnd).toBeGreaterThan(tagStart);
    const inputTag = screen.slice(tagStart, tagEnd);
    expect(inputTag).toContain("multiline");
    expect(inputTag).toContain("placeholder={ITEM_MEMO_INPUT_PLACEHOLDER}");
    // 큰 글씨 설정을 존중한다 -- 배율을 끄는 프롭을 걸지 않는다.
    expect(inputTag).not.toContain("allowFontScaling={false}");
  });

  it("저장은 명시 버튼 하나다 -- 자동 저장(blur/언마운트)이 없다", () => {
    const screen = detail();
    const cardAt = screen.indexOf("{ITEM_MEMO_CARD_TITLE}");
    expect(cardAt, "메모 카드").toBeGreaterThan(-1);
    const memoBlock = screen.slice(cardAt);
    expect(memoBlock).toContain("onPress={handleMemoSave}");
    // 입력 칸에 저장을 거는 자동 경로가 없다.
    expect(memoBlock).not.toContain("onBlur");
    expect(memoBlock).not.toContain("onEndEditing");
  });

  it("저장 실패는 무음이 아니다 -- 기존 기기 저장 실패 배너 한 자리로 알린다", () => {
    const screen = detail();
    expect(screen).toContain("setStatusErrorMessage(ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE)");
    // 그 배너는 이 화면에 이미 서 있다(ITEM-124 -- Toast tone="error" · 자기 낭독).
    expect(screen).toContain('{statusErrorMessage ? <Toast message={statusErrorMessage} tone="error" /> : null}');
  });

  it("저장 진입은 실패 배너를 먼저 지운다 -- 실패 후 재시도 성공 때 배너+토스트 동시 표시 금지 (리뷰 H-2)", () => {
    // 재현(두 시점): 저장 실패로 statusErrorMessage가 선 채 다시 [메모 저장]을 눌러 성공하면,
    // 종전 handleMemoSave는 성공 갈래에서 memoNotice만 세워 "저장 실패" 배너와 "저장했어요"
    // 토스트가 **동시에** 남았다. 상태 뮤테이션 경로(applyStatusChange)와 같은 관례로 진입
    // 시점에 setStatusErrorMessage(null)을 지난다.
    const screen = detail();
    const handlerAt = screen.indexOf("const handleMemoSave = ");
    expect(handlerAt, "handleMemoSave가 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const saveCallAt = screen.indexOf("saveMemo(itemTemplateId, memoText)", handlerAt);
    expect(saveCallAt, "저장 호출이 실재해야 자르는 구간이 참이다").toBeGreaterThan(handlerAt);
    const entryBlock = screen.slice(handlerAt, saveCallAt);
    expect(entryBlock).toContain("setStatusErrorMessage(null);");
  });

  it("빈 itemTemplateId의 no-op 저장은 성공 토스트를 만들지 않는다 (리뷰 L-2 -- id 가드)", () => {
    // applyItemMemoSave는 빈 키를 no-op으로 돌려주는데(위 저장 판정 테스트), 종전 화면은 그
    // no-op에도 "메모를 저장했어요."를 띄웠다 -- 일어나지 않은 일을 말하는 토스트다. 둘 중
    // 구현이 작은 쪽(id 가드)으로: 키가 비면 저장 경로에 들어가지 않는다.
    const screen = detail();
    const handlerAt = screen.indexOf("const handleMemoSave = ");
    const saveCallAt = screen.indexOf("saveMemo(itemTemplateId, memoText)", handlerAt);
    const entryBlock = screen.slice(handlerAt, saveCallAt);
    expect(entryBlock).toContain("if (itemTemplateId.trim().length === 0) return;");
  });

  it("세션 게이트: 메모 카드는 비세션 프리뷰(ITEM-002 픽셀락 캡처)에 렌더되지 않는다", () => {
    const screen = detail();
    const cardAt = screen.indexOf("{ITEM_MEMO_CARD_TITLE}");
    expect(cardAt, "메모 카드").toBeGreaterThan(-1);
    // 카드를 세우는 가장 가까운 앞선 조건이 hasSession이다.
    const gateAt = screen.lastIndexOf("{hasSession ? (", cardAt);
    expect(gateAt).toBeGreaterThan(-1);
    // 그 사이에 다른 카드 경계가 없다(이 게이트가 정말 메모 카드의 것이라는 존재 가드).
    expect(screen.slice(gateAt, cardAt)).not.toContain("</Card>");
  });

  it("DNC-010: 메모 카드는 제휴 고지-구매 CTA 인접의 바깥(뒤)에 선다", () => {
    const screen = detail();
    const disclosureAt = screen.indexOf("{affiliateDisclosureText ? <AffiliateDisclosure");
    const ctaAt = screen.indexOf('label="바로 구매하기"');
    const memoCardAt = screen.indexOf("{ITEM_MEMO_CARD_TITLE}");
    expect(disclosureAt, "제휴 고지").toBeGreaterThan(-1);
    expect(ctaAt, "구매 CTA").toBeGreaterThan(-1);
    expect(memoCardAt, "메모 카드").toBeGreaterThan(-1);
    expect(memoCardAt).toBeGreaterThan(ctaAt);
    expect(ctaAt).toBeGreaterThan(disclosureAt);
  });
});
