// 라운드 85 트랙 E (GAP-085 #5) — DNC-016 부정 스윕의 계약.
//
// 스윕 자체의 설명(왜 모집단을 먼저 정하는가 · 뿌리 아홉 · 면제 하나 · 이 그물의 한계)은
// `dnc-scope-guard.ts` 머리말에 있다. 이 파일이 묻는 것은 일곱이다.
//  ⓐ **뿌리** — 뿌리 아홉의 경로가 **실재**하고, 각각이 실제로 이름을 내놓으며, 이유가 비어 있지 않다.
//     (⚠️ 손으로 배열한 목록은 뿌리가 아니다 — 확인되지 않는 뿌리 위에서는 모든 부정 단언이 통과한다.)
//  ⓑ **여섯** — 항목마다 **독립된 단언**이 선다(한 덩어리 정규식 하나가 아니다 — 어느 항목이 깨졌는지
//     말하지 못하는 그물은 그 순간 사람에게 다시 조사를 시킨다).
//  ⓒ **여섯이 문서에서 온다** — `docs/dev/do-not-change.md`의 DNC-016 행에서 파싱한 문구와 대조한다.
//  ⓓ **면제** — 오늘 걸리는 둘이 이유·재개 조건과 함께 서 있고, **그 이유가 참인지를 소스로 확인한다**
//     (이력 테이블 부재 · 주기 잡 부재). 유령 면제(걸리지도 않는 줄)도 함께 막는다.
//  ⓔ **바늘이 실제로 문다** — 항목마다 가짜 이름 하나를 모집단에 섞어 빨개지는 것을 보이고,
//     디렉터리 뿌리 하나는 **임시 파일을 실제로 만들어** 끝에서 끝까지 재현한다.
//  ⓕ **DNC-001 판정** — 이 스윕이 그 조항의 세 축 중 몇을 걷는지를 값으로 답한다(오늘 셋 중 하나).
//  ⓖ **자기 참조 금지** — 스윕이 자기 파일을 모집단에 넣지 않는다.
//
// ⚠️ 이 트랙은 **조항 문서를 고치지 않았고**(개정은 승인 절차다), **제품 소스를 0건 고쳤다**
// (스윕은 `apps/**`와 스키마를 읽기만 한다).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DNC_CONTRACT_PATH as LEDGER_CONTRACT_PATH } from "./dnc-guard-ledger";
import {
  DNC_001_POSITION_AXES,
  DNC_001_SWEEP_VERDICT,
  DNC_CONTRACT_PATH,
  OUT_OF_SCOPE_SIX,
  SCOPE_ROOTS,
  SWEEP_SELF_FILES,
  type ScopeName,
  collectRouteNames,
  collectSchemaNames,
  collectScopeNames,
  collectWorkerJobNames,
  describeViolation,
  findScopeHits,
  findScopeViolations,
  manifestPaths,
  parseOutOfScopePhrases,
  readRepoFile,
  scannedFiles,
  schedulerJobImportPaths,
  scopeFailureHint,
  sweptPositionAxes,
  tsFilesUnder,
  workerSourceFiles
} from "./dnc-scope-guard";

/** 모집단 — 이 파일의 모든 판정이 여기서 나온다(한 번만 걷는다). */
const names: readonly ScopeName[] = collectScopeNames();

function namesOfKind(kind: ScopeName["kind"]): string[] {
  return names.filter((name) => name.kind === kind).map((name) => name.name);
}

