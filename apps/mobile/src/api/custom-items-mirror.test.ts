import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildStageCode } from "@wooriai/domain";
import {
  createCustomItem as clientCreateCustomItem,
  deleteCustomItem as clientDeleteCustomItem,
  updateCustomItem as clientUpdateCustomItem,
  updateItemStatus as clientUpdateItemStatus,
  LOCAL_SESSION_TOKEN,
  type CreateCustomItemBody,
  type ItemSummary
} from "./client";
import * as localBackend from "./local-backend";
import { LOCAL_CHILD_ID, LOCAL_ITEM_DIAPER } from "./local-fixtures";
import type { StageBandLabel } from "../items/stage-bands";
import { persistStorage } from "../stores/persist-storage";

/**
 * 라운드 100 T2 — **커스텀 품목 합류 규칙의 서버 ↔ 로컬 미러 대조** (리스크 R5 차단).
 *
 * 합류 규칙은 설계 문서(docs/5차/round100-custom-items-design.md §2.2/§3.1)가 문장 하나로
 * 확정했다: **"탭 술어는 카탈로그와 동일, 순서는 카탈로그 뒤 created ASC"**. 이 규칙을 구현하는
 * 코드는 저장소에 두 벌 생긴다 — 실서버(T1: custom_items 합류)와 데모/테스트 세션의
 * `src/api/local-backend.ts`(이 라운드 T2). 한쪽만 술어나 순서를 바꾸면 데모에서 본 목록과
 * 실계정에서 본 목록이 갈린다(recommendation-order-mirror.test.ts가 카탈로그 순서에 대해
 * 지키는 것과 같은 종류의 계약).
 *
 * ⚠️ T1(apps/api)은 병렬 트랙이라 이 파일이 서는 시점에 서버 커스텀 합류 코드가 아직 없을 수
 * 있다. 그래서 서버 쪽 검증은 **skip이 아니라 소스 계약**이다:
 *  ⓐ 규칙 문장 자체를 설계 문서에서 실재 확인한다(문서가 세 트랙의 단일 소스다 — §8).
 *  ⓑ 탭 술어의 절반은 서버에 **이미 실재하는** 순수 모듈(`matchesTab` —
 *     apps/api/src/onboarding/item-ranking.ts. 문서 §2.2: "커스텀 행도 RankableItem 모양으로
 *     빚어 기존 matchesTab을 그대로 통과시킨다")이므로, 같은 픽스처를 그 함수와 로컬 미러
 *     양쪽에 넣어 집합·순서를 값으로 대조한다. T1 완료 후 리뷰 단계가 e2e로 실대조한다.
 */

const mobileRoot = process.cwd();
const repoFile = (relativePath: string) => readFileSync(join(mobileRoot, "..", "..", relativePath), "utf8");
const designDoc = () => repoFile("docs/5차/round100-custom-items-design.md");
const contractsSource = () => repoFile("packages/contracts/src/schemas.ts");
const mirrorSource = () => readFileSync(join(mobileRoot, "src", "api", "local-backend.ts"), "utf8");

const childId = LOCAL_CHILD_ID;
const ALL_TABS = ["now", "soon", "prepared", "not_needed", "all"] as const;
const ALL_BANDS: StageBandLabel[] = ["0-6개월", "6-12개월", "12-24개월", "24개월+"];

function isCustomRow(item: ItemSummary): boolean {
  return item.isCustom === true;
}

/** 계약 소스에서 상수 선언을 실재 확인과 함께 읽는다(없으면 그 자리에서 빨개진다). */
function contractNumber(name: string): number {
  const match = contractsSource().match(new RegExp(`export const ${name} = (\\d+);`));
  expect(match, `packages/contracts에서 ${name}을 찾지 못했다`).not.toBeNull();
  return Number(match![1]);
}

function contractReasonText(): string {
  const match = contractsSource().match(/export const CUSTOM_ITEM_REASON_TEXT = "([^"]+)";/);
  expect(match, "packages/contracts에서 CUSTOM_ITEM_REASON_TEXT를 찾지 못했다").not.toBeNull();
  return match![1];
}

