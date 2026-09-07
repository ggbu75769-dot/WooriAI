import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomCategory as clientCreateCustomCategory,
  listCategories as clientListCategories,
  updateCustomCategory as clientUpdateCustomCategory,
  LOCAL_SESSION_TOKEN,
  type CategoryListItem
} from "./client";
import * as localBackend from "./local-backend";
import { LOCAL_CATEGORY_DIAPER, LOCAL_CHILD_ID, LOCAL_HOUSEHOLD_ID } from "./local-fixtures";
import { categoryCatalog, selectableCategories } from "../categories";
import { persistStorage } from "../stores/persist-storage";

/**
 * 라운드 103 T2 — **커스텀 지출 분류 규칙의 서버 ↔ 로컬 미러 대조** (리스크 R3·R4·R5 차단).
 *
 * 규칙은 설계 문서(docs/5차/round103-custom-expense-category-design.md §3.1)가 문장 하나로
 * 확정했다: **"보관은 `active:false`이고 행은 남는다 · 기본 목록은 활성만 · includeAll은 전량 ·
 * 이름 중복은 시드+자기 가구 전량 기준"**. 이 규칙을 구현하는 코드는 저장소에 두 벌 생긴다 —
 * 실서버(T1: categories.household_id + 관리 엔드포인트 둘)와 standalone/데모 세션의
 * `src/api/local-backend.ts`(이 라운드 T2). standalone APK는 **서버 없이 도는 경로**라
 * 한쪽만 규칙을 바꾸면 그 빌드에서만 목록·칩·범례가 갈린다.
 *
 * ⚠️ T1(apps/api)은 병렬 트랙이라 이 파일이 서는 시점에 서버 코드가 아직 없을 수 있다. 그래서
 * 서버 쪽 검증은 **skip이 아니라 소스 계약**이다: 규칙 문장·검증 순서·에러 문구·상수를 설계
 * 문서(세 트랙의 단일 소스 — §8)와 `packages/contracts`에서 실재 확인하고, 같은 픽스처를 로컬
 * 미러에 넣어 그 문장들이 값으로 성립하는지 문다(라운드 100 R5·102와 같은 형식). T1 완료 후
 * 실코드 대조는 e2e와 리뷰 단계의 몫이다.
 */

const mobileRoot = process.cwd();
const repoFile = (relativePath: string) => readFileSync(join(mobileRoot, "..", "..", relativePath), "utf8");
const designDoc = () => repoFile("docs/5차/round103-custom-expense-category-design.md");
const contractsSource = () => repoFile("packages/contracts/src/schemas.ts");
const mirrorSource = () => readFileSync(join(mobileRoot, "src", "api", "local-backend.ts"), "utf8");
const clientSource = () => readFileSync(join(mobileRoot, "src", "api", "client.ts"), "utf8");

/** 계약 소스에서 상수 선언을 실재 확인과 함께 읽는다(없으면 그 자리에서 빨개진다). */
function contractNumber(name: string): number {
  const match = contractsSource().match(new RegExp(`export const ${name} = (\\d+);`));
  expect(match, `packages/contracts에서 ${name}을 찾지 못했다`).not.toBeNull();
  return Number(match![1]);
}

/** 로컬 미러의 비export 리터럴 사본(contracts-mirror.test.ts 상수 대장이 가리키는 그 자리). */
function mirrorNumber(name: string): number {
  const match = mirrorSource().match(new RegExp(`const ${name} = (\\d+);`));
  expect(match, `local-backend.ts에서 ${name}을 찾지 못했다`).not.toBeNull();
  return Number(match![1]);
}

/** §9.3의 세 문구 — 문서·미러가 같은 문장을 든다(아래 소스 계약이 실재를 문다). */
const DUPLICATE_MESSAGE = "이미 있는 분류 이름이에요. 다른 이름으로 적어 주세요.";
const LIMIT_MESSAGE =
  "직접 추가한 분류는 가구당 15개까지예요. 쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요.";
const NOT_FOUND_MESSAGE = "직접 추가한 분류를 찾을 수 없어요.";

