// 라운드 84 트랙 B (GAP-084 #3) — DNC 가드 대장의 계약.
//
// 대장 자체의 설명·판정 기준·정찰과 갈린 자리는 `dnc-guard-ledger.ts` 머리말에 있다. 이 파일이
// 묻는 것은 다섯이다.
//  ⓐ **파싱** — 조항 ID 전수를 `docs/dev/do-not-change.md`에서 읽는다(수를 손으로 적지 않는다).
//  ⓑ **두 방향** — 대장의 키 집합 = 표의 ID 집합(문서에 줄이 늘거나 줄면 대장이 먼저 빨개진다) ·
//     대장이 가리키는 **파일과 단언 줄이 실재**한다(가드가 사라지면 빨개진다).
//  ⓒ **이유** — *"가드 없음"* 행은 빈 문자열이 아닌 **이유 + 재개 조건**을 갖는다.
//  ⓓ **래칫** — *"가드 없음"* 의 수가 오늘 실측값을 넘지 못한다.
//  ⓔ **부정** — 대장이 스스로를 가드로 세지 않는다 · **주석 인용은 가드로 서지 못한다**
//     (판정기를 픽스처로 실제로 돌려 보인다 — 값이 주석에만 적히면 다음 사람이 그 사실을 다시
//     발견해야 한다).
//
// ⚠️ 이 트랙은 **문서를 고치지 않았고**(개정은 승인 절차다), **가드를 새로 만들지 않았으며**
// (비어 있는 자리는 이유와 재개 조건으로 남는다), 대장이 가리키는 테스트 파일들을 **읽기만** 했다.
import { describe, expect, it } from "vitest";
import {
  ASSERTION_SHAPE,
  DNC_CONTRACT_PATH,
  DNC_GUARD_LEDGER,
  LEDGER_SELF_FILES,
  UNGUARDED_RULE_MAX,
  commentLineFlags,
  findAssertionLines,
  guardedRuleIds,
  isAssertionShaped,
  parseDncRuleIds,
  readRepoFile,
  unguardedRuleIds
} from "./dnc-guard-ledger";

/** 문서에서 읽은 조항 ID 전수 — 이 파일의 모든 모집단이 여기서 나온다. */
function contractRuleIds(): string[] {
  return parseDncRuleIds(readRepoFile(DNC_CONTRACT_PATH));
}

describe("ⓐ 조항 ID 전수를 문서에서 읽는다 (수를 손으로 적지 않는다)", () => {
  it("표에서 ID가 파싱되고, 중복 없이 DNC-000 모양이다", () => {
    const ids = contractRuleIds();

    // 실재 확인: 표식이 사라졌는데 조용히 초록인 일이 없게 한다(빈 모집단 위에서는 아래 두 방향이
    // 전부 통과한다).
    expect(ids.length, `${DNC_CONTRACT_PATH}에서 조항 행을 하나도 못 찾았다 = 파싱이 끊어졌다`).toBeGreaterThan(0);
    expect(new Set(ids).size, "같은 조항 ID가 두 줄에 있어요").toBe(ids.length);
    for (const id of ids) {
      expect(id, "조항 ID 모양").toMatch(/^DNC-\d{3}$/);
    }
  });

  it("개정 이력 표의 조항 인용은 규칙 행으로 세지 않는다 (첫 칸이 ID인 줄만 읽는다)", () => {
    // 오늘 문서의 개정 이력에는 DNC-017 행이 실려 있다. 첫 칸을 묻지 않으면 그 줄이 스물한 번째
    // 규칙으로 둔갑하고, 그 순간 두 방향 단언이 영영 빨간 채로 산다.
    const fixture = [
      "| ID | Area | Do Not Change | Reason |",
      "| --- | --- | --- | --- |",
      "| DNC-001 | Product Positioning | … | … |",
      "| DNC-002 | MVP Core Loop | … | … |",
      "",
      "| 버전 | 일자 | 항목 | 내용 | 승인 근거 |",
      "| v0.5 | 2026-08-27 | DNC-017 | 토큰 값 개정 | … |"
    ].join("\n");

    expect(parseDncRuleIds(fixture)).toEqual(["DNC-001", "DNC-002"]);
  });
});

describe("ⓑ 두 방향 — 대장의 키 집합 = 표의 ID 집합", () => {
  it("문서에 있는 조항이 전부 대장에 있고, 대장에 문서 밖의 키가 없다", () => {
    const ids = contractRuleIds();

    // 한 줄로 양방향이다: 문서에 줄이 늘면 왼쪽이, 대장에 유령이 생기면 오른쪽이 어긋난다.
    expect([...Object.keys(DNC_GUARD_LEDGER)].sort()).toEqual([...ids].sort());
  });

  it("가드 있음 + 가드 없음이 모집단 전수다 (제3의 상태가 없다)", () => {
    const ids = contractRuleIds();

    expect([...guardedRuleIds(), ...unguardedRuleIds()].sort()).toEqual([...ids].sort());
  });
});