/** 로컬 미러의 비export 리터럴 사본(contracts-mirror.test.ts 상수 대장이 가리키는 그 자리). */
function mirrorNumber(name: string): number {
  const match = mirrorSource().match(new RegExp(`const ${name} = (\\d+);`));
  expect(match, `local-backend.ts에서 ${name}을 찾지 못했다`).not.toBeNull();
  return Number(match![1]);
}

describe("합류 규칙 원문 — 문서·미러가 같은 한 문장을 든다 (서버 쪽 소스 계약)", () => {
  const RULE_SENTENCE = "탭 술어는 카탈로그와 동일, 순서는 카탈로그 뒤 created ASC";

  it("설계 문서 §3.1의 규칙 문장이 실재하고, §9.2가 같은 규칙으로 서버 응답을 못 박는다", () => {
    const doc = designDoc();
    expect(doc).toContain(RULE_SENTENCE);
    // §9.2 — 서버 목록 응답의 확정 모양(T1이 이 절만 보고 집행한다).
    expect(doc).toContain("커스텀(created_at ASC, 같은 탭 술어, isCustom:true)");
    // §2.2 — 커스텀을 추천 점수에 섞지 않는 근거 문장(DNC-009 무접촉의 뿌리).
    expect(doc).toContain("카탈로그 랭킹 결과 뒤에 커스텀을 `created_at ASC`로 덧붙인다");
  });

  it("로컬 미러 소스가 규칙 문장을 글자 그대로 들고 있다 (한쪽만 고치면 여기서 갈린다)", () => {
    expect(mirrorSource()).toContain(RULE_SENTENCE);
  });
});

