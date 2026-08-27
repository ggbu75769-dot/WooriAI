import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES, type ChildStageCode } from "@wooriai/domain";
import { STAGE_BAND_LABELS, stageBandLabelSchema } from "@wooriai/contracts";
import { STAGE_BAND_STAGES } from "../src/items-commerce/stage-bands";

/**
 * ITEM-121: 시기 밴드 정의는 두 곳에 손으로 유지된다.
 *
 *   server: apps/api/src/items-commerce/stage-bands.ts -> `STAGE_BAND_STAGES`
 *   client: apps/mobile/src/items/stage-bands.ts       -> `bandDefinitions` / `stageToBandLabel`
 *
 * 이제 칩 라벨이 그대로 `GET /children/:childId/items?stageBand=` 값으로 서버에 전달되고,
 * 서버가 그 밴드의 스테이지 코드로 목록을 만든다. 두 표가 어긋나면 사용자는 "6-12개월 칩을
 * 눌렀는데 다른 시기 목록"을 보게 되고, 모바일의 준비율 계산(prep-progress.ts)도 서버 목록과
 * 다른 모집단을 쓰게 된다. 이 파일이 그 대조다.
 *
 * 경로 주의: 모바일은 별도 RN/Expo TS 프로젝트라 여기서 import 하지 않고 텍스트로 읽는다
 * (apps/api/test/mobile-category-alias-contract.test.ts와 같은 방식). 파일이 옮겨지면
 * existsSync 단언이 전체 경로와 함께 실패한다.
 */
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(apiRoot, "..", "..");
const mobileStageBandsPath = join(repoRoot, "apps", "mobile", "src", "items", "stage-bands.ts");
const mobileItemsScreenPath = join(repoRoot, "apps", "mobile", "app", "(tabs)", "items.tsx");

function mobileSource(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

/** `bandDefinitions` 리터럴에서 [라벨, 스테이지 코드[]] 쌍을 순서대로 뽑는다. */
function parseMobileBandDefinitions(): Array<[string, string[]]> {
  const source = mobileSource(mobileStageBandsPath);
  const arrayMatch = /export const bandDefinitions: StageBandDefinition\[\] = \[([\s\S]*?)\n\];/.exec(source);
  expect(arrayMatch, `bandDefinitions literal not found in ${mobileStageBandsPath}`).not.toBeNull();

  const entries: Array<[string, string[]]> = [];
  const entryPattern = /\{\s*label:\s*"([^"]+)",\s*stages:\s*\[([^\]]*)\]\s*\}/g;
  for (const entry of (arrayMatch?.[1] ?? "").matchAll(entryPattern)) {
    const stages = [...entry[2].matchAll(/"([^"]+)"/g)].map((stage) => stage[1]);
    entries.push([entry[1], stages]);
  }
  return entries;
}

/** `stageToBandLabel` 리터럴에서 스테이지 코드 -> 라벨 매핑을 뽑는다. */
function parseMobileStageToBand(): Record<string, string> {
  const source = mobileSource(mobileStageBandsPath);
  const mapMatch = /const stageToBandLabel: Record<ChildStageCode, StageBandLabel> = \{([\s\S]*?)\n\};/.exec(source);
  expect(mapMatch, `stageToBandLabel literal not found in ${mobileStageBandsPath}`).not.toBeNull();

  const mapping: Record<string, string> = {};
  for (const entry of (mapMatch?.[1] ?? "").matchAll(/(\w+):\s*"([^"]+)"/g)) {
    mapping[entry[1]] = entry[2];
  }
  return mapping;
}

describe("stage-band definition contract (server <-> mobile <-> contracts)", () => {
  it("parses the mobile literals (guards this test against a silent no-op)", () => {
    const bands = parseMobileBandDefinitions();
    const stageToBand = parseMobileStageToBand();

    expect(bands.length).toBe(STAGE_BAND_LABELS.length);
    expect(Object.keys(stageToBand).length).toBe(CHILD_STAGE_CODES.length);
  });

  it("agrees on the chip labels and their order", () => {
    expect(parseMobileBandDefinitions().map(([label]) => label)).toEqual([...STAGE_BAND_LABELS]);
    // 서버 매핑의 키 순서도 계약 값과 같은 순서로 유지한다(칩 순서 = 시기 순서).
    expect(Object.keys(STAGE_BAND_STAGES)).toEqual([...STAGE_BAND_LABELS]);
    // 쿼리 파라미터 스키마가 곧 라벨의 단일 소스다.
    expect(stageBandLabelSchema.options).toEqual([...STAGE_BAND_LABELS]);
  });

  it("agrees on the stage codes behind every band", () => {
    for (const [label, stages] of parseMobileBandDefinitions()) {
      expect(STAGE_BAND_STAGES[label as keyof typeof STAGE_BAND_STAGES], `band ${label}`).toEqual(stages);
    }
  });

  it("uses only real stage codes and covers every stage code at least once", () => {
    const covered = new Set<ChildStageCode>();
    for (const [label, stages] of Object.entries(STAGE_BAND_STAGES)) {
      expect(stages.length, `band ${label} must map to at least one stage`).toBeGreaterThan(0);
      for (const stage of stages) {
        expect(CHILD_STAGE_CODES, `${stage} in band ${label}`).toContain(stage);
        covered.add(stage);
      }
    }
    // 어떤 스테이지도 어느 칩에도 속하지 않으면 그 시기의 아이는 빈 목록만 보게 된다.
    expect([...covered].sort()).toEqual([...CHILD_STAGE_CODES].sort());
  });

  it("keeps the mobile default-chip mapping consistent with the band membership", () => {
    // 기본 선택 칩(bandForStage)이 가리키는 밴드는 그 스테이지를 실제로 포함해야 한다 --
    // 아니면 앱을 열자마자 자기 시기 준비물이 안 보이는 칩이 선택된다.
    for (const [stage, label] of Object.entries(parseMobileStageToBand())) {
      expect(STAGE_BAND_LABELS, `${stage} maps to an unknown band`).toContain(label);
      expect(STAGE_BAND_STAGES[label as keyof typeof STAGE_BAND_STAGES], `${stage} -> ${label}`).toContain(stage);
    }
  });

  it("has the items screen derive its chips from the band definitions", () => {
    // 칩 라벨을 화면에 손으로 복제하면 이 대조를 우회한 채 어긋날 수 있다.
    expect(mobileSource(mobileItemsScreenPath)).toContain("const tabOptions = bandDefinitions.map((band) => band.label);");
  });
});
