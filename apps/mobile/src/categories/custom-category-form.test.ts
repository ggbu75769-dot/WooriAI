import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  customCategoryArchiveAccessibilityLabel,
  customCategoryArchiveConfirmCopy,
  customCategoryDuplicateMessage,
  customCategoryIdempotencyKey,
  customCategoryLimitExceededMessage,
  customCategoryListPhase,
  customCategoryMaxPerHousehold,
  customCategoryMutationErrorMessage,
  customCategoryNameMaxLength,
  customCategoryNameNotice,
  customCategoryNamePopulation,
  customCategoryNotFoundMessage,
  customCategoryRenameAccessibilityLabel,
  customCategoryRestoreAccessibilityLabel,
  customCategoryRowAccessibilityLabel,
  customCategoryScreenCopy,
  isCustomCategoryLimitReached,
  isCustomCategoryRow,
  normalizeCustomCategoryName,
  rotateCustomCategoryIdempotencyKey,
  splitCustomCategories,
  type CustomCategoryKeyHolder,
  type CustomCategoryListRow
} from "./custom-category-form";

const mobileRoot = process.cwd();
const repoFile = (relativePath: string) => readFileSync(join(mobileRoot, "..", "..", relativePath), "utf8");
const contractsSource = () => repoFile("packages/contracts/src/schemas.ts");
const localBackendSource = () => readFileSync(join(mobileRoot, "src", "api", "local-backend.ts"), "utf8");
const apiErrorSource = () => readFileSync(join(mobileRoot, "src", "api", "api-error.ts"), "utf8");

/**
 * 라운드 103 T3 — 커스텀 지출 분류 관리의 검증·문구·중복·상한·a11y 계약
 * (설계 문서 docs/5차/round103-custom-expense-category-design.md §4.1 · §9.6).
 *
 * 이 모듈의 값은 짓는 값이 아니라 **미러**다: 수치는 packages/contracts(수기 단일 소스)와,
 * 실패 문장은 로컬 대역(src/api/local-backend.ts — 서버 §9.3과 같은 해요체)과 맞대는 드리프트
 * 가드를 여기 세운다(custom-item-form.test.ts · text-limits.test.ts와 같은 관례).
 */
const HOUSEHOLD = "hh-1";
const OTHER_HOUSEHOLD = "hh-2";

/** 시드 행 하나(소유자 칸 없음). `isSystem`은 인자로 받는다 — 그 칸이 판별이 아님을 값으로 쓰기 위해서다. */
function seedRow(id: string, name: string, isSystem: boolean, displayOrder = 10): CustomCategoryListRow {
  return { id, name, active: true, isSystem, displayOrder };
}

function customRow(
  id: string,
  name: string,
  overrides: Partial<CustomCategoryListRow> = {}
): CustomCategoryListRow {
  return {
    id,
    name,
    active: true,
    isSystem: false,
    displayOrder: 2000,
    householdId: HOUSEHOLD,
    ...overrides
  };
}

