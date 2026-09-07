import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSeoulToday, MONEY_KRW_MAX } from "@wooriai/domain";
import {
  getBudget as clientGetBudget,
  upsertBudget as clientUpsertBudget,
  LOCAL_SESSION_TOKEN,
  type CategoryBudgetEntry
} from "./client";
import { API_ERROR_MESSAGES } from "./api-error";
import * as localBackend from "./local-backend";
import { categoryCatalog } from "../categories";
import {
  LOCAL_CATEGORY_DETERGENT,
  LOCAL_CATEGORY_DIAPER,
  LOCAL_CATEGORY_FORMULA,
  LOCAL_CHILD_ID,
  LOCAL_DEFAULT_BUDGET_KRW
} from "./local-fixtures";
import { persistStorage } from "../stores/persist-storage";

/**
 * 라운드 102 T2 — **카테고리별 예산 replace-set 규칙의 서버 ↔ 로컬 미러 대조** (리스크 R3·R5 차단).
 *
 * 규칙은 설계 문서(docs/5차/round102-category-budget-design.md §3.1)가 문장 하나로 확정했다:
 * **"필드 부재 무접촉 · 존재 시 그 달 집합 교체 · 응답은 categoryId 오름차순 배열"**. 이 규칙을
 * 구현하는 코드는 저장소에 두 벌 생긴다 — 실서버(T1: PUT /budget 확장)와 데모/테스트 세션의
 * `src/api/local-backend.ts`(이 라운드 T2). 한쪽만 규칙을 바꾸면 데모에서 본 예산 화면·리포트와
 * 실계정의 그것이 갈린다(custom-items-mirror.test.ts가 커스텀 품목 합류에 대해 지키는 것과
 * 같은 종류의 계약).
 *
 * ⚠️ T1(apps/api)은 병렬 트랙이라 이 파일이 서는 시점에 서버 카테고리 예산 코드가 아직 없을 수
 * 있다. 그래서 서버 쪽 검증은 **skip이 아니라 소스 계약**이다: 규칙 문장·검증 순서·에러 문구를
 * 설계 문서(세 트랙의 단일 소스 — §8)에서 실재 확인하고, 같은 픽스처를 로컬 미러에 넣어 그
 * 문장들이 값으로 성립하는지 문다. T1 완료 후 실코드 대조는 리뷰 단계의 몫이다.
 */

const mobileRoot = process.cwd();
const repoFile = (relativePath: string) => readFileSync(join(mobileRoot, "..", "..", relativePath), "utf8");
const designDoc = () => repoFile("docs/5차/round102-category-budget-design.md");
const contractsSource = () => repoFile("packages/contracts/src/schemas.ts");
const mirrorSource = () => readFileSync(join(mobileRoot, "src", "api", "local-backend.ts"), "utf8");

const childId = LOCAL_CHILD_ID;
/** 데모 아이(단일 아이 전제 — §3.1)와 이번 달. budgetKey가 "YYYY-MM"을 "YYYY-MM-01"로 정규화한다. */
const currentMonthInput = () => getSeoulToday().slice(0, 7);
const currentMonthKey = () => `${currentMonthInput()}-01`;