describe("규칙 원문 — 문서·미러가 같은 한 문장을 든다 (서버 쪽 소스 계약)", () => {
  const RULE_SENTENCE =
    "보관은 `active:false`이고 행은 남는다 · 기본 목록은 활성만 · includeAll은 전량 · 이름 중복은 시드+자기 가구 전량 기준";

  it("설계 문서 §3.1의 규칙 문장이 실재하고, §9.2가 같은 규칙으로 서버 계약을 못 박는다", () => {
    const doc = designDoc();
    expect(doc).toContain(RULE_SENTENCE);
    // §9.2 — 합류 규칙과 커스텀 행의 확정 모양(T1이 이 절만 보고 집행한다).
    expect(doc).toContain("커스텀 행: isSystem:false · householdId 실림 · iconName:null · selectable:true");
    expect(doc).toContain("active:false = 보관(행·id·code 불변, 지출 무접촉) · active:true = 복원");
    // §2.1/§9.2 — DELETE를 두지 않는다는 결정 자체가 계약이다(§1.6).
    expect(doc).toContain("(DELETE 없음 — 설계 §1.6)");
    // §9.3 — 세 에러 문구(해요체). 미러가 던지는 문장과 같은 원문이다.
    expect(doc).toContain(`"${DUPLICATE_MESSAGE}"`);
    expect(doc).toContain(`"${LIMIT_MESSAGE}"`);
    expect(doc).toContain(`"${NOT_FOUND_MESSAGE}"`);
  });

  it("로컬 미러 소스가 규칙 문장을 글자 그대로 들고 있다 (한쪽만 고치면 여기서 갈린다)", () => {
    expect(mirrorSource()).toContain(RULE_SENTENCE);
  });

  it("계약 소스: householdId 가산은 categoryListItemSchema 한 자리뿐이고, 표식은 기존 isSystem이다", () => {
    const source = contractsSource();
    // 읽기 경로의 계약 추가 0건 + 소유자 한 칸(§2.2)이 이 설계의 산출물이다 — 두 번째 선언이
    // 생기면 설계가 확장된 것이므로 여기서 빨개진다.
    expect(source.match(/householdId: uuidSchema\.optional\(\)/g)).toHaveLength(1);
    // 커스텀 표식용 새 필드(isCustom 류)를 만들지 않았다 — 000018이 뜻을 적어 둔 isSystem이 표식이다.
    expect(source).not.toContain("isCustomCategory");
    // DELETE 응답 스키마가 없다(§1.6 — 지우지 않는 동사에 DELETE를 붙이지 않는다).
    expect(source).not.toContain("deleteCustomCategoryResponseSchema");
  });

  it("클라이언트: 쓰기 둘만 서고 DELETE는 서지 않는다 (§2.1 · §9.4)", () => {
    const source = clientSource();
    expect(source).toContain("export function createCustomCategory(");
    expect(source).toContain("export function updateCustomCategory(");
    expect(source).not.toContain("export function deleteCustomCategory(");
    // 읽기는 기존 목록 하나다 — 두 번째 목록·두 번째 캐시 키를 만들지 않는다(§2.1).
    expect(source).not.toContain("export function listCustomCategories(");
  });
});