describe("같은 픽스처 대조 — 서버 탭 술어(matchesTab) ‖ 로컬 미러의 합류", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  /**
   * 데모 아이(생후 24개월)의 현재 단계를 **미러가 실제로 쓰는 값**에서 읽는다 — 두 구현에 같은
   * 입력을 주기 위해서다(고정 리터럴을 박으면 시계가 단계를 옮기는 날 픽스처가 갈린다).
   */
  function currentStage(): ChildStageCode {
    return localBackend.getHome(childId).child.currentStage as ChildStageCode;
  }

  /** 공유 픽스처: 밴드 셋 × 상태 넷 + 소프트 삭제 1건. 생성 순서가 곧 created ASC의 기대 순서다. */
  function seedCustomFixtures() {
    const created = [
      localBackend.createCustomItem(childId, { name: "아기 욕조", stageBand: "12-24개월", necessityLevel: "essential" }),
      localBackend.createCustomItem(childId, { name: "신생아 속싸개", stageBand: "0-6개월", necessityLevel: "convenience" }),
      localBackend.createCustomItem(childId, { name: "유아 헬멧", stageBand: "24개월+", necessityLevel: "optional" }),
      localBackend.createCustomItem(childId, { name: "물려받은 카시트", stageBand: "12-24개월", necessityLevel: "essential" }),
      localBackend.createCustomItem(childId, { name: "산모 방석", stageBand: "0-6개월", necessityLevel: "optional" })
    ];
    localBackend.updateItemStatus(childId, created[3].id, "prepared");
    localBackend.updateItemStatus(childId, created[4].id, "not_needed");
    const removed = localBackend.createCustomItem(childId, {
      name: "지워진 물건",
      stageBand: "12-24개월",
      necessityLevel: "essential"
    });
    localBackend.deleteCustomItem(childId, removed.id);
    return { created, removedId: removed.id };
  }

  it("다섯 탭 × (밴드 없음 + 4밴드) 전부에서: 커스텀 집합·순서가 서버 술어와 같고, 자리는 카탈로그 뒤다", async () => {
    // 서버 쪽 절반 — 실재하는 서버 순수 모듈을 그대로 부른다(미러 코드가 아니라 원본).
    const { matchesTab } = await import("../../../../apps/api/src/onboarding/item-ranking");
    const { stagesForBand } = await import("../../../../apps/api/src/items-commerce/stage-bands");

    // 커스텀이 서기 **전**의 카탈로그 응답(모든 조합) — 합류가 카탈로그를 흔들면 안 된다.
    const bandOptions: (StageBandLabel | undefined)[] = [undefined, ...ALL_BANDS];
    const catalogBaseline = new Map<string, ItemSummary[]>();
    for (const tab of ALL_TABS) {
      for (const stageBand of bandOptions) {
        catalogBaseline.set(`${tab}|${stageBand ?? ""}`, localBackend.listItems(childId, tab, stageBand).items);
      }
    }

    const { created, removedId } = seedCustomFixtures();
    const stageCode = currentStage();
    // 서버가 custom_items 행을 빚는 모양(§2.2): stageCodes = stagesForBand(라벨), 랭킹 점수 무관.
    const serverSideRows = created.map((summary) => ({
      id: summary.id,
      stageCodes: stagesForBand(summary.timingLabel as StageBandLabel),
      necessityLevel: summary.necessityLevel,
      status: localBackend.getItemDetail(childId, summary.id).status,
      displayOrder: 0
    }));

    for (const tab of ALL_TABS) {
      for (const stageBand of bandOptions) {
        const label = `tab=${tab} stageBand=${stageBand ?? "(없음)"}`;
        const mirror = localBackend.listItems(childId, tab, stageBand).items;
        const customPortion = mirror.filter(isCustomRow);
        const catalogPortion = mirror.filter((item) => !isCustomRow(item));

        // ⓐ 술어: 서버의 matchesTab(기존 원본 함수)에 같은 픽스처를 넣은 결과와 집합·순서가 같다.
        //    순서는 created ASC = 생성 순서(serverSideRows가 그 순서로 서 있다).
        const expectedIds = serverSideRows
          .filter((row) => matchesTab(row, { tab, stageCode, stageBand }))
          .map((row) => row.id);
        expect(customPortion.map((item) => item.id), label).toEqual(expectedIds);

        // ⓑ 자리: 커스텀은 언제나 카탈로그 결과 **뒤**다(사이에 끼지 않는다).
        expect(mirror, label).toEqual([...catalogPortion, ...customPortion]);

        // ⓒ 무간섭: 카탈로그 절반은 커스텀이 서기 전과 바이트 단위로 같다(랭킹 무접촉 — DNC-009).
        expect(catalogPortion, label).toEqual(catalogBaseline.get(`${tab}|${stageBand ?? ""}`));

        // 소프트 삭제 행은 어떤 조합에도 없다.
        expect(mirror.some((item) => item.id === removedId), label).toBe(false);
      }
    }

    // 다섯 탭의 소속 확인(값 박제 — 위 루프가 술어 동치를 물었다면 여기는 픽스처가 실제로
    // 다섯 갈래를 전부 밟았다는 증거다): now 2(12-24개월·24개월+ 활성) · soon 1(0-6개월 활성) ·
    // prepared 1 · not_needed 1 · all 5.
    const idsIn = (tab: (typeof ALL_TABS)[number]) =>
      localBackend.listItems(childId, tab).items.filter(isCustomRow).map((item) => item.id);
    expect(idsIn("now")).toEqual([created[0].id, created[2].id]);
    expect(idsIn("soon")).toEqual([created[1].id]);
    expect(idsIn("prepared")).toEqual([created[3].id]);
    expect(idsIn("not_needed")).toEqual([created[4].id]);
    expect(idsIn("all")).toEqual(created.map((summary) => summary.id));
  });

  it("의도된 중복(§1.3): 24개월+로 등록한 품목은 12-24개월 칩에서도 보인다 — 카탈로그와 같은 동작", () => {
    const helmet = localBackend.createCustomItem(childId, {
      name: "유아 헬멧",
      stageBand: "24개월+",
      necessityLevel: "optional"
    });
    const under12to24 = localBackend.listItems(childId, "now", "12-24개월").items;
    expect(under12to24.some((item) => item.id === helmet.id)).toBe(true);
    // 상세 timingLabel은 고른 밴드를 그대로 말한다(R6의 대응 — 역방향 표시 보존).
    expect(localBackend.getItemDetail(childId, helmet.id).timingLabel).toBe("24개월+");
  });

  it("요약 모양(§9.2): isCustom·밴드 라벨 원문·서버와 같은 밴드 전개 — 가격·분류는 싣지 않는다", async () => {
    const { stagesForBand } = await import("../../../../apps/api/src/items-commerce/stage-bands");
    for (const stageBand of ALL_BANDS) {
      const summary = localBackend.createCustomItem(childId, {
        name: `밴드 확인 ${stageBand}`,
        stageBand,
        necessityLevel: "essential"
      });
      expect(summary.isCustom).toBe(true);
      expect(summary.status).toBe("not_prepared");
      expect(summary.timingLabel).toBe(stageBand);
      // 밴드 → 스테이지 전개가 서버 표(stagesForBand)와 같은 픽스처에서 같다
      // (두 표 자체의 대조는 apps/api/test/mobile-stage-band-contract.test.ts가 문다).
      expect(summary.stageCodes).toEqual(stagesForBand(stageBand));
      // 준비템 가격 표시 잠금: 커스텀 타입에 가격·분류 필드를 만들지 않는다(§5 — 없는 사실).
      expect("priceBandText" in summary).toBe(false);
      expect("categoryId" in summary).toBe(false);
    }
  });
});

