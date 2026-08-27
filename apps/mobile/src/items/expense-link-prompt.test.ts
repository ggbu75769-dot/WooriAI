import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  expenseLinkParams,
  expenseLinkPromptPlacement,
  isExpenseLinkPromptRow,
  isExpenseLinkPromptStale,
  itemDetailExpenseLinkAccessibilityLabel,
  itemListExpenseLinkAccessibilityLabel,
  itemListExpenseLinkLabel,
  nextExpenseLinkPrompt,
  sameExpenseLinkPromptScope,
  shouldShowItemDetailExpenseLink,
  ITEM_DETAIL_EXPENSE_LINK_LABEL,
  ITEM_LIST_EXPENSE_LINK_LABEL,
  type ExpenseLinkPrompt,
  type ExpenseLinkPromptScope
} from "./expense-link-prompt";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 37 UX-I: 준비템 ↔ 지출 기록의 빈 고리.
 *
 * 회귀 가드가 지켜야 하는 것 두 가지:
 *  (a) 앱 밖에서 산 사람도 준비템에서 지출로 갈 수 있다 (제휴 링크 클릭이 전제가 아니다).
 *  (b) 그 진입점이 제휴 고지-구매 CTA 인접(DNC-010)과 픽셀 락 비세션 캡처를 건드리지 않는다.
 */
describe("지출 기록 프리필 파라미터", () => {
  it("/expenses/new가 읽는 두 파라미터만 만든다 (기존 계약 재사용)", () => {
    expect(expenseLinkParams({ itemName: "젖병", itemTemplateId: "tpl-1" })).toEqual({
      itemName: "젖병",
      itemTemplateId: "tpl-1"
    });
    // 새 파라미터를 더하지 않는다 -- 저장 경로가 갈라지면 "지출 저장 = 준비 완료" 연결이 한쪽에서만 돈다.
    expect(Object.keys(expenseLinkParams({ itemName: "젖병", itemTemplateId: "tpl-1" })).sort()).toEqual([
      "itemName",
      "itemTemplateId"
    ]);
  });
});

describe("아이템 상세 상시 진입점", () => {
  it("세션이 있을 때만 노출한다 (비세션 픽셀 락 캡처 불변)", () => {
    expect(shouldShowItemDetailExpenseLink({ hasSession: true, clickedPromptVisible: false })).toBe(true);
    expect(shouldShowItemDetailExpenseLink({ hasSession: false, clickedPromptVisible: false })).toBe(false);
  });

  /**
   * 라운드 37 G-8 — 링크 클릭 후 같은 화면에 지출 기록 입구가 둘이던 문제.
   *
   * 상시 진입점("이미 샀어요 · 지출로 기록")과 클릭 후 카드의 기본 버튼("지출 기록하고 준비 완료")은
   * 목적지도 행동도 같다. 함께 보이면 사용자는 둘의 차이를 찾느라 멈춘다.
   */
  it("G-8: 링크 클릭 후 카드가 서 있는 동안에는 상시 버튼을 숨긴다 (중복 CTA 제거)", () => {
    expect(shouldShowItemDetailExpenseLink({ hasSession: true, clickedPromptVisible: true })).toBe(false);
    // 카드가 사라지면 다시 돌아온다 -- 영구히 없어지는 것이 아니다.
    expect(shouldShowItemDetailExpenseLink({ hasSession: true, clickedPromptVisible: false })).toBe(true);
    // 세션 게이트가 먼저다(비세션에서는 카드 유무와 무관하게 없다).
    expect(shouldShowItemDetailExpenseLink({ hasSession: false, clickedPromptVisible: true })).toBe(false);
  });

  it("문구는 해요체 권유형이고 압박/죄책감 표현이 없다 (DNC-018)", () => {
    expect(ITEM_DETAIL_EXPENSE_LINK_LABEL).toBe("이미 샀어요 · 지출로 기록");
    for (const forbidden of ["아직", "빠졌", "놓쳤", "잊지", "해야", "필수로"]) {
      expect(ITEM_DETAIL_EXPENSE_LINK_LABEL).not.toContain(forbidden);
    }
  });

  it("스크린 리더 문장에 준비템 이름을 담는다", () => {
    expect(itemDetailExpenseLinkAccessibilityLabel("네이처러브 기저귀")).toBe(
      "네이처러브 기저귀 이미 샀어요, 지출로 기록"
    );
  });
});

const scope = (overrides: Partial<ExpenseLinkPromptScope> = {}): ExpenseLinkPromptScope => ({
  childId: "child-a",
  stageLabel: "0-6개월",
  necessityFilter: "all",
  searchText: "",
  ...overrides
});