describe("ⓑ 두 방향 — 대장이 가리키는 파일과 단언 줄이 실재한다", () => {
  const guarded = guardedRuleIds();

  it("가드 있음 행이 하나 이상이다 (전부 이유 칸으로 내려가면 대장이 면제부가 된다)", () => {
    expect(guarded.length).toBeGreaterThan(0);
  });

  for (const id of guarded) {
    const entry = DNC_GUARD_LEDGER[id];
    if (entry.state !== "guarded") continue;

    it(`${id}: ${entry.file}의 단언 줄이 주석이 아닌 자리에 글자 그대로 서 있다`, () => {
      // 파일 실재 확인 — 읽기가 던지면 그 자체가 판정이다(가드 파일이 사라졌다).
      const source = readRepoFile(entry.file);

      // ⚠️ 인용을 가드로 세지 않는다: 가드 칸은 **단언을 특정하는 문자열**이어야 한다.
      expect(isAssertionShaped(entry.assertion), `${id}의 가드 칸이 단언 모양이 아니에요`).toBe(true);

      const sites = findAssertionLines(source, entry.assertion);
      expect(
        sites.length,
        `${id}의 단언이 ${entry.file}에서 사라졌거나 주석 안에서만 발견돼요 — 가드가 없어졌는지 먼저 보세요`
      ).toBeGreaterThan(0);

      // 이유 칸과 같은 규율: 무는 것/물지 않는 것이 빈 문자열일 수 없다.
      expect(entry.covers.trim().length, `${id}의 covers가 비어 있어요`).toBeGreaterThan(20);
    });
  }
});

describe("ⓒ 가드 없음 행은 이유와 재개 조건을 갖는다", () => {
  const unguarded = unguardedRuleIds();

  for (const id of unguarded) {
    const entry = DNC_GUARD_LEDGER[id];
    if (entry.state !== "unguarded") continue;

    it(`${id}: 이유와 재개 조건이 빈 문자열이 아니다`, () => {
      // 한 줄짜리 "없음"은 이유가 아니다 — 다음 사람이 그 판단을 다시 하지 않아도 되게 적는다.
      expect(entry.reason.trim().length, `${id}의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      expect(entry.resumeWhen.trim().length, `${id}의 재개 조건이 비어 있거나 너무 짧아요`).toBeGreaterThan(20);
    });
  }
});

describe("ⓓ 래칫 — 가드 없는 조항의 수는 오늘 값을 넘지 못한다", () => {
  it("가드 없음의 수가 실측 상한 이하다", () => {
    const unguarded = unguardedRuleIds();

    expect(
      unguarded.length,
      `가드 없는 조항이 늘었어요: ${unguarded.join(" · ")} — 새 조항에는 가드를 세우거나, 이 줄을 올리는 결정을 문서로 남기세요`
    ).toBeLessThanOrEqual(UNGUARDED_RULE_MAX);
  });

  it("상한 자체가 조용히 올라가지 않는다 (오늘 실측값 셋)", () => {
    // 두 자리를 함께 고쳐야 상한이 오른다 — 한 자리만 고쳐서 지나가는 길을 남기지 않는다.
    expect(UNGUARDED_RULE_MAX).toBeLessThanOrEqual(3);
  });
});

describe("ⓔ 부정 — 대장이 스스로를 가드로 세지 않는다", () => {
  it("어떤 행도 대장 자신의 두 파일을 가리키지 않는다", () => {
    const selfCiting = guardedRuleIds().filter((id) => {
      const entry = DNC_GUARD_LEDGER[id];
      return entry.state === "guarded" && (LEDGER_SELF_FILES as readonly string[]).includes(entry.file);
    });

    expect(selfCiting, "대장이 자기 자신을 가드로 세면 '가드 있음'은 '대장에 줄이 있다'는 말이 돼요").toEqual([]);
  });

  it("어떤 행도 조항 문서 자신을 가드로 세지 않는다", () => {
    const documentCiting = guardedRuleIds().filter((id) => {
      const entry = DNC_GUARD_LEDGER[id];
      return entry.state === "guarded" && entry.file === DNC_CONTRACT_PATH;
    });

    expect(documentCiting, "규칙이 적혀 있다는 사실은 그 규칙의 가드가 아니에요").toEqual([]);
  });
});

describe("ⓔ 부정 — 주석 인용은 가드로 서지 못한다 (판정기를 실제로 돌린다)", () => {
  /**
   * 이 저장소의 고질병: 주석에 조항 ID가 적혀 있다는 사실이 가드로 읽힌다. 아래 셋은 그 판정을
   * **픽스처로 실제로 보여 준다** — 값이 머리말에만 적히면 다음 사람이 그 사실을 다시 발견해야 한다.
   */
  const fixture = [
    "// DNC-016: expect(catalog).not.toContain('커뮤니티');",
    "/**",
    " * expect(catalog).not.toContain('커뮤니티');",
    " */",
    "describe('범위', () => {",
    "  it('sample', () => {",
    "    expect(catalog).toContain('준비템');",
    "  });",
    "});"
  ].join("\n");

  it("주석 안에서만 발견되는 단언 문자열은 자리로 세지 않는다", () => {
    expect(findAssertionLines(fixture, "expect(catalog).not.toContain('커뮤니티');")).toEqual([]);
  });

  it("주석이 아닌 줄에 선 단언은 자리로 센다", () => {
    expect(findAssertionLines(fixture, "expect(catalog).toContain('준비템');")).toEqual([6]);
  });

  it("한 줄 주석·블록 주석·이어지는 별표 줄을 전부 주석으로 읽는다", () => {
    expect(commentLineFlags(fixture.split("\n"))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false
    ]);
  });

  it("단언이 아닌 인용문(조항 ID만 적힌 문자열)은 가드 칸의 모양이 아니다", () => {
    expect(isAssertionShaped("DNC-016 범위 밖 여섯을 구현하지 않는다")).toBe(false);
    expect(isAssertionShaped("")).toBe(false);
    expect(isAssertionShaped("   ")).toBe(false);
    // vitest의 `expect.objectContaining`처럼 점으로 이어지는 모양도 단언이다.
    expect(ASSERTION_SHAPE.test("expect.objectContaining({")).toBe(true);
    expect(ASSERTION_SHAPE.test("expect(body).toBe(1)")).toBe(true);
  });
});