describe("상세 갈래(§2.5)와 status 다형화(§2.4) — 오프라인 아웃박스 편승 경로의 미러", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("커스텀 상세는 링크 0건·주장 없음 모양이고, reasonText는 계약의 고정 문구 그대로다", () => {
    const created = localBackend.createCustomItem(childId, {
      name: "아기 욕조",
      stageBand: "0-6개월",
      necessityLevel: "essential"
    });
    const detail = localBackend.getItemDetail(childId, created.id);
    expect(detail).toMatchObject({
      id: created.id,
      isCustom: true,
      reasonText: contractReasonText(), // 출처 라벨 — 지어낸 설명이 아니다
      skipReasonText: null,
      usedSecondhandOk: false,
      safetyNote: null,
      medicalDisclaimerRequired: false,
      linkedExpense: null,
      productLinks: [] // 링크 0건 기존 갈래가 CTA·판매처 비교·고지를 접는다(DNC-010/011 무접촉)
    });
    // 카탈로그 상세는 커스텀 마커 없이 종전 그대로다(가산 계약의 반대 방향).
    expect(localBackend.getItemDetail(childId, LOCAL_ITEM_DIAPER).isCustom).toBeUndefined();
  });

  it("기존 status 경로가 커스텀 id를 받는다 — 클라이언트 진입점(updateItemStatus) 그대로", async () => {
    const created = localBackend.createCustomItem(childId, {
      name: "물려받은 카시트",
      stageBand: "12-24개월",
      necessityLevel: "essential"
    });
    // 아웃박스 flush가 부르는 바로 그 클라이언트 함수 하나로 커스텀 상태가 움직인다(§2.4).
    const updated = await clientUpdateItemStatus(LOCAL_SESSION_TOKEN, childId, created.id, "prepared");
    expect(updated).toMatchObject({ id: created.id, status: "prepared", isCustom: true });
    expect(localBackend.listItems(childId, "prepared").items.some((item) => item.id === created.id)).toBe(true);
    expect(localBackend.listItems(childId, "now").items.some((item) => item.id === created.id)).toBe(false);
  });

  it("경계(R1): 커스텀 + expenseId는 거절, 어느 표에도 없는 id는 종전 ITEM_NOT_FOUND 그대로", () => {
    const created = localBackend.createCustomItem(childId, {
      name: "아기 욕조",
      stageBand: "0-6개월",
      necessityLevel: "essential"
    });
    // §9.3 CUSTOM_ITEM_EXPENSE_LINK_UNSUPPORTED — 조용히 버리면 사용자가 연결됐다고 믿는다.
    expect(() => localBackend.updateItemStatus(childId, created.id, "prepared", "expense-1")).toThrow(
      "직접 추가한 준비물에는 아직 지출을 연결할 수 없어요."
    );
    // 존재하지 않는 id의 실패 모양은 다형화 이전과 같다(기존 e2e 경계 불변).
    expect(() => localBackend.updateItemStatus(childId, "no-such-item", "prepared")).toThrow("준비템을 찾을 수 없어요.");
    expect(() => localBackend.getItemDetail(childId, "no-such-item")).toThrow("준비템을 찾을 수 없어요.");
    // 카탈로그 갈래는 expenseId를 종전대로 받는다(커스텀 경계가 기존 동작을 좁히지 않는다).
    expect(localBackend.updateItemStatus(childId, LOCAL_ITEM_DIAPER, "prepared", "expense-1").status).toBe("prepared");
  });
});