describe("상수 두 방향 대조 — 계약 50·15 ↔ 로컬 비export 리터럴 ↔ 라운드 102 상한과의 산술", () => {
  it("CUSTOM_CATEGORY_NAME_MAX_LENGTH가 계약과 로컬 사본에서 값으로 같다", () => {
    expect(contractNumber("CUSTOM_CATEGORY_NAME_MAX_LENGTH")).toBe(50);
    expect(mirrorNumber("LOCAL_CUSTOM_CATEGORY_NAME_MAX_LENGTH")).toBe(
      contractNumber("CUSTOM_CATEGORY_NAME_MAX_LENGTH")
    );
  });

  it("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD가 계약과 로컬 사본에서 값으로 같다", () => {
    expect(contractNumber("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD")).toBe(15);
    expect(mirrorNumber("LOCAL_CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD")).toBe(
      contractNumber("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD")
    );
  });

  /**
   * **R4 — 라운드 102 §1.4의 정당화 문장이 이 라운드 뒤에도 참인가**를 값으로 묻는다.
   *
   * 그 문서는 카테고리 예산 상한 30을 *"정식 12종이고 … 커스텀 카테고리는 존재하지 않는 전제라,
   * 30은 분류 체계가 두 배 넘게 자라도 남는 수"* 라고 정당화했다. 이 라운드가 그 전제를 깨므로
   * **12 + 15 = 27 ≤ 30**이라야 그 문장이 계속 참이다. 어느 한쪽 상수를 올리는 라운드는 예산
   * 화면이 상한에 먼저 부딪히기 전에 여기서 빨개진다(설계 §1.7 · §9.1).
   *
   * 세 값을 전부 **계약 소스에서 읽는다** — 이 파일에 사본을 적으면 그 순간 넷째 벌이 생긴다.
   */
  it("12 + CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD <= CATEGORY_BUDGET_MAX_PER_MONTH (R4 산술)", () => {
    const SEEDED_CANONICAL_CATEGORY_COUNT = 12; // prisma/seed-data.ts categorySeeds
    const perHousehold = contractNumber("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD");
    const budgetCap = contractNumber("CATEGORY_BUDGET_MAX_PER_MONTH");
    expect(SEEDED_CANONICAL_CATEGORY_COUNT + perHousehold).toBe(27);
    expect(SEEDED_CANONICAL_CATEGORY_COUNT + perHousehold).toBeLessThanOrEqual(budgetCap);
    // 15가 파생값이라는 사실이 계약 주석에도 값으로 적혀 있다(다음 사람이 임의로 올리지 않게).
    expect(contractsSource()).toContain("정식 12 + 15 = 27 <= CATEGORY_BUDGET_MAX_PER_MONTH(30, 라운드 102 §1.4)");
  });

  /**
   * §9.3의 세 문구는 아직 `API_ERROR_MESSAGES`(src/api/api-error.ts) 표에 자리가 없다 —
   * 라운드 103 트랙 분할(§8)에서 그 파일이 T2 소유 목록 밖이라, 미러는 로컬 리터럴로 던진다.
   * 문장이 두 벌인 동안 갈라지는 순간을 여기서 잡고(설계 문서 §9.3 원문과 맞댄다), 상한 문구의
   * "15"는 계약 상수에서 조립해 숫자가 따로 놀지 않게 한다.
   */
  it("미러가 던지는 세 문구가 §9.3 원문·계약 상수와 갈라지지 않는다", () => {
    const source = mirrorSource();
    expect(source).toContain(`"${DUPLICATE_MESSAGE}"`);
    expect(source).toContain(`"${NOT_FOUND_MESSAGE}"`);
    expect(LIMIT_MESSAGE).toBe(
      `직접 추가한 분류는 가구당 ${contractNumber(
        "CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD"
      )}개까지예요. 쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요.`
    );
  });
});