function previousMonthInput(): string {
  const [year, month] = currentMonthInput().split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

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

/** §9.3의 두 에러 문구 — 문서·미러가 같은 문장을 든다(아래 소스 계약이 실재를 문다). */
const LIMIT_MESSAGE = "카테고리 예산은 한 달에 30개까지 정할 수 있어요.";
const INVALID_CATEGORY_MESSAGE = "예산을 세울 수 없는 카테고리예요.";

describe("규칙 원문 — 문서·미러가 같은 한 문장을 든다 (서버 쪽 소스 계약)", () => {
  const RULE_SENTENCE = "필드 부재 무접촉 · 존재 시 그 달 집합 교체 · 응답은 categoryId 오름차순 배열";

  it("설계 문서 §3.1의 규칙 문장이 실재하고, §9.2가 같은 규칙으로 서버 계약을 못 박는다", () => {
    const doc = designDoc();
    expect(doc).toContain(RULE_SENTENCE);
    // §9.2 — PUT 확장의 확정 규칙(T1이 이 절만 보고 집행한다).
    expect(doc).toContain("필드 부재 = 카테고리 행 무접촉 · 존재 = 그 달 집합 교체(빈 배열 = 전부 해제)");
    expect(doc).toContain("배열 상한 30 · categoryId 중복 = VALIDATION_ERROR");
    // §9.2 — 응답 정렬과 404 불변(§1.3(b)).
    expect(doc).toContain("// 항상 배열, categoryId 오름차순");
    expect(doc).toContain("총액 행 없음 → 종전 404 BUDGET_NOT_FOUND 그대로");
    // §9.3 — 두 에러 문구(해요체). 미러가 던지는 문장과 같은 원문이다.
    expect(doc).toContain(`"${LIMIT_MESSAGE}"`);
    expect(doc).toContain(`"${INVALID_CATEGORY_MESSAGE}"`);
  });

  it("로컬 미러 소스가 규칙 문장을 글자 그대로 들고 있다 (한쪽만 고치면 여기서 갈린다)", () => {
    expect(mirrorSource()).toContain(RULE_SENTENCE);
  });

  it("계약 소스: categoryBudgets 가산 optional이 정확히 두 스키마 자리(budget · reportMonthly)에 선다", () => {
    const declarations = contractsSource().match(/categoryBudgets: z\.array\(categoryBudgetEntrySchema\)\.optional\(\)/g);
    // budgetSchema와 reportMonthlySchema 두 자리(§9.1). homeMonthlyBudgetSchema는 extend 승계라
    // 자기 선언이 없어야 한다 — 세 번째 선언이 생기면 설계가 확장된 것이므로 여기서 빨개진다.
    expect(declarations).toHaveLength(2);
  });
});

describe("상수 두 방향 대조 — 계약 30 ↔ 로컬 비export 리터럴 ↔ 오류 문구 표", () => {
  it("CATEGORY_BUDGET_MAX_PER_MONTH가 계약과 로컬 사본에서 값으로 같다", () => {
    expect(contractNumber("CATEGORY_BUDGET_MAX_PER_MONTH")).toBe(30);
    expect(mirrorNumber("LOCAL_CATEGORY_BUDGET_MAX_PER_MONTH")).toBe(contractNumber("CATEGORY_BUDGET_MAX_PER_MONTH"));
  });

  /**
   * §9.3의 두 코드는 API_ERROR_MESSAGES(src/api/api-error.ts)에도 선다 — 예산 화면의 저장
   * 실패가 useSaveErrorCopy로 이 표를 읽는다(라운드 70 B). 상한 문구의 "30"은 모바일에 읽어 올
   * 단일 소스 모듈이 없어 리터럴로 적혔으므로, 계약 상수와 갈라지는 순간을 여기서 잡는다.
   */
  it("오류 문구 표의 두 줄이 §9.3 원문·계약 상수와 갈라지지 않는다", () => {
    expect(API_ERROR_MESSAGES.CATEGORY_BUDGET_INVALID_CATEGORY).toBe(INVALID_CATEGORY_MESSAGE);
    expect(API_ERROR_MESSAGES.CATEGORY_BUDGET_LIMIT_EXCEEDED).toBe(
      `카테고리 예산은 한 달에 ${contractNumber("CATEGORY_BUDGET_MAX_PER_MONTH")}개까지 정할 수 있어요.`
    );
    expect(API_ERROR_MESSAGES.CATEGORY_BUDGET_LIMIT_EXCEEDED).toBe(LIMIT_MESSAGE);
  });
});

describe("같은 픽스처 대조 — replace-set 미러(§2.2)와 응답 모양(§2.3/§2.4)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  // 정식 축의 예산 행(§1.1 대안 D — 예산은 사용자가 고르는 축) — 로컬 모집단(listCategories가
  // 서빙하는 목록: 퀵타일 8 + 픽스처 4)의 실재 id만 쓴다.
  const diaper = { categoryId: LOCAL_CATEGORY_DIAPER, amountKrw: 120_000 };
  const formula = { categoryId: LOCAL_CATEGORY_FORMULA, amountKrw: 90_000 };
  const detergent = { categoryId: LOCAL_CATEGORY_DETERGENT, amountKrw: 30_000 };

  it("데모 픽스처 0건(§3.2): 시드는 총액 예산만 심고 카테고리 예산은 zero-start다", () => {
    const budget = localBackend.getBudget(childId, currentMonthInput());
    expect(budget.amountKrw).toBe(LOCAL_DEFAULT_BUDGET_KRW);
    expect(budget.categoryBudgets).toEqual([]);
    expect(localBackend.getMonthlyReport(childId, currentMonthInput()).categoryBudgets).toEqual([]);
  });

  it("존재 = 그 달 집합 교체: upsert → 재교체 → 빈 배열 해제, 각 응답과 GET·월간 리포트가 같은 집합을 말한다", () => {
    const saved = localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper, formula]);
    expect(saved.categoryBudgets).toEqual([diaper, formula]); // local-category-diaper < local-category-formula
    expect(localBackend.getBudget(childId, currentMonthInput()).categoryBudgets).toEqual([diaper, formula]);
    expect(localBackend.getMonthlyReport(childId, currentMonthInput()).categoryBudgets).toEqual([diaper, formula]);

    // 교체: 배열에 없는 기존 행(formula)은 삭제, 있는 행은 upsert — 부분 병합이 아니다.
    const replaced = localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [
      { ...diaper, amountKrw: 150_000 },
      detergent
    ]);
    expect(replaced.categoryBudgets).toEqual([detergent, { ...diaper, amountKrw: 150_000 }]);

    // 빈 배열 = 그 달 전부 해제(행 단위 DELETE가 필요 없는 이유 — §2.2).
    expect(localBackend.upsertBudget(childId, 300_000, currentMonthInput(), []).categoryBudgets).toEqual([]);
    expect(localBackend.getBudget(childId, currentMonthInput()).categoryBudgets).toEqual([]);
  });

  it("필드 부재 = 무접촉: 카테고리 인자 없는 저장(구클라이언트·온보딩 화면)은 총액만 바꾸고 **응답에 키도 싣지 않는다** (R5 · 리뷰 M-4)", () => {
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper, formula]);

    const totalOnly = localBackend.upsertBudget(childId, 550_000, currentMonthInput());
    expect(totalOnly.amountKrw).toBe(550_000);
    // ⚠️ 두 시점: 종전 미러는 이 갈래에서도 categoryBudgets를 실었고(그래서 이 자리는
    // `toEqual([diaper, formula])`였다), 서버는 키 자체를 싣지 않는다(카테고리 행을 한 건도
    // 읽지 않는 갈래다 — §2.2). 두 벌이 갈린 채로 두면 PUT 응답을 낙관 갱신에 쓰는 날
    // 데모는 멀쩡하고 실계정에서만 행이 사라진다. 방향은 서버 쪽으로 통일했다.
    expect("categoryBudgets" in totalOnly).toBe(false);

    // 무접촉의 증명은 응답이 아니라 **다음 GET**이 진다 — 행은 한 건도 바뀌지 않았다.
    const budget = localBackend.getBudget(childId, currentMonthInput());
    expect(budget.amountKrw).toBe(550_000);
    expect(budget.categoryBudgets).toEqual([diaper, formula]);
    // 반대로 인자가 있는 갈래는 종전대로 방금 교체한 집합을 싣는다(§9.2 PUT 200 = GET 200 모양).
    expect(localBackend.upsertBudget(childId, 550_000, currentMonthInput(), [diaper]).categoryBudgets).toEqual([
      diaper
    ]);
  });

  it("응답은 categoryId 오름차순 배열: 입력 순서와 무관하게 결정적이다(§2.3)", () => {
    const quickTile = { categoryId: categoryCatalog[0].id, amountKrw: 50_000 }; // "c0a7e901-…" — 로컬 모집단의 퀵타일 행
    const saved = localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [formula, quickTile, diaper]);
    expect(saved.categoryBudgets).toEqual([quickTile, diaper, formula]); // "c…" < "local-category-d…" < "local-category-f…"
    expect(localBackend.getBudget(childId, currentMonthInput()).categoryBudgets).toEqual([quickTile, diaper, formula]);
  });

  it("월 축: 한 달의 교체는 다른 달의 행을 건드리지 않고, 총액 없는 달의 404 의미는 종전 그대로다 (R3)", () => {
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper]);

    // 지난달: 총액 예산이 없는 달 — GET은 종전 404 갈래 그대로다. §1.3(b): 총액 없는 달에는
    // 카테고리 행도 구조적으로 없다(upsertBudget이 언제나 총액을 함께 쓴다 — 요청 형태상
    // "총액 없는 카테고리 예산"을 만들 수 없다).
    expect(() => localBackend.getBudget(childId, previousMonthInput())).toThrow("월 예산을 찾을 수 없어요.");
    expect(localBackend.getMonthlyReport(childId, previousMonthInput())).toMatchObject({
      budgetAmountKrw: null,
      categoryBudgets: []
    });

    // 지난달에 총액+카테고리를 세워도 이번 달 집합은 그대로다(정규화월 축 분리).
    localBackend.upsertBudget(childId, 200_000, previousMonthInput(), [formula]);
    expect(localBackend.getBudget(childId, previousMonthInput()).categoryBudgets).toEqual([formula]);
    expect(localBackend.getBudget(childId, currentMonthInput()).categoryBudgets).toEqual([diaper]);
  });

  it("홈 무접촉(§2.4): getHome의 monthly에는 categoryBudgets 필드 자체가 실리지 않는다", () => {
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper]);
    expect("categoryBudgets" in localBackend.getHome(childId).monthly).toBe(false);
  });

  it("검증 순서(§2.2): 형식(중복·금액) → 상한 30 → 실재 — 서버의 [ValidationPipe → 서비스] 순서와 같다 (리뷰 L-8)", () => {
    const synthetic = (count: number, amountKrw = 10_000): CategoryBudgetEntry[] =>
      Array.from({ length: count }, (_, index) => ({
        categoryId: `synthetic-category-${String(index).padStart(2, "0")}`,
        amountKrw
      }));

    // 31건: 배열 상한 초과 — §9.3 CATEGORY_BUDGET_LIMIT_EXCEEDED 문구 그대로.
    expect(() => localBackend.upsertBudget(childId, 300_000, currentMonthInput(), synthetic(31))).toThrow(
      LIMIT_MESSAGE
    );
    // 정확히 30건은 상한을 통과한다 — 이 합성 id들은 모집단에 없으므로 다음 단계(실재)에서
    // §9.3 CATEGORY_BUDGET_INVALID_CATEGORY로 떨어진다(경계가 30/31 사이임을 증명).
    expect(() => localBackend.upsertBudget(childId, 300_000, currentMonthInput(), synthetic(30))).toThrow(
      INVALID_CATEGORY_MESSAGE
    );

    // ⚠️ 두 시점(리뷰 L-8): **형식 위반과 상한 초과가 동시**인 요청. 종전 미러는 상한을 맨 앞에
    // 두어 상한 문구로 떨어졌는데, 서버에서는 금액 범위·중복을 DTO(ValidationPipe)가 서비스보다
    // 먼저 보므로 `VALIDATION_ERROR` 갈래다. 이제 미러도 형식 위반이 먼저 잡힌다.
    expect(() => localBackend.upsertBudget(childId, 300_000, currentMonthInput(), synthetic(31, 0))).toThrow(
      "금액은 0보다 큰 원화 정수만 입력할 수 있어요."
    );
    expect(() =>
      localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [...synthetic(31), synthetic(1)[0]])
    ).toThrow("한 카테고리에는 예산을 하나만 정할 수 있어요.");
  });

  it("숨긴/모르는 카테고리의 **기존 행**은 계속 고칠 수 있다 — 새로 세우는 것만 막는다 (§6.5 · 리뷰 H 미러)", () => {
    // 로컬 모집단에는 active:false 행이 없으므로 "모집단 밖 id"가 서버의 숨긴 행 대역이다
    // (미러 헤더의 그 술어 접힘). 손상 저장본·구버전 blob으로 그런 행이 남아 있는 상태를 만든다.
    const hiddenId = "local-category-hidden-by-operator";
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper]);
    localBackend.useLocalBackendStore.setState((state) => ({
      categoryBudgets: {
        ...state.categoryBudgets,
        [currentMonthKey()]: { ...(state.categoryBudgets[currentMonthKey()] ?? {}), [hiddenId]: 50_000 }
      }
    }));
    const hidden = { categoryId: hiddenId, amountKrw: 50_000 };

    // ① 총액만 고치는 저장(화면은 kept 행을 그대로 다시 싣는다) — 종전에는 여기서 전체가 400.
    expect(localBackend.upsertBudget(childId, 360_000, currentMonthInput(), [diaper, hidden]).categoryBudgets).toEqual(
      [diaper, hidden]
    );
    // ② 그 행의 값 수정.
    expect(
      localBackend.upsertBudget(childId, 360_000, currentMonthInput(), [diaper, { ...hidden, amountKrw: 70_000 }])
        .categoryBudgets
    ).toEqual([diaper, { ...hidden, amountKrw: 70_000 }]);
    // ③ 그 행 해제(배열에서 빼기).
    expect(localBackend.upsertBudget(childId, 360_000, currentMonthInput(), [diaper]).categoryBudgets).toEqual([
      diaper
    ]);
    // ④ 해제한 뒤에는 다시 **신규**다 — 모집단 밖 id를 새로 세울 수는 없다.
    expect(() => localBackend.upsertBudget(childId, 360_000, currentMonthInput(), [diaper, hidden])).toThrow(
      INVALID_CATEGORY_MESSAGE
    );
  });

  it("검증: categoryId 중복·미존재·금액 범위 전부 거절 — 부분 적용 없이 총액까지 무접촉이다", () => {
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper]);

    // 배열 내 categoryId 중복(§2.2 — 서버 VALIDATION_ERROR 갈래).
    expect(() =>
      localBackend.upsertBudget(childId, 400_000, currentMonthInput(), [formula, { ...formula, amountKrw: 1 }])
    ).toThrow("한 카테고리에는 예산을 하나만 정할 수 있어요.");
    // 미존재 카테고리 하나가 섞이면 전체 거절(§2.2 — 부분 적용 없음).
    expect(() =>
      localBackend.upsertBudget(childId, 400_000, currentMonthInput(), [formula, { categoryId: "no-such", amountKrw: 1 }])
    ).toThrow(INVALID_CATEGORY_MESSAGE);
    // 금액은 지출·총액 예산과 같은 한 벌(1..MONEY_KRW_MAX — DNC-013, 0원 예산 없음 §1.2).
    for (const amountKrw of [0, -1, 1.5, MONEY_KRW_MAX + 1]) {
      expect(() =>
        localBackend.upsertBudget(childId, 400_000, currentMonthInput(), [{ ...formula, amountKrw }])
      ).toThrow("금액은 0보다 큰 원화 정수만 입력할 수 있어요.");
    }

    // 서버의 한 $transaction 미러: 실패한 저장은 총액도 카테고리도 한 글자도 바꾸지 않는다.
    const budget = localBackend.getBudget(childId, currentMonthInput());
    expect(budget.amountKrw).toBe(300_000);
    expect(budget.categoryBudgets).toEqual([diaper]);
  });

  it("아이 프로필 파기(§1.5 미러): 카테고리 예산은 아이와 함께 사라진다 — 재생성 아이는 0에서 시작한다", () => {
    localBackend.upsertBudget(childId, 300_000, currentMonthInput(), [diaper, formula]);
    localBackend.confirmChildProfileDeletion(childId, "DELETE CHILD");

    localBackend.createChild({ nickname: "여정이" });
    localBackend.updateChild(childId, { stageMode: "manual", manualStage: "toddler_1_3" });
    // 총액과 같은 규칙: 정한 적 없는 달은 404이고, 다시 세운 총액에 이전 아이의 카테고리
    // 기준선이 달라붙지 않는다.
    expect(() => localBackend.getBudget(childId, currentMonthInput())).toThrow("월 예산을 찾을 수 없어요.");
    // ⚠️ 두 시점(리뷰 M-4): 카테고리 인자 없는 저장의 응답에는 키 자체가 없으므로(무접촉 갈래)
    // "행이 0건"이라는 사실은 그 응답이 아니라 **GET**이 진다.
    const rebuilt = localBackend.upsertBudget(childId, 100_000, currentMonthInput());
    expect("categoryBudgets" in rebuilt).toBe(false);
    expect(localBackend.getBudget(childId, currentMonthInput()).categoryBudgets).toEqual([]);
  });
});