describe("CRUD 미러 — 검증·한도 200·멱등·소프트 삭제 (계약 상수와 두 방향 대조)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  const validBody: CreateCustomItemBody = { name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "essential" };

  it("계약 상수 ↔ 로컬 사본이 값으로 같다 (80 · 200 · reasonText)", () => {
    expect(mirrorNumber("LOCAL_CUSTOM_ITEM_NAME_MAX_LENGTH")).toBe(contractNumber("CUSTOM_ITEM_NAME_MAX_LENGTH"));
    expect(mirrorNumber("LOCAL_CUSTOM_ITEM_MAX_PER_CHILD")).toBe(contractNumber("CUSTOM_ITEM_MAX_PER_CHILD"));
    const reasonMatch = mirrorSource().match(/const LOCAL_CUSTOM_ITEM_REASON_TEXT = "([^"]+)";/);
    expect(reasonMatch, "local-backend.ts에서 LOCAL_CUSTOM_ITEM_REASON_TEXT를 찾지 못했다").not.toBeNull();
    expect(reasonMatch![1]).toBe(contractReasonText());
  });

  it("이름: 트림 후 저장, 빈 이름 거절, 80자 경계(80 통과·81 거절 — 생성과 수정 양쪽)", () => {
    const max = contractNumber("CUSTOM_ITEM_NAME_MAX_LENGTH");
    expect(localBackend.createCustomItem(childId, { ...validBody, name: "  아기 욕조  " }).name).toBe("아기 욕조");
    expect(localBackend.createCustomItem(childId, { ...validBody, name: "가".repeat(max) }).name).toHaveLength(max);
    expect(() => localBackend.createCustomItem(childId, { ...validBody, name: "   " })).toThrow(
      "준비물 이름을 입력해 주세요."
    );
    expect(() => localBackend.createCustomItem(childId, { ...validBody, name: "가".repeat(max + 1) })).toThrow(
      `준비물 이름은 ${max}자까지 입력할 수 있어요.`
    );

    const created = localBackend.createCustomItem(childId, validBody);
    expect(localBackend.updateCustomItem(childId, created.id, { name: "  산모 방석  " }).name).toBe("산모 방석");
    expect(() => localBackend.updateCustomItem(childId, created.id, { name: "가".repeat(max + 1) })).toThrow(
      `준비물 이름은 ${max}자까지 입력할 수 있어요.`
    );
  });

  it("한도(§1.4): 활성 200에서 201번째 생성이 §9.3 문구로 거절되고, 소프트 삭제가 자리를 되돌려준다", () => {
    const limit = contractNumber("CUSTOM_ITEM_MAX_PER_CHILD");
    const first = localBackend.createCustomItem(childId, validBody);
    for (let index = 1; index < limit; index += 1) {
      localBackend.createCustomItem(childId, { ...validBody, name: `품목 ${index}` });
    }
    expect(localBackend.listItems(childId, "all").items.filter(isCustomRow)).toHaveLength(limit);
    expect(() => localBackend.createCustomItem(childId, { ...validBody, name: "초과분" })).toThrow(
      `직접 추가할 수 있는 준비물은 아이당 ${limit}개까지예요.`
    );
    // 한도 계산은 **활성 행만** 본다(deleted_at IS NULL 미러) — 하나 지우면 다시 만들 수 있다.
    expect(localBackend.deleteCustomItem(childId, first.id)).toEqual({ id: first.id, deleted: true });
    expect(localBackend.createCustomItem(childId, { ...validBody, name: "재추가" }).name).toBe("재추가");
  });

  it("멱등(§2.3, MOB-102 형식): 같은 키 재제출은 기존 행을 돌려주고 새 행을 만들지 않는다", () => {
    const first = localBackend.createCustomItem(childId, validBody, "custom-item-draft-1");
    const replay = localBackend.createCustomItem(childId, validBody, "custom-item-draft-1");
    expect(replay.id).toBe(first.id);
    expect(localBackend.listItems(childId, "all").items.filter(isCustomRow)).toHaveLength(1);
    // 다른 키(새 초안)는 새 행이다.
    const second = localBackend.createCustomItem(childId, validBody, "custom-item-draft-2");
    expect(second.id).not.toBe(first.id);
    expect(localBackend.listItems(childId, "all").items.filter(isCustomRow)).toHaveLength(2);
  });

  it("수정: 밴드·필수도 변경이 목록 자리와 상세에 반영된다 (status는 이 경로가 받지 않는다)", () => {
    const created = localBackend.createCustomItem(childId, validBody); // 0-6개월 → soon(24개월 아이)
    expect(localBackend.listItems(childId, "soon").items.some((item) => item.id === created.id)).toBe(true);

    const moved = localBackend.updateCustomItem(childId, created.id, {
      stageBand: "12-24개월",
      necessityLevel: "convenience"
    });
    expect(moved).toMatchObject({ id: created.id, timingLabel: "12-24개월", necessityLevel: "convenience", isCustom: true });
    expect(localBackend.listItems(childId, "now").items.some((item) => item.id === created.id)).toBe(true);
    expect(localBackend.listItems(childId, "soon").items.some((item) => item.id === created.id)).toBe(false);
    // 수정은 속성만 — 상태는 그대로다(§2.4: status는 기존 status 경로 하나가 쓴다).
    expect(localBackend.getItemDetail(childId, created.id).status).toBe("not_prepared");
  });

  it("소프트 삭제 뒤에는 목록·상세·수정·재삭제 전부 §9.3 CUSTOM_ITEM_NOT_FOUND 갈래다", () => {
    const created = localBackend.createCustomItem(childId, validBody);
    expect(localBackend.deleteCustomItem(childId, created.id)).toEqual({ id: created.id, deleted: true });
    for (const tab of ALL_TABS) {
      expect(localBackend.listItems(childId, tab).items.some((item) => item.id === created.id)).toBe(false);
    }
    expect(() => localBackend.updateCustomItem(childId, created.id, { name: "이름" })).toThrow(
      "직접 추가한 준비물을 찾을 수 없어요."
    );
    expect(() => localBackend.deleteCustomItem(childId, created.id)).toThrow("직접 추가한 준비물을 찾을 수 없어요.");
    // 상세는 어느 표에도 없는 id와 같은 모양으로 떨어진다(활성 행만 커스텀 갈래를 연다).
    expect(() => localBackend.getItemDetail(childId, created.id)).toThrow("준비템을 찾을 수 없어요.");
  });

  it("타 아이 스코프(§2.6 미러): 다른 childId의 조회·수정·삭제는 구조적으로 NOT_FOUND다", () => {
    const created = localBackend.createCustomItem(childId, validBody);
    expect(() => localBackend.updateCustomItem("other-child", created.id, { name: "이름" })).toThrow(
      "직접 추가한 준비물을 찾을 수 없어요."
    );
    expect(() => localBackend.deleteCustomItem("other-child", created.id)).toThrow(
      "직접 추가한 준비물을 찾을 수 없어요."
    );
  });
});

