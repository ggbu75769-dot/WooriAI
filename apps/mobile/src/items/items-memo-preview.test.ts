import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEM_MEMO_CARD_TITLE } from "./item-memo";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");

/**
 * 토스 이월 해소 트랙 T-C(2) — **목록 행의 품목 메모 1줄 미리보기(읽기 소비).**
 *
 * 품목 메모(기기 보관 — src/items/item-memo.store.ts)는 기능 라운드 1 트랙 D가 상세 화면에
 * 만들었다. 목록에서는 어느 품목에 메모를 남겼는지 보이지 않아 타일을 하나씩 열어야 했다.
 * 이 파일은 목록 행이 그 메모를 **읽기 전용**으로 소비하는 계약을 지킨다:
 *  - 메모가 있는 행에만 1줄 미리보기(numberOfLines={1}, 캡션 톤, "내 메모" 프리픽스);
 *  - 메모가 없으면 아무것도 그리지 않는다;
 *  - 저장·삭제는 여전히 상세 화면의 명시 버튼뿐이다(이 화면은 saveMemo를 부르지 않는다).
 *
 * 화면 렌더는 vitest에서 불가하므로 화면 계약의 확립된 관례대로 소스 그렙을 쓴다
 * (src/design-restore-p2b.test.ts 참고).
 */
describe("준비템 목록: 품목 메모 미리보기", () => {
  it("기기 보관 메모 표를 store에서 읽고, 프리픽스는 상세 카드와 같은 단일 소스를 쓴다", () => {
    const items = itemsSource();
    expect(items).toContain('import { useItemMemoStore } from "../../src/items/item-memo.store";');
    expect(items).toContain('import { ITEM_MEMO_CARD_TITLE } from "../../src/items/item-memo";');
    // "메모" 한 낱말은 지출 메모와 헷갈린다는 판정(item-memo.ts)을 화면이 다시 하지 않는다.
    expect(items).toContain("{ITEM_MEMO_CARD_TITLE} · {memoPreview}");
    expect(ITEM_MEMO_CARD_TITLE).toBe("내 메모");
  });

  it("store 훅은 모든 early return보다 위에 선다(조건부 훅 금지 — 과거 실기기 크래시 축)", () => {
    const items = itemsSource();
    const hookIndex = items.indexOf("const itemMemos = useItemMemoStore((state) => state.memos);");
    expect(hookIndex).toBeGreaterThan(-1);
    // 이 화면의 첫 early return(아이 미선택 카드)보다 앞이어야 한다 -- 에러/로딩/비세션
    // 반환은 전부 그 뒤에 있으므로 이 하나로 전 갈래가 덮인다.
    const firstEarlyReturn = items.indexOf("if (authToken && !childId) {");
    expect(firstEarlyReturn).toBeGreaterThan(-1);
    expect(hookIndex).toBeLessThan(firstEarlyReturn);
  });

  it("메모가 있는 행에만 1줄 미리보기를 그린다(없으면 렌더 0)", () => {
    const items = itemsSource();
    // 행 단위 조회는 itemTemplateId(= item.id) 키다 -- 아이 전환과 무관한 물건 메모.
    expect(items).toContain("const memoPreview = itemMemos[item.id];");
    // 조건부 렌더: 값이 없으면(undefined/빈 문자열 없음 -- 스토어가 빈 메모를 저장하지 않는다)
    // 노드 자체가 서지 않는다.
    expect(items).toMatch(/\{memoPreview \? \(\s*<Text\s+numberOfLines=\{1\}/);
  });

  it("읽기 소비만 한다 -- 목록 화면에는 저장 경로가 없다", () => {
    const items = itemsSource();
    expect(items).not.toContain("saveMemo");
    expect(items).not.toContain("applyItemMemoSave");
    expect(items).not.toContain("normalizeItemMemo");
  });

  it("미리보기는 세션 렌더의 행 발밑 슬롯에만 있다(ITEM-001 비세션 캡처 무접촉)", () => {
    const items = itemsSource();
    const previewReturnIndex = items.indexOf("if (!hasSession) {");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    // 비세션 미리보기 갈래(픽셀락 캡처 경로)가 반환된 **뒤**에만 memoPreview가 그려진다.
    expect(items.indexOf("const memoPreview = itemMemos[item.id];")).toBeGreaterThan(previewReturnIndex);
  });
});