describe("상한 두 값 — 계약 대조(수기 미러 드리프트 가드)", () => {
  it("customCategoryNameMaxLength가 계약의 CUSTOM_CATEGORY_NAME_MAX_LENGTH와 같다", () => {
    const match = contractsSource().match(/export const CUSTOM_CATEGORY_NAME_MAX_LENGTH = (\d+);/);
    expect(match, "계약에서 CUSTOM_CATEGORY_NAME_MAX_LENGTH를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(customCategoryNameMaxLength());
    expect(customCategoryNameMaxLength()).toBe(50);
  });

  it("customCategoryMaxPerHousehold가 계약의 CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD와 같다", () => {
    const match = contractsSource().match(/export const CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = (\d+);/);
    expect(match, "계약에서 CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD를 찾지 못했다").not.toBeNull();
    expect(Number(match![1])).toBe(customCategoryMaxPerHousehold());
    expect(customCategoryMaxPerHousehold()).toBe(15);
  });

  it("로컬 대역의 비export 사본 둘과도 값이 같다 (미러 셋이 한 값을 든다)", () => {
    const source = localBackendSource();
    const nameMax = source.match(/const LOCAL_CUSTOM_CATEGORY_NAME_MAX_LENGTH = (\d+);/);
    const perHousehold = source.match(/const LOCAL_CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = (\d+);/);
    expect(nameMax, "로컬 대역에서 이름 상한 사본을 찾지 못했다").not.toBeNull();
    expect(perHousehold, "로컬 대역에서 가구 한도 사본을 찾지 못했다").not.toBeNull();
    expect(Number(nameMax![1])).toBe(customCategoryNameMaxLength());
    expect(Number(perHousehold![1])).toBe(customCategoryMaxPerHousehold());
  });
});

describe("§9.3 세 문구 — 로컬 대역·api-error 표와 바이트가 같다", () => {
  it("세 문장이 설계 §9.3 원문 그대로다", () => {
    expect(customCategoryDuplicateMessage()).toBe("이미 있는 분류 이름이에요. 다른 이름으로 적어 주세요.");
    expect(customCategoryNotFoundMessage()).toBe("직접 추가한 분류를 찾을 수 없어요.");
    expect(customCategoryLimitExceededMessage()).toBe(
      "직접 추가한 분류는 가구당 15개까지예요. 쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요."
    );
  });

  it("상한 문구의 숫자는 손으로 적은 것이 아니라 상한 사본에서 조립된다", () => {
    // 상한이 바뀌면 문장도 함께 바뀐다 — 표가 거짓말을 할 자리가 없다.
    expect(customCategoryLimitExceededMessage()).toContain(`가구당 ${customCategoryMaxPerHousehold()}개까지`);
    const moduleSource = readFileSync(join(mobileRoot, "src", "categories", "custom-category-form.ts"), "utf8");
    expect(moduleSource).toContain("가구당 ${customCategoryMaxPerHousehold()}개까지예요");
  });

  it("로컬 대역(데모 세션)이 던지는 문장과 정확히 같다 — 실계정과 데모가 같은 말을 한다", () => {
    const source = localBackendSource();
    expect(source).toContain(`"${customCategoryDuplicateMessage()}"`);
    expect(source).toContain(`"${customCategoryNotFoundMessage()}"`);
    expect(source).toContain("직접 추가한 분류는 가구당 ${LOCAL_CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD}개까지예요");
  });

  it("api-error 표의 세 줄이 이 모듈을 읽는다 — 표가 문장도 숫자도 짓지 않는다", () => {
    const source = apiErrorSource();
    expect(source).toContain(
      'import {\n  customCategoryDuplicateMessage,\n  customCategoryLimitExceededMessage,\n  customCategoryNotFoundMessage\n} from "../categories/custom-category-form";'
    );
    expect(source).toContain("CUSTOM_CATEGORY_NAME_DUPLICATE: customCategoryDuplicateMessage(),");
    expect(source).toContain("CUSTOM_CATEGORY_LIMIT_EXCEEDED: customCategoryLimitExceededMessage(),");
    expect(source).toContain("CUSTOM_CATEGORY_NOT_FOUND: customCategoryNotFoundMessage()");
    // 상한 숫자가 표에 리터럴로 적히지 않는다(계약이 움직이면 표가 따라간다).
    expect(source).not.toContain("가구당 15개까지예요");
  });
});

describe("이름 정규화·검증 (§1.4 · §9.2)", () => {
  it("정규화는 trim + 내부 연속 공백 1칸 접기 — 저장값이 이 형태다", () => {
    expect(normalizeCustomCategoryName("  산후   도우미  ")).toBe("산후 도우미");
    expect(normalizeCustomCategoryName("\t조리원\n추가결제 ")).toBe("조리원 추가결제");
    expect(normalizeCustomCategoryName("   ")).toBe("");
  });

  it("빈 이름·공백만 있는 이름은 로컬 대역과 같은 문장으로 막는다", () => {
    for (const raw of ["", "   ", "\n\t"]) {
      expect(customCategoryNameNotice({ raw, population: [] })).toBe("분류 이름을 입력해 주세요.");
    }
    expect(localBackendSource()).toContain('"분류 이름을 입력해 주세요."');
  });

  it("50자를 넘으면 상한을 말하고, 정확히 50자는 통과한다 (붙여넣기 경로 포함)", () => {
    const exact = "가".repeat(customCategoryNameMaxLength());
    expect(customCategoryNameNotice({ raw: exact, population: [] })).toBeNull();
    expect(customCategoryNameNotice({ raw: `${exact}가`, population: [] })).toBe(
      `분류 이름은 ${customCategoryNameMaxLength()}자까지 입력할 수 있어요.`
    );
    // 판정은 **정규화 후** 길이다 — 앞뒤 공백이 상한을 밀어내지 않는다.
    expect(customCategoryNameNotice({ raw: `  ${exact}  `, population: [] })).toBeNull();
    expect(localBackendSource()).toContain(
      "분류 이름은 ${LOCAL_CUSTOM_CATEGORY_NAME_MAX_LENGTH}자까지 입력할 수 있어요."
    );
  });

  it("중복 비교는 정규화 + 소문자 일치다 (대소문자·공백이 우회로가 되지 않는다)", () => {
    const population = [seedRow("s1", "기저귀", true), customRow("c1", "Baby Care")];
    expect(customCategoryNameNotice({ raw: "기저귀", population })).toBe(customCategoryDuplicateMessage());
    expect(customCategoryNameNotice({ raw: "  기저귀 ", population })).toBe(customCategoryDuplicateMessage());
    expect(customCategoryNameNotice({ raw: "baby   care", population })).toBe(customCategoryDuplicateMessage());
    expect(customCategoryNameNotice({ raw: "산후도우미", population })).toBeNull();
  });

  it("이름 바꾸기는 자기 자신과 충돌하지 않는다 (이름을 그대로 둔 저장이 거절되지 않는다)", () => {
    const population = [customRow("c1", "산후도우미")];
    expect(customCategoryNameNotice({ raw: "산후도우미", population })).toBe(customCategoryDuplicateMessage());
    expect(customCategoryNameNotice({ raw: "산후도우미", population, exceptCategoryId: "c1" })).toBeNull();
  });

  it("보관한 행도 중복 모집단이다 — 보관 해제가 중복을 만들면 안 된다 (§1.4)", () => {
    const population = [customRow("c1", "돌잔치", { active: false })];
    expect(customCategoryNameNotice({ raw: "돌잔치", population })).toBe(customCategoryDuplicateMessage());
  });
});

describe("⚠️ 커스텀 판별은 householdId다 — isSystem은 판별이 아니다 (실측 정정)", () => {
  /**
   * dev DB 실측(라운드 103 T3): `is_system = false`인 시드 행이 **아홉**이다(모바일 퀵타일 별칭
   * 8 + 가져오기 스텁 1 — prisma/seed.ts가 그 아홉을 `isSystem:false`로 시드한다). 설계 §2.2와
   * client.ts의 주석이 *"커스텀의 표식은 isSystem === false"* 라고 적어 둔 전제가 그 실측으로
   * 거짓이 됐고, 그 하나만으로 걸렀다면 사용자가 만들지도 않은 아홉 행이 "직접 추가한 분류"
   * 목록에 서서 보관을 누르는 순간 404가 났을 것이다. 그 함정을 값으로 잠근다.
   */
  const aliasRows: CustomCategoryListRow[] = [
    seedRow("alias-1", "기저귀", false, 1001),
    seedRow("alias-2", "분유", false, 1002),
    seedRow("stub-1", "가져오기 기본", false, 1009)
  ];

  it("isSystem:false지만 소유자 칸이 없는 시드 별칭·스텁은 관리 목록에서 0건이다", () => {
    const list = [...aliasRows, seedRow("seed-1", "육아용품", true, 10)];
    const split = splitCustomCategories(list, HOUSEHOLD);
    expect(split.inUse).toEqual([]);
    expect(split.archived).toEqual([]);
    expect(split.total).toBe(0);
    for (const row of aliasRows) {
      expect(isCustomCategoryRow(row, HOUSEHOLD), `${row.name}는 커스텀이 아니다`).toBe(false);
    }
  });

  it("같은 목록에서 소유자 칸이 있는 행만 커스텀으로 선다", () => {
    const mine = customRow("c1", "산후도우미");
    const split = splitCustomCategories([...aliasRows, mine], HOUSEHOLD);
    expect(split.inUse.map((row) => row.id)).toEqual(["c1"]);
    expect(isCustomCategoryRow(mine, HOUSEHOLD)).toBe(true);
  });

  it("⚠️ 중복 모집단에는 그 아홉이 **들어간다** — 화면이 서버보다 느슨해지지 않는다", () => {
    // 시드 판정도 `isSystem`이 아니라 `householdId == null`이다. `isSystem === true`로 걸렀다면
    // 별칭 이름("기저귀")이 모집단에서 빠져 화면은 통과시키고 서버만 400을 내는 자리가 생긴다.
    const population = customCategoryNamePopulation(aliasRows, HOUSEHOLD);
    expect(population.map((row) => row.id)).toEqual(["alias-1", "alias-2", "stub-1"]);
    expect(customCategoryNameNotice({ raw: "기저귀", population })).toBe(customCategoryDuplicateMessage());
  });

  it("다른 가구의 커스텀 행은 목록에도 중복 모집단에도 들어오지 않는다 (§1.3 · §6.6)", () => {
    const theirs = customRow("c9", "시가 지원", { householdId: OTHER_HOUSEHOLD });
    expect(isCustomCategoryRow(theirs, HOUSEHOLD)).toBe(false);
    expect(splitCustomCategories([theirs], HOUSEHOLD).total).toBe(0);
    const population = customCategoryNamePopulation([theirs], HOUSEHOLD);
    expect(population).toEqual([]);
    expect(customCategoryNameNotice({ raw: "시가 지원", population })).toBeNull();
  });

  it("가구를 아직 모르면(조회 중) 목록은 비고, 중복 모집단은 시드만 남는다", () => {
    const list = [...aliasRows, customRow("c1", "산후도우미")];
    expect(splitCustomCategories(list, null).total).toBe(0);
    expect(splitCustomCategories(undefined, HOUSEHOLD).total).toBe(0);
    expect(customCategoryNamePopulation(list, null).map((row) => row.id)).toEqual([
      "alias-1",
      "alias-2",
      "stub-1"
    ]);
  });
});

describe("두 구획과 상한 (§4.1 · §1.7)", () => {
  it("사용 중 / 보관한 분류로 갈리고, 목록이 온 순서를 그대로 둔다", () => {
    const list = [
      customRow("c1", "산후도우미", { displayOrder: 2000 }),
      customRow("c2", "돌잔치", { displayOrder: 2001, active: false }),
      customRow("c3", "친정 지원", { displayOrder: 2002 })
    ];
    const split = splitCustomCategories(list, HOUSEHOLD);
    expect(split.inUse.map((row) => row.name)).toEqual(["산후도우미", "친정 지원"]);
    expect(split.archived.map((row) => row.name)).toEqual(["돌잔치"]);
    expect(split.total).toBe(3);
  });

  it("상한은 보관 행도 센다 — 만들고 보관을 반복해 목록을 불릴 수 없다 (§1.7)", () => {
    const rows = Array.from({ length: customCategoryMaxPerHousehold() }, (_, index) =>
      customRow(`c${index}`, `분류${index}`, { active: index % 2 === 0 })
    );
    const split = splitCustomCategories(rows, HOUSEHOLD);
    expect(split.total).toBe(customCategoryMaxPerHousehold());
    expect(isCustomCategoryLimitReached(split.total)).toBe(true);
    expect(isCustomCategoryLimitReached(split.total - 1)).toBe(false);
    expect(isCustomCategoryLimitReached(0)).toBe(false);
  });
});

/**
 * 라운드 103 리뷰 M-3 — **빈 목록과 "모르는 목록"을 가르는 축.**
 *
 * 재현: 비행기 모드에서(또는 `GET /categories` 500) 설정 → 지출 분류 관리. 종전 화면은 이
 * 조회의 로딩·실패를 한 갈래도 읽지 않아, 그 가구에 분류가 열다섯 있어도 "아직 직접 추가한
 * 분류가 없어요." 하나만 그렸다. 그리고 그 **거짓 빈 목록이 판정까지 오염시켰다** — 아래 첫
 * 단언이 그 파생을 값으로 재현한다: 모집단이 비면 중복 판정도 상한 판정도 통과한다.
 *
 * 그래서 이 describe가 무는 것은 두 가지다: ⓐ 그 오염이 **오늘도 실재한다**(모집단이 비면 판정이
 * 통과한다 — 그러니 판정을 여는 조건이 따로 있어야 한다), ⓑ 그 조건을 `customCategoryListPhase`
 * 하나가 답하고, 그 답이 화면의 얼굴과 [분류 추가] 잠금을 **같은 축**으로 정한다.
 */
describe("목록 국면 — 조회 실패·조회 중·가구 미확정을 빈 목록으로 읽지 않는다 (리뷰 M-3)", () => {
  const fifteen = Array.from({ length: customCategoryMaxPerHousehold() }, (_, index) =>
    customRow(`c${index}`, `분류${index}`)
  );

  it("⚠️ 모집단이 비면 중복·상한 판정이 통과한다 — 그래서 판정을 여는 조건이 따로 있어야 한다", () => {
    // 실제로 있는 목록에서는 둘 다 막는다.
    expect(customCategoryNameNotice({ raw: "분류0", population: customCategoryNamePopulation(fifteen, HOUSEHOLD) })).toBe(
      customCategoryDuplicateMessage()
    );
    expect(isCustomCategoryLimitReached(splitCustomCategories(fifteen, HOUSEHOLD).total)).toBe(true);
    // 조회가 실패해 손에 목록이 없으면(= `categories.data`가 없다) **둘 다 통과한다**.
    const nothing = customCategoryNamePopulation(undefined, HOUSEHOLD);
    expect(customCategoryNameNotice({ raw: "분류0", population: nothing })).toBeNull();
    expect(isCustomCategoryLimitReached(splitCustomCategories(undefined, HOUSEHOLD).total)).toBe(false);
    // 가구를 아직 모르는 창도 **같은 자리**다 — 목록은 손에 있는데 전부 걸러진다.
    const coldEntry = customCategoryNamePopulation(fifteen, null).filter((row) => row.householdId != null);
    expect(coldEntry).toEqual([]);
    expect(isCustomCategoryLimitReached(splitCustomCategories(fifteen, null).total)).toBe(false);
  });

  it("조회 실패는 `error`다 — 손에 남은 옛 목록이 있어도 실패를 로딩·정상으로 위장하지 않는다", () => {
    const failed = {
      hasSession: true,
      isPending: false,
      isError: true,
      hasData: false,
      householdId: HOUSEHOLD
    } as const;
    expect(customCategoryListPhase(failed)).toBe("error");
    // 새로고침 실패(캐시 보유)도 실패다 — MOB-130의 그 순서를 이 함수가 다시 짓지 않는다.
    expect(customCategoryListPhase({ ...failed, hasData: true })).toBe("error");
  });

  it("조회 중과 **가구 미확정**은 `loading`이다 — 그 창에서 '없어요'는 거짓이다", () => {
    const pending = { hasSession: true, isPending: true, isError: false, hasData: false, householdId: null } as const;
    expect(customCategoryListPhase(pending)).toBe("loading");
    // ⚠️ 콜드 진입: 목록은 이미 왔는데 `["children"]`이 정착하지 않아 가구가 null인 창.
    // 그 창에서 splitCustomCategories는 전부 걸러 내므로 화면이 "없어요"를 그렸었다.
    expect(customCategoryListPhase({ ...pending, isPending: false, hasData: true })).toBe("loading");
    expect(customCategoryListPhase({ ...pending, isPending: false, hasData: true, householdId: undefined })).toBe(
      "loading"
    );
    // 확정됐는데 데이터가 없는 모양(react-query v5)도 로딩이다.
    expect(
      customCategoryListPhase({ hasSession: true, isPending: false, isError: false, hasData: false, householdId: HOUSEHOLD })
    ).toBe("loading");
  });

  it("목록과 가구를 **둘 다** 아는 창 하나만 `ready`다 (= 모집단을 믿어도 되는 창)", () => {
    expect(
      customCategoryListPhase({ hasSession: true, isPending: false, isError: false, hasData: true, householdId: HOUSEHOLD })
    ).toBe("ready");
    // 세션이 없으면 기다릴 조회가 없다(쿼리가 enabled: Boolean(authToken)이라 영원히 pending이다)
    // — 그 창을 로딩으로 읽으면 비로그인 화면이 스켈레톤에 갇힌다. isChildrenSettled의 그 첫 줄.
    expect(
      customCategoryListPhase({ hasSession: false, isPending: true, isError: false, hasData: false, householdId: null })
    ).toBe("ready");
  });

  it("세 국면 밖의 답이 없다 — 입력 조합 전수", () => {
    const flags = [false, true];
    for (const hasSession of flags) {
      for (const isPending of flags) {
        for (const isError of flags) {
          for (const hasData of flags) {
            for (const householdId of [null, HOUSEHOLD]) {
              expect(["loading", "error", "ready"]).toContain(
                customCategoryListPhase({ hasSession, isPending, isError, hasData, householdId })
              );
            }
          }
        }
      }
    }
  });
});

describe("확정 카피와 낭독 (§9.6)", () => {
  const copy = customCategoryScreenCopy();

  it("머리·구획·빈 상태·버튼이 §9.6 확정값 그대로다", () => {
    expect(copy.title).toBe("지출 분류");
    expect(copy.subtitle).toBe("우리 가족이 쓰는 분류를 직접 더할 수 있어요.");
    expect(copy.inUseSectionTitle).toBe("사용 중");
    expect(copy.archivedSectionTitle).toBe("보관한 분류");
    expect(copy.emptyStateText).toBe("아직 직접 추가한 분류가 없어요.");
    // 라운드 103 리뷰 M-2 — 화면 전체가 비었다는 말과 사용 중 구획이 비었다는 말은 다른
    // 사실이다. 종전에는 문장이 하나뿐이라 전부 보관한 상태에서 앞 문장이 보관 목록과
    // 나란히 서서 거짓이 됐다. 두 문장은 서로 달라야 한다 — 같아지면 그 결함이 되돌아온다.
    expect(copy.inUseEmptyText).toBe("사용 중인 분류가 없어요.");
    expect(copy.inUseEmptyText).not.toBe(copy.emptyStateText);
    expect(copy.addPlaceholder).toBe("예: 산후도우미");
    // 라운드 103 리뷰 L-2 — 입력칸이 버튼 라벨("분류 추가")을 돌려 쓰면 스크린리더가 같은
    // 문장을 두 번 읽고 무엇을 치는 칸인지 말하지 않는다. 칸은 자기 라벨을 갖는다.
    expect(copy.addInputLabel).toBe("분류 이름");
    expect(copy.addInputLabel).not.toBe(copy.addButtonLabel);
    expect(copy.addButtonLabel).toBe("분류 추가");
    expect(copy.renameLabel).toBe("이름 바꾸기");
    expect(copy.saveLabel).toBe("저장");
    expect(copy.archiveLabel).toBe("보관");
    expect(copy.restoreLabel).toBe("다시 사용");
    expect(copy.archivedFootnote).toBe("보관한 분류로 기록한 지출은 그대로 남아요.");
  });

  it('⚠️ "삭제"라는 낱말이 이 모듈 어디에도 없다 (§1.6 — 지우지 않는 조작이다)', () => {
    // ⚠️ 주석은 먼저 걷는다 — 이 모듈의 머리말은 *왜* 그 낱말을 쓰지 않는지 설명하려고 그
    // 낱말을 인용한다(record-permissions.test.ts의 withoutComments와 같은 관례). 여기서
    // 잡으려는 것은 **화면에 서는 문자열**이지 설명이 아니다.
    const moduleSource = readFileSync(join(mobileRoot, "src", "categories", "custom-category-form.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    const literals = moduleSource.match(/"[^"\n]*"|`[^`]*`/g) ?? [];
    expect(literals.length, "리터럴 스캔이 조용히 0건이 되지 않는다").toBeGreaterThan(15);
    for (const literal of literals) {
      expect(literal, "지우지 않는 조작에 '삭제'를 쓰지 않는다").not.toContain("삭제");
      expect(literal).not.toContain("지우기");
    }
  });

  it("보관 확인은 지출이 남는다는 사실을 말하고, 이름 뒤에 조사를 두지 않는다", () => {
    const confirm = customCategoryArchiveConfirmCopy("산후도우미");
    expect(confirm.message).toBe(
      '"산후도우미" 분류를 보관할까요? 이미 기록한 지출은 그대로 남고, 앞으로 새 기록에서 고를 수 없어요.'
    );
    expect(confirm.confirmLabel).toBe("보관");
    expect(confirm.cancelLabel).toBe("취소");
    // 받침 유무가 달라도 문장이 갈리지 않는다 = 조사가 이름을 보지 않는 형태다(§6.4).
    for (const name of ["산후도우미", "돌잔치", "Baby"]) {
      expect(customCategoryArchiveConfirmCopy(name).message).toContain(`"${name}" 분류를 보관할까요?`);
    }
  });

  it("행·버튼 낭독이 §9.6 확정값이고, 이름 바로 뒤가 조사가 아니다", () => {
    expect(customCategoryRowAccessibilityLabel("산후도우미")).toBe("산후도우미. 지출 분류");
    expect(customCategoryRenameAccessibilityLabel("산후도우미")).toBe("산후도우미 이름 바꾸기");
    expect(customCategoryArchiveAccessibilityLabel("산후도우미")).toBe("산후도우미 보관");
    expect(customCategoryRestoreAccessibilityLabel("산후도우미")).toBe("산후도우미 다시 사용");
  });

  it("DNC-018: 새 문장 전량이 해요체이고 재촉·비난·감탄이 없다", () => {
    const sentences = [
      copy.subtitle,
      copy.emptyStateText,
      copy.inUseEmptyText,
      copy.archivedFootnote,
      customCategoryArchiveConfirmCopy("산후도우미").message,
      customCategoryDuplicateMessage(),
      customCategoryLimitExceededMessage(),
      customCategoryNotFoundMessage(),
      "분류 이름을 입력해 주세요.",
      `분류 이름은 ${customCategoryNameMaxLength()}자까지 입력할 수 있어요.`
    ];
    for (const sentence of sentences) {
      expect(sentence, sentence).toMatch(/(요\.|요\?)$/);
      expect(sentence).not.toMatch(/!|축하|얼른|서둘|잘못|실패했습니다|하십시오/);
    }
  });
});

describe("실패 문장 층 (로컬 대역의 코드 없는 Error 한 겹)", () => {
  it("아는 문장은 그대로 올리고, 모르는 실패는 호출부의 fallback이 선다", () => {
    const fallback = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
    expect(customCategoryMutationErrorMessage(new Error(customCategoryDuplicateMessage()), fallback)).toBe(
      customCategoryDuplicateMessage()
    );
    expect(customCategoryMutationErrorMessage(new Error(customCategoryLimitExceededMessage()), fallback)).toBe(
      customCategoryLimitExceededMessage()
    );
    expect(customCategoryMutationErrorMessage(new Error(customCategoryNotFoundMessage()), fallback)).toBe(
      customCategoryNotFoundMessage()
    );
    expect(customCategoryMutationErrorMessage(new Error("바꿀 내용을 하나 이상 골라 주세요."), fallback)).toBe(
      "바꿀 내용을 하나 이상 골라 주세요."
    );
  });

  it("모르는 내부 문장은 화면으로 새지 않는다 (정확 일치만 통과)", () => {
    const fallback = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
    expect(customCategoryMutationErrorMessage(new Error("Network request failed"), fallback)).toBe(fallback);
    expect(
      customCategoryMutationErrorMessage(new Error(`${customCategoryDuplicateMessage()} (code 400)`), fallback)
    ).toBe(fallback);
    expect(customCategoryMutationErrorMessage({ code: "CUSTOM_CATEGORY_NOT_FOUND" }, fallback)).toBe(fallback);
    expect(customCategoryMutationErrorMessage(null, fallback)).toBe(fallback);
  });
});

describe("멱등 키 (§2.4 — 초안 단위 하나, 이름이 바뀌면 새 키)", () => {
  it("같은 이름의 재시도는 같은 키를 쓰고, 이름이 달라지면 새 키가 나간다", () => {
    const holder: CustomCategoryKeyHolder = { current: null };
    const first = customCategoryIdempotencyKey(holder, "산후도우미");
    expect(customCategoryIdempotencyKey(holder, "산후도우미")).toBe(first);
    // 정규화 후 같은 이름이면 같은 제출이다(공백만 다른 재시도가 새 키를 만들지 않는다).
    expect(customCategoryIdempotencyKey(holder, "  산후도우미 ")).toBe(first);
    const second = customCategoryIdempotencyKey(holder, "돌잔치");
    expect(second).not.toBe(first);
  });

  it("접두가 다른 멱등 축과 겹치지 않고, 성공 뒤 폐기하면 다음 추가는 새 범위다", () => {
    const holder: CustomCategoryKeyHolder = { current: null };
    const key = customCategoryIdempotencyKey(holder, "산후도우미");
    expect(key.startsWith("custom-category-")).toBe(true);
    rotateCustomCategoryIdempotencyKey(holder);
    expect(holder.current).toBeNull();
    expect(customCategoryIdempotencyKey(holder, "산후도우미")).not.toBe(key);
  });
});