describe("데모 픽스처 0건(§3.2)과 sanitize — zero-start 규약", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("시드는 커스텀 품목을 하나도 만들지 않는다 — standalone은 생성 경로 자체로 성립한다", () => {
    localBackend.seedLocalDemoFixturesForTests();
    for (const tab of ALL_TABS) {
      expect(localBackend.listItems(childId, tab).items.filter(isCustomRow)).toEqual([]);
    }
    // 카탈로그 픽스처(앱 콘텐츠)에도 커스텀 행이 섞여 있지 않다(운영 시드 미러의 소유권 §3.2).
    expect(readFileSync(join(mobileRoot, "src", "api", "local-fixtures.ts"), "utf8")).not.toContain("isCustom");
  });

  it("오염 blob: customItems가 배열이 아니면 []로, 깨진 행은 버리고 성한 행만 살린다", async () => {
    const store = localBackend.useLocalBackendStore;
    const validRecord = {
      id: "local-custom-item-keep",
      childId,
      name: "성한 행",
      stageBand: "0-6개월",
      necessityLevel: "essential",
      status: "prepared",
      createdAt: new Date().toISOString(),
      deletedAt: null
    };

    // ⓐ 비배열 blob → [] (멤버·초대와 같은 관례).
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({ state: { seeded: true, customItems: "corrupted" }, version: 3 })
    );
    await store.persist.rehydrate();
    expect(store.getState().customItems).toEqual([]);

    // ⓑ 행 단위 오염 → 성한 행만 남는다(밴드 라벨이 깨진 행은 시기를 지어낼 수 없어 버린다).
    await persistStorage.setItem(
      "wooriai-local-backend",
      JSON.stringify({
        state: {
          seeded: true,
          customItems: [
            validRecord,
            { id: 123 }, // 식별자 오염
            { id: "x", childId, name: "밴드 오염", stageBand: "임신 중" }, // 라벨 원문 아님
            "garbage"
          ]
        },
        version: 3
      })
    );
    await store.persist.rehydrate();
    expect(store.getState().customItems).toEqual([validRecord]);
  });
});