describe("같은 픽스처 대조 — 합류·정렬·includeAll 갈래(§2.2)와 쓰기 둘(§2.3)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  /** 데모 목록의 시드 대역 — 퀵타일 8 + 로컬 픽스처 4. 커스텀은 이 뒤에 선다. */
  const seedRowCount = categoryCatalog.length + 4;

  it("데모 픽스처 0건(§3.2): 시드는 커스텀 분류를 한 행도 만들지 않는다", () => {
    expect(localBackend.useLocalBackendStore.getState().customCategories).toEqual([]);
    expect(localBackend.listCategories().categories.filter((row) => row.isSystem === false)).toEqual([]);
    expect(localBackend.listCategories().categories).toHaveLength(seedRowCount);
  });

  it("생성: 이름 하나만 받고 나머지는 서버가 정한다 — code·displayOrder·표식·소유자(§2.3)", () => {
    const created = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");

    expect(created.name).toBe("산후도우미");
    expect(created.code.startsWith("custom_")).toBe(true);
    expect(created.isSystem).toBe(false); // 표식은 기존 필드다(§2.2 — 새 필드 0건)
    expect(created.active).toBe(true);
    expect(created.selectable).toBe(true); // 사용자가 고르라고 만든 행이다
    expect(created.iconName).toBeNull(); // §1.5 — 색·아이콘을 주지 않는다
    expect(created.householdId).toBe(LOCAL_HOUSEHOLD_ID);
    // 시드 대역(10~999)보다 큰 대역이라 공통 정렬에서 언제나 시드 뒤다(§1.7).
    expect(created.displayOrder).toBe(2000);

    // 두 번째 행은 2000 + 기존 커스텀 행 수.
    expect(localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "조리원 추가결제").displayOrder).toBe(2001);
  });

  it("합류와 정렬: displayOrder 오름차순으로 시드 뒤에 붙고, 목록 계약의 모양이 같다(§2.2)", () => {
    const first = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    const second = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "돌잔치");

    const rows = localBackend.listCategories().categories;
    expect(rows).toHaveLength(seedRowCount + 2);
    // 정렬이 결정적이다 — 커스텀 둘이 목록의 마지막 두 자리를 만든 순서대로 차지한다.
    expect(rows.slice(-2).map((row) => row.id)).toEqual([first.id, second.id]);
    expect(rows.slice(0, seedRowCount).every((row) => row.isSystem === true)).toBe(true);
    // displayOrder는 전 구간에서 비내림차순이다(합류가 정렬을 깨지 않는다).
    const orders = rows.map((row) => row.displayOrder);
    expect([...orders].sort((left, right) => left - right)).toEqual(orders);
  });

  it("includeAll 갈래: 기본 목록은 활성만, includeAll은 보관된 것까지 (§2.2 · R28-F3 재사용)", () => {
    const kept = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    const archived = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "조리원 추가결제");
    localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, archived.id, { active: false });

    const idsOf = (options?: { includeAll?: boolean }) =>
      localBackend.listCategories(options).categories.map((row) => row.id);

    expect(idsOf()).toContain(kept.id);
    expect(idsOf()).not.toContain(archived.id); // 새 기록에서 고를 수 없다
    expect(idsOf({ includeAll: true })).toContain(archived.id); // 과거 지출의 이름은 계속 해석된다
    expect(idsOf({ includeAll: false })).not.toContain(archived.id);

    // 시드 대역은 두 갈래에서 한 행도 달라지지 않는다(전부 active — 종전 동작 무변경).
    expect(idsOf()).toHaveLength(seedRowCount + 1);
    expect(idsOf({ includeAll: true })).toHaveLength(seedRowCount + 2);
  });

  it("보관: 행·id·code는 그대로 남고 그 분류로 기록한 지출은 한 바이트도 움직이지 않는다 (§1.6 · R2)", () => {
    const created = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    const expense = localBackend.createExpense(LOCAL_CHILD_ID, {
      categoryId: created.id,
      amountKrw: 250_000,
      spentOn: localBackend.listExpenses(LOCAL_CHILD_ID).expenses[0]?.spentOn ?? "2026-09-01",
      itemName: "산후도우미 2주"
    });

    const archived = localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, { active: false });
    expect(archived.id).toBe(created.id);
    expect(archived.code).toBe(created.code);
    expect(archived.name).toBe(created.name);
    expect(archived.active).toBe(false);

    // 지출 행은 그대로다(하드 삭제도 재배정도 없다 — 그것이 이 결정의 전부다).
    const stored = localBackend.listExpenses(LOCAL_CHILD_ID).expenses.find((row) => row.id === expense.id);
    expect(stored?.categoryId).toBe(created.id);
    // 이름 해석의 모집단(includeAll)에 그 행이 남아 있다 → 기록·리포트·CSV가 이름을 계속 말한다.
    const lookupRow = localBackend
      .listCategories({ includeAll: true })
      .categories.find((row) => row.id === created.id);
    expect(lookupRow?.name).toBe("산후도우미");

    // 복원은 같은 PATCH의 active:true — 되돌릴 수 있는 조작이라 "삭제"라는 말을 쓰지 않는다.
    expect(localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, { active: true }).active).toBe(true);
    expect(localBackend.listCategories().categories.map((row) => row.id)).toContain(created.id);
  });

  it("이름 바꾸기: 과거 지출의 표시 라벨이 함께 바뀌고, 행·id·code·순서는 그대로다", () => {
    const created = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    const renamed = localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, { name: "산후관리사" });

    expect(renamed).toEqual({ ...created, name: "산후관리사" });
    expect(localBackend.listCategories().categories.slice(-1)[0]).toEqual(renamed);
    // 같은 이름으로 다시 저장해도 "자기 자신과의 중복"으로 막히지 않는다(DB 부분 유니크와 같은 결).
    expect(localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, { name: "산후관리사" }).name).toBe(
      "산후관리사"
    );
  });

  it("이름 정규화(§1.4): trim + 내부 연속 공백 1칸 접기가 **저장값**이다", () => {
    expect(localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "  산후  도우미  ").name).toBe("산후 도우미");
    expect(localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "돌잔치\t비용").name).toBe("돌잔치 비용");
  });

  it("이름 중복(R3): 시드 이름·자기 커스텀 이름(보관 포함)과 겹치면 거절한다 (§1.4)", () => {
    // ① 시드 대역의 이름 — 퀵타일 8타일 중 하나. 겹치면 selectableCategories (c)가 동명 그룹을
    //    하나로 접어 칩이 조용히 사라지므로 서버가 먼저 막는다.
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, categoryCatalog[0].label)).toThrow(
      DUPLICATE_MESSAGE
    );
    // 정규화·대소문자 무시 비교다(공백만 다른 이름도 같은 이름이다).
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, `  ${categoryCatalog[0].label}  `)).toThrow(
      DUPLICATE_MESSAGE
    );

    // ② 자기 가구의 커스텀 행 — 보관한 것도 모집단이다(보관 해제가 중복을 만들면 안 된다).
    const archived = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, archived.id, { active: false });
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미")).toThrow(DUPLICATE_MESSAGE);
    // 이름 변경도 같은 모집단을 본다.
    const other = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "돌잔치");
    expect(() => localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, other.id, { name: "산후도우미" })).toThrow(
      DUPLICATE_MESSAGE
    );
    // 거절된 저장은 한 글자도 쓰지 않는다.
    expect(localBackend.listCategories({ includeAll: true }).categories.filter((row) => !row.isSystem)).toHaveLength(2);
    expect(other.name).toBe("돌잔치");
  });

  it("한도 15(§1.7): 보관 행도 세고, 초과는 §9.3 문구로 거절한다", () => {
    const cap = contractNumber("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD");
    for (let index = 0; index < cap; index += 1) {
      localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, `분류${index}`);
    }
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "한 칸 더")).toThrow(LIMIT_MESSAGE);

    // 보관해도 자리는 비지 않는다 — "만들고 보관"으로 목록을 무한히 불릴 수 없다.
    const rows = localBackend.listCategories({ includeAll: true }).categories.filter((row) => !row.isSystem);
    expect(rows).toHaveLength(cap);
    localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, rows[0].id, { active: false });
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "한 칸 더")).toThrow(LIMIT_MESSAGE);
  });

  it("검증 순서(§2.3): 형식 → 대상 실재 → 중복 — 서버의 [DTO → 404 → 중복] 순서와 같다", () => {
    const cap = contractNumber("CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD");
    const nameMax = contractNumber("CUSTOM_CATEGORY_NAME_MAX_LENGTH");

    // ① 형식이 먼저다 — 시드 이름과 겹치면서 51자인 요청은 형식 문구로 떨어진다(중복이 아니라).
    expect(() =>
      localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "가".repeat(nameMax + 1))
    ).toThrow(`분류 이름은 ${nameMax}자까지 입력할 수 있어요.`);
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "   ")).toThrow("분류 이름을 입력해 주세요.");
    // 정확히 50자는 통과한다(경계 한 칸 위아래 — moneyKrwSchema 테스트 관례).
    expect(localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "가".repeat(nameMax)).name).toHaveLength(nameMax);

    // ② 중복이 한도보다 먼저다 — 15칸을 다 채운 뒤 중복 이름을 내면 중복 문구가 선다.
    for (let index = localBackend.listCategories({ includeAll: true }).categories.filter((r) => !r.isSystem).length; index < cap; index += 1) {
      localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, `분류${index}`);
    }
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "분류3")).toThrow(DUPLICATE_MESSAGE);

    // ③ PATCH는 대상 실재가 형식 다음이다 — 없는 id + 51자면 형식 문구, 없는 id + 정상 이름이면 404 문구.
    expect(() =>
      localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, "no-such-id", { name: "가".repeat(nameMax + 1) })
    ).toThrow(`분류 이름은 ${nameMax}자까지 입력할 수 있어요.`);
    expect(() => localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, "no-such-id", { name: "새 이름" })).toThrow(
      NOT_FOUND_MESSAGE
    );
  });

  /**
   * §9.2의 "둘 다 optional, **최소 하나 필요**" — 서버는 DTO에서 `VALIDATION_ERROR`(바구니 코드)로
   * 던진다. 미러가 이 갈래를 통과시키면 데모에서는 조용히 성공하고 실계정에서만 400이 나므로,
   * 같은 자리에서 같은 순서로(형식 → 404) 거절한다. 문구는 바구니 코드라 미러 로컬이다.
   */
  it("빈 PATCH 바디는 형식 단계에서 거절한다 — 대상 실재보다 먼저다 (§9.2)", () => {
    const created = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    expect(() => localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, {})).toThrow(
      "바꿀 내용을 하나 이상 골라 주세요."
    );
    // 없는 id로 빈 바디를 보내도 404가 아니라 형식 문구다(서버의 [DTO → 404] 순서와 같다).
    expect(() => localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, "no-such-id", {})).toThrow(
      "바꿀 내용을 하나 이상 골라 주세요."
    );
    // 거절된 저장은 한 글자도 쓰지 않는다.
    expect(localBackend.listCategories().categories.slice(-1)[0]).toEqual(created);
  });

  it("PATCH 대상은 커스텀 행뿐 — 시드 행 id는 404 문구로 떨어진다 (§2.3)", () => {
    expect(() => localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, categoryCatalog[0].id, { name: "새 이름" })).toThrow(
      NOT_FOUND_MESSAGE
    );
    expect(() =>
      localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, LOCAL_CATEGORY_DIAPER, { active: false })
    ).toThrow(NOT_FOUND_MESSAGE);
    // 시드 행은 한 글자도 바뀌지 않았다.
    const seedRow = localBackend.listCategories().categories.find((row) => row.id === LOCAL_CATEGORY_DIAPER);
    expect(seedRow?.active).toBe(true);
    expect(seedRow?.isSystem).toBe(true);
  });

  it("멱등(§2.4): 같은 Idempotency-Key의 재제출은 새 행을 만들지 않는다", () => {
    const first = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미", "draft-key-1");
    const retried = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미", "draft-key-1");

    expect(retried).toEqual(first);
    expect(localBackend.listCategories({ includeAll: true }).categories.filter((row) => !row.isSystem)).toHaveLength(1);
    // 다른 키는 새 행이다(같은 이름이면 중복 규칙이 먼저 잡는다).
    expect(() => localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미", "draft-key-2")).toThrow(
      DUPLICATE_MESSAGE
    );
  });

  /**
   * §4.3 — **클라이언트 코드 0바이트로 따라오는 표면**의 절반을 값으로 확인한다: 커스텀 행이
   * `GET /categories` 응답의 정상 항목이므로 지출 수정 화면의 칩 좁히기가 그대로 통과시킨다
   * (커스텀 code는 `custom_` 접두라 `mobile_`·`import_` 규칙에 걸리지 않는다).
   */
  it("selectableCategories가 커스텀을 그대로 통과시키고, 보관 행은 현재값일 때만 남긴다(§4.3)", () => {
    const created = localBackend.createCustomCategory(LOCAL_HOUSEHOLD_ID, "산후도우미");
    const all = () => localBackend.listCategories({ includeAll: true }).categories;

    expect(selectableCategories(all()).map((row) => row.id)).toContain(created.id);

    localBackend.updateCustomCategory(LOCAL_HOUSEHOLD_ID, created.id, { active: false });
    // 규칙 (a): active:false는 더 이상 고르라고 내밀지 않는다.
    expect(selectableCategories(all()).map((row) => row.id)).not.toContain(created.id);
    // 규칙 (d): 그 분류로 이미 기록된 지출을 수정할 때는 현재값이라 언제나 남는다.
    expect(selectableCategories(all(), created.id).map((row) => row.id)).toContain(created.id);
  });
});

