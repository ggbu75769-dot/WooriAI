// 라운드 87 트랙 E (GAP-087 #5) → 88 트랙 D → 89 트랙 C → **라운드 90 트랙 C** — 사문 대장의 계약.
//
// 대장 자체의 설명(결정 셋 · 갈래 셋 · 사각 · 이 그물의 한계)은 `dead-export-ledger.ts` 머리말에
// 있다. 이 파일이 묻는 것은 여덟이다.
//  ⓐ **결정** — *무엇을 호출부로 볼 것인가* · *무엇을 모집단으로 볼 것인가* · **무엇을 계약 전용
//     데이터로 볼 것인가**가 **값으로** 적혀 있다.
//  ⓑ **유령 방지** — 모집단이 0건이 아니고, **뿌리마다 파일 수와 축 둘의 export 수가 하한을 넘는다**
//     (⚠️ 빈 모집단 위에서는 *"사문이 스물둘을 넘지 않는다"* 가 언제나 참이다).
//  ⓒ **항목** — 오늘의 스물둘이 **전수로** 있고 각각 셋 중 하나다: 이름이 고백하는 것 ·
//     이유가 소스에 있는 것(⚠️ **그 이유를 소스로 확인한다**) · 이유가 대장에만 있는 것(빈 문자열 금지).
//  ⓓ **래칫** — 사문 수가 오늘의 실측보다 늘지 않는다. ⚠️ 래칫이 **내려간 적이 없다는 사실**도 값이다.
//  ⓔ **사각** — 남은 사각이 값과 하한으로 적혀 있고 그 값을 **다시 잰다**(유령 사각 금지), 닫힌
//     사각은 **무엇이 언제 닫았는지**를 들고 산다.
//  ⓕ **자기 참조 부정** — 대장 자신이 모집단에 들어가지 않고, 루프 안 단언은 **항목 id 전수**를 못 박는다.
//  ⓖ **마스킹**(라운드 88 트랙 D) — 참조를 셀 때 **주석이 마스킹된다**. 마스킹 자체는 손으로 세운
//     소스 조각으로 **한 갈래씩** 확인한다(줄 주석 · 블록 주석 · 문자열 안의 `//` · 템플릿 `${…}` ·
//     정규식 리터럴 · JSX 텍스트의 `http://`).
//  ⓗ **파생 판정**(라운드 89 트랙 C) — *"이 모듈은 계약 전용 데이터다"* 가 **모듈 자신의 소스에서**
//     파생하고(import 그래프 · 실재하는 자리), **표식을 복사해서는 면제를 살 수 없다.**
//  ⓘ **문자열 리터럴 축**(라운드 90 트랙 C) — 그물이 **문자열의 글자를 지우고** 센다. ⚠️⚠️ 그러나
//     템플릿 `${…}` 안은 **코드로 남는다**: 그 갈래는 오늘 저장소에 그 모양이 있느냐와 무관하게
//     **합성 소스로** 증명하고(계약 ⓐ), 갈래를 지우는 옛 마스킹으로 되돌리면 **살아 있는 호출부가
//     사문으로 세어진다**는 사실까지 같은 조각으로 함께 문다(교란 ①).
//     그리고 마스킹 **전(40)/후(44)** 두 수를 **둘 다 값으로** 든다(계약 ⓑ — 한 낱말로 적지 않는다).
//
// ⚠️ 라운드 87 트랙 E는 **제품 소스를 0건 고쳤다**(`apps/**`는 읽기만 했다).
// ⚠️ 라운드 88 트랙 D는 제품 소스 아홉 파일에 **주석 한 덩이씩만** 더했다.
// ⚠️ 라운드 89 트랙 C는 제품 소스 두 파일에 주석 한 덩이씩만 더했다
// (`analytics/events.ts` · `offline/sqlite-offline-store.ts` — 코드·문자열·export 값 바이트 불변).
// ⚠️⚠️ **라운드 90 트랙 C는 제품 소스를 0건 고쳤다 — 주석 한 글자도 더하지 않았다.**
// 이 트랙이 연 것은 **판정 축 하나**뿐이고, `shared-cache-policy.ts`(넷이 사는 자리)와
// `comment-tolerant-anchor-ledger.ts`(마스킹의 형식 본보기)는 **읽기만 했다**(바이트 불변).
// 지운 export 0건 · 되살린 export 0건 · **대장에서 지운 줄 0건**이다.
// ⚠️ 이 대장은 **DNC 조항이 아니다** — `docs/dev/do-not-change.md`는 무접촉이고 DNC 대장에 행도 없다.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALLSITE_DEFINITION,
  CALLSITE_ROOTS,
  CLOSED_BLIND_SPOTS,
  CONTRACT_ONLY_AXES,
  CONTRACT_ONLY_DEFINITION,
  DEAD_EXPORT_LEDGER,
  DEAD_EXPORT_RATCHET,
  HAND_LIST_REPLACED_BY_DERIVATION,
  LEDGER_BLIND_SPOTS,
  LEDGER_SELF_FILES,
  MEASURED_ON,
  NAME_CONFESSION_PATTERNS,
  POPULATION_DEFINITION,
  POPULATION_ROOTS,
  RATCHET_HISTORY,
  SOURCE_REASON_KEEP_MARKER,
  SOURCE_REASON_MARKER,
  apostropheBearingCallsiteFiles,
  apostropheMaskedCodeSites,
  classifyDeadExport,
  collectCallsiteFiles,
  collectExportedConstants,
  collectExportedFunctions,
  collectPopulation,
  collectTestFiles,
  commentOnlyReferenceExports,
  contractOnlyContext,
  contractOnlyDataModules,
  contractOnlyDataProof,
  contractOnlyExemptions,
  deadExportHint,
  describeDeadExport,
  filesUnder,
  findCommentMaskedProductReferences,
  findDeadExports,
  findDeadExportsBeforeStringMasking,
  findDeadExportsOfKind,
  findProductReferences,
  findRawProductReferences,
  findTestReferences,
  importersOfModule,
  initializerText,
  ledgerRequiredDeadExports,
  maskComments,
  maskCommentsAndStrings,
  nameConfessions,
  namesAlsoUsedAsProperty,
  namesReferencedInsideStringLiterals,
  readCallsiteSources,
  readRepoFile,
  repoRoot,
  resolveProductLocator,
  sourceReasonProof,
  stringOnlyReferenceExports,
  topLevelElements,
  tsxExportFunctionCount,
  type DeadExportRatchet,
  type ExportedFunction
} from "./dead-export-ledger";

/** 모집단·호출부·사문 — 한 번만 걷는다(파일 삼백 개 × 이름 천육백 개라 재사용이 필수다). */
const population = collectPopulation();
const callsiteFiles = collectCallsiteFiles();
const dead = findDeadExports();
/** ⚠️ 계약 ⓑ의 **앞의 수** — 문자열 마스킹을 켜기 전(라운드 88·89) 그물의 사문 전수(오늘 40). */
const deadBeforeStringMasking = findDeadExportsBeforeStringMasking();
const exemptions = contractOnlyExemptions();
/** 파생 판정이 낸 면제 모듈 전수 — 같은 전수 훑기를 계약마다 되풀이하지 않는다(오늘 여섯). */
const exemptionModules = contractOnlyDataModules();
const ledgerRequired = ledgerRequiredDeadExports();
const testSources = new Map(collectTestFiles().map((file) => [file, readRepoFile(file)]));

/**
 * ⚠️ **오늘의 스물둘 id 전수** — 계약 ⓕ가 요구하는 못.
 *
 * 아래 `for (const entry of DEAD_EXPORT_LEDGER)` 루프는 대장이 줄어들면 **조용히 통과한다**
 * (항목이 없으면 단언도 없다). 그래서 루프 앞에 이 배열을 세워 **집합 자체**를 못 박는다.
 *
 * ⚠️ 뒤의 여섯이 라운드 89 트랙 C가 `export const` 축을 들이며 선 줄이다 — **새 부채가 아니라
 * 세는 자리가 늘어난 것**이고, 앞의 열여섯은 라운드 87·88과 **한 글자도 다르지 않다.**
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
  "apps/mobile/src/settings/support-links.ts:supportLinkUrl",
  // ── 라운드 89 트랙 C: `export const` 축 ──────────────────────────────────────────────
  "apps/mobile/src/analytics/events.ts:ANALYTICS_CATEGORY_CODES",
  "apps/mobile/src/expenses/failed-row-prefill.ts:FAILED_ROW_LOCAL_ID_PARAM",
  "apps/mobile/src/import/import-failure-messages.ts:IMPORT_FAILURE_KINDS",
  "apps/mobile/src/offline/messages.ts:SYNC_STATUS_RETRY_ALL_LABEL",
  "apps/mobile/src/offline/sqlite-offline-store.ts:OFFLINE_DB_SCHEMA_VERSION",
  "apps/mobile/src/settings/destructive-flow-messages.ts:DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES"
] as const;

/**
 * ⚠️⚠️ **래칫의 타입 핀**(계약 ⓔ · 라운드 90 트랙 C) — 래칫은 **값과 타입 양쪽**에 걸린다.
 *
 * `LEDGER_IDS`는 `as const` 튜플이라 `length`가 리터럴 타입이고, `DEAD_EXPORT_RATCHET`도
 * 리터럴 타입 `22`다. 아래 상수는 **두 리터럴이 같을 때만** 타입이 맞는다 — 그래서 새
 * `export const`가 이유 없이 죽어 스물셋째 id가 붙는 날, `vitest`가 돌기도 전에
 * **`tsc --noEmit`가 먼저 빨개진다**(둘 중 한쪽만 손대서 통과시키는 길이 막힌다).
 */
type SameLiteral<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const RATCHET_TYPE_PIN: SameLiteral<DeadExportRatchet, typeof LEDGER_IDS.length> = true;

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

/** 임시 뿌리에 모집단·호출부 네 자리를 세운다(교란이 제품 소스를 건드리지 않게 하는 관례). */
function makeFixtureRoot(prefix: string): string {
  const base = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(base, "apps/mobile/src/fixture"), { recursive: true });
  mkdirSync(join(base, "apps/mobile/app"), { recursive: true });
  mkdirSync(join(base, "apps/admin/src/lib"), { recursive: true });
  mkdirSync(join(base, "apps/admin/app"), { recursive: true });
  writeFileSync(join(base, "apps/admin/src/lib/noop.ts"), "export const fixtureConstant = 1;\n", "utf8");
  // ⚠️ 어드민 뼈대의 상수는 **화면이 실제로 쓴다.** 라운드 89 트랙 C가 `export const` 축을 들이면서
  // 안 쓰면 이 뼈대 자체가 사문 하나를 내고, 그러면 교란이 무엇을 물었는지가 흐려진다.
  writeFileSync(
    join(base, "apps/admin/app/page.tsx"),
    'import { fixtureConstant } from "../src/lib/noop";\n' +
      "export default function Page() {\n  return fixtureConstant;\n}\n",
    "utf8"
  );
  return base;
}