describe("sanitize(§3.1) — 비객체/오염 blob → {}, 행 단위 오염은 성한 값만 살린다", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("categoryBudgets가 객체가 아니면 {}로 되돌린다 (멤버·customItems 관례)", async () => {
    const store = localBackend.useLocalBackendStore;
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({ state: { seeded: true, categoryBudgets: "corrupted" }, version: 3 })
    );
    await store.persist.rehydrate();
    expect(store.getState().categoryBudgets).toEqual({});
  });

  it("달 단위·행 단위 오염은 걸러 내고 양수 정수 금액 행만 살린다", async () => {
    const store = localBackend.useLocalBackendStore;
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({
        state: {
          seeded: true,
          categoryBudgets: {
            [currentMonthKey()]: {
              [LOCAL_CATEGORY_DIAPER]: 120_000, // 성한 행
              [LOCAL_CATEGORY_FORMULA]: "not-a-number", // 금액 오염
              [LOCAL_CATEGORY_DETERGENT]: 0 // 0원 예산은 존재하지 않는다(§1.2)
            },
            "2026-01-01": "garbage" // 달 blob 오염
          }
        },
        version: 3
      })
    );
    await store.persist.rehydrate();
    expect(store.getState().categoryBudgets).toEqual({
      [currentMonthKey()]: { [LOCAL_CATEGORY_DIAPER]: 120_000 }
    });
  });
});

