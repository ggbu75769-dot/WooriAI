// 라운드 85 트랙 E (GAP-085 #5) — DNC-016 부정 스윕의 계약.
//
// 스윕 자체의 설명(왜 모집단을 먼저 정하는가 · 뿌리 여덟 · 면제 하나 · 이 그물의 한계)은
// `dnc-scope-guard.ts` 머리말에 있다. 이 파일이 묻는 것은 일곱이다.
//  ⓐ **뿌리** — 뿌리 여덟의 경로가 **실재**하고, 각각이 실제로 이름을 내놓으며, 이유가 비어 있지 않다.
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
  scopeFailureHint,
  sweptPositionAxes
} from "./dnc-scope-guard";

/** 모집단 — 이 파일의 모든 판정이 여기서 나온다(한 번만 걷는다). */
const names: readonly ScopeName[] = collectScopeNames();

function namesOfKind(kind: ScopeName["kind"]): string[] {
  return names.filter((name) => name.kind === kind).map((name) => name.name);
}

describe("ⓐ 뿌리 — 경로가 실재하고, 이유가 있고, 실제로 이름을 내놓는다", () => {
  it("뿌리 여덟이 서로 다른 종류이고 각각 이유를 지고 있다", () => {
    expect(SCOPE_ROOTS.length).toBeGreaterThan(0);
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

  it("면제의 이유가 참이다 ② 주기적으로 갱신되지 않는다 — 워커의 어느 파일도 그 두 칸을 쓰지 않는다", () => {
    const jobs = collectWorkerJobNames("apps/api/src/worker/jobs");
    const jobFiles = [...new Set(jobs.map((job) => job.where))];

    // 실재 확인 — 잡을 하나도 못 읽었으면 아래 부정은 빈 집합 위에서 통과한다.
    expect(jobFiles.length, "워커 잡을 하나도 못 읽었어요 = 이 증명이 빈 집합 위에서 돌고 있어요").toBeGreaterThan(0);

    const touching = jobFiles.filter((file) =>
      /priceSnapshotKrw|priceCheckedAt|price_snapshot_krw|price_checked_at/.test(readRepoFile(file))
    );
    expect(
      touching,
      "워커 잡이 가격 스냅샷 칸을 쓰기 시작했어요 — '현재값 한 벌'이 '이력'이 되는 순간이라 면제를 거두세요"
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

  it("판정이 파생값과 어긋나지 않는다 (세 축을 다 걷기 전에는 가드가 아니다)", () => {
    const allSwept = DNC_001_POSITION_AXES.every((axis) => axis.sweptBy !== null);

    expect(
      DNC_001_SWEEP_VERDICT,
      "세 축을 다 걷게 되면 그때 DNC-001을 다시 판정하세요 — 그래도 '포지션 문장 자체를 읽는가'는 따로 물어야 해요"
    ).toBe(allSwept ? DNC_001_SWEEP_VERDICT : "unguarded");
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