describe("목록 인라인 프롬프트 노출 조건", () => {
  const prompt: ExpenseLinkPrompt = { itemTemplateId: "tpl-1", itemName: "젖병", scope: scope() };

  it("준비했어요(prepared) 성공에서만 프롬프트를 남긴다", () => {
    expect(
      nextExpenseLinkPrompt({ itemTemplateId: "tpl-1", itemName: "젖병", status: "prepared", scope: scope() })
    ).toEqual(prompt);
  });

  it("괜찮아요(not_needed)/찜/선물 받음에는 남기지 않는다 -- 사지 않기로 한 판단에 기록을 권하지 않는다", () => {
    for (const status of ["not_needed", "interested", "gifted", "not_prepared"] as const) {
      expect(nextExpenseLinkPrompt({ itemTemplateId: "tpl-1", itemName: "젖병", status, scope: scope() })).toBeNull();
    }
  });

  it("이름이나 id가 비면 남기지 않는다", () => {
    expect(
      nextExpenseLinkPrompt({ itemTemplateId: "", itemName: "젖병", status: "prepared", scope: scope() })
    ).toBeNull();
    expect(
      nextExpenseLinkPrompt({ itemTemplateId: "tpl-1", itemName: "", status: "prepared", scope: scope() })
    ).toBeNull();
  });

  it("세션이 없거나 프롬프트가 없으면 아무것도 그리지 않는다", () => {
    expect(expenseLinkPromptPlacement({ hasSession: false, prompt, scope: scope(), visibleItemIds: ["tpl-1"] })).toBe(
      "none"
    );
    expect(
      expenseLinkPromptPlacement({ hasSession: true, prompt: null, scope: scope(), visibleItemIds: ["tpl-1"] })
    ).toBe("none");
  });

  it("행이 아직 목록에 있으면 그 행 아래(inline)", () => {
    expect(
      expenseLinkPromptPlacement({ hasSession: true, prompt, scope: scope(), visibleItemIds: ["tpl-0", "tpl-1"] })
    ).toBe("inline");
  });

  it("준비완료로 옮겨 가 행이 사라지면 목록 위 한 줄(detached)로 살아남는다", () => {
    // "지금 필요" 탭에서 준비했어요를 누르면 그 항목은 탭이 바뀌며 목록에서 빠진다.
    // inline만 그렸다면 링크가 깜빡이고 사라져 기능이 사실상 죽는다.
    expect(expenseLinkPromptPlacement({ hasSession: true, prompt, scope: scope(), visibleItemIds: ["tpl-0"] })).toBe(
      "detached"
    );
    expect(expenseLinkPromptPlacement({ hasSession: true, prompt, scope: scope(), visibleItemIds: [] })).toBe(
      "detached"
    );
  });

  it("인라인은 오직 한 행에서만 뜬다", () => {
    expect(isExpenseLinkPromptRow({ placement: "inline", prompt, itemTemplateId: "tpl-1" })).toBe(true);
    expect(isExpenseLinkPromptRow({ placement: "inline", prompt, itemTemplateId: "tpl-0" })).toBe(false);
    // detached로 자리를 옮긴 뒤에는 어느 행에도 붙지 않는다(같은 줄이 두 번 보이지 않는다).
    expect(isExpenseLinkPromptRow({ placement: "detached", prompt, itemTemplateId: "tpl-1" })).toBe(false);
    expect(isExpenseLinkPromptRow({ placement: "none", prompt, itemTemplateId: "tpl-1" })).toBe(false);
  });
});

/**
 * 라운드 37 G-3 — 프롬프트의 수명.
 *
 * 이 줄은 화면 상태로만 살아 있어서, 목록이 통째로 바뀐 뒤에도 그대로 떠 있었다. 그중 아이 전환은
 * 표시 문제가 아니라 **데이터 오염**이다: A에서 남긴 줄을 B로 바꾼 뒤 누르면 B의 지출로 기록되고,
 * 서버가 그 지출에 딸린 B의 준비템까지 준비 완료로 바꾼다(R19-B).
 */
