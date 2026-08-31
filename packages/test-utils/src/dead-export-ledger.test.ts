// 라운드 87 트랙 E (GAP-087 #5) — 사문 대장의 계약.
//
// 대장 자체의 설명(결정 두 문장 · 갈래 셋 · 사각 다섯 · 이 그물의 한계)은 `dead-export-ledger.ts`
// 머리말에 있다. 이 파일이 묻는 것은 여섯이다.
//  ⓐ **결정** — *무엇을 호출부로 볼 것인가*와 *무엇을 모집단으로 볼 것인가*가 **값으로** 적혀 있다.
//  ⓑ **유령 방지** — 모집단이 0건이 아니고, **뿌리마다 파일 수가 하한을 넘는다**
//     (⚠️ 빈 모집단 위에서는 *"사문이 열여섯을 넘지 않는다"* 가 언제나 참이다).
//  ⓒ **항목** — 오늘의 열여섯이 **전수로** 있고 각각 셋 중 하나다: 이름이 고백하는 것 ·
//     이유가 소스에 있는 것(⚠️ **그 이유를 소스로 확인한다**) · 이유가 대장에만 있는 것(빈 문자열 금지).
//  ⓓ **래칫** — 사문 수가 오늘의 실측보다 늘지 않는다.
//  ⓔ **사각** — `export const` 축 · 흔한 이름 · `.tsx` 컴포넌트가 값으로 적혀 있고, 그 값을 **다시 잰다**
//     (유령 사각 금지 — 있지도 않은 사각을 적어 두면 그 줄은 겸손이 아니라 장식이다).
//  ⓕ **자기 참조 부정** — 대장 자신이 모집단에 들어가지 않고, 루프 안 단언은 **항목 id 전수**를 못 박는다.
//
// ⚠️ 이 트랙은 **제품 소스를 0건 고쳤다** — 열여섯 중 하나도 지우거나 주석을 달지 않았고
// (`apps/**`는 읽기만 한다), 기존 가드·대장 파일(`dnc-guard-ledger.ts`·`dnc-scope-guard.ts`·
// `dnc-secret-scan.ts`·`source-contract-slice-guard.test.ts`)은 **형식의 본보기로 읽기만** 했다.
// ⚠️ 이 대장은 **DNC 조항이 아니다** — `docs/dev/do-not-change.md`는 무접촉이고 DNC 대장에 행도 없다.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALLSITE_DEFINITION,
  CALLSITE_ROOTS,
  CONTRACT_ONLY_DATA_MODULES,
  DEAD_EXPORT_LEDGER,
  DEAD_EXPORT_RATCHET,
  LEDGER_BLIND_SPOTS,
  LEDGER_SELF_FILES,
  MEASURED_ON,
  NAME_CONFESSION_PATTERNS,
  POPULATION_DEFINITION,
  POPULATION_ROOTS,
  SOURCE_REASON_KEEP_MARKER,
  SOURCE_REASON_MARKER,
  classifyDeadExport,
  collectCallsiteFiles,
  collectExportedConstants,
  collectExportedFunctions,
  collectTestFiles,
  deadExportHint,
  describeDeadExport,
  filesUnder,
  findDeadExports,
  findProductReferences,
  findTestReferences,
  nameConfessions,
  readCallsiteSources,
  readRepoFile,
  repoRoot,
  sourceReasonProof,
  type ExportedFunction
} from "./dead-export-ledger";

/** 모집단·호출부·사문 — 한 번만 걷는다(파일 삼백 개 × 이름 천 개라 재사용이 필수다). */
const population = collectExportedFunctions();
const callsiteFiles = collectCallsiteFiles();
const dead = findDeadExports();
const testSources = new Map(collectTestFiles().map((file) => [file, readRepoFile(file)]));

/**
 * ⚠️ **오늘의 열여섯 id 전수** — 계약 ⓕ가 요구하는 못.
 *
 * 아래 `for (const entry of DEAD_EXPORT_LEDGER)` 루프는 대장이 줄어들면 **조용히 통과한다**
 * (항목이 없으면 단언도 없다). 그래서 루프 앞에 이 배열을 세워 **집합 자체**를 못 박는다.
 *
 * ⚠️ 정찰(round87-scout #5 ⓐ)이 센 열일곱 중 `audit-log-filters.ts:hasAnyAuditLogFilter`는 여기
 * 없다 — **같은 라운드의 트랙 A가 되살렸다**(audit-log-rows.ts가 그 술어를 부른다). 이 못은
 * 정찰의 수가 아니라 **최종 실측**을 박는다.
 */
