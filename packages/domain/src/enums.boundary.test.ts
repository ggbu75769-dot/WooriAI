// TEST-115: 경계·속성 기반 테스트 — enums 모듈.
import { describe, expect, it } from "vitest";
import {
  AUTH_PROVIDERS,
  CHILD_STAGE_CODES,
  CHILD_STAGE_MODES,
  EXPENSE_SOURCES,
  EXPENSE_TYPES,
  IMPORT_STATUSES,
  ITEM_STATUSES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  NECESSITY_LEVELS,
  PAYMENT_METHODS,
  PRODUCT_PLATFORMS,
  USER_STATUSES,
  isChildStageCode
} from "./enums";

/** 시드 고정 선형 합동 생성기 — 실행마다 동일한 수열을 재현한다. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("enum 목록 불변식", () => {
  it("모든 enum 배열에 중복 값이 없다", () => {
    const allEnums: ReadonlyArray<readonly string[]> = [
      AUTH_PROVIDERS,
      USER_STATUSES,
      MEMBER_ROLES,
      MEMBER_STATUSES,
      CHILD_STAGE_MODES,
      CHILD_STAGE_CODES,
      EXPENSE_SOURCES,
      EXPENSE_TYPES,
      PAYMENT_METHODS,
      NECESSITY_LEVELS,
      ITEM_STATUSES,
      PRODUCT_PLATFORMS,
      IMPORT_STATUSES
    ];

    for (const values of allEnums) {
      expect(new Set(values).size).toBe(values.length);
      for (const value of values) {
        // DB enum과 매칭되는 소문자 스네이크 케이스 규약.
        expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("지출 타입에 gift/refund가 포함돼 혼합 집계 시나리오의 전제 값이 유지된다", () => {
    // 도메인 패키지에는 금액 집계 함수가 없고(API 계층 소관), enum 계약만 여기서 잠근다.
    expect(EXPENSE_TYPES).toContain("gift");
    expect(EXPENSE_TYPES).toContain("refund");
    expect(EXPENSE_TYPES).toContain("expense");
    expect(EXPENSE_TYPES).toHaveLength(3);
  });
});

describe("isChildStageCode 경계", () => {
  it("전 코드 10개는 참이고, 유사 변형(대문자·공백·부분 문자열)은 거짓이다", () => {
    for (const code of CHILD_STAGE_CODES) {
      expect(isChildStageCode(code)).toBe(true);
      expect(isChildStageCode(code.toUpperCase())).toBe(false);
      expect(isChildStageCode(` ${code}`)).toBe(false);
      expect(isChildStageCode(`${code} `)).toBe(false);
      expect(isChildStageCode(`${code}\n`)).toBe(false);
    }
    expect(isChildStageCode("pregnancy")).toBe(false); // 접두 부분 문자열
    expect(isChildStageCode("newborn_0_")).toBe(false);
  });

  it("빈 문자열·공백만·이모지·서로게이트 페어·비문자열 입력은 거짓이다", () => {
    expect(isChildStageCode("")).toBe(false);
    expect(isChildStageCode("   ")).toBe(false);
    expect(isChildStageCode("👶")).toBe(false);
    expect(isChildStageCode("𝕡regnancy_early")).toBe(false); // BMP 밖 문자 시작
    expect(isChildStageCode("\ud83d")).toBe(false); // 홀로 남은 상위 서로게이트
    expect(isChildStageCode(null)).toBe(false);
    expect(isChildStageCode(undefined)).toBe(false);
    expect(isChildStageCode(0)).toBe(false);
    expect(isChildStageCode(true)).toBe(false);
    expect(isChildStageCode(["pregnancy_early"])).toBe(false);
    expect(isChildStageCode({ toString: () => "pregnancy_early" })).toBe(false);
    expect(isChildStageCode(Symbol("pregnancy_early"))).toBe(false);
  });

  it("[속성] 목록 밖 임의 문자열 100건은 항상 거짓이다", () => {
    const rand = makeLcg(20260821);
    const alphabet = "abcdefghijklmnopqrstuvwxyz_0123456789";

    for (let i = 0; i < 100; i += 1) {
      const length = 1 + Math.floor(rand() * 24);
      let candidate = "x!"; // '!'는 어떤 코드에도 없어 목록 밖임이 보장된다.
      for (let k = 0; k < length; k += 1) {
        candidate += alphabet[Math.floor(rand() * alphabet.length)];
      }

      expect(isChildStageCode(candidate)).toBe(false);
    }
  });
});
