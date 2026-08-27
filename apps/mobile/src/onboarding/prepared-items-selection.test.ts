import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ItemSummary } from "../api/client";
import {
  PREPARED_ITEM_OPTION_LIMIT,
  preparedIdsToSubmit,
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

    it("ONB-006 이어하기 문구가 0개를 실패처럼 읽히게 두지 않는다", () => {
      const resumeSource = source("app/(onboarding)/resume.tsx");
      expect(resumeSource).toContain("체크한 준비물은 아직 없어요");
      expect(resumeSource).toContain("summary.preparedItemsCount > 0");
    });
  });

  describe("라운드 45 UX-Y(S) 날짜 입력 키패드", () => {
    it("예정일·생년월일 입력이 지출 화면과 같은 숫자 키패드와 10자 제한을 쓴다", () => {
      for (const relativePath of ["app/(onboarding)/child-profile.tsx", "app/settings/children.tsx"]) {
        const dateScreenSource = source(relativePath);
        expect(dateScreenSource, `${relativePath}`).toContain('keyboardType="numbers-and-punctuation"');
        expect(dateScreenSource, `${relativePath}`).toContain("maxLength={10}");
      }
    });
  });
});