const LEDGER_IDS = [
  "apps/admin/src/lib/admin-api.ts:updateContentRevisionDraft",
  "apps/mobile/src/analytics/client.ts:__resetAnalyticsClientForTests",
  "apps/mobile/src/analytics/client.ts:getQueuedAnalyticsEventCount",
  "apps/mobile/src/auth/release-build.ts:isRealUserBuild",
  "apps/mobile/src/consent/consent-definitions.ts:hasPendingRequiredConsents",
  "apps/mobile/src/consent/legal-links.ts:legalDocumentUrl",
  "apps/mobile/src/import/bulk-run.ts:resetImportBulkRuns",
  "apps/mobile/src/import/import-failure-messages.ts:isNamedImportFailure",
  "apps/mobile/src/import/preview-rows.ts:canBulkSelectImportRows",
  "apps/mobile/src/notifications/local-devices.ts:resetLocalDevicesForTests",
  "apps/mobile/src/notifications/notification-preferences.store.ts:notificationTypeLabel",
  "apps/mobile/src/notifications/usePushDeviceRegistration.ts:resetPushRegistrationForTests",
  "apps/mobile/src/offline/offline-aware-screens.ts:usesOfflineAwareLoadErrorCopy",
  "apps/mobile/src/query/query-client-registry.ts:resetAppQueryClientRegistryForTests",
  "apps/mobile/src/settings/destructive-flow-messages.ts:destructiveFlowFallbackMessage",
  "apps/mobile/src/settings/support-links.ts:supportLinkUrl"
] as const;

/** 실측에서 이 id를 집어 온다 — 없으면 ⓒ가 먼저 빨개지므로 여기서는 이유를 말하고 멈춘다. */
function measured(id: string): ExportedFunction {
  const item = dead.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(
      `${id}가 오늘 실측에 없어요 — 호출부가 생겼거나 지워졌습니다. ` +
        "DEAD_EXPORT_LEDGER에서 그 줄을 지우고 DEAD_EXPORT_RATCHET을 함께 내리세요."
    );
  }
  return item;
}

