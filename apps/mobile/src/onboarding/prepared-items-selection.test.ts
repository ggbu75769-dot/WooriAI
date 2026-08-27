import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ItemSummary } from "../api/client";
import {
  PREPARED_ITEM_OPTION_LIMIT,
  PREPARED_ITEMS_PARTIAL_ALERT_MESSAGE,
  preparedIdsToSubmit,
  preparedItemsPartialNotice,
  selectPreparedItemOptions,
  togglePreparedItemId
} from "./prepared-items-selection";

// 화면 자체는 react-native를 transitive import해서 vitest가 실행할 수 없다
// (src/onboarding-step-progress.test.ts와 같은 소스 계약 관례).
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function item(overrides: Partial<ItemSummary> & { id: string }): ItemSummary {
  return {
    name: `항목 ${overrides.id}`,
    necessityLevel: "convenience",
    status: "not_prepared",
    ...overrides
  };
}

describe("라운드 45 UX-Y(P1) ONB-003 준비물 선택 판정", () => {
  describe("selectPreparedItemOptions", () => {
    it("필수를 앞에 두되 같은 등급 안에서는 서버 순서를 유지한다", () => {
      const options = selectPreparedItemOptions([
        item({ id: "c1", necessityLevel: "convenience" }),
        item({ id: "e1", necessityLevel: "essential" }),
        item({ id: "o1", necessityLevel: "optional" }),
        item({ id: "c2", necessityLevel: "convenience" }),
        item({ id: "e2", necessityLevel: "essential" })
      ]);

      expect(options.map((option) => option.id)).toEqual(["e1", "e2", "c1", "c2", "o1"]);
      expect(options.map((option) => option.essential)).toEqual([true, true, false, false, false]);
    });

    it("한 화면 분량(최대 6개)만 남기고, 이름을 라벨로 쓴다", () => {
      const many = Array.from({ length: 12 }, (_, index) => item({ id: `i${index}`, name: `물건${index}` }));
      const options = selectPreparedItemOptions(many);

      expect(options).toHaveLength(PREPARED_ITEM_OPTION_LIMIT);
      expect(options[0]).toMatchObject({ id: "i0", label: "물건0" });
    });

    it("이미 준비 완료인 항목과 중복 id는 후보에서 뺀다", () => {
      const options = selectPreparedItemOptions([
        item({ id: "a" }),
        item({ id: "a" }),
        item({ id: "b", status: "prepared" })
      ]);

      expect(options.map((option) => option.id)).toEqual(["a"]);
    });

    it("빈 목록이면 빈 후보 — 화면은 이 단계를 건너뛸 수 있어야 한다", () => {
      expect(selectPreparedItemOptions([])).toEqual([]);
    });
  });

  describe("togglePreparedItemId", () => {
    it("없으면 더하고 있으면 뺀다", () => {
      expect(togglePreparedItemId([], "a")).toEqual(["a"]);
      expect(togglePreparedItemId(["a", "b"], "a")).toEqual(["b"]);
    });
  });

  describe("preparedIdsToSubmit", () => {
    const options = selectPreparedItemOptions([
      item({ id: "a", necessityLevel: "essential" }),
      item({ id: "b" })
    ]);

    it("사용자가 고른 것만, 화면 순서대로 보낸다", () => {
      expect(preparedIdsToSubmit(["b", "a"], options)).toEqual(["a", "b"]);
      expect(preparedIdsToSubmit(["b"], options)).toEqual(["b"]);
    });

    it("아무것도 안 고르면 빈 배열 — 기본값이 전체 선택이던 허위 성공의 반대다", () => {
      expect(preparedIdsToSubmit([], options)).toEqual([]);
    });

    it("화면에 없는 id(갱신되며 사라진 항목·옛 데모 픽스처)는 절대 보내지 않는다", () => {
      // 이 id가 실서버로 새어 나가면 서버는 조용히 건너뛰는데 화면만 "준비 완료"라고 말한다.
      expect(preparedIdsToSubmit(["10ca11fe-0000-4a01-8a01-f1c7deb0a001", "a"], options)).toEqual(["a"]);
    });
  });

  describe("preparedItemsPartialNotice (라운드 45 O-3)", () => {
    it("반영 수가 보낸 수보다 작으면 중립 안내 한 줄", () => {
      expect(preparedItemsPartialNotice(3, 1)).toBe(PREPARED_ITEMS_PARTIAL_ALERT_MESSAGE);
      expect(preparedItemsPartialNotice(2, 0)).toBe(PREPARED_ITEMS_PARTIAL_ALERT_MESSAGE);
      // 안내일 뿐 실패가 아니다 -- 저장은 성공했고 다시 체크할 곳을 알려 준다.
      expect(PREPARED_ITEMS_PARTIAL_ALERT_MESSAGE).toContain("준비템 탭");
    });

    it("전부 반영됐거나 보낼 것이 없었으면 조용하다", () => {
      expect(preparedItemsPartialNotice(2, 2)).toBeNull();
      // 건너뛰기(0건 신고)는 비교할 것이 없다.
      expect(preparedItemsPartialNotice(0, 0)).toBeNull();
    });

    it("응답이 수를 안 주면(구버전·이상 응답) 지어내지 않는다", () => {
      expect(preparedItemsPartialNotice(2, undefined)).toBeNull();
      expect(preparedItemsPartialNotice(2, "1")).toBeNull();
      expect(preparedItemsPartialNotice(2, Number.NaN)).toBeNull();
    });
  });

  describe("ONB-003 화면 배선(소스 계약)", () => {
    const screenSource = source("app/(onboarding)/prepared-items.tsx");

    it("실세션은 서버 준비템 목록에서 후보를 만들어 진짜 id를 보낸다", () => {
      expect(screenSource).toContain("listItems(authToken!, selectedChildId!, \"now\")");
      expect(screenSource).toContain("selectPreparedItemOptions(itemsQuery.data?.items ?? [])");
      expect(screenSource).toContain("preparedIdsToSubmit(checkedIds, options)");
      expect(screenSource).toContain("setPreparedItems(authToken, selectedChildId, idsToSubmit)");
    });

    it("데모 픽스처는 데모 토큰 경로에서만 쓴다", () => {
      expect(screenSource).toContain("const isDemoSession = authToken === LOCAL_SESSION_TOKEN");
      expect(screenSource).toContain("isDemoSession ? demoPreparedItemOptions :");
    });

    it("기본값은 전체 해제 — 사용자가 고른 것만 준비 완료로 선언한다", () => {
      expect(screenSource).toContain("useState<string[]>([])");
      expect(screenSource).not.toContain("preparedItemOptions.map((item) => item.id)");
    });

    it("목록을 못 받았거나 비었으면 이 단계를 건너뛸 수 있다", () => {
      expect(screenSource).toContain("const canSkip = !isLoadingOptions && !hasOptions");
      expect(screenSource).toContain("건너뛰고 계속");
      expect(screenSource).toContain("목록 다시 불러오기");
    });

    it("데모 세션은 서버 목록 쿼리를 아예 켜지 않는다 (데모 토큰으로 실요청 금지)", () => {
      expect(screenSource).toContain(
        "const isItemsQueryEnabled = Boolean(authToken && selectedChildId) && !isDemoSession"
      );
      expect(screenSource).toContain("enabled: isItemsQueryEnabled");
    });

    it("로딩 판정은 '실제로 조회 중'일 때만 참 (비활성 쿼리도 isPending이다)", () => {
      // 이 판정이 isPending만 보면 데모 세션은 영원히 스켈레톤이고, 건너뛰기 창도 열리지 않는다.
      expect(screenSource).toContain("const isLoadingOptions = isItemsQueryEnabled && itemsQuery.isPending");
    });

    it("다시 불러오는 동안에도 건너뛰기 창이 닫히지 않는다", () => {
      // canSkip은 isFetching이 아니라 isLoadingOptions(첫 조회)만 본다 -- refetch 중에 버튼이
      // "건너뛰고 계속"에서 "저장하고 계속"으로 흔들리면 사용자가 무엇을 누르는지 알 수 없다.
      expect(screenSource).toContain("const canSkip = !isLoadingOptions && !hasOptions");
      expect(screenSource).not.toContain("canSkip = !itemsQuery.isFetching");
      // 다시 불러오기 버튼만 그 사이 비활성이다.
      expect(screenSource).toContain("disabled={itemsQuery.isFetching}");
    });

    it("저장 응답의 반영 수를 읽고, 요청보다 작으면 중립 안내를 남긴다 (라운드 45 O-3)", () => {
      expect(screenSource).toContain("preparedItemsPartialNotice(idsToSubmit.length, result?.updatedCount)");
      // 안내는 진행을 막지 않는다 -- 저장 자체는 성공이다.
      expect(screenSource).toContain('completeStep("ONB-003")');
      expect(screenSource).toContain('router.push("/onboarding/budget")');
    });

    it("라운드 46 Q-2: 안내는 확인 버튼을 누른 뒤 다음 화면으로 넘어간다", () => {
      // 예전 배선은 Alert를 띄우자마자 push해서, 안내가 이미 넘어간 예산 화면 위에 떴다.
      // 가족 초대 수락(app/family/accept/[token].tsx)과 같은 관례: onPress에서 이동한다.
      expect(screenSource).toContain(
        "Alert.alert(PREPARED_ITEMS_PARTIAL_ALERT_TITLE, notice, [{ text: \"확인\", onPress: proceed }]);"
      );
      // fire-and-forget 형태(버튼 없이 띄우고 바로 진행)는 남아 있으면 안 된다.
      expect(screenSource).not.toContain("Alert.alert(PREPARED_ITEMS_PARTIAL_ALERT_TITLE, notice);");

      // 단계 완료·이동은 한 곳(proceed)에만 있고, 안내가 없을 때만 즉시 호출된다.
      const onSuccess = screenSource.slice(
        screenSource.indexOf("onSuccess: (result) => {"),
        screenSource.indexOf("const canSkip")
      );
      expect(onSuccess).toContain("const proceed = () => {");
      expect(onSuccess.indexOf("proceed();")).toBeGreaterThan(onSuccess.indexOf("if (!notice) {"));
      // 이동 호출은 proceed 안에 한 번씩만 존재한다.
      expect(onSuccess.split('router.push("/onboarding/budget")').length - 1).toBe(1);
      expect(onSuccess.split('completeStep("ONB-003")').length - 1).toBe(1);
    });

    it("ONB-006 이어하기 문구가 0개를 실패처럼 읽히게 두지 않는다", () => {
      const resumeSource = source("app/(onboarding)/resume.tsx");
      expect(resumeSource).toContain("체크한 준비물은 아직 없어요");
      expect(resumeSource).toContain("summary.preparedItemsCount > 0");
    });
  });

  describe("라운드 45 UX-Y(S) 날짜 입력 키패드", () => {
    // 라운드 45 O-7: numbers-and-punctuation은 iOS 전용 값이다(Android는 기본 키보드 + maxLength).
    // 계약은 "지출 화면과 같은 값"이지 "모든 플랫폼에서 숫자 키패드"가 아니다.
    it("예정일·생년월일 입력이 지출 화면과 같은 키보드 값과 10자 제한을 쓴다", () => {
      for (const relativePath of ["app/(onboarding)/child-profile.tsx", "app/settings/children.tsx"]) {
        const dateScreenSource = source(relativePath);
        expect(dateScreenSource, `${relativePath}`).toContain('keyboardType="numbers-and-punctuation"');
        expect(dateScreenSource, `${relativePath}`).toContain("maxLength={10}");
      }
    });
  });
});