describe("ⓐ 결정 — 호출부·모집단·계약 전용 데이터가 값으로 적혀 있다", () => {
  it("세 정의가 산문이 아니라 값이고, 비어 있지 않다", () => {
    expect(CALLSITE_DEFINITION.trim().length, "호출부의 정의가 비어 있어요").toBeGreaterThan(120);
    expect(POPULATION_DEFINITION.trim().length, "모집단의 정의가 비어 있어요").toBeGreaterThan(120);
    expect(CONTRACT_ONLY_DEFINITION.trim().length, "계약 전용 데이터 판정의 정의가 비어 있어요").toBeGreaterThan(200);
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

  it("모집단 정의가 **축 둘**을 말하고, `.tsx`가 왜 밖인지 함께 적는다", () => {
    expect(POPULATION_DEFINITION).toContain("export function");
    expect(POPULATION_DEFINITION).toContain("export const");
    expect(POPULATION_DEFINITION).toContain(".tsx");
    // 축 둘이 실제로 걷혀 하나의 모집단이 된다(정의와 코드가 갈리지 않는다).
    expect(population.length).toBe(collectExportedFunctions().length + collectExportedConstants().length);
    expect(new Set(population.map((item) => item.kind))).toEqual(new Set(["function", "const"]));
  });

  it("계약 전용 데이터의 정의가 **손 목록이 아님**을 값으로 말한다", () => {
    expect(CONTRACT_ONLY_DEFINITION).toContain("파생");
    expect(CONTRACT_ONLY_DEFINITION).toContain("bundle-excluded");
    expect(CONTRACT_ONLY_DEFINITION).toContain("locator-table");
    // 옛 손 목록이 무엇으로 바뀌었는지가 값으로 남아 있다(다음 라운드가 되돌리지 못하게).
    expect(HAND_LIST_REPLACED_BY_DERIVATION).toContain("CONTRACT_ONLY_DATA_MODULES");
    expect(HAND_LIST_REPLACED_BY_DERIVATION).toContain("contractOnlyDataProof");
    // 그리고 그 손 목록의 이름은 이 대장 어디에도 **값으로 남아 있지 않다**(경로 배열이 사라졌다).
    const ledgerSource = readRepoFile(LEDGER_SELF_FILES[0]);
    expect(
      /export const CONTRACT_ONLY_DATA_MODULES/.test(ledgerSource),
      "손 목록이 아직 살아 있어요 — 판정이 파생으로 옮겨 가지 않았습니다"
    ).toBe(false);
  });

  it("테스트 파일은 호출부가 아니다(그래야 '테스트만 부른다'를 셀 수 있다)", () => {
    expect(callsiteFiles.filter((file) => /\.(test|spec)\.tsx?$/.test(file))).toEqual([]);
    // 그리고 테스트는 실제로 존재한다 — 없으면 위 단언은 아무것도 지키지 않는다.
    expect(testSources.size, "테스트 파일이 0건이면 '계약만 초록'을 잴 수 없어요").toBeGreaterThan(150);
  });
});

describe("ⓑ 유령 방지 — 뿌리가 실재하고, 축 둘이 다 0건이 아니다", () => {
  it("모집단 뿌리 둘이 각각 이유를 지고 있다", () => {
    expect(POPULATION_ROOTS.length).toBe(2);
    expect(POPULATION_ROOTS.map((root) => root.id).sort()).toEqual(["admin-src-lib", "mobile-src"]);
    for (const root of POPULATION_ROOTS) {
      expect(root.reason.trim().length, `${root.id} 뿌리의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(60);
      expect(root.extensions.length, `${root.id} 뿌리의 확장자가 비어 있어요`).toBeGreaterThan(0);
    }
  });

  for (const root of POPULATION_ROOTS) {
    it(`${root.id}: 뿌리가 실재하고 파일 수·축 둘의 export 수가 하한을 넘는다`, () => {
      const files = filesUnder(root.path, root.extensions, root.excludeSegments);
      expect(files.length, `${root.path}의 파일 수가 하한(${root.minFiles}) 아래예요`).toBeGreaterThanOrEqual(
        root.minFiles
      );
      const functions = population.filter((item) => item.root === root.id && item.kind === "function");
      const constants = population.filter((item) => item.root === root.id && item.kind === "const");
      expect(
        functions.length,
        `${root.path}의 export function 수가 하한(${root.minExports}) 아래예요 — 걷기가 죽었을 수 있어요`
      ).toBeGreaterThanOrEqual(root.minExports);
      // ⚠️ 라운드 89 트랙 C: 새 축도 하한을 진다. 하한이 없으면 `export const` 걷기가 통째로
      // 죽어도 *"사문이 스물둘을 넘지 않는다"* 는 그대로 초록이다.
      expect(
        constants.length,
        `${root.path}의 export const 수가 하한(${root.minConstExports}) 아래예요 — 새 축의 걷기가 죽었을 수 있어요`
      ).toBeGreaterThanOrEqual(root.minConstExports);
      // 하한은 실측 아래에 있어야 한다(하한을 실측 위에 두면 첫날부터 빨갛다).
      expect(root.minFiles).toBeLessThanOrEqual(root.measuredFiles);
      expect(root.minExports).toBeLessThanOrEqual(root.measuredExports);
      expect(root.minConstExports).toBeLessThanOrEqual(root.measuredConstExports);
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
    expect(new Set(ids).size, "같은 파일에 같은 이름의 export가 둘 있어요").toBe(ids.length);
  });

  it("축 둘이 다 사문을 내놓는다(한쪽이 0건이면 그 축의 그물이 죽었을 수 있다)", () => {
    expect(dead.length, "사문이 0건이면 그물이 죽었을 수 있어요").toBeGreaterThan(0);
    expect(population.length).toBeGreaterThan(dead.length);
    expect(findDeadExportsOfKind("function").length, "함수 축의 사문").toBeGreaterThan(0);
    expect(findDeadExportsOfKind("const").length, "상수 축의 사문").toBeGreaterThan(0);
    expect(findDeadExportsOfKind("function").length + findDeadExportsOfKind("const").length).toBe(dead.length);
  });
});

describe("ⓗ 파생 판정 — 계약 전용 데이터를 **모듈 자신의 소스에서** 가른다 (라운드 89 트랙 C)", () => {
  it("축 둘이 이름과 문장을 지고, 오늘 **둘 다 산출을 낸다**(유령 축 금지)", () => {
    expect(CONTRACT_ONLY_AXES.length).toBe(2);
    expect(new Set(CONTRACT_ONLY_AXES.map((axis) => axis.id))).toEqual(
      new Set(["bundle-excluded", "locator-table"])
    );
    for (const axis of CONTRACT_ONLY_AXES) {
      expect(axis.statement.trim().length, `${axis.id} 축의 문장이 비어 있어요`).toBeGreaterThan(80);
      expect(
        exemptions.some((entry) => entry.proof.axis === axis.id),
        `${axis.id} 축으로 면제된 자리가 오늘 0건이에요 — 근거 없는 축은 조용한 면제부입니다`
      ).toBe(true);
    }
  });

  it("면제의 크기가 **값**이고, 근거가 항목마다 **비어 있지 않다**", () => {
    // ⚠️ 라운드 90 트랙 C: 18 → 22. 문자열 축이 들어오며 늘어난 사문 넷이 **전부 자리 표 축으로**
    // 떨어졌고, 그 넷이 사는 `shared-cache-policy.ts`는 이미 면제 쪽 모듈이라 **모듈 수는 6 그대로**다.
    expect(exemptions.length, "오늘 파생 판정이 면제한 자리 수").toBe(22);
    // ⚠️ 파생의 산출(`contractOnlyDataModules`)과 면제 목록에서 딴 집합이 **같은 답**을 낸다.
    expect(exemptionModules).toEqual([...new Set(exemptions.map((entry) => entry.item.file))].sort());
    expect(exemptionModules.length, "그 면제가 걸친 모듈 수").toBe(6);
    expect(
      exemptions.filter((entry) => entry.proof.axis === "locator-table").length,
      "자리 표 축의 면제 수 — 라운드 89의 열하나에서 넷이 늘었다"
    ).toBe(15);
    expect(
      exemptions.filter((entry) => entry.proof.axis === "bundle-excluded").length,
      "번들 밖 축의 면제 수 — 문자열 축과 무관하게 움직이지 않았다"
    ).toBe(7);
    for (const entry of exemptions) {
      expect(entry.proof.evidence.length, `${entry.item.id}의 근거가 비어 있어요`).toBeGreaterThan(0);
      expect(entry.proof.reason.trim().length, `${entry.item.id}의 이유가 비어 있어요`).toBeGreaterThan(30);
      // ⚠️ 면제는 **새로 들어온 축에만** 걸린다 — 그러지 않으면 이 트랙이 하는 일이
      // "모집단을 넓히는 것"이 아니라 "이미 선 대장의 줄을 지우는 것"이 된다.
      expect(entry.item.kind, `${entry.item.id}: 면제가 함수 축까지 걷어 갔어요`).toBe("const");
    }
  });

  it("근거가 **오늘도 실재한다** — 유령 근거는 면제가 아니다", () => {
    for (const entry of exemptions) {
      if (entry.proof.axis === "bundle-excluded") {
        // 근거는 이 모듈을 import하는 계약 파일 전수다. 그 파일들이 실재해야 한다.
        for (const contract of entry.proof.evidence) {
          expect(() => readRepoFile(contract), `${entry.item.id}의 근거 파일 ${contract}가 없어요`).not.toThrow();
        }
      } else {
        // 근거는 `토큰 → 자리`이고, 그 자리가 저장소에 실재해야 한다.
        for (const line of entry.proof.evidence) {
          const at = line.split(" → ")[1] ?? "";
          const file = at.replace(/ \(export .*\)$/, "");
          expect(file.length, `${entry.item.id}의 근거가 자리를 가리키지 않아요: ${line}`).toBeGreaterThan(0);
          expect(() => readRepoFile(file), `${entry.item.id}의 근거 자리 ${file}가 없어요`).not.toThrow();
        }
      }
    }
  });

  it("면제 + 대장 = 사문 전수이고, 겹치는 자리가 0건이다(ⓓ 유령 방지)", () => {
    const exemptIds = exemptions.map((entry) => entry.item.id);
    const requiredIds = ledgerRequired.map((item) => item.id);
    expect(new Set(exemptIds).size, "면제 목록에 중복이 있어요").toBe(exemptIds.length);
    expect(new Set(requiredIds).size, "대장 필요 목록에 중복이 있어요").toBe(requiredIds.length);
    expect(exemptIds.filter((id) => requiredIds.includes(id)), "면제와 대장이 같은 자리를 물어요").toEqual([]);
    expect(exemptions.length + ledgerRequired.length, "면제 + 대장이 사문 전수와 갈렸어요").toBe(dead.length);
    // 그리고 그 전수는 축 둘의 합이다 — 오늘 44(함수 16 · 상수 28).
    expect(dead.length).toBe(44);
    expect(findDeadExportsOfKind("function").length).toBe(16);
    expect(findDeadExportsOfKind("const").length).toBe(28);
    expect(ledgerRequired.length).toBe(DEAD_EXPORT_LEDGER.length);
  });

  it("⚠️ **표식만 복사해서는 면제를 살 수 없다** — 머리말의 문장이 아니라 import 그래프가 판정한다", () => {
    const base = makeFixtureRoot("dead-export-ledger-copied-marker-");
    try {
      // 화면이 실제로 import하는 모듈에, `offline-aware-screens.ts` 머리말의 자백을 **그대로 베껴** 붙인다.
      writeFileSync(
        join(base, "apps/mobile/src/fixture/pretend.ts"),
        "/**\n" +
          " * 이 모듈은 화면 코드가 import하지 않는다(계약 전용 데이터라 앱 번들에 실리지 않는다).\n" +
          " * 계약 전용 데이터라 테스트만 읽는 것이 이 모듈의 설계다.\n" +
          " */\n" +
          'export const PRETEND_CONTRACT_TABLE = ["설계상 계약만 읽는다", "그러나 화면이 import한다"];\n',
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        'import { PRETEND_CONTRACT_TABLE } from "../src/fixture/pretend";\n' +
          "export default function Screen() {\n  return PRETEND_CONTRACT_TABLE.length;\n}\n",
        "utf8"
      );
      const context = contractOnlyContext(base);
      const item: ExportedFunction = {
        id: "apps/mobile/src/fixture/pretend.ts:PRETEND_CONTRACT_TABLE",
        root: "mobile-src",
        file: "apps/mobile/src/fixture/pretend.ts",
        line: 5,
        name: "PRETEND_CONTRACT_TABLE",
        kind: "const"
      };
      expect(
        contractOnlyDataProof(item, context),
        "머리말의 자백을 베껴 붙인 것만으로 면제가 나왔어요 — 판정이 표식을 읽고 있습니다"
      ).toBeNull();
      // 그리고 그 파일을 아무도 import하지 않게 되는 순간에는 면제가 **근거와 함께** 선다.
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        "export default function Screen() {\n  return null;\n}\n",
        "utf8"
      );
      mkdirSync(join(base, "apps/mobile/src/fixture/__tests__"), { recursive: true });
      writeFileSync(
        join(base, "apps/mobile/src/fixture/__tests__/pretend.test.ts"),
        'import { PRETEND_CONTRACT_TABLE } from "../pretend";\nexport const used = PRETEND_CONTRACT_TABLE;\n',
        "utf8"
      );
      const proof = contractOnlyDataProof(item, contractOnlyContext(base));
      expect(proof?.axis, "화면이 놓은 뒤에도 번들 밖 축이 서지 않아요").toBe("bundle-excluded");
      expect(proof?.evidence.length, "번들 밖 축의 근거(계약 import)가 비어 있어요").toBeGreaterThan(0);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("⚠️ **자리 표 축은 자리가 실재할 때만 선다** — 원소 하나만 못 풀려도 표가 아니다", () => {
    const base = makeFixtureRoot("dead-export-ledger-locator-");
    try {
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        "export default function Screen() {\n  return null;\n}\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/src/fixture/tables.ts"),
        'export const REAL_TABLE = ["app/screen.tsx"];\n' +
          'export const FAKE_TABLE = ["app/screen.tsx", "app/does-not-exist.tsx"];\n',
        "utf8"
      );
      const context = contractOnlyContext(base);
      const make = (name: string, line: number): ExportedFunction => ({
        id: `apps/mobile/src/fixture/tables.ts:${name}`,
        root: "mobile-src",
        file: "apps/mobile/src/fixture/tables.ts",
        line,
        name,
        kind: "const"
      });
      expect(contractOnlyDataProof(make("REAL_TABLE", 1), context)?.axis, "실재하는 자리를 못 읽었어요").toBe(
        "locator-table"
      );
      expect(
        contractOnlyDataProof(make("FAKE_TABLE", 2), context),
        "없는 자리를 가리키는 배열이 표로 읽혔어요 — 근거 없이 면제가 나갑니다"
      ).toBeNull();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("자리 판정의 갈래 셋이 각각 산다(파일 경로 · 라우트 · export된 식별자)", () => {
    const product = readCallsiteSources();
    const owner = "apps/mobile/src/settings/more-menu.ts";
    expect(resolveProductLocator("app/(tabs)/reports.tsx", owner, product)?.kind).toBe("source-file");
    expect(resolveProductLocator("/settings/privacy", owner, product)?.kind).toBe("route");
    expect(resolveProductLocator("useRecurringExpenseStore", owner, product)?.kind).toBe("exported-identifier");
    // ⚠️ 도메인 코드는 자리가 아니다 — 이것이 ANALYTICS_CATEGORY_CODES가 면제되지 않는 이유다.
    expect(resolveProductLocator("pregnancy_mother", owner, product)).toBeNull();
    expect(resolveProductLocator("row_edit", owner, product)).toBeNull();
  });

  it("초기화식 읽기가 **주석은 버리고 문자열은 남긴다**(주석 한 줄로 면제를 살 수 없다)", () => {
    const source = ["export const T = [", '  // "app/(tabs)/reports.tsx" 라고 주석에만 적는다', '  "값"', "];"].join(
      "\n"
    );
    const initializer = initializerText(source, 1);
    expect(initializer, "주석 안의 자리가 초기화식에 남았어요").not.toContain("reports.tsx");
    expect(initializer).toContain('"값"');
    expect(topLevelElements(initializer)).toEqual(['"값"']);
  });

  it("import 세기가 **동적 import와 require까지** 본다(놓치면 번들 밖 축이 잘못 선다)", () => {
    const sources = new Map([
      ["apps/mobile/src/a.ts", 'const m = await import("./target");\n'],
      ["apps/mobile/src/b.ts", 'const m = require("./target");\n'],
      ["apps/mobile/src/c.ts", 'import { x } from "./target";\n'],
      ["apps/mobile/src/d.ts", '// import("./target") 은 주석이다\n']
    ]);
    expect(importersOfModule("apps/mobile/src/target.ts", sources)).toEqual([
      "apps/mobile/src/a.ts",
      "apps/mobile/src/b.ts",
      "apps/mobile/src/c.ts"
    ]);
    // ⚠️ 이 저장소의 실물로도 확인한다: sync-controller가 동적 import로만 여는 모듈이 있다.
    const product = readCallsiteSources();
    expect(
      importersOfModule("apps/mobile/src/offline/sqlite-offline-store.ts", product).length,
      "동적 import를 놓치면 이 모듈이 '번들 밖'으로 잘못 읽힙니다"
    ).toBeGreaterThan(0);
  });
});

describe("ⓒ 항목 — 오늘의 스물둘이 전수로 있고 각각 셋 중 하나다", () => {
  it("대장의 id 전수가 못 박혀 있고 **면제를 뺀 실측**과 양방향으로 같다", () => {
    const ledgerIds = DEAD_EXPORT_LEDGER.map((entry) => entry.id).sort();
    // ⓕ의 못 — 루프가 줄어들어도 조용히 통과하지 않게 집합 자체를 값으로 박는다.
    expect(ledgerIds, "대장의 항목 집합이 못 박은 스물둘과 달라요").toEqual([...LEDGER_IDS].sort());

    const measuredIds = ledgerRequired.map((item) => item.id).sort();
    const missing = measuredIds.filter((id) => !ledgerIds.includes(id));
    const ghosts = ledgerIds.filter((id) => !measuredIds.includes(id));
    expect(
      missing,
      `대장에 없는 새 사문이 생겼어요:\n${ledgerRequired
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

  it("축 둘이 대장 안에서 갈리고, 그 수가 오늘 실측(16 / 6)과 같다", () => {
    const byKind = (kind: string) =>
      DEAD_EXPORT_LEDGER.filter((entry) => measured(entry.id).kind === kind).length;
    expect(byKind("function"), "`export function` 축의 줄 수 — 라운드 87·88에서 한 줄도 움직이지 않았다").toBe(16);
    expect(byKind("const"), "`export const` 축의 줄 수 — 라운드 89 트랙 C가 들인 자리").toBe(6);
  });

  it("갈래 셋이 전부 서 있고, 갈래의 수가 오늘 실측(5 / 15 / 2)과 같다", () => {
    const byKind = (kind: string) => DEAD_EXPORT_LEDGER.filter((entry) => entry.reasonKind === kind).length;
    // ⚠️ 라운드 87은 5 / 2 / 9, 라운드 88은 5 / 11 / 0이었다. 라운드 89 트랙 C가 `export const`
    // 축을 들이며 소스에 이유가 있는 넷과 대장에만 이유가 있는 둘이 더해져 **5 / 15 / 2**다.
    // ⚠️ 셋째 갈래는 라운드 88에 **비어 있었을 뿐 살아 있었고**, 오늘 실제로 둘이 그리로 떨어졌다.
    expect(byKind("name-confesses"), "이름이 고백하는 항목 수").toBe(5);
    expect(byKind("reason-in-source"), "이유가 소스에 있는 항목 수").toBe(15);
    expect(byKind("reason-in-ledger"), "이유가 대장에만 있는 항목 수").toBe(2);
    expect(byKind("name-confesses") + byKind("reason-in-source") + byKind("reason-in-ledger")).toBe(
      DEAD_EXPORT_LEDGER.length
    );
  });

  it("그 분포가 **대장의 칸이 아니라 모집단**에서 파생한다", () => {
    // ⚠️ 위 단언만 있으면 대장이 자기 칸을 스스로 적고 자기 칸을 세는 셈이다. 같은 셋을 **오늘의
    // 실측(모집단 → 사문 → 면제 빼기 → 소스 확인)** 에서 다시 파생시켜, 두 셈이 같은 답을 내는지 본다.
    const derived = { "name-confesses": 0, "reason-in-source": 0, "reason-in-ledger": 0 };
    for (const item of ledgerRequired) derived[classifyDeadExport(item)] += 1;
    expect(derived, "모집단에서 파생한 갈래 분포가 5 / 15 / 2가 아니에요").toEqual({
      "name-confesses": 5,
      "reason-in-source": 15,
      "reason-in-ledger": 2
    });
    expect(ledgerRequired.length, "모집단이 내놓은 사문 수(면제 뺀 뒤)").toBe(DEAD_EXPORT_LEDGER.length);
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

  it("이름이 고백하는 다섯은 실제로 표식을 달고, 나머지 열일곱은 달지 않는다", () => {
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

  it("이유가 소스에 있는 열다섯은 그 이유가 **실제로 그 파일에** 있다", () => {
    const inSource = DEAD_EXPORT_LEDGER.filter((entry) => entry.reasonKind === "reason-in-source");
    // ⚠️ 라운드 87의 둘이 본보기였고 라운드 88 트랙 D가 아홉을 같은 형식으로 옮겼다. 라운드 89
    // 트랙 C가 상수 축의 넷을 더한다 — 그중 둘(IMPORT_FAILURE_KINDS · DESTRUCTIVE_FLOW_…)은
    // **소스가 이미 적어 두고 있었고 오늘 주석 바이트가 불변**이다(모집단이 그 자리에 닿았을 뿐이다).
    expect(inSource.map((entry) => entry.name).sort()).toEqual(
      [
        "canBulkSelectImportRows",
        "getQueuedAnalyticsEventCount",
        "hasPendingRequiredConsents",
        "isRealUserBuild",
        "legalDocumentUrl",
        "notificationTypeLabel",
        "supportLinkUrl",
        "updateContentRevisionDraft",
        "usesOfflineAwareLoadErrorCopy",
        "destructiveFlowFallbackMessage",
        "isNamedImportFailure",
        "ANALYTICS_CATEGORY_CODES",
        "IMPORT_FAILURE_KINDS",
        "OFFLINE_DB_SCHEMA_VERSION",
        "DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES"
      ].sort()
    );
    for (const entry of inSource) {
      const item = measured(entry.id);
      const proof = sourceReasonProof(item);
      expect(proof, `${entry.id}: 선언 위 주석에 S-8 관례가 없어요`).not.toBeNull();
      expect(proof?.text).toContain(SOURCE_REASON_MARKER);
      expect(proof?.text, `${entry.id}: '왜 지우지 않는가'가 빠졌어요`).toContain(SOURCE_REASON_KEEP_MARKER);
      // 주석 덩어리는 선언 **위**에 있다(아래에 있는 것은 다음 선언의 이유다).
      expect(proof?.markerLine).toBeLessThan(item.line);
    }
  });

  it("그 이유가 관례 문구만이 아니라 **왜 화면이 부르지 않는가**를 말한다", () => {
    // ⚠️ 이 단언이 없으면 `⚠ **테스트 전용 export** … **지우지 않는다**` 두 문구만 복사해 붙여도
    // 갈래가 올라간다 — 그것은 이유가 아니라 표식이다. 이유는 **그 export를 가리키며**
    // 화면이 무엇을 대신 부르는지/무엇이 없어서 부르지 않는지를 말해야 한다.
    for (const entry of DEAD_EXPORT_LEDGER.filter((row) => row.reasonKind === "reason-in-source")) {
      const proof = sourceReasonProof(measured(entry.id));
      const text = proof?.text ?? "";
      expect(text.length, `${entry.id}: 소스의 이유가 표식 두 줄뿐이에요`).toBeGreaterThan(
        SOURCE_REASON_MARKER.length + SOURCE_REASON_KEEP_MARKER.length + 120
      );
      expect(
        ["이 함수", "이 술어", "이 값", "이 목록", "이 표", "이 배열", "이 상수", "이 이름", entry.name].some(
          (noun) => text.includes(noun)
        ),
        `${entry.id}: 소스의 이유가 무엇에 대한 이유인지 말하지 않아요`
      ).toBe(true);
      expect(text, `${entry.id}: '안 쓴다'만 적혀 있어요`).toMatch(/않는|없다|없고|없어|대신|갈아탔/);
    }
  });

  it("이유가 대장에만 있는 갈래가 **다시 살았고**, 그 둘은 소스에 이유가 없다", () => {
    const onlyInLedger = DEAD_EXPORT_LEDGER.filter((row) => row.reasonKind === "reason-in-ledger");
    // ⚠️ 라운드 88 뒤 이 갈래는 0건이었고 계약은 *"사라진 것이 아니라 비어 있다"* 고 적었다.
    // 라운드 89 트랙 C가 `export const` 축을 들이며 실제로 둘이 이 갈래로 떨어졌다.
    expect(onlyInLedger.map((entry) => entry.id).sort()).toEqual([
      "apps/mobile/src/expenses/failed-row-prefill.ts:FAILED_ROW_LOCAL_ID_PARAM",
      "apps/mobile/src/offline/messages.ts:SYNC_STATUS_RETRY_ALL_LABEL"
    ]);
    for (const entry of onlyInLedger) {
      expect(sourceReasonProof(measured(entry.id)), `${entry.id}: 소스에 이미 이유가 있어요`).toBeNull();
    }
    // 그리고 갈래 자체가 살아 있다: 소스에도 이름에도 아무 말 없는 사문이 생기면 여기로 떨어진다.
    expect(
      classifyDeadExport(
        {
          id: "x:y",
          root: "mobile-src",
          file: "apps/mobile/src/offline/messages.ts",
          line: 1,
          name: "y",
          kind: "function"
        },
        repoRoot
      ),
      "아무 말 없는 항목이 이 갈래로 떨어지지 않아요 — 셋째 갈래가 죽었습니다"
    ).toBe("reason-in-ledger");
  });

  it("스물둘 중 스물하나는 테스트 참조가 있고, **없는 하나는 그 사실이 이유에 적혀 있다**", () => {
    // ⚠️ 라운드 88까지 이 단언은 *"열여섯 다 테스트 참조가 있다"* 였다. `export const` 축이
    // 들어오며 **테스트조차 부르지 않는 자리 하나**가 처음 드러났다 — 그것이 이 대장이 축을
    // 넓혀서 얻은 값이고, 수를 맞추려고 그 사실을 감추지 않는다.
    const withoutTests = DEAD_EXPORT_LEDGER.filter(
      (entry) => findTestReferences(entry.name, testSources).length === 0
    );
    expect(withoutTests.map((entry) => entry.id)).toEqual([
      "apps/mobile/src/expenses/failed-row-prefill.ts:FAILED_ROW_LOCAL_ID_PARAM"
    ]);
    for (const entry of withoutTests) {
      expect(
        entry.reason,
        `${entry.id}: 테스트도 부르지 않는데 이유가 그 사실을 말하지 않아요`
      ).toMatch(/계약도|테스트조차|테스트도/);
    }
    for (const entry of DEAD_EXPORT_LEDGER.filter((row) => !withoutTests.includes(row))) {
      expect(
        findTestReferences(entry.name, testSources).length,
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

  it("⚠️ 손 목록이 가리고 있던 자리를 소스로 확인한다(SYNC_STATUS_RETRY_ALL_LABEL)", () => {
    // ⚠️ 이 한 줄이 라운드 89 트랙 C가 손 목록을 파생 판정으로 바꾼 이유 전체다: 옛 목록은
    // 이 모듈의 사문 셋을 "계약이 읽는 값"이라며 통째로 면제했는데, 이 상수는 사용자 문장이다.
    const item = measured("apps/mobile/src/offline/messages.ts:SYNC_STATUS_RETRY_ALL_LABEL");
    expect(
      contractOnlyDataProof(item, contractOnlyContext()),
      "사용자 문장이 계약 전용 데이터로 면제됐어요 — 판정이 모듈 통째로 걸려 있습니다"
    ).toBeNull();
    // 같은 모듈의 나머지 둘은 오늘도 면제 쪽이다(판정이 모듈이 아니라 **자리**에 걸린다).
    const exemptInSameModule = exemptions
      .filter((entry) => entry.item.file === "apps/mobile/src/offline/messages.ts")
      .map((entry) => entry.item.name)
      .sort();
    expect(exemptInSameModule).toEqual(["LOGOUT_COUNTED_TEARDOWN_STORES", "LOGOUT_UNCOUNTED_TEARDOWN_STORES"]);
    // 그리고 화면이 갈아탄 더 좁은 라벨이 실제로 그 화면에 서 있다.
    const screen = readRepoFile("apps/mobile/app/sync-status.tsx");
    expect(screen, "화면이 대신 쓰는 라벨의 뿌리").toContain("SYNC_STATUS_RETRY_LABEL");
  });
});

describe("ⓓ 래칫 — 사문 수가 오늘의 실측보다 늘지 않는다", () => {
  it("래칫 값이 오늘의 실측과 같고, 대장의 줄 수와도 같다", () => {
    expect(DEAD_EXPORT_RATCHET).toBe(DEAD_EXPORT_LEDGER.length);
    expect(DEAD_EXPORT_RATCHET, "래칫이 실측보다 느슨해요").toBeGreaterThanOrEqual(ledgerRequired.length);
  });

  it("⚠️⚠️ 래칫이 **타입과 값 양쪽**에 걸려 있다(라운드 90 트랙 C)", () => {
    // ⚠️ 타입 쪽: `RATCHET_TYPE_PIN`은 `DEAD_EXPORT_RATCHET`의 리터럴 타입과 못 박은 id 튜플의
    // `length`가 **같을 때만** 컴파일된다 — 스물셋째 사문이 이유 없이 생기는 날 `tsc --noEmit`가
    // 먼저 빨개지고, 두 자리 중 한쪽만 고쳐서 통과시키는 길이 막힌다.
    expect(RATCHET_TYPE_PIN, "래칫의 타입 핀이 꺼졌어요").toBe(true);
    // ⚠️ 값 쪽: 같은 수가 세 자리에서 만난다(래칫 · 대장의 줄 · 못 박은 id 전수).
    expect(LEDGER_IDS.length).toBe(DEAD_EXPORT_RATCHET);
    expect(DEAD_EXPORT_LEDGER.length).toBe(DEAD_EXPORT_RATCHET);
    // ⚠️ 그리고 그 셋은 **오늘의 실측**과도 같다 — 값만 서로 맞추고 저장소는 안 보는 핀이 아니다.
    expect(ledgerRequired.length).toBe(DEAD_EXPORT_RATCHET);
  });

  it("사문 수(면제 뺀 뒤)가 래칫을 넘지 않는다", () => {
    expect(
      ledgerRequired.length,
      `호출부 0건이고 면제도 없는 export가 ${ledgerRequired.length}건이에요(래칫 ${DEAD_EXPORT_RATCHET}).\n` +
        ledgerRequired
          .filter((item) => !DEAD_EXPORT_LEDGER.some((entry) => entry.id === item.id))
          .map((item) => deadExportHint(item))
          .join("\n")
    ).toBeLessThanOrEqual(DEAD_EXPORT_RATCHET);
  });

  it("⚠️ 래칫이 **내려간 적이 없다**는 사실이 값으로 서 있다", () => {
    // ⚠️ 이 이력이 없으면 다음 라운드가 "예전에는 16이었는데 왜 22인가"를 산문으로만 만나고,
    // 그때 가장 싼 답은 축을 도로 좁히는 것이다.
    expect(RATCHET_HISTORY.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < RATCHET_HISTORY.length; index += 1) {
      expect(
        RATCHET_HISTORY[index].value,
        `라운드 ${RATCHET_HISTORY[index].round}에서 래칫이 내려갔어요 — 그 답은 막혀 있습니다`
      ).toBeGreaterThanOrEqual(RATCHET_HISTORY[index - 1].value);
      expect(RATCHET_HISTORY[index].round).toBeGreaterThan(RATCHET_HISTORY[index - 1].round);
      expect(RATCHET_HISTORY[index].why.trim().length, "래칫이 움직인 이유가 비어 있어요").toBeGreaterThan(20);
    }
    expect(RATCHET_HISTORY[RATCHET_HISTORY.length - 1].value, "이력의 끝이 오늘의 래칫이어야 해요").toBe(
      DEAD_EXPORT_RATCHET
    );
    // 늘어난 이유가 '새 부채'가 아니라 '세는 자리가 늘었다'로 적혀 있다(라운드 88 D의 형식).
    expect(RATCHET_HISTORY[RATCHET_HISTORY.length - 1].why).toContain("세는 자리가");
  });

  it("실패 메시지가 사람을 파일로 보내고 두 답을 함께 적어 준다", () => {
    const sample = ledgerRequired[0];
    expect(describeDeadExport(sample)).toContain(sample.file);
    expect(describeDeadExport(sample)).toContain(String(sample.line));
    const hint = deadExportHint(sample);
    expect(hint).toContain("① 지운다");
    expect(hint).toContain("② 이유를 적는다");
    expect(hint).toContain(SOURCE_REASON_MARKER);
    // 상수 축에는 셋째 길(파생 면제)이 있고, 그 길을 실패 메시지가 알려 준다.
    const constantSample = ledgerRequired.find((item) => item.kind === "const") as ExportedFunction;
    expect(deadExportHint(constantSample)).toContain("결정 ③");
  });
});

describe("ⓔ 사각 — 값으로 적혀 있고, 오늘 다시 잰다", () => {
  it("남은 사각이 서로 다른 id이고 문장·값을 지고 있다", () => {
    expect(LEDGER_BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(LEDGER_BLIND_SPOTS.map((spot) => spot.id)).size).toBe(LEDGER_BLIND_SPOTS.length);
    for (const spot of LEDGER_BLIND_SPOTS) {
      expect(spot.statement.trim().length, `${spot.id} 사각의 문장이 비어 있어요`).toBeGreaterThan(60);
      expect(spot.floor, `${spot.id} 사각의 하한이 실측값 위에 있어요`).toBeLessThanOrEqual(spot.value);
    }
  });

  it("⚠️ **닫힌 사각**이 지워지지 않고, 무엇이 언제 닫았는지를 들고 산다", () => {
    // ⚠️ 그냥 사라지면 다음 라운드가 "이 축은 왜 세지 않지"를 다시 묻고 **다시 세고 나서
    // 어디에도 적지 못한다**(AA-4의 규율이 막으려던 그 자리다).
    // ⚠️ 라운드 89가 닫은 둘은 **그대로 서 있고**, 라운드 90이 닫은 셋째가 그 옆에 붙었다.
    expect(CLOSED_BLIND_SPOTS.map((spot) => spot.id).sort()).toEqual([
      "contract-only-data-modules",
      "export-const-axis",
      "string-literal-references"
    ]);
    const closedInRound = Object.fromEntries(
      CLOSED_BLIND_SPOTS.map((spot) => [spot.id, spot.closedInRound])
    );
    expect(closedInRound, "무엇을 어느 라운드가 닫았는지가 값으로 서 있어야 해요").toEqual({
      "export-const-axis": 89,
      "contract-only-data-modules": 89,
      "string-literal-references": 90
    });
    const openIds = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    for (const closed of CLOSED_BLIND_SPOTS) {
      expect(closed.closedInRound, `${closed.id}를 닫은 라운드`).toBeGreaterThanOrEqual(89);
      expect(closed.statement.trim().length, `${closed.id}의 문장이 비어 있어요`).toBeGreaterThan(100);
      // 닫힌 자리가 열린 사각 목록에 **동시에** 있으면 그 줄은 장식이다.
      expect(openIds, `${closed.id}가 닫혔는데 사각 목록에도 있어요`).not.toContain(closed.id);
    }
  });

  it("명세가 요구한 남은 사각 셋이 이름으로 서 있다", () => {
    const ids = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    // ⚠️ 라운드 90 명세 ⓕ가 이름으로 부른 셋.
    expect(ids).toContain("tsx-components");
    expect(ids).toContain("common-name");
    expect(ids).toContain("derived-exemptions");
    // 라운드 88이 연 자리와, 라운드 90이 `string-literal-references`를 닫으며 **새로 연 자리**.
    expect(ids).toContain("comment-and-string-references");
    expect(ids).toContain("string-keyed-dynamic-access");
    // ⚠️ 닫힌 자리는 열린 목록에 **동시에** 서지 않는다(그 줄이 장식이 되는 자리다).
    expect(ids).not.toContain("string-literal-references");
  });

  it("⚠️⚠️ **계약 ⓑ 전후 대조** — 마스킹 전 40 · 후 44를 **둘 다 값으로** 든다", () => {
    // ⚠️ 두 수를 한 낱말로 적지 않는다(라운드 88 D가 주석 마스킹에 대해 세운 그 형식).
    // 앞의 수는 라운드 88·89의 그물이, 뒤의 수는 오늘의 그물이 낸다 — 같은 저장소·같은 모집단이다.
    const before = deadBeforeStringMasking;
    expect(before.length, "마스킹 **전**의 사문 수").toBe(40);
    expect(dead.length, "마스킹 **후**의 사문 수").toBe(44);
    expect(population.length, "두 수의 분모는 같다").toBeGreaterThan(dead.length);

    // ⚠️ 갈린 자리가 **정확히 넷**이고, 그 넷의 신원까지 값이다(수만 맞는 대조는 신원을 놓친다).
    const beforeIds = new Set(before.map((item) => item.id));
    const added = dead.filter((item) => !beforeIds.has(item.id));
    expect(dead.length - before.length, "전후의 차").toBe(added.length);
    expect(added.map((item) => item.id).sort()).toEqual(
      [
        "apps/mobile/src/query/shared-cache-policy.ts:CHILDREN_WRITE_APIS",
        "apps/mobile/src/query/shared-cache-policy.ts:CHILDREN_WRITE_LEDGER",
        "apps/mobile/src/query/shared-cache-policy.ts:EXPENSE_WRITE_LEDGER",
        "apps/mobile/src/query/shared-cache-policy.ts:SHARED_KEY_COVERAGE"
      ].sort()
    );
    // ⚠️ 마스킹 전의 사문은 **한 자리도 빠지지 않는다** — 문자열을 지우는 일이 참조를 만들 수는 없다.
    expect(before.filter((item) => !dead.some((entry) => entry.id === item.id))).toEqual([]);
    // ⚠️ 그리고 그 넷은 전부 **상수 축**이다: 함수 축 열여섯은 라운드 87부터 한 자리도 움직이지 않았다.
    expect(added.every((item) => item.kind === "const")).toBe(true);
    expect(findDeadExportsOfKind("function").length, "함수 축의 사문 수").toBe(16);
    // 같은 넷을 `stringOnlyReferenceExports`(전후가 갈린 자리를 세는 자)도 집어 든다.
    expect(stringOnlyReferenceExports().map((item) => item.id).sort()).toEqual(
      added.map((item) => item.id).sort()
    );

    // ⚠️⚠️ **계약 ⓓ 유령 방지 — 여섯 수를 한 자리에서 함께 대조한다.** 따로 선 단언은 각각
    // 참이면서도 서로 어긋날 수 있다(면제가 늘고 대장이 줄어도 합은 같다). 그 길을 이 한 줄이 막는다.
    expect(
      {
        마스킹전: deadBeforeStringMasking.length,
        마스킹후: dead.length,
        갈린자리: added.length,
        면제: exemptions.length,
        면제모듈: exemptionModules.length,
        대장줄: DEAD_EXPORT_LEDGER.length,
        대장요구: ledgerRequired.length
      },
      "유령 방지: 마스킹 전후·면제·모듈·대장이 한 자리에서 갈렸어요"
    ).toEqual({
      마스킹전: 40,
      마스킹후: 44,
      갈린자리: 4,
      면제: 22,
      면제모듈: 6,
      대장줄: 22,
      대장요구: 22
    });
    expect(exemptions.length + ledgerRequired.length, "면제 + 대장 = 사문 전수").toBe(dead.length);
  });

  it("⚠️⚠️ **계약 ⓒ 넷의 처분** — 자리 표 축으로 떨어지고 **대장의 줄은 0이 늘었다**", () => {
    // ⚠️ 라운드 89 트랙 C가 값으로 적은 예상은 *"대장의 줄은 0이 는다"* 였다. 예상과 실측이 갈리면
    // 그 갈림이 이 트랙의 값이므로, 여기서 **갈리지 않았다는 사실**을 값으로 확인한다.
    const context = contractOnlyContext();
    const beforeIds = new Set(deadBeforeStringMasking.map((item) => item.id));
    const added = dead.filter((item) => !beforeIds.has(item.id));
    expect(added.length, "문자열 축이 처음 본 자리 수").toBe(4);
    for (const item of added) {
      const proof = contractOnlyDataProof(item, context);
      expect(
        proof?.axis,
        `${item.id}: 자리 표 축이 이 넷을 면제하지 않아요 — 그러면 대장의 줄이 늘어납니다`
      ).toBe("locator-table");
      expect(proof?.evidence.length, `${item.id}의 근거가 비어 있어요`).toBeGreaterThan(0);
    }
    // ⚠️ **대장의 줄은 0이 늘었다** — 늘어난 넷이 하나도 대장을 요구하지 않는다.
    expect(ledgerRequired.length, "대장이 요구하는 자리 수(라운드 89와 같아야 한다)").toBe(22);
    expect(DEAD_EXPORT_LEDGER.length).toBe(22);
    expect(added.filter((item) => ledgerRequired.some((entry) => entry.id === item.id))).toEqual([]);
    // ⚠️ 면제는 18 → 22로 넷 늘었고, **모듈 수는 6 그대로다**(그 넷이 사는 파일이 이미 면제 쪽이었다).
    expect(exemptions.length, "면제 수").toBe(22);
    // ⚠️ 모듈 전수는 이미 걷어 둔 면제에서 파생한다(같은 전수 훑기를 세 번 하지 않는다 —
    // `contractOnlyDataModules()`가 내는 것과 같은 집합이고, ⓗ가 그 둘이 같은지 따로 확인한다).
    const modules = [...new Set(exemptions.map((entry) => entry.item.file))].sort();
    expect(modules, "면제가 걸친 모듈 전수").toContain("apps/mobile/src/query/shared-cache-policy.ts");
    expect(modules.length, "모듈 수 — 새 모듈은 생기지 않았다").toBe(6);
    // ⚠️ 그리고 그 처분이 **닫힌 사각의 문장에 값으로** 적혀 있다(산문으로 넘기지 않는다).
    const closed = CLOSED_BLIND_SPOTS.find((entry) => entry.id === "string-literal-references");
    expect(closed?.statement, "닫힌 사각이 그 넷의 이름을 값으로 들고 있어야 해요").toContain(
      "CHILDREN_WRITE_APIS"
    );
    expect(closed?.statement, "전후의 두 수").toContain("40 → 44");
  });

  for (const spot of LEDGER_BLIND_SPOTS.filter((entry) => entry.measure)) {
    it(`${spot.id}: 사각이 오늘도 실재한다(유령 사각 금지)`, () => {
      const value = (spot.measure as (baseDir: string) => number)(repoRoot);
      expect(
        value,
        `${spot.id} 사각을 다시 재니 ${value}예요 — 하한(${spot.floor}) 아래면 그 줄은 장식입니다`
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }

  it("⚠️⚠️ **명세 ⓕ의 사각 재실측** — tsx 141 · common-name 226 · 절반 문턱을 오늘 다시 잰다", () => {
    // ⚠️ 전제 재실측 의무(round90-scout #3 ⓕ): 축을 켠 **뒤에** 다시 재고, 갈리면 그 갈림이 값이다.
    const spotOf = (id: string) => LEDGER_BLIND_SPOTS.find((entry) => entry.id === id);

    // ① tsx-components — 종전 141(라운드 88~90), 토스 라운드 T1·T6이 ui.tsx에 export function 둘
    // (SheetMountTransition · LoadErrorCard)을 더해 143이 됐고(두 시점), 토스 리뷰가 홈 히어로의
    // 카운트업 사본을 걷으며 AmountCountUpText를 export로 열어 오늘 144다(두 시점 — 소비자 실재,
    // 대장 value도 함께 144로 적음).
    expect(spotOf("tsx-components")?.value, "적어 둔 값").toBe(144);
    expect(tsxExportFunctionCount(), "오늘 다시 잰 값 — 갈리면 그 수가 값이다").toBe(144);

    // ② common-name — 종전 226(라운드 89 C) → 229(기능 라운드 1), 토스 라운드 T2가 홈의 삼항
    // `HOME_SECTIONS_COLLAPSE_LABEL : …`을 걷어 오늘 228(두 시점 — 그물이 삼항의 `:`를 키로 오독하던
    // 표면이 준 것이고, 줄어든 쪽도 값이다. 대장 value도 함께 228로 내려 적음).
    expect(spotOf("common-name")?.value, "적어 둔 값").toBe(228);
    expect(namesAlsoUsedAsProperty().length, "오늘 다시 잰 값").toBe(228);
    expect(spotOf("common-name")?.statement, "77 → 226이 왜 갈렸는지").toContain("77");

    // ③ derived-exemptions의 **절반 문턱** — 라운드 89는 40 중 18(여유 둘)이었다.
    // ⚠️ 축을 켠 뒤 다시 재니 44 중 22다: 분자와 분모가 함께 넷씩 늘어 **여유가 0**이 됐다.
    expect(spotOf("derived-exemptions")?.value, "면제 수").toBe(exemptions.length);
    expect(exemptions.length, "오늘의 면제 수").toBe(22);
    expect(dead.length, "오늘의 사문 전수").toBe(44);
    // ⚠️ 라운드 90 리뷰 M-4: *"면제 × 2 = 사문 전수"* 를 등호로 고정하던 줄을 지웠다 — 오늘의
    // 등호는 **우연**(분자와 분모가 마침 넷씩 함께 늘었다)이고, 우연의 등호는 정당한 변화
    // (사문 하나가 늘거나 면제 하나가 줄어드는 흔한 걸음)에 **거짓 빨강**을 낸다. 이 자리가
    // 지켜야 하는 것은 등호가 아니라 아래 **문턱 판정**이고, 그것은 그대로 남아 있다.
    // ⚠️⚠️ **문턱은 '절반 초과'이지 '절반 도달'이 아니다** — 그래서 오늘 판정을 좁히지 않는다.
    // 이 단언이 그 판정을 값으로 들고 있고, 면제가 하나만 더 늘면 여기가 먼저 빨개진다.
    expect(
      exemptions.length * 2 > dead.length,
      "면제 수가 사문 전수의 절반을 **넘었어요** — 재개 조건이 발동했습니다(판정을 좁힐 라운드입니다)"
    ).toBe(false);
    expect(spotOf("derived-exemptions")?.statement, "여유가 0이라는 사실이 값으로 적혀 있어야 해요").toContain(
      "여유 0"
    );

    // ④ 새로 연 사각도 같은 자리에서 다시 잰다(값 없이 열지 않는다).
    // 두 시점: 55(라운드 89·90) → 56 — T1의 useReducedMotion은 파일 이름이 export 이름과 같아
    // import 경로 문자열이 그 이름을 담는다(코드 참조가 함께 있어 판정은 움직이지 않았다).
    expect(spotOf("string-keyed-dynamic-access")?.value, "적어 둔 값").toBe(56);
    expect(namesReferencedInsideStringLiterals().length, "오늘 다시 잰 값").toBe(56);

    // ⑤ 라운드 90 리뷰 M-3이 연 자리 — **스캐너의 오탐 표면**도 값과 실피해를 함께 든다.
    // 두 시점: 105(라운드 90) → 106 — T1의 use-transient-notice.ts가 ASCII '를 지닌 채 호출부에 들어왔다.
    expect(spotOf("jsx-apostrophe-string-masking")?.value, "적어 둔 표면").toBe(106);
    expect(apostropheBearingCallsiteFiles().length, "오늘 다시 잰 표면").toBe(106);
    // ⚠️ 이 등호는 우연이 아니다(M-4의 그 등호와 다르다): 0을 넘는 날 사문 판정 하나가 **거짓
    // 빨강**이므로, 빨개지는 것이 곧 알려야 할 사실이다. 그때의 답은 대장에 줄을 더하는 것이
    // 아니라 이 스캐너가 JSX 텍스트를 코드와 가르는 것이다.
    expect(
      apostropheMaskedCodeSites(),
      "어포스트로피 짝이 코드를 지운 자리가 생겼어요 — 그 자리의 사문 판정은 거짓 빨강입니다"
    ).toEqual([]);

    // 그리고 함수 축은 오늘도 열여섯이다 — 늘어난 것이 **함수 축의 부채가 아님**을 값으로 못 박는다.
    expect(findDeadExportsOfKind("function").length, "함수 축의 사문 수가 라운드 88과 갈렸어요").toBe(16);
    expect(collectExportedFunctions().length, "함수 축의 모집단").toBeGreaterThan(600);
    for (const spot of LEDGER_BLIND_SPOTS) {
      if (spot.value > 0) expect(spot.statement, `${spot.id}의 문장이 값을 말하지 않아요`).toMatch(/\d/);
    }
  });

  it("`export const` 축이 **모집단 안에 있다**는 사실이 파생 면제와 함께 값으로 선다", () => {
    const spot = LEDGER_BLIND_SPOTS.find((entry) => entry.id === "derived-exemptions");
    expect(spot?.value, "면제의 크기").toBe(exemptions.length);
    expect(spot?.statement, "면제 사각의 재개 조건").toContain("재개 조건");
    for (const module of exemptionModules) {
      // 실재 확인 — 없는 파일을 근거로 든 순간 결정 ③은 근거를 잃는다.
      expect(() => readRepoFile(module), `${module}가 없어요`).not.toThrow();
      expect(
        collectExportedConstants().some((item) => item.file === module),
        `${module}에 export const가 0건이에요`
      ).toBe(true);
    }
  });

  it("이름 훑기의 사각이 오늘의 스물둘을 오염시키지 않았다", () => {
    // ⚠️ 흔한 이름 사각은 **사문을 놓치는 쪽**의 오차다(거짓 초록). 스물둘은 참조가 0건이라
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
    // 이 계약 파일과 대장 파일에는 스물둘의 이름이 전부 문자열로 실려 있다 — 그것이 참조로
    // 읽히면 스물둘이 통째로 사라진다. 위 배제가 그 자리를 막고 있음을 값으로 확인한다.
    const selfSource = readRepoFile(LEDGER_SELF_FILES[0]);
    expect(selfSource).toContain("getQueuedAnalyticsEventCount");
    expect(selfSource).toContain("SYNC_STATUS_RETRY_ALL_LABEL");
    expect(dead.some((item) => item.name === "getQueuedAnalyticsEventCount")).toBe(true);
    expect(dead.some((item) => item.name === "SYNC_STATUS_RETRY_ALL_LABEL")).toBe(true);
  });
});

describe("ⓖ 마스킹 — 참조를 셀 때 주석이 지워진다(라운드 88 트랙 D)", () => {
  it("한 갈래씩: 주석은 지우고, 주석처럼 생긴 코드는 지우지 않는다", () => {
    // ⚠️ 이 갈래별 확인의 대상은 `maskComments`다 — 라운드 90부터 **그물**은 문자열까지 지우지만,
    // 주석 축만 따로 무는 자리는 여기 남는다(두 축을 한 낱말로 뭉개지 않는다 · ⓘ가 문자열 축을 문다).
    // ⚠️ 손으로 세운 조각으로 확인하는 이유: 저장소 전체로 재면 *"오늘 아무 일도 안 났다"* 밖에
    // 알 수 없다. 여기서 물어야 하는 것은 **어떤 갈래에서 그물이 죽는가**이다.
    const source = [
      'const a = "http://keep.example/one"; // 주석의 hiddenName',
      "/* 블록 주석의 hiddenName */ const b = keptName;",
      "const c = `템플릿의 hiddenName ${keptName} 뒤`;",
      'const d = /a\\/\\/b/.test("string의 hiddenName");',
      "const e = <span>http:// 또는 https:// 로 시작해요 {keptName}</span>;"
    ].join("\n");
    const masked = maskComments(source);

    // 길이·줄이 보존된다(참조 자리 계산이 마스킹 뒤에도 같은 답을 낸다).
    expect(masked.length).toBe(source.length);
    expect(masked.split("\n").length).toBe(source.split("\n").length);
    // 주석 안의 이름은 사라진다 — 줄 주석 · 블록 주석 둘 다.
    expect(masked).not.toContain("hiddenName */");
    expect((masked.match(/hiddenName/g) ?? []).length, "주석 안의 이름이 남았거나 코드가 지워졌어요").toBe(2);
    // 남아야 하는 둘: 문자열 안(문자열은 오늘 마스킹하지 않는다)과 템플릿 안.
    expect(masked).toContain("string의 hiddenName");
    expect(masked).toContain("템플릿의 hiddenName");
    // 코드는 한 글자도 잃지 않는다 — 템플릿 `${…}` · 정규식 리터럴 · JSX 텍스트의 `http://`.
    expect((masked.match(/keptName/g) ?? []).length, "진짜 코드가 마스킹됐어요").toBe(3);
    expect(masked).toContain("http://keep.example/one");
    expect(masked, "JSX 텍스트의 http:// 뒤가 주석으로 읽혔어요").toContain("로 시작해요 {keptName}");
    expect(masked, "정규식 리터럴 안의 `//`가 주석으로 읽혔어요").toContain("/a\\/\\/b/.test(");

    // ⚠️⚠️ **라운드 90부터 문자열까지 지우는 자가 곧 그물이다** — 그 갈림도 값으로 확인한다.
    const both = maskCommentsAndStrings(source);
    expect(both).not.toContain("string의 hiddenName");
    expect(both, "문자열을 지우는 자가 템플릿 `${…}` 안의 코드까지 지웠어요").toContain("${keptName}");
    expect(both.length, "문자열 마스킹이 길이를 바꿨어요 — 참조 자리 계산이 어긋납니다").toBe(source.length);
    expect(both.split("\n").length, "문자열 마스킹이 줄 수를 바꿨어요").toBe(source.split("\n").length);
    // ⚠️ 문자열 안의 이름은 사라지고(hiddenName은 템플릿 조각 하나만 남는다), 코드는 그대로다.
    expect(both).not.toContain("템플릿의 hiddenName");
    expect((both.match(/keptName/g) ?? []).length, "문자열 마스킹이 진짜 코드를 지웠어요").toBe(3);
  });

  it("마스킹이 없었다면 **오늘 사문 마흔 중 스물이** 조용히 사라졌다", () => {
    // ⚠️ 라운드 88의 순서(마스킹 먼저 · 주석 나중)가 왜 계약이었는지를, 축을 넓힌 오늘 한 번 더
    // 값으로 남긴다. 라운드 88의 이 수는 아홉이었고 오늘은 스물이다 — 상수 축이 들어오며 열하나가
    // 더해졌다(계약 전용 데이터 표들은 자기 이름을 주석으로 설명하는 것이 관례라서 그렇다).
    // ⚠️⚠️ **라운드 90 트랙 C의 정정**: 이 셈의 기준은 오늘의 그물(44)이 아니라 **주석만 지우던
    // 그물(40)** 이다 — 새 그물 위에서 세면 이 수가 *'주석뿐'* 이 아니라 *'주석이나 문자열뿐'* 이
    // 되어 24가 되고, 주석 축 20과 문자열 축 4가 한 낱말로 뭉개진다.
    const sources = readCallsiteSources();
    const commentMaskedDead = deadBeforeStringMasking;
    const rawDead = population.filter((item) => findRawProductReferences(item, sources).length === 0);
    expect(commentMaskedDead.length, "주석 마스킹판의 사문 수").toBe(40);
    expect(dead.length, "오늘의 그물(주석 + 문자열)의 사문 수").toBe(44);
    expect(
      rawDead.length,
      "옛 그물(마스킹 없음)로 재도 수가 같아요 — 이유 주석이 이름을 부르지 않고 있습니다"
    ).toBeLessThan(commentMaskedDead.length);

    const vanished = commentMaskedDead
      .filter((item) => !rawDead.some((raw) => raw.id === item.id))
      .map((item) => item.id);
    expect(vanished.length, "마스킹이 없었다면 사라졌을 항목 수").toBe(20);
    // 라운드 88이 못 박은 아홉은 오늘도 그 안에 그대로 있다(함수 축이 움직이지 않았다는 값).
    for (const id of [
      "apps/admin/src/lib/admin-api.ts:updateContentRevisionDraft",
      "apps/mobile/src/analytics/client.ts:getQueuedAnalyticsEventCount",
      "apps/mobile/src/auth/release-build.ts:isRealUserBuild",
      "apps/mobile/src/consent/consent-definitions.ts:hasPendingRequiredConsents",
      "apps/mobile/src/consent/legal-links.ts:legalDocumentUrl",
      "apps/mobile/src/import/preview-rows.ts:canBulkSelectImportRows",
      "apps/mobile/src/notifications/notification-preferences.store.ts:notificationTypeLabel",
      "apps/mobile/src/offline/offline-aware-screens.ts:usesOfflineAwareLoadErrorCopy",
      "apps/mobile/src/settings/support-links.ts:supportLinkUrl"
    ]) {
      expect(vanished, `라운드 88이 못 박은 ${id}가 오늘 목록에서 빠졌어요`).toContain(id);
    }
    // 같은 스물을 사각의 재측정자도 집어 든다(사각의 값이 산문이 아니라 이 실행에서 나온다).
    expect(commentOnlyReferenceExports().map((item) => item.id).sort()).toEqual(vanished.sort());
    const spot = LEDGER_BLIND_SPOTS.find((entry) => entry.id === "comment-and-string-references");
    expect(spot?.value, "사각의 값이 오늘의 재측정과 갈렸어요").toBe(vanished.length);
    expect(spot?.measure, "이 사각은 이제 0이 아니다 — 다시 재는 자가 붙어야 해요").toBeTypeOf("function");
  });

  it("주석에만 참조가 있는 사문을 심으면 그물이 그것을 사문으로 집어 든다", () => {
    // ⚠️ 교란: 마스킹이 없으면 이 항목은 **호출부 1건**으로 읽혀 조용히 사라진다. 제품 소스에는
    // 손대지 않고 임시 뿌리에서 재현한다.
    const base = makeFixtureRoot("dead-export-ledger-comment-");
    try {
      writeFileSync(
        join(base, "apps/mobile/src/fixture/commented.ts"),
        "// 화면이 commentedFixtureJudgement를 부르지 않는 이유를 적은 주석이다.\n" +
          "export function commentedFixtureJudgement(): boolean {\n  return false;\n}\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        "/* commentedFixtureJudgement 를 인용만 하는 화면 주석 */\nexport default function Screen() {\n  return null;\n}\n",
        "utf8"
      );

      const sources = new Map([
        ["apps/mobile/src/fixture/commented.ts", readRepoFile("apps/mobile/src/fixture/commented.ts", base)],
        ["apps/mobile/app/screen.tsx", readRepoFile("apps/mobile/app/screen.tsx", base)]
      ]);
      const item = findDeadExports(base).find((entry) => entry.name === "commentedFixtureJudgement");
      expect(item, "주석에만 인용된 사문을 놓쳤어요 — 마스킹이 새고 있습니다").toBeDefined();
      // 그리고 옛 그물로 재면 **호출부 2건**이라 사문이 아니다 — 그 갈림이 이 트랙의 값이다.
      expect(findRawProductReferences(item as ExportedFunction, sources).length).toBeGreaterThan(0);
      expect(findProductReferences(item as ExportedFunction, sources)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("ⓘ 문자열 리터럴 축 — 글자는 지우고 템플릿 `${…}`는 코드로 남긴다 (라운드 90 트랙 C)", () => {
  /**
   * ⚠️⚠️ **합성 소스**(계약 ⓐ) — 오늘 저장소에 이 모양이 없어도 계약은 이 갈래를 물어야 한다.
   *
   * 두 이름이 각각 한 갈래를 진다. `templateOnlyCallsite`는 선언 줄을 빼면 **오직 템플릿 `${…}`
   * 안에서만** 불리고(진짜 호출부 — 결정 ①의 *'자기 파일까지 포함'*), `spokenOnlyInsideAString`은
   * 화면의 **문자열 글자로만** 이름이 나온다(호출부가 아니다). 그물이 옳으면 앞의 하나는 살고
   * 뒤의 하나만 사문이다 — **한 조각이 두 갈래를 동시에 문다.**
   */
  const MODULE_SOURCE =
    "export function templateOnlyCallsite(count: number): string {\n" +
    "  return String(count);\n" +
    "}\n" +
    "\n" +
    "export function spokenOnlyInsideAString(): string {\n" +
    '  return "값";\n' +
    "}\n" +
    "\n" +
    "export function summaryLine(count: number): string {\n" +
    "  return `검색 결과 ${templateOnlyCallsite(count)} 건`;\n" +
    "}\n";
  const SCREEN_SOURCE =
    'import { summaryLine } from "../src/fixture/template";\n' +
    "\n" +
    "export default function Screen() {\n" +
    '  const note = "spokenOnlyInsideAString 는 문장 안에서만 이름이 불린다";\n' +
    "  return summaryLine(3) + note;\n" +
    "}\n";

  it("⚠️ 문자열의 글자는 지워지고, 템플릿 `${…}` 안의 이름은 **코드로 남는다**", () => {
    const maskedModule = maskCommentsAndStrings(MODULE_SOURCE);
    expect(maskedModule, "템플릿 `${…}` 안의 호출이 지워졌어요 — 살아 있는 호출부가 사라집니다").toContain(
      "${templateOnlyCallsite(count)}"
    );
    // 템플릿의 **문자열 조각**(`검색 결과 `·` 건`)은 글자이므로 지워진다 — `${…}`만 남는다.
    expect(maskedModule).not.toContain("검색 결과");
    expect(maskedModule, "따옴표 문자열의 글자도 지워진다").not.toContain('"값"');

    const maskedScreen = maskCommentsAndStrings(SCREEN_SOURCE);
    expect(maskedScreen, "문자열의 글자가 남았어요 — 문장 속 이름이 호출부로 세어집니다").not.toContain(
      "spokenOnlyInsideAString"
    );
    expect(maskedScreen, "import 지정자 밖의 진짜 코드는 남는다").toContain("summaryLine(3)");

    // 길이·줄이 보존된다(참조 자리 계산이 마스킹 뒤에도 같은 답을 낸다).
    for (const [raw, masked] of [
      [MODULE_SOURCE, maskedModule],
      [SCREEN_SOURCE, maskedScreen]
    ] as const) {
      expect(masked.length).toBe(raw.length);
      expect(masked.split("\n").length).toBe(raw.split("\n").length);
    }
  });

  it("⚠️⚠️ 그물이 **합성 소스 위에서** 둘을 가른다 — 템플릿은 살고 문자열만 사문이다", () => {
    const base = makeFixtureRoot("dead-export-ledger-template-");
    try {
      writeFileSync(join(base, "apps/mobile/src/fixture/template.ts"), MODULE_SOURCE, "utf8");
      writeFileSync(join(base, "apps/mobile/app/screen.tsx"), SCREEN_SOURCE, "utf8");

      const found = findDeadExports(base).map((item) => item.name);
      expect(
        found,
        "템플릿 `${…}` 안의 호출부를 놓쳤어요 — 마스킹이 진짜 코드를 지우고 있습니다(거짓 빨강)"
      ).not.toContain("templateOnlyCallsite");
      expect(
        found,
        "문장 안에서만 이름이 불리는 export를 사문으로 집어 들지 못했어요 — 문자열 축이 새고 있습니다"
      ).toContain("spokenOnlyInsideAString");

      // ⚠️ 그리고 **마스킹 전에는 둘 다 사문이 아니었다** — 이 갈림이 이 라운드가 더한 것 전부다.
      const before = findDeadExportsBeforeStringMasking(base).map((item) => item.name);
      expect(before, "옛 그물은 문장 속 이름을 호출부로 셌다").not.toContain("spokenOnlyInsideAString");
      expect(before).not.toContain("templateOnlyCallsite");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("⚠️⚠️ 교란 — 템플릿 갈래를 **통째로 지우는** 옛 마스킹으로 되돌리면 살아 있는 호출부가 사문이 된다", () => {
    // ⚠️ 이 자리가 명세의 이중 경고다: 문자열 마스킹이 `${…}` 안을 지우면 **사문이 거짓으로 는다**.
    // 그 되돌림을 여기서 재현한다 — 템플릿을 통째로 공백으로 바꾸는 순진한 마스킹.
    const naive = MODULE_SOURCE.replace(/`[^`]*`/g, (match) => " ".repeat(match.length));
    const masked = maskCommentsAndStrings(MODULE_SOURCE);
    const count = (source: string) => (source.match(/templateOnlyCallsite/g) ?? []).length;

    // 옛 마스킹판에서는 **선언 줄 하나만** 남는다 = 호출부 0건 = 사문(거짓 빨강).
    expect(count(naive), "이 교란이 아무것도 지우지 않았어요 — 재현이 죽으면 계약은 영원히 초록입니다").toBe(1);
    expect(naive).not.toContain("${templateOnlyCallsite(count)}");
    // 오늘의 마스킹판에서는 선언 + 템플릿 안의 호출 **둘**이다 = 호출부 1건 = 사문이 아니다.
    expect(count(masked), "오늘의 마스킹이 템플릿 안의 호출을 지웠어요").toBe(2);
    expect(count(masked)).toBeGreaterThan(count(naive));

    // ⚠️ 그리고 그 갈림이 **판정을 뒤집는다**는 것을 임시 뿌리에서 값으로 보인다.
    const base = makeFixtureRoot("dead-export-ledger-naive-");
    try {
      writeFileSync(join(base, "apps/mobile/src/fixture/template.ts"), naive, "utf8");
      writeFileSync(join(base, "apps/mobile/app/screen.tsx"), SCREEN_SOURCE, "utf8");
      expect(
        findDeadExports(base).map((item) => item.name),
        "템플릿을 통째로 지운 소스에서는 살아 있는 호출부가 사문이 된다 — 그 되돌림이 이 계약의 빨강이다"
      ).toContain("templateOnlyCallsite");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("⚠️ 저장소에서도 같은 갈래가 산다 — 넷 말고는 판정이 움직이지 않았다", () => {
    // ⚠️ 합성 소스가 갈래를 증명하고, 이 단언이 **그 갈래가 저장소에서 사고를 내지 않았음**을 센다.
    // 문자열 안에 참조가 있는 이름 56(두 시점: 라운드 89·90의 55 → 토스 라운드 T1의 useReducedMotion이
    // import 경로 문자열로 하나 더함) 가운데 판정이 움직인 것은 넷뿐이다(나머지는 코드 참조를 함께 갖는다).
    const names = namesReferencedInsideStringLiterals();
    expect(names.length, "문자열 안에 이름이 나오는 모집단 이름 수").toBe(56);
    const moved = stringOnlyReferenceExports();
    expect(moved.length, "그중 판정이 움직인 자리").toBe(4);
    expect(
      moved.every((item) => names.includes(item.name)),
      "판정이 움직인 자리가 문자열 사각의 모집단 밖이에요"
    ).toBe(true);
    // ⚠️ 그리고 그 넷은 대장의 줄을 요구하지 않는다 — 오늘의 실피해가 0이라는 값이다.
    expect(moved.filter((item) => ledgerRequired.some((entry) => entry.id === item.id))).toEqual([]);
  });

  it("⚠️⚠️ 스캐너의 오탐 표면 — JSX 텍스트의 어포스트로피 **짝**은 코드를 지운다(라운드 90 리뷰 M-3)", () => {
    // ⚠️ **합성 소스로 증명한다**(계약 ⓐ의 형식): 저장소에 오늘 그 모양이 0건이어도, 이 그물이
    // 그 갈래에서 무엇을 하는지는 여기서 값으로 선다.
    const oneApostrophe = "<Text>Don't stop {renderFooter()} now</Text>";
    const twoApostrophes = "<Text>Don't stop {renderFooter()} it's fine</Text>";

    // ⓐ 한 줄에 **하나**면 줄바꿈에서 문자열이 아님이 드러나 아무것도 지워지지 않는다(한 줄 가두기).
    expect(maskCommentsAndStrings(oneApostrophe), "한 줄 가두기가 깨졌어요").toBe(oneApostrophe);
    // ⓑ **짝으로** 서면 그 사이의 진짜 코드가 공백이 된다 — 오차의 방향이 **거짓 빨강**이다.
    expect(
      maskCommentsAndStrings(twoApostrophes),
      "어포스트로피 짝이 코드를 지우지 않게 되었다면 이 사각은 닫힌 것이고, 그 줄을 CLOSED_BLIND_SPOTS로 옮기세요"
    ).not.toContain("renderFooter");
    // ⓒ 주석만 지우는 옛 자에서는 그 코드가 살아 있었다 — 방향이 라운드 90에 뒤집혔다는 근거.
    expect(maskComments(twoApostrophes), "옛 그물은 글자를 지우지 않았다").toContain("renderFooter");
    // ⓓ 길이·줄은 여전히 보존된다(손상이 그 줄 안에 갇힌다).
    expect(maskCommentsAndStrings(twoApostrophes).length).toBe(twoApostrophes.length);

    // ⓔ **저장소의 실피해는 0건**이고, 사각이 지는 것은 그 위의 **표면**이다.
    const spot = LEDGER_BLIND_SPOTS.find((entry) => entry.id === "jsx-apostrophe-string-masking");
    expect(spot?.statement, "사각의 문장이 실피해를 값으로 말해야 해요").toContain("실피해는 0건");
    expect(apostropheMaskedCodeSites(), "오늘의 실피해").toEqual([]);
    expect(spot?.value, "적어 둔 표면").toBe(apostropheBearingCallsiteFiles().length);
    expect(apostropheBearingCallsiteFiles().length, "표면이 호출부 전수보다 클 수 없다").toBeLessThan(
      collectCallsiteFiles().length
    );
  });
});

describe("교란 — 사문이 하나 늘면 실제로 빨개진다", () => {
  it("임시 뿌리에 사문 하나를 심으면 걷기가 그것을 집어 든다", () => {
    // ⚠️ **제품 소스에는 손대지 않는다.** 임시 디렉터리에 뿌리 모양만 세우고 거기서 재현한다
    // (물지 못하는 스윕은 영원히 초록이고, 그 사실은 아무도 모른다).
    const base = makeFixtureRoot("dead-export-ledger-");
    try {
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

      const found = findDeadExports(base).map((item) => item.name);
      expect(found, "심어 둔 사문을 집어 들지 못했어요 — 그물이 죽어 있습니다").toContain("deadFixtureJudgement");
      expect(found, "화면이 부르는 판정까지 사문으로 셌어요 — 거짓 빨강입니다").not.toContain("liveFixtureJudgement");

      // ⚠️ 그리고 **계약 ⓒ·ⓓ가 실제로 이 모집단 위에서 빨갛다**는 것을 값으로 보인다 —
      // 걷기만 확인하고 판정을 확인하지 않으면 "물었다"고 말할 수 없다.
      const ledgerIds = DEAD_EXPORT_LEDGER.map((entry) => entry.id);
      const perturbed = ledgerRequiredDeadExports(base);
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

  it("⚠️ **새 `export const` 사문**을 심어도 잡히고, 면제 근거가 없으면 대장을 요구한다", () => {
    const base = makeFixtureRoot("dead-export-ledger-const-");
    try {
      writeFileSync(
        join(base, "apps/mobile/src/fixture/constants.ts"),
        "export const DEAD_FIXTURE_CONSTANT = 3;\nexport const LIVE_FIXTURE_CONSTANT = 4;\n",
        "utf8"
      );
      writeFileSync(
        join(base, "apps/mobile/app/screen.tsx"),
        'import { LIVE_FIXTURE_CONSTANT } from "../src/fixture/constants";\n' +
          "export default function Screen() {\n  return LIVE_FIXTURE_CONSTANT;\n}\n",
        "utf8"
      );

      const perturbedDead = findDeadExports(base);
      expect(
        perturbedDead.map((item) => item.name),
        "심어 둔 `export const` 사문을 집어 들지 못했어요 — 새 축의 그물이 죽어 있습니다"
      ).toContain("DEAD_FIXTURE_CONSTANT");
      expect(perturbedDead.map((item) => item.name), "화면이 쓰는 상수까지 사문으로 셌어요").not.toContain(
        "LIVE_FIXTURE_CONSTANT"
      );
      // 그 모듈은 화면이 import하므로 번들 밖이 아니고, 값은 숫자라 자리 표도 아니다 → **대장을 요구한다.**
      const required = ledgerRequiredDeadExports(base).map((item) => item.name);
      expect(required, "근거 없는 새 상수 사문이 조용히 면제됐어요").toContain("DEAD_FIXTURE_CONSTANT");
      expect(contractOnlyExemptions(base), "이 교란에는 면제할 자리가 없어야 해요").toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("같은 파일 안에서만 쓰이는 export는 사문이 아니다(결정 ①의 '자기 파일까지 포함')", () => {
    const base = makeFixtureRoot("dead-export-ledger-self-");
    try {
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

      expect(findDeadExports(base).map((item) => item.name)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