describe("client.ts 라우팅 — 로컬 세션은 미러로, 실세션은 §9.2 본문 모양으로", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("LOCAL_SESSION_TOKEN이면 다섯째 인자가 미러의 같은 인자로 흐르고, getBudget도 같은 집합을 돌려준다", async () => {
    const entries: CategoryBudgetEntry[] = [
      { categoryId: LOCAL_CATEGORY_FORMULA, amountKrw: 90_000 },
      { categoryId: LOCAL_CATEGORY_DIAPER, amountKrw: 120_000 }
    ];
    const saved = await clientUpsertBudget(LOCAL_SESSION_TOKEN, childId, 300_000, undefined, entries);
    expect(saved.categoryBudgets).toEqual([
      { categoryId: LOCAL_CATEGORY_DIAPER, amountKrw: 120_000 },
      { categoryId: LOCAL_CATEGORY_FORMULA, amountKrw: 90_000 }
    ]);
    const fetched = await clientGetBudget(LOCAL_SESSION_TOKEN, childId);
    expect(fetched?.categoryBudgets).toEqual(saved.categoryBudgets);
  });

  it("실세션 PUT 본문: 인자가 있으면 categoryBudgets를 싣고, 없으면 키 자체가 없다(필드 부재 = 무접촉)", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      })
    );

    const entries: CategoryBudgetEntry[] = [{ categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 1 }];
    await clientUpsertBudget("real-token", "child-1", 300_000, "2026-09-01", entries);
    await clientUpsertBudget("real-token", "child-1", 300_000, "2026-09-01");
    await clientUpsertBudget("real-token", "child-1", 300_000, "2026-09-01", []);

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url).toContain("/children/child-1/budget");
      expect(call.init?.method).toBe("PUT");
    }
    const bodyOf = (index: number) => JSON.parse(String(calls[index].init?.body)) as Record<string, unknown>;

    expect(bodyOf(0)).toEqual({ yearMonth: "2026-09-01", amountKrw: 300_000, categoryBudgets: entries });
    // 인자 부재 = 본문 키 부재 — 구클라이언트와 같은 본문이라 서버가 그 달의 카테고리 행을
    // 읽지도 쓰지도 않는다(§2.2 하위호환의 전부).
    expect("categoryBudgets" in bodyOf(1)).toBe(false);
    expect(bodyOf(1)).toEqual({ yearMonth: "2026-09-01", amountKrw: 300_000 });
    // 빈 배열은 부재가 아니다 — "그 달 전부 해제"라는 뜻으로 그대로 실린다.
    expect(bodyOf(2)).toEqual({ yearMonth: "2026-09-01", amountKrw: 300_000, categoryBudgets: [] });
  });
});