describe("G-3 프롬프트 수명 (어떤 상태 변화가 프롬프트를 무효로 만드는가)", () => {
  const prompt: ExpenseLinkPrompt = { itemTemplateId: "tpl-1", itemName: "젖병", scope: scope() };

  it("아이를 바꾸면 무효다 -- 다른 아이의 지출/준비템을 건드리지 않는다", () => {
    expect(isExpenseLinkPromptStale({ prompt, scope: scope({ childId: "child-b" }) })).toBe(true);
    // 그리지도 않는다(상태에서 걷히기 전 한 프레임도 새지 않게).
    expect(
      expenseLinkPromptPlacement({
        hasSession: true,
        prompt,
        scope: scope({ childId: "child-b" }),
        visibleItemIds: ["tpl-1"]
      })
    ).toBe("none");
  });

  it("시기 밴드 칩을 바꾸면 무효다", () => {
    expect(isExpenseLinkPromptStale({ prompt, scope: scope({ stageLabel: "6-12개월" }) })).toBe(true);
  });

  it("검색어·필수도 칩을 바꾸면 무효다", () => {
    expect(isExpenseLinkPromptStale({ prompt, scope: scope({ searchText: "젖" }) })).toBe(true);
    expect(isExpenseLinkPromptStale({ prompt, scope: scope({ necessityFilter: "essential" }) })).toBe(true);
  });

  it("같은 목록이면 그대로 살아 있다 -- 정상 경로(준비완료 탭으로 옮겨 간 항목)를 끊지 않는다", () => {
    expect(isExpenseLinkPromptStale({ prompt, scope: scope() })).toBe(false);
    expect(
      expenseLinkPromptPlacement({ hasSession: true, prompt, scope: scope(), visibleItemIds: [] })
    ).toBe("detached");
    // 프롬프트가 없으면 "무효"라고 말할 것도 없다(정리 대상이 아니다).
    expect(isExpenseLinkPromptStale({ prompt: null, scope: scope({ childId: "child-b" }) })).toBe(false);
  });

  it("검색어 비교는 목록 필터와 같은 정규화를 쓴다 -- 공백/대소문자는 목록을 바꾸지 않는다", () => {
    const typed: ExpenseLinkPrompt = { ...prompt, scope: scope({ searchText: "Bottle" }) };
    expect(isExpenseLinkPromptStale({ prompt: typed, scope: scope({ searchText: " bottle " }) })).toBe(false);
    expect(sameExpenseLinkPromptScope(scope({ searchText: "  " }), scope({ searchText: "" }))).toBe(true);
  });

  it("상태 탭은 좌표에 없다 -- 준비완료 탭으로 그 항목을 보러 가는 이동은 프롬프트를 버리는 행동이 아니다", () => {
    expect(Object.keys(scope()).sort()).toEqual(["childId", "necessityFilter", "searchText", "stageLabel"]);
  });
});

describe("목록 프롬프트 문구", () => {
  it("인라인에는 이름을 넣지 않는다 (바로 위 카드가 이미 말한다)", () => {
    expect(itemListExpenseLinkLabel("inline", "젖병")).toBe("지출도 기록할까요?");
    expect(ITEM_LIST_EXPENSE_LINK_LABEL).toBe("지출도 기록할까요?");
  });

  it("떨어져 나온 줄에는 『』로 이름을 붙인다 (구매 확인 프롬프트와 같은 표기)", () => {
    expect(itemListExpenseLinkLabel("detached", "젖병")).toBe("『젖병』 지출도 기록할까요?");
  });

  it("두 자리 모두 스크린 리더에는 이름을 함께 읽어 준다", () => {
    expect(itemListExpenseLinkAccessibilityLabel("젖병")).toBe("젖병 지출도 기록할까요?");
  });

  it("권유형 물음이지 재촉이 아니다 (DNC-018)", () => {
    expect(ITEM_LIST_EXPENSE_LINK_LABEL.endsWith("?")).toBe(true);
    for (const forbidden of ["해야", "잊지", "빼먹", "지금 바로", "필수"]) {
      expect(ITEM_LIST_EXPENSE_LINK_LABEL).not.toContain(forbidden);
    }
  });
});