describe("ⓐ 결정 — 호출부와 모집단이 값으로 적혀 있다", () => {
  it("두 정의가 산문이 아니라 값이고, 비어 있지 않다", () => {
    expect(CALLSITE_DEFINITION.trim().length, "호출부의 정의가 비어 있어요").toBeGreaterThan(120);
    expect(POPULATION_DEFINITION.trim().length, "모집단의 정의가 비어 있어요").toBeGreaterThan(120);
    expect(MEASURED_ON, "실측 날짜가 값으로 적혀 있어야 해요").toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("호출부 정의가 말한 것과 CALLSITE_ROOTS가 같은 자리를 가리킨다", () => {
    // ⚠️ 정의는 문장이고 뿌리는 코드다 — 둘이 갈리면 이 대장은 자기가 무엇을 세는지 모른다.
    for (const root of CALLSITE_ROOTS) {
      expect(CALLSITE_DEFINITION, `${root.path}가 호출부 정의 문장에 없어요`).toContain(root.path);
    }
    // 결정 ①의 '자기 파일까지 포함': 모집단 뿌리 둘이 호출부에도 서 있다.
    for (const root of POPULATION_ROOTS) {
      expect(
        CALLSITE_ROOTS.some((callsite) => root.path.startsWith(callsite.path)),
        `${root.path}가 호출부에 없어요 — '자기 파일까지 포함'이 깨집니다`
      ).toBe(true);
    }
  });

  it("모집단 정의가 `export function` 축임을 말하고 `export const`를 왜 뺐는지 함께 적는다", () => {
    expect(POPULATION_DEFINITION).toContain("export function");
    expect(POPULATION_DEFINITION).toContain("export const");
    expect(POPULATION_DEFINITION).toContain(".tsx");
  });

  it("테스트 파일은 호출부가 아니다(그래야 '테스트만 부른다'를 셀 수 있다)", () => {
    expect(callsiteFiles.filter((file) => /\.(test|spec)\.tsx?$/.test(file))).toEqual([]);
    // 그리고 테스트는 실제로 존재한다 — 없으면 위 단언은 아무것도 지키지 않는다.
    expect(testSources.size, "테스트 파일이 0건이면 '계약만 초록'을 잴 수 없어요").toBeGreaterThan(150);
  });
});

describe("ⓑ 유령 방지 — 뿌리가 실재하고, 모집단이 0건이 아니다", () => {
  it("모집단 뿌리 둘이 각각 이유를 지고 있다", () => {
    expect(POPULATION_ROOTS.length).toBe(2);
    expect(POPULATION_ROOTS.map((root) => root.id).sort()).toEqual(["admin-src-lib", "mobile-src"]);
    for (const root of POPULATION_ROOTS) {
      expect(root.reason.trim().length, `${root.id} 뿌리의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(60);
      expect(root.extensions.length, `${root.id} 뿌리의 확장자가 비어 있어요`).toBeGreaterThan(0);
    }
  });

  for (const root of POPULATION_ROOTS) {
    it(`${root.id}: 뿌리가 실재하고 파일 수·export 수가 하한을 넘는다`, () => {
      const files = filesUnder(root.path, root.extensions, root.excludeSegments);
      expect(files.length, `${root.path}의 파일 수가 하한(${root.minFiles}) 아래예요`).toBeGreaterThanOrEqual(
        root.minFiles
      );
      const exports = population.filter((item) => item.root === root.id);
      expect(
        exports.length,
        `${root.path}의 export function 수가 하한(${root.minExports}) 아래예요 — 걷기가 죽었을 수 있어요`
      ).toBeGreaterThanOrEqual(root.minExports);
      // 하한은 실측 아래에 있어야 한다(하한을 실측 위에 두면 첫날부터 빨갛다).
      expect(root.minFiles).toBeLessThanOrEqual(root.measuredFiles);
      expect(root.minExports).toBeLessThanOrEqual(root.measuredExports);
    });
  }

  for (const root of CALLSITE_ROOTS) {
    it(`${root.path}: 호출부 뿌리가 실재하고 파일 수가 하한을 넘는다`, () => {
      const files = filesUnder(root.path, [".ts", ".tsx"], root.excludeSegments);
      expect(files.length, `${root.path}의 파일 수가 하한(${root.minFiles}) 아래예요`).toBeGreaterThanOrEqual(
        root.minFiles
      );
      expect(root.reason.trim().length, `${root.path} 호출부 뿌리의 이유가 비어 있어요`).toBeGreaterThan(20);
    });
  }

  it("모집단 이름이 서로 겹치지 않는다(겹치면 파일:이름 열쇠가 두 자리를 가리킨다)", () => {
    const ids = population.map((item) => item.id);
    expect(new Set(ids).size, "같은 파일에 같은 이름의 export function이 둘 있어요").toBe(ids.length);
  });

  it("모집단이 실제로 사문을 내놓는다(0건이면 이 대장은 아무것도 세지 않는다)", () => {
    expect(dead.length, "사문이 0건이면 그물이 죽었을 수 있어요").toBeGreaterThan(0);
    expect(population.length).toBeGreaterThan(dead.length);
  });
});

describe("ⓒ 항목 — 오늘의 열여섯이 전수로 있고 각각 셋 중 하나다", () => {
  it("대장의 id 전수가 못 박혀 있고 실측과 양방향으로 같다", () => {
    const ledgerIds = DEAD_EXPORT_LEDGER.map((entry) => entry.id).sort();
    // ⓕ의 못 — 루프가 줄어들어도 조용히 통과하지 않게 집합 자체를 값으로 박는다.
    expect(ledgerIds, "대장의 항목 집합이 못 박은 열여섯과 달라요").toEqual([...LEDGER_IDS].sort());

    const measuredIds = dead.map((item) => item.id).sort();
    const missing = measuredIds.filter((id) => !ledgerIds.includes(id));
    const ghosts = ledgerIds.filter((id) => !measuredIds.includes(id));
    expect(
      missing,
      `대장에 없는 새 사문이 생겼어요:\n${dead
        .filter((item) => missing.includes(item.id))
        .map((item) => deadExportHint(item))
        .join("\n")}`
    ).toEqual([]);
    expect(
      ghosts,
      `대장에 있는데 오늘은 사문이 아닌 줄이에요(호출부가 생겼거나 지워졌습니다) — ` +
        `그 줄과 DEAD_EXPORT_RATCHET을 함께 내리세요: ${ghosts.join(", ")}`
    ).toEqual([]);
  });

  it("항목마다 파일·이름·이유가 서고, 이유는 빈 문자열일 수 없다", () => {
    expect(DEAD_EXPORT_LEDGER.length).toBe(LEDGER_IDS.length);
    for (const entry of DEAD_EXPORT_LEDGER) {
      expect(entry.id, `${entry.name}의 id가 파일:이름 모양이 아니에요`).toBe(`${entry.file}:${entry.name}`);
      expect(entry.reason.trim().length, `${entry.id}의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      // "안 쓴다"는 이유가 아니다 — 이유는 **왜** 화면이 부르지 않는지를 말해야 한다.
      expect(entry.reason, `${entry.id}의 이유가 '안 쓴다'만 말해요`).not.toMatch(/^쓰지 않는다\.?$/);
    }
  });

  it("갈래 셋이 전부 서 있고, 갈래의 수가 오늘 실측(5 / 2 / 9)과 같다", () => {
    const byKind = (kind: string) => DEAD_EXPORT_LEDGER.filter((entry) => entry.reasonKind === kind).length;
    // ⚠️ 정찰(#5 ⓐ)은 6 / 2 / 9로 적었다 — 실측하면 이름이 고백하는 것은 다섯이고(대장 머리말에 값으로
    // 남겼다), 정찰의 아홉 중 하나(hasAnyAuditLogFilter)는 트랙 A가 되살려 오늘 대장 밖이다.
    expect(byKind("name-confesses"), "이름이 고백하는 항목 수").toBe(5);
    expect(byKind("reason-in-source"), "이유가 소스에 있는 항목 수").toBe(2);
    expect(byKind("reason-in-ledger"), "이유가 대장에만 있는 항목 수").toBe(9);
    expect(byKind("name-confesses") + byKind("reason-in-source") + byKind("reason-in-ledger")).toBe(
      DEAD_EXPORT_LEDGER.length
    );
  });

  for (const entry of DEAD_EXPORT_LEDGER) {
    it(`${entry.name}: 갈래가 손이 아니라 **재어서** 정해진다`, () => {
      const item = measured(entry.id);
      expect(
        classifyDeadExport(item),
        `${entry.id}의 갈래가 소스 실측과 갈렸어요(대장이 자기 갈래를 스스로 정하면 그 칸은 값이 아닙니다)`
      ).toBe(entry.reasonKind);
    });
  }

  it("이름이 고백하는 다섯은 실제로 표식을 달고, 나머지 열하나는 달지 않는다", () => {
    for (const entry of DEAD_EXPORT_LEDGER) {
      const confessions = nameConfessions(entry.name);
      if (entry.reasonKind === "name-confesses") {
        expect(confessions.length, `${entry.name}이 표식을 달지 않았어요`).toBeGreaterThan(0);
      } else {
        expect(confessions, `${entry.name}은 이름이 이미 고백하고 있어요 — 갈래가 잘못 적혔습니다`).toEqual([]);
      }
    }
    for (const pattern of NAME_CONFESSION_PATTERNS) {
      expect(pattern.reason.trim().length, `${pattern.label} 표식의 이유가 비어 있어요`).toBeGreaterThan(30);
      // 유령 표식 금지 — 표식마다 오늘 실제로 그 표식을 단 사문이 있어야 한다.
      expect(
        DEAD_EXPORT_LEDGER.some((entry) => nameConfessions(entry.name).includes(pattern.label)),
        `${pattern.label} 표식을 단 사문이 오늘 0건이에요 — 근거 없는 표식은 조용한 면제부입니다`
      ).toBe(true);
    }
  });

  it("이유가 소스에 있는 둘은 그 이유가 **실제로 그 파일에** 있다", () => {
    const inSource = DEAD_EXPORT_LEDGER.filter((entry) => entry.reasonKind === "reason-in-source");
    expect(inSource.map((entry) => entry.name).sort()).toEqual([
      "destructiveFlowFallbackMessage",
      "isNamedImportFailure"
    ]);
    for (const entry of inSource) {
      const item = measured(entry.id);
      const proof = sourceReasonProof(item);
      expect(proof, `${entry.id}: 선언 위 주석에 S-8 관례가 없어요`).not.toBeNull();
      expect(proof?.text).toContain(SOURCE_REASON_MARKER);
      expect(proof?.text, `${entry.id}: '왜 지우지 않는가'가 빠졌어요`).toContain(SOURCE_REASON_KEEP_MARKER);
      // 주석 덩어리는 선언 **위**에 있다(아래에 있는 것은 다음 함수의 이유다).
      expect(proof?.markerLine).toBeLessThan(item.line);
    }
  });

  it("이유가 대장에만 있는 아홉은 소스에 아무 말도 없다(있으면 갈래가 하나 올라간다)", () => {
    for (const entry of DEAD_EXPORT_LEDGER.filter((row) => row.reasonKind === "reason-in-ledger")) {
      const item = measured(entry.id);
      expect(sourceReasonProof(item), `${entry.id}: 소스에 이미 이유가 있어요 — 갈래를 올리세요`).toBeNull();
    }
  });

  it("열여섯 다 테스트 참조가 있다 — 이것이 '계약만 초록'이라는 말의 값이다", () => {
    for (const entry of DEAD_EXPORT_LEDGER) {
      const references = findTestReferences(entry.name, testSources);
      expect(
        references.length,
        `${entry.id}: 테스트도 부르지 않아요 — 이 항목은 '계약만 초록'이 아니라 그냥 죽은 코드입니다`
      ).toBeGreaterThan(0);
    }
  });

  it("'있다'와 '닿는다'가 갈린 자리를 소스로 확인한다(updateContentRevisionDraft)", () => {
    // ⚠️ 어드민 계약이 **소스 텍스트 포함**을 단언한다 — 그래서 이름이 살아 있는 한 초록이고,
    // 아무 화면도 부르지 않는다는 사실은 그 단언 밖에 있다. 그 갈림 자체를 여기서 못 박는다.
    const contract = readRepoFile("apps/admin/src/content-revisions.test.ts");
    expect(contract, "어드민 계약이 이 이름의 '있음'을 단언하는 자리").toContain(
      'toContain("updateContentRevisionDraft")'
    );
    const screens = readCallsiteSources();
    const item = measured("apps/admin/src/lib/admin-api.ts:updateContentRevisionDraft");
    expect(findProductReferences(item, screens), "화면이 이 이름에 닿는 자리").toEqual([]);
    // 화면이 실제로 쓰는 합성 함수는 살아 있다(그래서 이 라운드는 지우지 않는다).
    expect([...screens.values()].some((source) => source.includes("draftAndSubmitContentRevision"))).toBe(true);
  });
});

describe("ⓓ 래칫 — 사문 수가 오늘의 실측보다 늘지 않는다", () => {
  it("래칫 값이 오늘의 실측과 같고, 대장의 줄 수와도 같다", () => {
    expect(DEAD_EXPORT_RATCHET).toBe(DEAD_EXPORT_LEDGER.length);
    expect(DEAD_EXPORT_RATCHET, "래칫이 실측보다 느슨해요").toBeGreaterThanOrEqual(dead.length);
  });

  it("사문 수가 래칫을 넘지 않는다", () => {
    expect(
      dead.length,
      `호출부 0건인 export가 ${dead.length}건이에요(래칫 ${DEAD_EXPORT_RATCHET}).\n` +
        dead
          .filter((item) => !DEAD_EXPORT_LEDGER.some((entry) => entry.id === item.id))
          .map((item) => deadExportHint(item))
          .join("\n")
    ).toBeLessThanOrEqual(DEAD_EXPORT_RATCHET);
  });

  it("실패 메시지가 사람을 파일로 보내고 두 답을 함께 적어 준다", () => {
    const sample = dead[0];
    expect(describeDeadExport(sample)).toContain(sample.file);
    expect(describeDeadExport(sample)).toContain(String(sample.line));
    const hint = deadExportHint(sample);
    expect(hint).toContain("① 지운다");
    expect(hint).toContain("② 이유를 적는다");
    expect(hint).toContain(SOURCE_REASON_MARKER);
  });
});

describe("ⓔ 사각 — 값으로 적혀 있고, 오늘 다시 잰다", () => {
  it("사각 다섯이 서로 다른 id이고 문장·값을 지고 있다", () => {
    expect(LEDGER_BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(LEDGER_BLIND_SPOTS.map((spot) => spot.id)).size).toBe(LEDGER_BLIND_SPOTS.length);
    for (const spot of LEDGER_BLIND_SPOTS) {
      expect(spot.statement.trim().length, `${spot.id} 사각의 문장이 비어 있어요`).toBeGreaterThan(60);
      expect(spot.floor, `${spot.id} 사각의 하한이 실측값 위에 있어요`).toBeLessThanOrEqual(spot.value);
    }
  });

  it("명세가 요구한 사각 셋이 이름으로 서 있다", () => {
    const ids = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    expect(ids).toContain("export-const-axis");
    expect(ids).toContain("common-name");
    expect(ids).toContain("tsx-components");
  });

  for (const spot of LEDGER_BLIND_SPOTS.filter((entry) => entry.measure)) {
    it(`${spot.id}: 사각이 오늘도 실재한다(유령 사각 금지)`, () => {
      const measured = (spot.measure as (baseDir: string) => number)(repoRoot);
      expect(
        measured,
        `${spot.id} 사각을 다시 재니 ${measured}예요 — 하한(${spot.floor}) 아래면 그 줄은 장식입니다`
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }

  it("`export const` 축이 왜 모집단 밖인지 — 계약 전용 데이터 모듈 다섯이 실재하고 사문을 낸다", () => {
    expect(CONTRACT_ONLY_DATA_MODULES.length).toBe(5);
    for (const module of CONTRACT_ONLY_DATA_MODULES) {
      expect(module.reason.trim().length, `${module.path}의 이유가 비어 있어요`).toBeGreaterThan(30);
      // 실재 확인 — 없는 파일을 이유로 든 순간 결정 ②는 근거를 잃는다.
      expect(() => readRepoFile(module.path), `${module.path}가 없어요`).not.toThrow();
      expect(
        collectExportedConstants().some((item) => item.file === module.path),
        `${module.path}에 export const가 0건이에요`
      ).toBe(true);
    }
    // 그 축을 모집단에 넣었다면 첫날부터 면제가 될 줄들 — 그 수가 결정 ②의 이유 전체다.
    const axis = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "contract-only-data-modules");
    expect(axis?.value, "계약 전용 데이터 모듈의 사문 수").toBeGreaterThanOrEqual(8);
  });

  it("이름 훑기의 사각이 오늘의 열여섯을 오염시키지 않았다", () => {
    // ⚠️ 흔한 이름 사각은 **사문을 놓치는 쪽**의 오차다(거짓 초록). 열여섯은 참조가 0건이라
    // 그 사각의 반대편에 서 있고, 그 사실을 값으로 확인해 둔다.
    const sources = readCallsiteSources();
    for (const entry of DEAD_EXPORT_LEDGER) {
      const item = measured(entry.id);
      expect(findProductReferences(item, sources), `${entry.id}에 제품 소스 참조가 생겼어요`).toEqual([]);
    }
  });
});

describe("ⓕ 자기 참조 부정 — 대장은 자기를 모집단에 넣지 않는다", () => {
  it("대장 자신의 두 파일이 모집단·호출부 어디에도 없다", () => {
    expect(LEDGER_SELF_FILES.length).toBe(2);
    for (const self of LEDGER_SELF_FILES) {
      expect(() => readRepoFile(self), `${self}가 실재하지 않아요`).not.toThrow();
      expect(population.some((item) => item.file === self), `${self}가 모집단에 들어왔어요`).toBe(false);
      expect(callsiteFiles).not.toContain(self);
    }
  });

  it("대장 자신의 export가 사문 목록에 들어오지 않는다", () => {
    for (const item of dead) {
      expect(LEDGER_SELF_FILES as readonly string[]).not.toContain(item.file);
    }
  });

  it("대장의 항목 이름이 이 파일 안에 실려 있어도 그것이 호출부로 세어지지 않는다", () => {
    // 이 계약 파일과 대장 파일에는 열여섯 이름이 전부 문자열로 실려 있다 — 그것이 참조로
    // 읽히면 열여섯이 통째로 사라진다. 위 배제가 그 자리를 막고 있음을 값으로 확인한다.
    const selfSource = readRepoFile(LEDGER_SELF_FILES[0]);
    expect(selfSource).toContain("getQueuedAnalyticsEventCount");
    expect(dead.some((item) => item.name === "getQueuedAnalyticsEventCount")).toBe(true);
  });
});

describe("교란 — 사문이 하나 늘면 실제로 빨개진다", () => {
  it("임시 뿌리에 사문 하나를 심으면 걷기가 그것을 집어 든다", () => {
    // ⚠️ **제품 소스에는 손대지 않는다.** 임시 디렉터리에 뿌리 모양만 세우고 거기서 재현한다
    // (물지 못하는 스윕은 영원히 초록이고, 그 사실은 아무도 모른다).
    const base = mkdtempSync(join(tmpdir(), "dead-export-ledger-"));
    try {
      mkdirSync(join(base, "apps/mobile/src/fixture"), { recursive: true });
      mkdirSync(join(base, "apps/mobile/app"), { recursive: true });
      mkdirSync(join(base, "apps/admin/src/lib"), { recursive: true });
      mkdirSync(join(base, "apps/admin/app"), { recursive: true });

      writeFileSync(
        join(base, "apps/mobile/src/fixture/live.ts"),
        "export function liveFixtureJudgement(): boolean {\n  return true;\n}\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/src/fixture/dead.ts"),
        "export function deadFixtureJudgement(): boolean {\n  return false;\n}\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        'import { liveFixtureJudgement } from "../src/fixture/live";\nexport default function Screen() {\n  return liveFixtureJudgement();\n}\n',
        "utf8"
      );
      writeFileSync(join(base, "apps/admin/src/lib/noop.ts"), "export const fixtureConstant = 1;\n", "utf8");
      writeFileSync(join(base, "apps/admin/app/page.tsx"), "export default function Page() {\n  return null;\n}\n", "utf8");

      const found = findDeadExports(base).map((item) => item.name);
      expect(found, "심어 둔 사문을 집어 들지 못했어요 — 그물이 죽어 있습니다").toContain("deadFixtureJudgement");
      expect(found, "화면이 부르는 판정까지 사문으로 셌어요 — 거짓 빨강입니다").not.toContain("liveFixtureJudgement");

      // ⚠️ 그리고 **계약 ⓒ·ⓓ가 실제로 이 모집단 위에서 빨갛다**는 것을 값으로 보인다 —
      // 걷기만 확인하고 판정을 확인하지 않으면 "물었다"고 말할 수 없다.
      const ledgerIds = DEAD_EXPORT_LEDGER.map((entry) => entry.id);
      const perturbed = findDeadExports(base);
      const missing = perturbed.filter((item) => !ledgerIds.includes(item.id));
      expect(missing.length, "전수 단언(ⓒ)이 이 교란에 빨개지지 않아요").toBeGreaterThan(0);
      expect(
        DEAD_EXPORT_LEDGER.length + missing.length,
        "래칫(ⓓ)이 이 교란에 넘어가지 않아요"
      ).toBeGreaterThan(DEAD_EXPORT_RATCHET);
      expect(deadExportHint(perturbed[0])).toContain("② 이유를 적는다");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("같은 파일 안에서만 쓰이는 export는 사문이 아니다(결정 ①의 '자기 파일까지 포함')", () => {
    const base = mkdtempSync(join(tmpdir(), "dead-export-ledger-self-"));
    try {
      mkdirSync(join(base, "apps/mobile/src/fixture"), { recursive: true });
      mkdirSync(join(base, "apps/mobile/app"), { recursive: true });
      mkdirSync(join(base, "apps/admin/src/lib"), { recursive: true });
      mkdirSync(join(base, "apps/admin/app"), { recursive: true });
      writeFileSync(
        join(base, "apps/mobile/src/fixture/self.ts"),
        "export function selfOnlyHelper(): number {\n  return 1;\n}\n\nexport function screenFacingExport(): number {\n  return selfOnlyHelper();\n}\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        'import { screenFacingExport } from "../src/fixture/self";\nexport default function Screen() {\n  return screenFacingExport();\n}\n',
        "utf8"
      );
      writeFileSync(join(base, "apps/admin/src/lib/noop.ts"), "export const fixtureConstant = 1;\n", "utf8");
      writeFileSync(join(base, "apps/admin/app/page.tsx"), "export default function Page() {\n  return null;\n}\n", "utf8");

      expect(findDeadExports(base).map((item) => item.name)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