describe("ⓐ 뿌리 — 경로가 실재하고, 이유가 있고, 실제로 이름을 내놓는다", () => {
  it("뿌리 아홉이 서로 다른 종류이고 각각 이유를 지고 있다", () => {
    // ⚠️ 라운드 85 리뷰 L-8: 종전에는 `toBeGreaterThan(0)`뿐이라 뿌리 수가 줄어도 초록이었고,
    // 다섯 자리의 산문은 실제 아홉을 두고 "여덟"이라고 적고 있었다(열거형 값 뿌리가 라운드 85
    // 트랙 E에서 늘 때 산문만 안 따라온 것이다). 이제 **수를 값으로 못 박아** 산문과 함께 움직인다.
    expect(SCOPE_ROOTS.length, "뿌리 수가 바뀌었어요 — 이 파일과 dnc-scope-guard.ts의 산문('아홉')도 함께 고치세요").toBe(9);
    expect(SCOPE_ROOTS.map((root) => root.kind).sort()).toEqual([...new Set(SCOPE_ROOTS.map((r) => r.kind))].sort());
    for (const root of SCOPE_ROOTS) {
      expect(root.reason.trim().length, `${root.kind} 뿌리의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      expect(root.unit.trim().length, `${root.kind} 뿌리의 단위가 비어 있어요`).toBeGreaterThan(0);
    }
  });

  for (const root of SCOPE_ROOTS) {
    it(`${root.kind}: 뿌리 ${root.path}가 실재하고 이름이 0건이 아니다`, () => {
      // 실재 확인 — 읽기가 던지면 그 자체가 판정이다(뿌리가 옮겨 갔거나 사라졌다).
      expect(scannedFiles().some((file) => file === root.path || file.startsWith(`${root.path}/`))).toBe(true);
      expect(
        namesOfKind(root.kind).length,
        `${root.kind} 뿌리가 이름을 하나도 못 걷었어요(${root.path}) — 빈 모집단 위에서는 아래 부정 단언 여섯이 전부 통과해요`
      ).toBeGreaterThan(0);
    });
  }

  it("걷어 온 이름이 실제 저장소의 것이다 (닻 여섯으로 확인한다)", () => {
    // 파서가 조용히 엉뚱한 것을 세면 모집단은 커도 그물은 없다. 뿌리마다 오늘 반드시 있는 이름
    // 하나씩을 닻으로 둔다(이 여섯이 사라지는 변경은 그 자체로 이 파일을 다시 보게 만드는 변경이다).
    expect(namesOfKind("schema-table")).toContain("product_links");
    expect(namesOfKind("schema-enum-value")).toContain("product_platform.coupang");
    expect(namesOfKind("schema-column")).toContain("product_links.price_snapshot_krw");
    expect(namesOfKind("api-endpoint")).toContain("product-links");
    expect(namesOfKind("mobile-route")).toContain("(tabs)/items.tsx");
    expect(namesOfKind("admin-route")).toContain("items/page.tsx");
    expect(namesOfKind("dependency")).toContain("expo");
    expect(namesOfKind("worker-job")).toContain("link_health");
  });

  it("의존성 뿌리가 워크스페이스 전수를 읽는다 (매니페스트를 손으로 적지 않는다)", () => {
    const manifests = manifestPaths();
    expect(manifests).toContain("package.json");
    for (const workspace of ["apps/api", "apps/mobile", "apps/admin", "packages/test-utils"]) {
      expect(manifests, `${workspace}의 매니페스트가 모집단 밖이에요`).toContain(`${workspace}/package.json`);
    }
  });
});

describe("ⓑ 여섯 — 항목마다 자기 뿌리와 바늘로 독립해서 선다", () => {
  it("여섯이 서로 다른 id를 갖고, 각각 뿌리·바늘·이유를 지고 있다", () => {
    expect(OUT_OF_SCOPE_SIX.length).toBe(6);
    expect([...new Set(OUT_OF_SCOPE_SIX.map((item) => item.id))].length).toBe(6);
    for (const item of OUT_OF_SCOPE_SIX) {
      expect(item.roots.length, `${item.id}의 뿌리가 비어 있어요`).toBeGreaterThan(0);
      expect(item.needles.length, `${item.id}의 바늘이 비어 있어요`).toBeGreaterThan(0);
      expect(item.rootsReason.trim().length, `${item.id}의 뿌리 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      for (const kind of item.roots) {
        expect(
          SCOPE_ROOTS.map((root) => root.kind),
          `${item.id}가 뿌리 목록에 없는 종류(${kind})를 가리켜요`
        ).toContain(kind);
      }
      for (const needle of item.needles) {
        expect(needle.label.trim().length, `${item.id}의 바늘에 이름이 없어요`).toBeGreaterThan(0);
        // 뿌리 밖으로 좁혀진 바늘은 한 번도 돌지 않으면서 "이미 막아 둔 자리"로 읽힌다.
        for (const kind of needle.kinds ?? []) {
          expect(
            item.roots,
            `${item.id}의 바늘 "${needle.label}"이 이 항목의 뿌리 밖(${kind})으로 좁혀져 있어요 — 한 번도 돌지 않아요`
          ).toContain(kind);
        }
      }
    }
  });

  for (const item of OUT_OF_SCOPE_SIX) {
    it(`${item.id}(${item.clausePhrase}): 뿌리 ${item.roots.join(" · ")}에 이 항목의 이름이 0건이다`, () => {
      const violations = findScopeViolations(item, names);

      expect(violations.map(describeViolation), scopeFailureHint(item)).toEqual([]);
    });
  }
});

describe("ⓒ 여섯을 손으로 적지 않는다 — 조항 문서의 DNC-016 행에서 읽는다", () => {
  it("스윕과 대장이 같은 문서를 가리킨다", () => {
    expect(DNC_CONTRACT_PATH).toBe(LEDGER_CONTRACT_PATH);
  });

  it("여섯의 문구가 문서에서 파싱한 여섯과 글자 그대로 같다", () => {
    const parsed = parseOutOfScopePhrases(readRepoFile(DNC_CONTRACT_PATH));

    // 실재 확인 — 파싱이 끊어지면 빈 배열 위에서 아래 비교가 조용히 무의미해진다.
    expect(parsed.length, `${DNC_CONTRACT_PATH}의 DNC-016 행을 못 읽었어요 = 파싱이 끊어졌어요`).toBe(6);
    expect(
      OUT_OF_SCOPE_SIX.map((item) => item.clausePhrase),
      "조항의 범위 밖 목록이 바뀌었어요 — 새 항목에는 뿌리와 바늘을 함께 세우세요(문서 개정은 승인 절차예요)"
    ).toEqual(parsed);
  });

  it("여섯의 id가 오늘 이 순서다 (모집단이 조용히 줄지 않는다)", () => {
    // ⚠️ 대장(dnc-guard-ledger.ts)의 DNC-016 행이 이 줄들을 모집단 칸으로 가리킨다 — 항목이
    // 하나 빠지면 이 단언과 대장이 함께 빨개진다(라운드 84 리뷰 H-2의 규율).
    expect(OUT_OF_SCOPE_SIX.map((item) => item.id)).toEqual([
      "photo-receipt-ai",
      "community",
      "price-tracking",
      "used-market",
      "insurance-finance",
      "medical-advice"
    ]);
  });

  it("개정 이력 표의 DNC-016 인용은 규칙 행으로 읽지 않는다", () => {
    const fixture = [
      "| ID | Area | Do Not Change | Reason |",
      "| DNC-016 | Out of Scope | 가나, 다라, 마바은 MVP에 구현하지 않는다. | MVP 집중 |",
      "| v0.9 | 2026-09-01 | DNC-016 | 범위 개정 | … |"
    ].join("\n");

    expect(parseOutOfScopePhrases(fixture)).toEqual(["가나", "다라", "마바"]);
  });
});

describe("ⓓ 면제 — 오늘 걸리는 둘만, 이유와 재개 조건과 증명을 지고 선다", () => {
  const exempted = OUT_OF_SCOPE_SIX.flatMap((item) => item.exemptions.map((exemption) => ({ item, exemption })));

  it("면제는 가격 스냅샷 두 칸뿐이다 (면제 목록은 좁을수록 값이다)", () => {
    expect(exempted.map(({ exemption }) => `${exemption.kind}:${exemption.name}`)).toEqual([
      "schema-column:product_links.price_snapshot_krw",
      "schema-column:product_links.price_checked_at"
    ]);
  });

  for (const { item, exemption } of exempted) {
    it(`${exemption.name}: 이유·재개 조건·증명이 빈 문자열이 아니다`, () => {
      expect(exemption.reason.trim().length, "면제의 이유가 비어 있거나 너무 짧아요").toBeGreaterThan(40);
      expect(exemption.resumeWhen.trim().length, "면제의 재개 조건이 비어 있거나 너무 짧아요").toBeGreaterThan(20);
      expect(exemption.provenBy.trim().length, "면제 이유의 증명이 비어 있어요").toBeGreaterThan(20);
    });

    it(`${exemption.name}: 오늘 실제로 걸리는 자리다 (유령 면제 금지)`, () => {
      // 걸리지도 않는 줄은 아무것도 면제하지 않으면서 "이미 살펴본 자리"로 읽힌다(라운드 78 리뷰 P-1).
      const hits = findScopeHits(item, names);
      expect(
        hits.map((hit) => `${hit.kind}:${hit.name}`),
        `${exemption.name}이 오늘 모집단에서 걸리지 않아요 — 칸이 사라졌거나 이름이 바뀌었다면 이 면제 줄을 지우세요`
      ).toContain(`${exemption.kind}:${exemption.name}`);
    });
  }

  it("면제의 이유가 참이다 ① 행이 쌓이지 않는다 — 가격 이력 테이블이 0건이고 링크의 가격 칸이 둘뿐이다", () => {
    const historyShaped = namesOfKind("schema-table").filter((table) => /price|가격|snapshot|history|이력/.test(table));
    expect(historyShaped, "가격 이력·스냅샷 테이블이 생겼어요 — 그 순간 이 면제는 거둬야 해요").toEqual([]);

    const linkPriceColumns = namesOfKind("schema-column").filter((column) =>
      /^product_links\.[a-z_]*price/.test(column)
    );
    expect(
      linkPriceColumns.sort(),
      "product_links의 가격 칸이 둘보다 늘었어요 — 시간축이 생겼는지 먼저 보세요"
    ).toEqual(["product_links.price_checked_at", "product_links.price_snapshot_krw"]);
  });

  /**
   * ⚠️ **라운드 85 리뷰 M-4 — 이 증명이 주장보다 좁았다.**
   *
   * 면제의 `provenBy`는 *"`apps/api/src/worker` 아래 **어느 파일도** 이 칸 이름을 쓰지 않는다"*
   * 라고 적는데, 종전 확인은 `collectWorkerJobNames`가 걷어 온 `*.job.ts`만 읽었다. 그 아래에는
   * `scheduler.service.ts`·`worker-status.service.ts`·`worker.module.ts`·`worker-job.ts`가 함께
   * 사는데 전부 증명 밖이었고, **주기 갱신을 스케줄러 틱 안에 직접 적으면** 잡 파일이 하나도
   * 늘지 않은 채 면제만 거짓이 된다. 이제 디렉터리를 전수로 읽는다.
   */
  it("면제의 이유가 참이다 ② 주기적으로 갱신되지 않는다 — 워커 디렉터리의 어느 파일도 그 두 칸을 쓰지 않는다", () => {
    const workerFiles = workerSourceFiles();

    // 실재 확인 — 파일을 하나도 못 읽었으면 아래 부정은 빈 집합 위에서 통과한다.
    expect(
      workerFiles.length,
      "워커 디렉터리에서 파일을 하나도 못 읽었어요 = 이 증명이 빈 집합 위에서 돌고 있어요"
    ).toBeGreaterThan(0);
    // 잡 파일만 읽던 종전 모집단보다 **실제로 넓다**(넓어지지 않았다면 이 정정은 이름뿐이다).
    const jobFiles = [...new Set(collectWorkerJobNames("apps/api/src/worker/jobs").map((job) => job.where))];
    expect(jobFiles.length).toBeGreaterThan(0);
    expect(workerFiles.length).toBeGreaterThan(jobFiles.length);
    for (const jobFile of jobFiles) expect(workerFiles).toContain(jobFile);
    // 잡이 아닌 자리도 실제로 들어와 있다(디렉터리 전수라는 말이 값으로 확인된다).
    expect(workerFiles).toContain("apps/api/src/worker/scheduler.service.ts");

    const touching = workerFiles.filter((file) =>
      /priceSnapshotKrw|priceCheckedAt|price_snapshot_krw|price_checked_at/.test(readRepoFile(file))
    );
    expect(
      touching,
      "워커가 가격 스냅샷 칸을 쓰기 시작했어요 — '현재값 한 벌'이 '이력'이 되는 순간이라 면제를 거두세요"
    ).toEqual([]);
  });
});

/**
 * ⚠️ **라운드 85 리뷰 M-4 — 뿌리가 이름을 걷는 방식 자체가 관례에 기대고 있다.**
 *
 * 이 스윕은 값으로 적은 뿌리 위에서만 돈다. 그런데 두 뿌리는 **저장소의 관례가 오늘도 지켜진다는
 * 전제**를 말하지 않고 깔고 있었다:
 *  · `worker-job` 뿌리는 `*.job.ts`만 훑는다 — 꼬리 없는 잡 파일 하나면 이름이 앉을 자리가 없다.
 *  · `api-endpoint` 뿌리는 `@Get("…")`처럼 **큰따옴표**만 읽는다 — 작은따옴표 한 줄이면 경로가
 *    모집단 밖이다(이 저장소는 큰따옴표 관례이고, 그 사실이 어디에도 세어지지 않았다).
 * 전제는 값으로 적어 두면 깨지는 날 빨개진다.
 */
describe("ⓐ-2 뿌리가 기대는 관례 (라운드 85 리뷰 M-4)", () => {
  it("스케줄러가 굴리는 잡 파일이 전부 `.job.ts`다 (뿌리가 훑는 그 꼬리)", () => {
    const schedulerPath = "apps/api/src/worker/scheduler.service.ts";
    const schedulerSource = readRepoFile(schedulerPath);
    const imported = schedulerJobImportPaths(schedulerSource);

    // 실재 확인 — 하나도 못 읽었으면 아래 부정이 빈 집합 위에서 통과한다.
    expect(imported.length, `${schedulerPath}에서 잡 import를 하나도 못 읽었어요`).toBeGreaterThan(0);

    const withoutJobSuffix = imported.filter((path) => !path.endsWith(".job"));
    expect(
      withoutJobSuffix,
      "스케줄러가 `.job.ts`가 아닌 파일을 잡으로 굴려요 — worker-job 뿌리가 그 이름을 걷지 못해요"
    ).toEqual([]);

    // 그리고 그 import 전부가 뿌리가 실제로 걷어 온 파일이다(양방향 대조 — 유령도 누락도 0건).
    const collectedFiles = new Set(collectWorkerJobNames("apps/api/src/worker/jobs").map((job) => job.where));
    expect([...imported].map((path) => `apps/api/src/worker/${path}.ts`).sort()).toEqual([...collectedFiles].sort());

    // 생성자에 주입된 잡 수와 `this.jobs` 배열의 길이도 같다(굴리지 않는 잡이 조용히 남지 않는다).
    const jobsArray = /this\.jobs = \[([\s\S]*?)\];/.exec(schedulerSource);
    expect(jobsArray, "스케줄러의 jobs 배열을 못 읽었어요").toBeTruthy();
    const wired = jobsArray![1]
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !entry.startsWith("//"));
    expect(wired.length).toBe(imported.length);
  });

  it("api-endpoint 뿌리가 읽는 큰따옴표 관례가 오늘도 전수다 (작은따옴표 0건)", () => {
    // ⚠️ 모집단은 `scannedFiles()`가 아니라 **디렉터리 전수**다 — 작은따옴표로 적힌 파일은
    // 애초에 이름을 못 내놓아 그 목록에 없다(그 목록으로 이 관례를 확인하면 순환 논증이다).
    const apiFiles = tsFilesUnder("apps/api/src");
    expect(apiFiles.length, "apps/api/src에서 파일을 하나도 못 읽었어요").toBeGreaterThan(0);

    const singleQuoted: string[] = [];
    for (const file of apiFiles) {
      const source = readRepoFile(file);
      for (const match of source.matchAll(/@(?:Controller|Get|Post|Patch|Put|Delete)\(\s*'/g)) {
        singleQuoted.push(`${file} — ${match[0].trim()}`);
      }
    }
    expect(
      singleQuoted,
      "작은따옴표로 적힌 엔드포인트 경로가 생겼어요 — 이 스윕의 api-endpoint 뿌리가 그 경로를 못 걷어요"
    ).toEqual([]);
  });
});

describe("ⓔ 바늘이 실제로 문다 (물지 못하는 스윕은 영원히 초록이다)", () => {
  for (const item of OUT_OF_SCOPE_SIX) {
    it(`${item.id}: 가짜 이름 하나를 모집단에 섞으면 그 항목만 빨개진다`, () => {
      const planted: ScopeName = { ...item.tripSample, where: "(픽스처)" };

      // 오늘 저장소에 없는 이름이어야 픽스처다(있다면 그건 픽스처가 아니라 위반이다).
      expect(names.map((name) => name.name)).not.toContain(planted.name);

      // 한 이름이 바늘 둘에 걸릴 수 있으므로 이름 집합으로 견준다 — 묻는 것은 **그 자리 하나만**
      // 빨개지는가다(다른 이름이 함께 딸려 오면 바늘이 넓어진 것이다).
      const violations = findScopeViolations(item, [...names, planted]);
      expect([...new Set(violations.map((violation) => violation.name))]).toEqual([planted.name]);
    });
  }

  it("스키마 픽스처: 가격 이력 테이블이 생기면 price-tracking이 빨개진다", () => {
    const fixture = [
      "model ProductLinkPriceHistory {",
      "  id        String   @id",
      "  priceKrw  Int      @map(\"price_krw\")",
      "  @@map(\"product_link_price_history\")",
      "}"
    ].join("\n");
    const item = OUT_OF_SCOPE_SIX.find((candidate) => candidate.id === "price-tracking")!;

    const violations = findScopeViolations(item, collectSchemaNames(fixture, "(픽스처)"));
    expect(violations.map((violation) => violation.name)).toContain("product_link_price_history");
  });

  /**
   * ⚠️ **라운드 85 리뷰 M-3 — 트립 픽스처가 수집기를 우회하고 있었다.**
   *
   * used-market의 `tripSample`은 `{ kind: "schema-enum-value", name: "product_platform.danggeun" }`
   * 를 **손으로 만든 ScopeName**으로 심는다. 그것은 바늘이 무는지는 보이지만 **수집기가 그 이름을
   * 실제로 걷어 오는지는 한 번도 묻지 않는다** — 그리고 그 자리에 정확히 구멍이 있었다:
   * `@map`이 붙은 열거형 값은 종전 정규식(`^(\w+)$`)에 걸리지 않아 모집단에서 통째로 빠졌다.
   * 즉 조항이 말한 *"가장 싼 입구"* 로 값 한 줄이 들어와도 이 스윕은 초록이었다.
   *
   * 그래서 여기서는 **스키마 소스 문자열부터** 끝까지 지난다(픽스처 배열이 아니라).
   */
  it("스키마 픽스처: `@map`이 붙은 열거형 값도 모집단에 들어와 used-market이 빨개진다", () => {
    const fixture = [
      "enum ProductPlatform {",
      "  coupang",
      "  naver",
      // ⚠️ 이름을 감추는 가장 싼 방법 — 선언 이름과 DB 이름이 다르다.
      '  Danggeun @map("dg")',
      '  @@map("product_platform")',
      "}"
    ].join("\n");
    const item = OUT_OF_SCOPE_SIX.find((candidate) => candidate.id === "used-market")!;

    const collected = collectSchemaNames(fixture, "(픽스처)");
    // 세 값이 전부 걷혔고, `@map` 줄은 **두 이름**으로 선다(어느 쪽으로도 새지 않는다).
    expect(collected.filter((entry) => entry.kind === "schema-enum-value").map((entry) => entry.name)).toEqual([
      "product_platform.coupang",
      "product_platform.naver",
      "product_platform.dg",
      "product_platform.Danggeun"
    ]);

    expect(findScopeViolations(item, collected).map((violation) => violation.name)).toEqual([
      "product_platform.Danggeun"
    ]);

    // 오늘 스키마에는 `@map`이 붙은 열거형 값이 0건이라 이 확장이 실제 모집단을 늘리지 않는다
    // (늘어나는 날 그 값은 두 이름으로 서고, 그것이 이 확장의 목적이다).
    expect(namesOfKind("schema-enum-value")).toContain("product_platform.coupang");
  });

  it("정찰이 이름 붙인 실패 시나리오: 스냅샷을 주기적으로 갱신하는 잡이 생기면 price-tracking이 빨개진다", () => {
    // ⚠️ 이 잡의 이름은 '이력'도 '추이'도 말하지 않는다 — 만드는 사람도 "가격 추적을 켠다"고
    // 생각하지 않는다. 그래서 이 항목의 바늘 하나는 **잡 이름 공간에서만** 넓은 낱말로 선다.
    const item = OUT_OF_SCOPE_SIX.find((candidate) => candidate.id === "price-tracking")!;
    const planted: ScopeName[] = [
      { kind: "worker-job", name: "price-refresh.job.ts", where: "(픽스처)" },
      { kind: "worker-job", name: "product_link_price_refresh", where: "(픽스처)" }
    ];

    expect(findScopeViolations(item, planted).map((violation) => violation.name)).toEqual([
      "price-refresh.job.ts",
      "product_link_price_refresh"
    ]);
    // 같은 낱말이 열 이름에서는 돌지 않는다(카탈로그의 가격대 두 칸은 시간축이 없다).
    expect(
      findScopeViolations(item, [{ kind: "schema-column", name: "item_templates.price_min_krw", where: "(픽스처)" }])
    ).toEqual([]);
  });

  it("디렉터리 뿌리: 임시 라우트 파일을 실제로 만들면 community가 빨개지고, 지우면 초록으로 돌아온다", () => {
    // ⚠️ 끝에서 끝까지 재현한다 — 걷기·이름·바늘·판정이 한 줄로 이어져 있는지는 픽스처 배열로는
    // 알 수 없다(제품 뿌리를 건드리지 않으려고 임시 디렉터리 위에서 돌린다).
    const item = OUT_OF_SCOPE_SIX.find((candidate) => candidate.id === "community")!;
    const sandbox = mkdtempSync(join(tmpdir(), "wooriai-dnc-scope-"));
    try {
      const routeRoot = join(sandbox, "apps", "admin", "app");
      mkdirSync(join(routeRoot, "community"), { recursive: true });
      writeFileSync(join(routeRoot, "community", "page.tsx"), "export default function Page() { return null; }\n");

      const planted = collectRouteNames("admin-route", "apps/admin/app", sandbox);
      expect(findScopeViolations(item, planted).map((violation) => violation.name)).toEqual(["community/page.tsx"]);

      rmSync(join(routeRoot, "community"), { recursive: true, force: true });
      expect(findScopeViolations(item, collectRouteNames("admin-route", "apps/admin/app", sandbox))).toEqual([]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe("ⓕ DNC-001 판정 — 이 스윕이 그 조항의 축을 몇이나 걷는가", () => {
  it("세 축이 조항 문서의 DNC-001 행에 글자로 실려 있다", () => {
    const row = readRepoFile(DNC_CONTRACT_PATH)
      .split("\n")
      .find((line) => /^\|\s*DNC-001\s*\|/.test(line));

    expect(row, "DNC-001 행을 못 찾았어요 = 판정의 근거가 사라졌어요").toBeDefined();
    for (const axis of DNC_001_POSITION_AXES) {
      expect(row!, `DNC-001 행에 "${axis.axis}" 축이 없어요 — 조항이 개정됐다면 이 판정을 다시 하세요`).toContain(
        axis.axis
      );
    }
  });

  it("셋 중 하나만 걷힌다 (커뮤니티) — 그래서 판정은 무가드로 남는다", () => {
    const swept = sweptPositionAxes();

    expect(swept.map((axis) => axis.axis)).toEqual(["커뮤니티"]);
    expect(swept.length).toBeLessThan(DNC_001_POSITION_AXES.length);
    // 걷는다고 적힌 축은 이 스윕에 실재하는 항목을 가리켜야 한다(유령 판정 금지).
    for (const axis of swept) {
      expect(OUT_OF_SCOPE_SIX.map((item) => item.id)).toContain(axis.sweptBy);
    }
    for (const axis of DNC_001_POSITION_AXES) {
      expect(axis.note.trim().length, `${axis.axis} 축의 판정 근거가 비어 있어요`).toBeGreaterThan(40);
    }
  });

  /**
   * ⚠️ **라운드 85 리뷰 M-5 — 이 단언은 종전에 자기 자신을 견주고 있었다.**
   *
   * 종전 형태는 `toBe(allSwept ? DNC_001_SWEEP_VERDICT : "unguarded")`였다. `allSwept`가 참이
   * 되는 날 — 즉 **이 판정을 반드시 다시 해야 하는 바로 그 날** — 기대값이 `DNC_001_SWEEP_VERDICT`
   * 자신이 되어 무엇을 적어 두든 통과한다. 재판정을 강제하려고 세운 줄이 정확히 그 순간 무효가
   * 되는 모양이다(라운드 78 리뷰 P-1이 "이미 살펴본 자리로 읽히는 초록"이라고 부른 것과 같은 병).
   *
   * 그래서 **두 사실을 따로** 묻는다: ① 오늘 세 축을 다 걷지는 못한다 · ② 그래서 판정은 무가드다.
   * ①이 뒤집히는 날 이 줄은 기대값이 아니라 **사실**에서 빨개지고, 메시지가 재판정을 시킨다.
   */
  it("판정이 파생값과 어긋나지 않는다 (오늘의 사실과 판정을 따로 문다)", () => {
    const allSwept = DNC_001_POSITION_AXES.every((axis) => axis.sweptBy !== null);

    // ① 오늘의 사실 — 걷히는 축은 위 단언이 센 하나뿐이고, 셋 전부는 아니다.
    expect(
      allSwept,
      "세 축을 다 걷게 됐어요 — DNC-001을 **다시 판정**하세요. " +
        "걷는다고 해서 가드는 아니에요: 그때도 '이 스윕이 포지션 문장 자체를 읽는가'를 따로 물어야 하고, " +
        "답이 예이면 DNC_001_SWEEP_VERDICT와 이 줄을 함께 고치세요(대장의 래칫 수도 같이 움직여요)."
    ).toBe(false);

    // ② 그 사실에서 나오는 판정 — 값으로 따로 선다(①과 서로를 근거로 삼지 않는다).
    expect(DNC_001_SWEEP_VERDICT).toBe("unguarded");
    expect(sweptPositionAxes().length).toBeLessThan(DNC_001_POSITION_AXES.length);
  });
});

describe("ⓖ 자기 참조 금지 — 스윕은 자기를 모집단에 넣지 않는다", () => {
  it("스윕이 읽은 파일 목록에 자기 두 파일이 없다", () => {
    const scanned = scannedFiles();
    for (const self of SWEEP_SELF_FILES) {
      expect(scanned, `스윕이 자기 파일을 읽고 있어요: ${self}`).not.toContain(self);
    }
  });

  it("자기 파일이 모집단에 들어오면 첫날부터 빨간 채로 산다 (그래서 뿌리가 자기를 뺀다)", () => {
    // 이 파일들에는 "커뮤니티"·"중고"·"보험"이 값과 설명으로 실려 있다. 그 사실을 값으로 세지
    // 않으면 다음 사람이 "뿌리를 packages까지 넓히자"고 말할 때 이유를 다시 찾아야 한다.
    const item = OUT_OF_SCOPE_SIX.find((candidate) => candidate.id === "community")!;
    const selfAsName: ScopeName = {
      kind: "schema-table",
      name: readRepoFile(SWEEP_SELF_FILES[0]),
      where: SWEEP_SELF_FILES[0]
    };

    expect(findScopeViolations(item, [selfAsName]).length).toBeGreaterThan(0);
  });
});
