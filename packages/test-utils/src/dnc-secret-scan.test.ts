// 라운드 86 트랙 E (GAP-086 #5) — DNC-019 비밀값 부정 스윕의 계약.
//
// 스윕 자체의 설명(결정 두 문장 · 뿌리 넷 · 표식과 게이트 · 이 그물의 한계)은 `dnc-secret-scan.ts`
// 머리말에 있다. 이 파일이 묻는 것은 여섯이다.
//  ⓐ **뿌리** — 뿌리 넷의 경로가 **실재**하고, 각각이 실제로 자리를 내놓으며, 이유가 비어 있지 않다.
//     (⚠️ 손으로 배열한 목록은 뿌리가 아니다 — 확인되지 않는 뿌리 위에서는 모든 부정 단언이 통과한다.)
//  ⓑ **셋** — 항목마다 **독립된 단언**이 서고, 실패 메시지가 **어느 항목이 깨졌는지** 말한다
//     (한 정규식으로 셋을 묶으면 그 순간 사람에게 이유를 다시 찾게 한다). 셋의 문구는
//     `docs/dev/do-not-change.md`의 DNC-019 행에서 **파싱해** 대조한다(수도 이름도 손으로 적지 않는다).
//  ⓒ **면제** — 부류마다 이유·재개 조건·증명이 있고(유령 부류 0건), 줄마다 오늘 실제로 걸리는
//     자리다(유령 면제 0건). 그리고 **dev 폴백 면제의 이유가 참인지를 소스로 확인한다**
//     (*"`isDevOrTestEnv()` 뒤에서만 반환된다"* — `require-secret.ts`를 읽어 셋을 센다) ·
//     면제에 오른 자리의 **오늘 값이 가짜 표식을 달고 있는지**도 다시 센다.
//  ⓓ **자기 참조 금지** — 스윕이 자기 파일을 모집단에 넣지 않는다(넣으면 첫날부터 빨간 채로 산다).
//  ⓔ **바늘이 실제로 문다** — 항목마다 명백한 가짜 자리 하나를 모집단에 섞어 빨개지는 것을 보이고,
//     디렉터리 뿌리 하나는 **임시 파일을 실제로 만들어** 끝에서 끝까지 재현한다.
//  ⓕ **실패 메시지가 값을 싣지 않는다** — 이 스윕이 빨개지는 상황은 진짜 비밀값이 들어온 상황이고,
//     그때 값을 CI 로그에 다시 찍으면 스윕 자신이 유출의 두 번째 경로가 된다.
//
// ⚠️ 이 트랙은 **조항 문서를 고치지 않았고**(개정은 PM/Tech Lead 승인 절차다), **제품 소스를 0건
// 고쳤다**(스윕은 `apps/**`·`infra/**`·`.env.example`을 읽기만 한다 — 인라인 dev 폴백 여섯을 이름
// 상수로 바꾸는 것도 이 트랙 밖이다). `dnc-scope-guard.ts`는 본보기로 **읽기만** 했다.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DNC_CONTRACT_PATH,
  DB_PASSWORD_PROVEN_FAKE,
  FAKE_VALUE_MARKER,
  FAKE_VALUE_MARKERS,
  HIGH_ENTROPY_SHAPE,
  LOCAL_DB_HOSTS,
  LOOPBACK_DB_HOSTS,
  COMPOSE_SERVICE_DB_HOSTS,
  REQUIRE_SECRET_PATH,
  SECRET_EXEMPTION_CLASSES,
  SECRET_ITEMS,
  SECRET_ROOTS,
  SWEEP_SELF_FILES,
  type SecretCandidate,
  collectDbUrlLiterals,
  collectEnvExampleValues,
  collectSecretCandidates,
  collectSecretFallbacks,
  collectSeedAffiliateCodes,
  composeServiceNames,
  describeSecretViolation,
  devFallbackGateProof,
  fakeValueMarkersIn,
  filesUnder,
  findSecretHits,
  findSecretViolations,
  parseDbUrlParts,
  parseSecretClausePhrases,
  readRepoFile,
  scannedFiles,
  secretFailureHint
} from "./dnc-secret-scan";

/** 모집단 — 이 파일의 모든 판정이 여기서 나온다(한 번만 걷는다). */
const candidates: readonly SecretCandidate[] = collectSecretCandidates();

function candidatesOfKind(kind: SecretCandidate["kind"]): SecretCandidate[] {
  return candidates.filter((candidate) => candidate.kind === kind);
}