describe("client.ts 라우팅 — 로컬 세션은 미러로, 실세션은 §9.2 경로·멱등 헤더로", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("LOCAL_SESSION_TOKEN이면 세 함수 전부 로컬 미러를 타고 같은 계약 모양을 돌려준다", async () => {
    const created = await clientCreateCustomItem(LOCAL_SESSION_TOKEN, childId, {
      name: "아기 욕조",
      stageBand: "0-6개월",
      necessityLevel: "essential"
    });
    expect(created).toMatchObject({ name: "아기 욕조", isCustom: true, status: "not_prepared" });

    const updated = await clientUpdateCustomItem(LOCAL_SESSION_TOKEN, childId, created.id, { name: "산모 방석" });
    expect(updated).toMatchObject({ id: created.id, name: "산모 방석" });

    const deleted = await clientDeleteCustomItem(LOCAL_SESSION_TOKEN, childId, created.id);
    expect(deleted).toEqual({ id: created.id, deleted: true });
  });

  it("실세션 생성은 POST /children/:childId/custom-items + Idempotency-Key 헤더(온보딩 관례 §2.3)", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const summary = { id: "server-custom-1", name: "아기 욕조", necessityLevel: "essential", status: "not_prepared", isCustom: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(summary), { status: 200, headers: { "Content-Type": "application/json" } });
      })
    );

    const body: CreateCustomItemBody = { name: "아기 욕조", stageBand: "0-6개월", necessityLevel: "essential" };
    await clientCreateCustomItem("real-token", "child-1", body, "draft-key-1");
    await clientUpdateCustomItem("real-token", "child-1", "server-custom-1", { name: "산모 방석" });
    await clientDeleteCustomItem("real-token", "child-1", "server-custom-1");

    expect(calls).toHaveLength(3);
    const headerOf = (index: number, name: string) =>
      (calls[index].init?.headers as Record<string, string> | undefined)?.[name];

    expect(calls[0].url).toContain("/children/child-1/custom-items");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(body);
    expect(headerOf(0, "Idempotency-Key")).toBe("draft-key-1"); // 같은 초안 재시도의 재사용 키

    expect(calls[1].url).toContain("/children/child-1/custom-items/server-custom-1");
    expect(calls[1].init?.method).toBe("PATCH");
    expect(headerOf(1, "Idempotency-Key")).toBeUndefined(); // PATCH/DELETE는 자연 멱등 — 키 없음(§2.3)

    expect(calls[2].url).toContain("/children/child-1/custom-items/server-custom-1");
    expect(calls[2].init?.method).toBe("DELETE");
    expect(headerOf(2, "Idempotency-Key")).toBeUndefined();
  });

  it("키를 넘기지 않은 생성에는 멱등 헤더 자체가 실리지 않는다 (없는 키를 지어내지 않는다)", async () => {
    const calls: { init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push({ init });
        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      })
    );
    await clientCreateCustomItem("real-token", "child-1", {
      name: "아기 욕조",
      stageBand: "0-6개월",
      necessityLevel: "essential"
    });
    expect((calls[0].init?.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
  });
});