describe("클라이언트 경유(§9.4) — 로컬 토큰은 네트워크를 만지지 않고 미러로 간다", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("생성·수정·목록이 같은 미러 상태를 지난다 (fetch 0회)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const created = await clientCreateCustomCategory(LOCAL_SESSION_TOKEN, LOCAL_HOUSEHOLD_ID, "산후도우미");
    expect(created.isSystem).toBe(false);
    expect(created.householdId).toBe(LOCAL_HOUSEHOLD_ID);

    const renamed = await clientUpdateCustomCategory(LOCAL_SESSION_TOKEN, LOCAL_HOUSEHOLD_ID, created.id, {
      name: "산후관리사"
    });
    expect(renamed.name).toBe("산후관리사");

    // ⚠️ 두 시점 — 종전 client.listCategories의 로컬 분기는 `options`를 버렸다(데모 목록이 전부
    // active라 무의미했다). 보관 행이 생기는 순간 그 전제가 깨지므로 이제 그대로 넘긴다.
    await clientUpdateCustomCategory(LOCAL_SESSION_TOKEN, LOCAL_HOUSEHOLD_ID, created.id, { active: false });
    const visible = (await clientListCategories(LOCAL_SESSION_TOKEN)).categories.map((row: CategoryListItem) => row.id);
    const everything = (await clientListCategories(LOCAL_SESSION_TOKEN, { includeAll: true })).categories.map(
      (row: CategoryListItem) => row.id
    );
    expect(visible).not.toContain(created.id);
    expect(everything).toContain(created.id);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("sanitize(§3.1) — 비배열/오염 blob → [], 행 단위 오염은 성한 값만 살린다", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("customCategories가 배열이 아니면 []로 되돌린다 (customItems 관례)", async () => {
    const store = localBackend.useLocalBackendStore;
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({ state: { seeded: true, customCategories: "corrupted" }, version: 3 })
    );
    await store.persist.rehydrate();
    expect(store.getState().customCategories).toEqual([]);
  });

  it("행 단위 오염: 식별자·code·이름이 성치 않은 행은 버리고, 나머지 칸은 기본값으로 되돌린다", async () => {
    const store = localBackend.useLocalBackendStore;
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({
        state: {
          seeded: true,
          customCategories: [
            { id: "local-custom-category-1", code: "custom_1", name: "산후도우미", displayOrder: 2000, active: false, createdAt: "2026-09-01T00:00:00.000Z" },
            { id: "local-custom-category-2", code: "custom_2", name: "돌잔치" }, // 칸 결손 → 기본값
            { id: "local-custom-category-3", code: "custom_3", name: "   " }, // 이름 공백 → 버린다
            { id: "", code: "custom_4", name: "친정 지원" }, // 식별자 결손 → 버린다
            { code: "custom_5", name: "조리원" }, // id 없음 → 버린다
            "garbage"
          ]
        },
        version: 3
      })
    );
    await store.persist.rehydrate();

    const rows = store.getState().customCategories;
    expect(rows.map((row) => row.id)).toEqual(["local-custom-category-1", "local-custom-category-2"]);
    // 보관 상태는 사용자 조작의 결과라 그대로 살린다.
    expect(rows[0].active).toBe(false);
    // 결손 칸은 새 행이 갖는 값으로 되돌린다(active:true · 시드 뒤 대역의 바닥).
    expect(rows[1].active).toBe(true);
    expect(rows[1].displayOrder).toBe(mirrorNumber("LOCAL_CUSTOM_CATEGORY_DISPLAY_ORDER_BASE"));
    // 오염된 blob이 목록 전체를 죽이지 않는다 — 이름 해석의 모집단이 살아 있어야 한다.
    expect(() => localBackend.listCategories({ includeAll: true })).not.toThrow();
  });
});