describe("ⓐ 뿌리 — 경로가 실재하고, 이유가 있고, 실제로 자리를 내놓는다", () => {
  it("뿌리 넷이 서로 다른 종류이고 각각 이유·단위를 지고 있다", () => {
    // ⚠️ 수를 값으로 못 박는다 — 뿌리가 조용히 줄면 그물이 좁아지는데 부정 단언은 그대로 초록이다
    // (라운드 85 리뷰 L-8이 같은 자리에서 실제로 열어 보인 창이다).
    expect(
      SECRET_ROOTS.length,
      "뿌리 수가 바뀌었어요 — 이 파일과 dnc-secret-scan.ts의 산문('넷')도 함께 고치세요"
    ).toBe(4);
    expect(SECRET_ROOTS.map((root) => root.kind).sort()).toEqual(
      [...new Set(SECRET_ROOTS.map((root) => root.kind))].sort()
    );
    for (const root of SECRET_ROOTS) {
      expect(root.reason.trim().length, `${root.kind} 뿌리의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      expect(root.unit.trim().length, `${root.kind} 뿌리의 단위가 비어 있어요`).toBeGreaterThan(0);
      expect(root.paths.length, `${root.kind} 뿌리의 경로가 비어 있어요`).toBeGreaterThan(0);
    }
  });

  for (const root of SECRET_ROOTS) {
    it(`${root.kind}: 뿌리 경로가 실재하고 자리가 0건이 아니다`, () => {
      for (const path of root.paths) {
        // 실재 확인 — 읽기가 던지면 그 자체가 판정이다(뿌리가 옮겨 갔거나 사라졌다).
        expect(filesUnder(path).length, `${root.kind} 뿌리의 경로가 비었어요: ${path}`).toBeGreaterThan(0);
      }
      expect(
        candidatesOfKind(root.kind).length,
        `${root.kind} 뿌리가 자리를 하나도 못 걷었어요 — 빈 모집단 위에서는 아래 부정 단언 셋이 전부 통과해요`
      ).toBeGreaterThan(0);
    });
  }

  it("걷어 온 자리가 실제 저장소의 것이다 (닻 넷으로 확인한다)", () => {
    // 파서가 조용히 엉뚱한 것을 세면 모집단은 커도 그물은 없다. 뿌리마다 오늘 반드시 있는 자리
    // 하나씩을 닻으로 둔다(이 넷이 사라지는 변경은 그 자체로 이 파일을 다시 보게 만드는 변경이다).
    expect(candidatesOfKind("seed-affiliate-code").map((candidate) => candidate.id)).toContain(
      "affiliatePartnerCode[0]"
    );
    expect(candidatesOfKind("secret-fallback").map((candidate) => candidate.id)).toContain(
      "OAUTH_KAKAO_CLIENT_ID@apps/api/src/auth/kakao/kakao-oidc-client.http.ts"
    );
    expect(candidatesOfKind("db-url-literal").map((candidate) => candidate.where)).toContain(
      "infra/docker/docker-compose.prod.yml"
    );
    expect(candidatesOfKind("env-example-value").map((candidate) => candidate.id)).toContain("DATABASE_URL");
  });

  it("시드 뿌리가 타입 선언 줄을 자리로 세지 않는다 (칸과 타입을 가른다)", () => {
    // `affiliatePartnerCode: string | null;` 은 칸이 아니라 타입이다. 그 줄을 함께 세면 모집단에
    // **영원히 위반 하나**가 섞여 들어와(=`string | null`은 `null`이 아니다) 이 항목은 첫날부터 빨갛다.
    expect(collectSeedAffiliateCodes().map((candidate) => candidate.parts.value)).not.toContain("string | null");
    expect(new Set(collectSeedAffiliateCodes().map((candidate) => candidate.parts.value))).toEqual(new Set(["null"]));
  });

  it("비밀값 폴백 뿌리가 함수 **정의**를 호출부로 세지 않는다", () => {
    // `export function requireSecret(envKey: string, devFallback: string)` 은 호출이 아니다.
    expect(collectSecretFallbacks().map((candidate) => candidate.id)).not.toContain(
      `envKey: string@${REQUIRE_SECRET_PATH}`
    );
    expect(collectSecretFallbacks().map((candidate) => candidate.parts.value)).not.toContain("devFallback: string");
  });

  it("DB URL 뿌리가 `${…}` 주입을 잘라 읽지 않는다 (호스트 조각이 사용자 이름으로 새지 않는다)", () => {
    // ⚠️ 이 스윕이 실제로 한 번 틀렸던 자리다: 중괄호에서 끊으면 운영 compose의 호스트가
    // `wooriai`(사용자 이름)로 읽혀 **거짓 빨강**이 난다.
    expect(parseDbUrlParts("postgresql://wooriai:${POSTGRES_PASSWORD}@postgres:5432/wooriai")).toEqual({
      host: "postgres",
      password: "${POSTGRES_PASSWORD}"
    });
    expect(parseDbUrlParts("postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}")).toEqual({
      host: "localhost",
      password: "${dbPassword}"
    });
    const prod = collectDbUrlLiterals().filter((candidate) => candidate.where.endsWith("docker-compose.prod.yml"));
    expect(prod.length, "운영 compose의 DB URL을 못 읽었어요").toBeGreaterThan(0);
    for (const candidate of prod) {
      expect(candidate.parts.host).toBe("postgres");
      expect(candidate.parts.password).toBe("${POSTGRES_PASSWORD}");
    }
  });

  it("`.env.example` 뿌리가 빈 값과 순수 숫자를 걷지 않는다 (자리표시자·설정값은 비밀값이 아니다)", () => {
    const collected = collectEnvExampleValues();
    for (const candidate of collected) {
      expect(candidate.parts.value.length, `${candidate.id}의 값이 비었는데 걷혔어요`).toBeGreaterThan(0);
      expect(candidate.parts.value, `${candidate.id}는 순수 숫자예요`).not.toMatch(/^\d+$/);
    }
    // 실재 확인 두 방향: 빈 값 키도, 숫자 키도 오늘 파일에 있다(규칙이 아무것도 거르지 않는 게 아니다).
    const source = readRepoFile(".env.example");
    expect(source).toContain("EXPO_PUBLIC_TERMS_URL=");
    expect(source).toContain("RATE_LIMIT_GLOBAL_MAX=300");
    expect(collected.map((candidate) => candidate.id)).not.toContain("EXPO_PUBLIC_TERMS_URL");
    expect(collected.map((candidate) => candidate.id)).not.toContain("RATE_LIMIT_GLOBAL_MAX");
  });
});

describe("ⓐ-2 표식과 로컬 호스트 — 결정 ②가 기대는 관례를 값으로 센다", () => {
  it("표식 낱말마다 이유(오늘 어느 값이 이 표식으로 사는가)가 적혀 있다", () => {
    expect(FAKE_VALUE_MARKERS.length).toBeGreaterThan(0);
    for (const marker of FAKE_VALUE_MARKERS) {
      expect(marker.label.trim().length, "표식에 이름이 없어요").toBeGreaterThan(0);
      expect(marker.seenIn.trim().length, `${marker.label} 표식의 근거가 비어 있어요`).toBeGreaterThan(10);
      // ⚠️ 표식을 늘리는 것은 그물을 **좁히는** 일이다 — 낱말이 자기 자신을 실제로 무는지 먼저 센다.
      expect(marker.pattern.test(marker.label), `${marker.label} 표식이 자기 낱말을 못 물어요`).toBe(true);
    }
  });

  it("오늘 저장소의 가짜 값이 실제로 표식을 달고 있다 (관례가 오늘도 참이다)", () => {
    expect(fakeValueMarkersIn("dev-admin-token")).toContain("dev");
    expect(fakeValueMarkersIn("DEV_ALLOWED_DOMAINS_FALLBACK")).toContain("dev");
    expect(fakeValueMarkersIn("change-me-local-only")).toContain("change-me");
    expect(fakeValueMarkersIn("wooriai_dev_password")).toContain("dev");
    expect(fakeValueMarkersIn("unused-fallback-for-boot-check")).toContain("unused");
    // 그리고 표식 없는 값은 표식 없는 값으로 읽힌다(규칙이 전부를 통과시키는 게 아니다).
    expect(fakeValueMarkersIn("명백한가짜-표식없는-폴백")).toEqual([]);
    expect(FAKE_VALUE_MARKER.test("명백한가짜-표식없는-폴백")).toBe(false);
  });

  it("고엔트로피 바늘이 오늘 값을 물지 않고 구분자 없는 덩어리만 문다", () => {
    for (const candidate of candidates) {
      expect(
        HIGH_ENTROPY_SHAPE.test(candidate.parts.value),
        `${candidate.id}의 값이 고엔트로피 모양이에요(${candidate.where}) — 실제 키인지 먼저 보세요`
      ).toBe(false);
    }
    // 물기는 문다 — 명백한 가짜지만 모양은 그 부류다(대소문자＋숫자, 구분자 0건, 24자 이상).
    expect(HIGH_ENTROPY_SHAPE.test("AaaaaaaaaaBbbbbbbbbbCc12")).toBe(true);
    expect(HIGH_ENTROPY_SHAPE.test("wooriai-dev-analytics-anon-salt")).toBe(false);
  });

  it("루프백이 아닌 로컬 호스트는 compose가 실제로 정의하는 서비스뿐이다", () => {
    // ⚠️ 이 배열은 이유만으로 서지 않는다 — 확인되지 않는 호스트 하나가 곧 조용한 문이다.
    const services = composeServiceNames();
    expect(services.length, "infra/docker에서 compose 서비스를 하나도 못 읽었어요").toBeGreaterThan(0);
    for (const host of COMPOSE_SERVICE_DB_HOSTS) {
      expect(services, `${host}가 compose 서비스가 아니에요 — 그러면 그것은 실제 호스트 이름이에요`).toContain(host);
    }
    expect([...LOCAL_DB_HOSTS].sort()).toEqual([...LOOPBACK_DB_HOSTS, ...COMPOSE_SERVICE_DB_HOSTS].sort());
  });

  it("DB 비밀번호의 '가짜' 판정이 셋만 받는다 (빈 값 · 환경 주입 · 표식)", () => {
    expect(DB_PASSWORD_PROVEN_FAKE.test("")).toBe(true);
    expect(DB_PASSWORD_PROVEN_FAKE.test("${POSTGRES_PASSWORD}")).toBe(true);
    expect(DB_PASSWORD_PROVEN_FAKE.test("wooriai_dev_password")).toBe(true);
    expect(DB_PASSWORD_PROVEN_FAKE.test("가짜비밀번호")).toBe(false);
  });
});

describe("ⓑ 셋 — 항목마다 자기 뿌리와 바늘로 독립해서 선다", () => {
  it("셋이 서로 다른 id를 갖고, 각각 뿌리·바늘·이유를 지고 있다", () => {
    expect(SECRET_ITEMS.map((item) => item.id)).toEqual([
      "oauth-secret",
      "affiliate-id",
      "prod-db-url"
    ]);
    for (const item of SECRET_ITEMS) {
      expect(item.roots.length, `${item.id}의 뿌리가 비어 있어요`).toBeGreaterThan(0);
      expect(item.needles.length, `${item.id}의 바늘이 비어 있어요`).toBeGreaterThan(0);
      expect(item.rootsReason.trim().length, `${item.id}의 뿌리 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      for (const kind of item.roots) {
        expect(
          SECRET_ROOTS.map((root) => root.kind),
          `${item.id}가 뿌리 목록에 없는 종류(${kind})를 가리켜요`
        ).toContain(kind);
      }
      for (const needle of item.needles) {
        expect(needle.label.trim().length, `${item.id}의 바늘에 이름이 없어요`).toBeGreaterThan(0);
        expect(needle.reason.trim().length, `${item.id} · ${needle.label} 바늘의 이유가 비어 있어요`).toBeGreaterThan(40);
        expect(needle.kinds.length, `${item.id} · ${needle.label} 바늘이 아무 뿌리도 안 돌아요`).toBeGreaterThan(0);
        for (const kind of needle.kinds) {
          // 항목의 뿌리 밖으로 좁혀진 바늘은 한 번도 돌지 않으면서 "이미 막아 둔 자리"로 읽힌다.
          expect(item.roots, `${item.id} · ${needle.label} 바늘이 이 항목의 뿌리 밖(${kind})을 가리켜요`).toContain(kind);
        }
      }
    }
  });

  it("셋의 문구가 조항 문서의 DNC-019 행에서 온다 (수도 이름도 손으로 적지 않는다)", () => {
    const phrases = parseSecretClausePhrases(readRepoFile(DNC_CONTRACT_PATH));

    // 실재 확인 — 파싱이 끊어지면 아래 대조가 빈 목록 위에서 통과한다.
    expect(phrases.length, `${DNC_CONTRACT_PATH}의 DNC-019 행에서 문구를 하나도 못 읽었어요`).toBeGreaterThan(0);
    expect(
      SECRET_ITEMS.map((item) => item.clausePhrase),
      "조항이 잠근 목록이 바뀌었어요 — 새 항목의 뿌리·바늘·면제를 정하는 것이 그 라운드의 일이에요"
    ).toEqual(phrases);
  });

  /**
   * ⚠️ **셋을 한 정규식으로 묶지 않는다.** 어느 항목이 깨졌는지 말하지 못하는 스윕은 그 순간
   * 사람에게 조사를 다시 시킨다(라운드 85 트랙 E의 판정 그대로). 그래서 `it`가 항목마다 선다.
   *
   * ⚠️ 이 단언은 **셋을 도는 루프 안**에 있다 — 배열이 비거나 항목이 빠지면 0회 돌고도 초록이다.
   * 그래서 대장(`dnc-guard-ledger.ts`)의 DNC-019 행은 이 `for` 줄과 **셋의 id 전수**를 모집단으로
   * 못 박는다(H-2의 규율).
   */
  for (const item of SECRET_ITEMS) {
    it(`${item.id}("${item.clausePhrase}"): 오늘 이 항목의 위반이 0건이다`, () => {
      const violations = findSecretViolations(item, candidates);
      expect(violations.map(describeSecretViolation), secretFailureHint(item)).toEqual([]);
    });
  }

  it("실패 안내가 항목마다 다르고 그 항목의 이름을 말한다", () => {
    for (const item of SECRET_ITEMS) {
      expect(secretFailureHint(item)).toContain(item.id);
      expect(secretFailureHint(item)).toContain(item.clausePhrase);
    }
    expect(new Set(SECRET_ITEMS.map((item) => secretFailureHint(item))).size).toBe(SECRET_ITEMS.length);
  });
});

describe("ⓒ 면제 — 부류마다 이유·재개 조건·증명이 있고, 줄마다 오늘 걸리는 자리다", () => {
  const allExemptions = SECRET_ITEMS.flatMap((item) => item.exemptions.map((exemption) => ({ item, exemption })));

  it("면제 부류가 전부 이유·재개 조건·증명을 지고 있다", () => {
    for (const [id, meta] of Object.entries(SECRET_EXEMPTION_CLASSES)) {
      expect(meta.reason.trim().length, `${id} 부류의 이유가 비어 있거나 너무 짧아요`).toBeGreaterThan(40);
      expect(meta.resumeWhen.trim().length, `${id} 부류의 재개 조건이 비어 있어요`).toBeGreaterThan(20);
      expect(meta.provenBy.trim().length, `${id} 부류의 증명이 비어 있어요`).toBeGreaterThan(40);
    }
  });

  it("유령 부류가 없다 (부류마다 적어도 한 줄) · 유령 부류를 늘리는 것이 면제 목록이 문을 여는 방식이다", () => {
    for (const id of Object.keys(SECRET_EXEMPTION_CLASSES)) {
      expect(
        allExemptions.map(({ exemption }) => exemption.exemptionClass),
        `${id} 부류에 오늘 줄이 0건이에요 — 쓰지 않는 부류는 다음 사람에게 열린 문으로 읽혀요`
      ).toContain(id);
    }
    // 정찰이 센 셋 중 `.env.example` 자리표시자는 **면제가 아니다**(표식 규칙이 이미 가른다).
    expect(Object.keys(SECRET_EXEMPTION_CLASSES).sort()).toEqual(["dev-fallback-gate", "test-fixture"]);
  });

  it("면제 줄마다 이름과 한 줄 메모가 있고, 부류가 실재한다", () => {
    expect(allExemptions.length, "면제가 0건이면 아래 증명들이 빈 집합 위에서 통과해요").toBeGreaterThan(0);
    for (const { item, exemption } of allExemptions) {
      expect(exemption.note.trim().length, `${item.id} · ${exemption.name}의 메모가 비어 있어요`).toBeGreaterThan(10);
      expect(Object.keys(SECRET_EXEMPTION_CLASSES)).toContain(exemption.exemptionClass);
      expect(item.roots, `${item.id}의 면제가 이 항목의 뿌리 밖(${exemption.kind})을 가리켜요`).toContain(exemption.kind);
    }
    // 같은 자리가 두 줄로 서지 않는다.
    const names = allExemptions.map(({ item, exemption }) => `${item.id}::${exemption.kind}::${exemption.name}`);
    expect(new Set(names).size).toBe(names.length);
  });

  /**
   * ⚠️ **양방향이다.** 왼쪽이 어긋나면 유령 면제(걸리지도 않는 줄이 남아 목록이 늘어난다)이고,
   * 오른쪽이 어긋나면 **새 자리가 이름 없이 통과하려다 빨개진다**(예: `requireSecret` 호출부가
   * 하나 늘면 그 자리를 이유·메모와 함께 대장에 적기 전까지는 초록이 되지 않는다).
   */
  for (const item of SECRET_ITEMS) {
    it(`${item.id}: 걸리는 자리 전수 = 면제 대장의 줄 전수 (유령 면제도, 이름 없는 통과도 0건)`, () => {
      const hitNames = [...new Set(findSecretHits(item, candidates).map((hit) => `${hit.kind}::${hit.id}`))].sort();
      const exemptNames = item.exemptions.map((exemption) => `${exemption.kind}::${exemption.name}`).sort();

      expect(
        exemptNames,
        `${item.id}의 면제 대장이 오늘 걸리는 자리와 어긋나요 — 걸리지 않게 된 줄은 지우고, ` +
          "새로 걸리는 자리는 이유·메모와 함께 적으세요(그 판단을 하지 않고 지나가는 길을 남기지 않아요)"
      ).toEqual(hitNames);
    });
  }

  it("dev 폴백 면제의 이유가 참이다 — `isDevOrTestEnv()` 뒤에서만 반환된다 (소스로 확인)", () => {
    // ⚠️ 이유를 적기만 하고 확인하지 않으면 그것이 면제부다(라운드 84 트랙 D의 `provenBy` 관례).
    const proof = devFallbackGateProof();

    expect(proof.fallbackReturnLines, `${REQUIRE_SECRET_PATH}에서 폴백 반환을 못 읽었어요`).toBeGreaterThan(0);
    expect(
      proof.returnsFallbackOnlyBehindGate,
      "폴백을 게이트 **밖**에서도 돌려주게 됐어요 — 그러면 dev 폴백 면제의 근거가 사라져요"
    ).toBe(true);
    expect(
      proof.throwsOutsideGate,
      "게이트 밖에서 던지지 않아요 — 운영이 공개된 폴백 값으로 조용히 뜰 수 있어요"
    ).toBe(true);
    expect(
      proof.gateChecksNodeEnv,
      'isDevOrTestEnv()가 NODE_ENV를 "development"/"test"로만 참으로 만들지 않아요(미설정도 운영 취급이어야 해요)'
    ).toBe(true);
  });

  for (const { item, exemption } of allExemptions) {
    it(`${item.id} · ${exemption.name}: 그 자리의 오늘 값이 가짜 표식을 달고 있다`, () => {
      const site = candidates.find(
        (candidate) => candidate.kind === exemption.kind && candidate.id === exemption.name
      );
      expect(site, `면제에 오른 자리가 모집단에 없어요: ${exemption.name}`).toBeDefined();

      // ⚠️ 면제는 **자리**에 걸리고 값은 갈아 끼울 수 있다 — 그래서 값을 다시 센다. 실제 키로
      // 바꿔 넣으면 면제 이름은 그대로인데 이 줄이 빨개진다(면제부가 되는 유일한 경로를 막는다).
      expect(
        fakeValueMarkersIn(site!.parts.value),
        `${exemption.name}의 값이 가짜 표식을 잃었어요 — 실제 값이라면 지우고 **회전**한 뒤 환경변수로 옮기세요`
      ).not.toEqual([]);

      if (exemption.exemptionClass === "test-fixture") {
        expect(site!.where, "test-fixture 부류는 테스트 경로에만 서요").toMatch(/(^|\/)test(s)?\/|\.test\.ts$/);
      }
    });
  }
});

describe("ⓓ 자기 참조 금지 — 스윕은 자기를 모집단에 넣지 않는다", () => {
  it("스윕이 읽은 파일 목록에 자기 두 파일이 없다", () => {
    const scanned = scannedFiles();
    // 실재 확인 — 빈 목록 위에서는 아래 부정이 공짜로 통과한다.
    expect(scanned.length, "모집단 파일을 하나도 못 읽었어요").toBeGreaterThan(0);
    expect(scanned, "packages를 훑는데 이 파일이 그 목록에 없다면 뿌리가 좁아진 거예요").toContain(
      "packages/test-utils/src/dnc-guard-ledger.ts"
    );
    for (const self of SWEEP_SELF_FILES) {
      expect(scanned, `스윕이 자기 파일을 읽고 있어요: ${self}`).not.toContain(self);
    }
    expect(candidates.map((candidate) => candidate.where)).not.toContain(SWEEP_SELF_FILES[0]);
    expect(candidates.map((candidate) => candidate.where)).not.toContain(SWEEP_SELF_FILES[1]);
  });

  it("자기 파일이 모집단에 들어오면 첫날부터 빨간 채로 산다 (그래서 뿌리가 자기를 뺀다)", () => {
    // 이 두 파일에는 가짜 픽스처와 `postgres…://` 예시가 값으로 실려 있다. 그 사실을 값으로 세지
    // 않으면 다음 사람이 "뿌리에서 자기 배제를 빼자"고 말할 때 이유를 다시 찾아야 한다.
    const item = SECRET_ITEMS.find((candidate) => candidate.id === "prod-db-url")!;
    const selfSource = readRepoFile(SWEEP_SELF_FILES[1]);
    const planted: SecretCandidate[] = [...selfSource.matchAll(/postgres(?:ql)?:\/\/[^\s"'`,\\)\]<>]+/g)].map(
      (match, index) => ({
        kind: "db-url-literal" as const,
        id: `${SWEEP_SELF_FILES[1]}#${index}`,
        where: SWEEP_SELF_FILES[1],
        parts: { value: match[0], ...parseDbUrlParts(match[0]) }
      })
    );

    expect(planted.length, "이 파일에 URL 예시가 0건이면 이 단언이 아무것도 보이지 못해요").toBeGreaterThan(0);
    expect(findSecretViolations(item, planted).length).toBeGreaterThan(0);
  });
});

describe("ⓔ 바늘이 실제로 문다 (물지 못하는 스윕은 영원히 초록이다)", () => {
  for (const item of SECRET_ITEMS) {
    it(`${item.id}: 명백한 가짜 자리 하나를 모집단에 섞으면 그 항목만 빨개진다`, () => {
      // 오늘 저장소에 없는 자리여야 픽스처다(있다면 그건 픽스처가 아니라 위반이다).
      expect(candidates.map((candidate) => candidate.id)).not.toContain(item.tripSample.id);

      const violations = findSecretViolations(item, [...candidates, item.tripSample]);
      // 한 자리가 바늘 둘에 걸릴 수 있으므로 **자리 집합**으로 견준다 — 묻는 것은 그 자리 하나만
      // 빨개지는가다(다른 자리가 함께 딸려 오면 바늘이 넓어진 것이다).
      expect([...new Set(violations.map((violation) => violation.id))]).toEqual([item.tripSample.id]);

      // 그리고 **다른 두 항목은 그대로 초록이다**(셋이 독립이라는 말의 뜻).
      for (const other of SECRET_ITEMS) {
        if (other.id === item.id) continue;
        expect(
          findSecretViolations(other, [...candidates, item.tripSample]).map(describeSecretViolation),
          `${item.id}의 픽스처가 ${other.id}까지 빨갛게 만들어요 — 두 항목의 바늘이 겹쳐요`
        ).toEqual([]);
      }
    });
  }

  it("정찰이 이름 붙인 실패 시나리오: 시드의 파트너 코드 칸이 채워지면 affiliate-id가 빨개진다", () => {
    // ⚠️ 이 한 줄은 "링크가 동작하게 만드는" 지극히 자연스러운 변경이고, 아무도 "비밀값을
    // 커밋한다"고 생각하지 않는다 — 그것이 이 트랙이 선 이유다.
    const item = SECRET_ITEMS.find((candidate) => candidate.id === "affiliate-id")!;
    const planted: SecretCandidate[] = [
      {
        kind: "seed-affiliate-code",
        id: "affiliatePartnerCode[가짜-계약]",
        where: "apps/api/prisma/seed-data.ts",
        parts: { value: '"명백한가짜-파트너-계약-코드"' }
      }
    ];

    expect(findSecretViolations(item, planted).map((violation) => violation.needle)).toContain(
      "시드의 제휴 파트너 코드 칸에 값이 들어왔다"
    );
    // 그리고 `null` 그대로면 초록이다(오늘 67행의 모양).
    expect(
      findSecretViolations(item, [{ ...planted[0], parts: { value: "null" } }])
    ).toEqual([]);
  });

  it("이름 상수가 감춘 값도 본다 (표식을 단 이름 뒤의 고엔트로피 값)", () => {
    const item = SECRET_ITEMS.find((candidate) => candidate.id === "oauth-secret")!;
    const planted: SecretCandidate = {
      kind: "secret-fallback",
      id: "OAUTH_KAKAO_CLIENT_SECRET@apps/api/src/auth/kakao/가짜-상수-호출부.ts",
      where: "apps/api/src/auth/kakao/가짜-상수-호출부.ts",
      // 이름은 표식을 달았지만 풀린 값은 구분자 없는 덩어리다(명백한 가짜 — 알파벳 순서 그대로).
      parts: { value: "DEV_KAKAO_SECRET_FALLBACK", resolved: "AaaaaaaaaaBbbbbbbbbbCc12" }
    };

    expect(findSecretViolations(item, [planted]).map((violation) => violation.needle)).toContain(
      "이름 상수가 감춘 고엔트로피 값"
    );
  });

  it("디렉터리 뿌리: 임시 compose 파일을 실제로 만들면 prod-db-url이 빨개지고, 지우면 초록으로 돌아온다", () => {
    // ⚠️ 끝에서 끝까지 재현한다 — 걷기·조각 나누기·바늘·판정이 한 줄로 이어져 있는지는 픽스처
    // 배열로는 알 수 없다(제품 뿌리를 건드리지 않으려고 임시 디렉터리 위에서 돌린다).
    const item = SECRET_ITEMS.find((candidate) => candidate.id === "prod-db-url")!;
    const sandbox = mkdtempSync(join(tmpdir(), "wooriai-dnc-secret-"));
    try {
      for (const dir of ["apps", "packages", "scripts", "infra/docker"]) {
        mkdirSync(join(sandbox, dir), { recursive: true });
      }
      writeFileSync(join(sandbox, ".env.example"), "NODE_ENV=development\n");
      writeFileSync(join(sandbox, "apps", "keep.ts"), "export const keep = 1;\n");
      writeFileSync(join(sandbox, "packages", "keep.ts"), "export const keep = 1;\n");
      writeFileSync(join(sandbox, "scripts", "keep.ts"), "export const keep = 1;\n");

      const planted = join(sandbox, "infra", "docker", "docker-compose.staging.yml");
      // ⚠️ 명백한 가짜다: `.invalid`는 해석되지 않는 예약 TLD이고 비밀번호도 한국어 낱말이다.
      // 그리고 이 줄은 **이 파일 안에 통째로** 서 있다 — 그래서 위 ⓓ가 자기 배제의 필요를
      // 값으로 보일 수 있다(자르거나 감추면 그 단언이 아무것도 못 본다).
      writeFileSync(
        planted,
        "services:\n  api:\n    environment:\n" +
          "      DATABASE_URL: postgresql://wooriai:가짜비밀번호@staging.가짜.invalid:5432/wooriai\n"
      );

      const withPlanted = collectDbUrlLiterals(sandbox);
      expect(withPlanted.length, "심은 URL을 못 걷었어요 — 걷기부터 끊어졌어요").toBe(1);
      expect(withPlanted[0].parts.host).toBe("staging.가짜.invalid");
      expect(findSecretViolations(item, withPlanted).map((violation) => violation.needle).sort()).toEqual([
        "로컬이 아닌 DB 호스트",
        "표식 없는 DB 비밀번호"
      ]);

      rmSync(planted, { force: true });
      expect(findSecretViolations(item, collectDbUrlLiterals(sandbox))).toEqual([]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe("ⓕ 실패 메시지가 값을 싣지 않는다 (스윕이 유출의 두 번째 경로가 되지 않는다)", () => {
  it("위반 한 줄에 항목·바늘·자리·파일·조각은 있고, 값은 없다", () => {
    const item = SECRET_ITEMS.find((candidate) => candidate.id === "oauth-secret")!;
    const secretShaped = "AaaaaaaaaaBbbbbbbbbbCc12";
    const planted: SecretCandidate = {
      kind: "secret-fallback",
      id: "OAUTH_KAKAO_CLIENT_SECRET@apps/api/src/auth/kakao/가짜-유출-호출부.ts",
      where: "apps/api/src/auth/kakao/가짜-유출-호출부.ts",
      parts: { value: secretShaped }
    };

    const lines = findSecretViolations(item, [planted]).map(describeSecretViolation);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, "실패 메시지가 값을 CI 로그에 다시 찍어요").not.toContain(secretShaped);
      expect(line).toContain(item.id);
      expect(line).toContain(planted.where);
    }
    // 안내문도 값을 싣지 않는다 — 사람을 파일로 보내고, 회전부터 말한다.
    expect(secretFailureHint(item)).not.toContain(secretShaped);
    expect(secretFailureHint(item)).toContain("회전");
  });
});