describe("화면 배선 (source contract)", () => {
  const detailSource = () => source("app/items/[itemTemplateId].tsx");
  const itemsSource = () => source("app/(tabs)/items.tsx");

  it("상세: 진입점이 clickedTitle(제휴 링크 클릭) 게이트 밖에 있다", () => {
    const detail = detailSource();
    const linkIndex = detail.indexOf("ITEM_DETAIL_EXPENSE_LINK_LABEL}");
    const clickedGateIndex = detail.indexOf("{clickedTitle ? (");
    expect(linkIndex).toBeGreaterThan(-1);
    expect(clickedGateIndex).toBeGreaterThan(-1);
    // 링크 클릭 뒤에만 나타나던 카드보다 **앞에** 있다 = 그 게이트 안이 아니다.
    expect(linkIndex).toBeLessThan(clickedGateIndex);
    // 기존 카드의 경로는 그대로 남는다(구매 직후 흐름은 건드리지 않는다).
    expect(detail).toContain('label="지출 기록하고 준비 완료"');
  });

  it("상세: 제휴 고지와 구매 CTA 사이에 끼지 않고 CTA 아래에 놓인다 (DNC-010)", () => {
    const detail = detailSource();
    const disclosureIndex = detail.indexOf("<AffiliateDisclosure");
    const ctaIndex = detail.indexOf('label="바로 구매하기"');
    const linkIndex = detail.indexOf("ITEM_DETAIL_EXPENSE_LINK_LABEL}");
    expect(ctaIndex).toBeGreaterThan(disclosureIndex);
    expect(linkIndex).toBeGreaterThan(ctaIndex);
  });

  it("상세: 세션 게이트를 거치고 기존 프리필 경로를 재사용한다", () => {
    const detail = detailSource();
    expect(detail).toContain(
      "{shouldShowItemDetailExpenseLink({ hasSession, clickedPromptVisible: Boolean(clickedTitle) }) ? ("
    );
    expect(detail).toContain('pathname: "/expenses/new"');
    expect(detail).toContain("params: expenseLinkParams({ itemName: visibleDetail.name, itemTemplateId })");
    expect(detail).toContain("accessibilityLabel={itemDetailExpenseLinkAccessibilityLabel(visibleDetail.name)}");
    // 문구는 화면에 인라인하지 않는다 -- 순수 모듈이 단일 소스다.
    expect(detail).not.toContain('label="이미 샀어요');
  });

  it("목록: 준비했어요 성공 직후에만 프롬프트를 세우고, 새 조작이 시작되면 걷는다", () => {
    const items = itemsSource();
    expect(items).toContain("const [expenseLinkPrompt, setExpenseLinkPrompt] = useState<ExpenseLinkPrompt | null>(null);");
    expect(items).toContain("setExpenseLinkPrompt(null);");
    expect(items).toContain("nextExpenseLinkPrompt({");
    // 판정은 순수 모듈이 한다 -- 화면이 status를 직접 비교하지 않는다.
    expect(items).not.toContain('variables.status === "prepared" ? { itemTemplateId');
  });

  it("목록: 카드/모달이 아니라 한 줄 텍스트 링크다", () => {
    const items = itemsSource();
    expect(items).toContain("<TextButton");
    expect(items).toContain("label={itemListExpenseLinkLabel(expenseLinkPlacement, item.name)}");
    expect(items).toContain("accessibilityLabel={itemListExpenseLinkAccessibilityLabel(item.name)}");
    // 프롬프트 전용 Alert/모달을 세우지 않는다.
    expect(items).not.toContain('Alert.alert("지출도 기록할까요?"');
  });

  it("목록: 세션 게이트를 거친다 (ITEM-001 비세션 캡처 불변)", () => {
    const items = itemsSource();
    const placementBlock = items.slice(
      items.indexOf("const expenseLinkPlacement = expenseLinkPromptPlacement({"),
      items.indexOf("const openExpenseLinkPrompt")
    );
    expect(placementBlock).toContain("hasSession,");
    // G-3: 지금 화면 좌표를 함께 넘겨야 오래된 줄이 "none"으로 떨어진다.
    expect(placementBlock).toContain("scope: expenseLinkPromptScope,");
  });

  it("목록: G-3 -- 프롬프트에 생성 시점 좌표를 박고, 좌표가 바뀌면 useEffect로 걷는다", () => {
    const items = itemsSource();
    // 남길 때 좌표를 함께 저장한다.
    expect(items).toContain("scope: { childId, stageLabel, necessityFilter, searchText }");
    // 아이·시기 밴드·필수도·검색어가 바뀌면 정리하는 효과가 있고, 판정은 순수 모듈이 한다.
    expect(items).toContain("isExpenseLinkPromptStale({ prompt, scope:");
    expect(items).toContain("}, [childId, stageLabel, necessityFilter, searchText]);");
  });

  it("두 화면 모두 문구/판정을 같은 순수 모듈에서 가져온다", () => {
    for (const screen of ["app/items/[itemTemplateId].tsx", "app/(tabs)/items.tsx"]) {
      expect(source(screen), `${screen} imports the shared module`).toContain("items/expense-link-prompt");
    }
  });

  it("새 색상 hex를 들이지 않는다 (DNC-017)", () => {
    const moduleSource = source("src/items/expense-link-prompt.ts");
    expect(moduleSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
