import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, createItemTemplate, updateAdminCategory } from "./lib/admin-api";
import { writeErrorMessage } from "./lib/write-error-copy";

/**
 * 라운드 110 트랙 1 — **`VALIDATION_ERROR`의 사유가 운영자 화면까지 닿는다.**
 *
 * ## 무엇이 문제였나(라운드 108-T9의 실측을 다시 재서 확인했다)
 *
 * 어드민의 API 래퍼는 실패 본문에서 `error.message` **하나만** 읽어 `AdminApiError`를 만들고,
 * `writeErrorMessage`가 그것을 화면에 세운다. 그런데 이 API의 `VALIDATION_ERROR` 봉투에서
 * `message`는 어느 거절이든 **같은 일반 문장**이다("요청 값을 다시 확인해주세요." —
 * apps/api/src/bootstrap.ts). 사유는 `details.fields[].constraints`에만 있었고 그 값을 읽는
 * 코드가 어드민 전체에 **0건**이었다. 그래서 라운드 107·108이 500을 400으로 바꿔 세운 거절들이
 * 화면에서는 전부 같은 한 문장으로 보였다.
 *
 * ## ⚠️ 이 라운드가 다시 재서 **바로잡은** 두 가지
 *
 *  1. **다섯 거절이 전부 `details.fields`에 있는 것은 아니다.** 실측(이 저장소의 서버 소스):
 *     `ADMIN_ITEM_PRICE_RANGE_INVALID`(가격 대소) · `ADMIN_SPONSOR_LABEL_REQUIRED` ·
 *     `ADMIN_CATEGORY_NAME_DUPLICATE`(이름 중복)은 **전용 코드 + 봉투 `message`에 한국어 사유**를
 *     싣는다 — 그 셋은 종전에도 화면에 그대로 섰다. 화면에 닿지 않던 것은 `VALIDATION_ERROR`
 *     갈래, 즉 **폭 초과 · 고지 키 길이 · 분류 이름의 보이지 않는 문자** 셋이다.
 *  2. **사유 문장이 전부 한국어인 것도 아니다.** 실측: class-validator의 기본 문장은 영문이고
 *     앞머리가 **서버 필드명 그대로**다(`"necessityLevel must be one of the following values: …"`).
 *     그래서 사유를 그대로 잇기만 하면 한국어 화면에 영문 필드명이 선다 — 라운드 76 리뷰 M-1이
 *     봉투 `message`에 대해 이미 막아 둔 바로 그 사고다.
 *
 * ## 그래서 고친 자리 둘 (필드명을 다룬 방법)
 *
 *  · **서버**(apps/api/src/admin/dto/admin.dto.ts) — 폭 상한 다섯 칸의 거절 문구를 한국어로
 *    짓는다. 칸 이름은 **어드민 화면이 이미 쓰는 라벨 그대로**다("준비템 이름" · "타이밍 라벨" ·
 *    "상품 링크 제목" · "스폰서 표시 문구" · "고지 문구").
 *  · **어드민**(src/lib/admin-api.ts · write-error-copy.ts) — `constraints`의 **문장만** 싣고
 *    `field`(영문 키)는 **아예 꺼내지 않는다**. 그리고 한글이 한 자도 없는 문장은 화면에 세우지
 *    않는다(종전 한 벌이 이미 쓰던 그 규칙 하나). 이 둘이 겹쳐 **영문 필드명이 화면에 서는 길이
 *    구조적으로 막힌다.**
 *
 * ## ⚠️ 이 계약의 한계 — **어드민에는 DOM 테스트 환경이 없다**
 *
 * 이 워크스페이스에는 jsdom도 testing-library도 설치돼 있지 않고 vitest가 node 환경으로 돈다
 * (apps/admin/package.json의 devDependencies에 그 둘이 없다 — 값으로 아래 ⓔ가 문다).
 * 그래서 이 파일이 **볼 수 없는 것**은: 실제 화면이 이 문장을 `role="alert"` 배너에 그리는가,
 * 줄바꿈·길이가 배너를 깨뜨리지 않는가. 이 파일이 **볼 수 있는 것**은 순수 함수의 출력과
 * 소스 구조 계약뿐이다. 화면까지의 마지막 한 칸은 `writeErrorMessage`를 부르는 자리 전수를
 * 무는 `src/admin-write-error-copy.test.ts`(대장 열다섯)가 이어 받는다.
 */

const adminRoot = process.cwd();
const repoRoot = join(adminRoot, "..", "..");

function readRepoSource(relativePath: string): string {
  const filePath = join(repoRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readAdminSource(relativePath: string): string {
  const filePath = join(adminRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * 서버가 실제로 내는 봉투 그대로(apps/api/src/bootstrap.ts의 `validationDetails` 꼴).
 * ⚠️ 기대값은 리터럴이다 — 이 파일이 서버의 문장을 **짓지 않고**, 아래 ⓓ가 그 리터럴이
 * 서버 소스에 정말로 있는지 되묻는다.
 */
function validationEnvelope(fields: { field: string; constraints: Record<string, string> }[]) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "요청 값을 다시 확인해주세요.",
      details: { fields }
    }
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** 서버가 짓는 폭 초과 문장 다섯 중 둘 — 리터럴(ⓓ가 서버 소스와 대조한다). */
const NAME_TOO_LONG = "준비템 이름 최대 길이는 80자예요. 넘는 값은 잘라 저장하지 않아요.";
const TIMING_TOO_LONG = "타이밍 라벨 최대 길이는 80자예요. 넘는 값은 잘라 저장하지 않아요.";
/** 손으로 던지는 자리의 한국어 문장(apps/api/src/admin/dto/admin-categories.dto.ts 경유). */
const INVISIBLE_CHAR = "이름에 화면에 보이지 않는 문자가 있어요(U+202E). 그 문자를 지우고 다시 저장해 주세요.";
/** class-validator 기본 문장 — **영문이고 앞머리가 서버 필드명 그대로다**(실측). */
const ENGLISH_DEFAULT = "necessityLevel must be one of the following values: essential, convenience, optional";

/** 종전에 화면에 서던 그 한 문장(폴백을 쓰지 않고 봉투 message가 이겼을 때). */
const GENERIC = "요청 값을 다시 확인해주세요.";
const ITEM_FALLBACK = "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.";

describe("ⓐ 400 봉투의 details.fields가 AdminApiError까지 실린다 (라운드 110)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-110" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("사유 문장이 응답 순서 그대로, 중복 없이 실린다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        400,
        validationEnvelope([
          { field: "name", constraints: { maxLength: NAME_TOO_LONG } },
          { field: "necessityLevel", constraints: { isIn: ENGLISH_DEFAULT } },
          { field: "timingLabel", constraints: { maxLength: TIMING_TOO_LONG } },
          // 같은 문장이 두 칸에서 오면 한 번만 담는다(화면에 같은 줄을 두 번 세우지 않는다).
          { field: "timingLabelCopy", constraints: { maxLength: TIMING_TOO_LONG } }
        ])
      )
    );

    const error = await createItemTemplate({ name: "가".repeat(81) }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminApiError);
    const adminError = error as AdminApiError;
    expect(adminError.status).toBe(400);
    expect(adminError.code).toBe("VALIDATION_ERROR");
    expect(adminError.message).toBe(GENERIC);
    expect(adminError.fieldReasons).toEqual([NAME_TOO_LONG, ENGLISH_DEFAULT, TIMING_TOO_LONG]);
  });

  it("details가 없거나 모양이 다르면 빈 배열이다 — 모르는 것을 지어내지 않는다", async () => {
    const shapes: unknown[] = [
      { error: { code: "ADMIN_FORBIDDEN", message: "Admin access is required." } },
      { error: { code: "VALIDATION_ERROR", message: GENERIC, details: null } },
      { error: { code: "VALIDATION_ERROR", message: GENERIC, details: { fields: "nope" } } },
      { error: { code: "VALIDATION_ERROR", message: GENERIC, details: { fields: [null, 7, "x"] } } },
      { error: { code: "VALIDATION_ERROR", message: GENERIC, details: { fields: [{ field: "name" }] } } },
      {
        error: {
          code: "VALIDATION_ERROR",
          message: GENERIC,
          // 문자열이 아닌 값·빈 문자열은 사유가 아니다.
          details: { fields: [{ field: "name", constraints: { a: 1, b: "   ", c: null } }] }
        }
      }
    ];
    for (const body of shapes) {
      fetchMock.mockResolvedValueOnce(jsonResponse(400, body));
      const error = (await createItemTemplate({ name: "x" }).catch((caught: unknown) => caught)) as AdminApiError;
      expect(error, JSON.stringify(body)).toBeInstanceOf(AdminApiError);
      expect(error.fieldReasons, JSON.stringify(body)).toEqual([]);
    }
  });

  it("본문이 아예 JSON이 아니어도 던지는 것은 종전 그대로다(사유만 비어 있다)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));
    const error = (await updateAdminCategory("cat-1", { active: false }).catch(
      (caught: unknown) => caught
    )) as AdminApiError;
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error.status).toBe(502);
    expect(error.fieldReasons).toEqual([]);
  });
});

describe("ⓑ 화면 문장 — 일반 문장 뒤에 한국어 사유만 붙는다 (라운드 110)", () => {
  it("한국어 사유는 봉투의 일반 문장 뒤에 순서대로 붙는다", () => {
    const error = new AdminApiError(400, GENERIC, "VALIDATION_ERROR", [NAME_TOO_LONG, TIMING_TOO_LONG]);
    expect(writeErrorMessage(error, ITEM_FALLBACK)).toBe(`${GENERIC} ${NAME_TOO_LONG} ${TIMING_TOO_LONG}`);
  });

  it("영문 사유는 화면에 서지 않는다 — 영문 필드명이 새어 나갈 길이 없다", () => {
    const error = new AdminApiError(400, GENERIC, "VALIDATION_ERROR", [ENGLISH_DEFAULT]);
    const message = writeErrorMessage(error, ITEM_FALLBACK);
    expect(message).toBe(GENERIC);
    expect(message).not.toContain("necessityLevel");
    expect(message).not.toContain("must be");
  });

  it("섞여 오면 한국어만 남는다", () => {
    const error = new AdminApiError(400, GENERIC, "VALIDATION_ERROR", [
      ENGLISH_DEFAULT,
      INVISIBLE_CHAR,
      "sponsorLabel must be shorter than or equal to 80 characters"
    ]);
    expect(writeErrorMessage(error, ITEM_FALLBACK)).toBe(`${GENERIC} ${INVISIBLE_CHAR}`);
  });

  it("사유가 없으면 종전과 한 글자도 다르지 않다", () => {
    expect(writeErrorMessage(new AdminApiError(400, GENERIC, "VALIDATION_ERROR"), ITEM_FALLBACK)).toBe(GENERIC);
    expect(writeErrorMessage(new AdminApiError(403, "Admin access is required.", "ADMIN_FORBIDDEN"), ITEM_FALLBACK)).toBe(
      ITEM_FALLBACK
    );
    expect(writeErrorMessage(new TypeError("boom"), ITEM_FALLBACK)).toBe(ITEM_FALLBACK);
  });

  it("영문 봉투 + 한국어 사유면 폴백 뒤에 사유가 붙는다(한 문장도 잃지 않는다)", () => {
    const error = new AdminApiError(400, "Bad Request", "VALIDATION_ERROR", [INVISIBLE_CHAR]);
    expect(writeErrorMessage(error, ITEM_FALLBACK)).toBe(`${ITEM_FALLBACK} ${INVISIBLE_CHAR}`);
  });

  it("봉투 문장과 같은 사유는 두 번 서지 않는다", () => {
    const error = new AdminApiError(400, INVISIBLE_CHAR, "VALIDATION_ERROR", [INVISIBLE_CHAR]);
    expect(writeErrorMessage(error, ITEM_FALLBACK)).toBe(INVISIBLE_CHAR);
  });
});

describe("ⓒ 소스 구조 계약 — 필드명은 어드민 번들에 들어오지 않는다 (라운드 110)", () => {
  it("admin-api.ts는 constraints의 값만 걷고 field 키는 꺼내지 않는다", () => {
    const source = readAdminSource("src/lib/admin-api.ts");
    // 걷는 자리는 있다.
    expect(source).toContain("readFieldReasons");
    expect(source).toContain("fieldReasons");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    // ⚠️ 부정 단언: 코드가 `field` 키를 읽어 내는 꼴이 0건이다(읽지 않는 것이 곧 샐 수 없다는 보장).
    expect(codeOnly, "admin-api.ts가 details.fields의 영문 필드명을 꺼내고 있다").not.toMatch(
      /\.field\b|\["field"\]|\bfield:\s/
    );
  });

  it("write-error-copy.ts는 사유를 거를 때도 같은 한글 술어 하나만 쓴다", () => {
    const source = readAdminSource("src/lib/write-error-copy.ts");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    // 문구를 짓지 않는다는 종전 계약 그대로(한국어 리터럴 0건).
    expect(codeOnly).not.toMatch(/[가-힣]/);
    // 판정의 재료는 그 파일이 이미 갖고 있던 술어 하나다 — 두 번째 술어를 만들지 않았다.
    expect(codeOnly).toContain("HANGUL_SYLLABLE.test");
    expect((codeOnly.match(/\\uAC00-\\uD7A3/g) ?? []).length).toBe(1);
  });
});

describe("ⓓ 서버가 그 한국어 문장을 정말로 짓는다 (기대값의 출처)", () => {
  const dto = () => readRepoSource("apps/api/src/admin/dto/admin.dto.ts");

  it("폭 상한 다섯 칸이 어드민 화면의 라벨로 사유를 짓는다", () => {
    const source = dto();
    for (const label of ["준비템 이름", "타이밍 라벨", "상품 링크 제목", "스폰서 표시 문구", "고지 문구"]) {
      expect(source, `${label} 라벨이 서버 문장에서 사라졌다`).toContain(`tooLongMessage("${label}")`);
    }
    // 문장의 꼴 — 위 리터럴 둘이 이 템플릿에서 나온다(숫자는 데코레이터의 상한 하나에서 온다).
    expect(source).toContain("최대 길이는 $constraint1자예요. 넘는 값은 잘라 저장하지 않아요.");
  });

  it("이 파일의 기대 리터럴이 그 템플릿과 어긋나지 않는다", () => {
    const source = dto();
    const templateMatch = /return `\$\{fieldLabel\} (.+)`;/.exec(source);
    expect(templateMatch, "tooLongMessage의 템플릿을 찾지 못했다").not.toBeNull();
    const tail = (templateMatch as RegExpExecArray)[1];
    expect(NAME_TOO_LONG).toBe(`준비템 이름 ${tail.replace("$constraint1", "80")}`);
    expect(TIMING_TOO_LONG).toBe(`타이밍 라벨 ${tail.replace("$constraint1", "80")}`);
  });

  it("전용 코드 셋은 종전대로 봉투 message에 사유를 싣는다 — 이 트랙이 건드리지 않은 자리", () => {
    const write = readRepoSource("apps/api/src/admin/admin-catalog-write.service.ts");
    expect(write).toContain("ADMIN_SPONSOR_LABEL_REQUIRED");
    expect(write).toContain("최소 가격이 최대 가격보다 커요. 최소 가격을 최대 가격 이하로 맞춰 주세요.");
    const categories = readRepoSource("apps/api/src/admin/admin-categories.service.ts");
    expect(categories).toContain("이미 있는 카테고리 이름이에요. 다른 이름으로 바꿔 주세요.");
  });
});

describe("ⓔ 이 계약의 한계를 값으로 적는다", () => {
  it("어드민에는 DOM 테스트 환경이 없다 — jsdom·testing-library 0건", () => {
    const pkg = JSON.parse(readAdminSource("package.json")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const installed = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of ["jsdom", "happy-dom", "@testing-library/react", "@testing-library/dom"]) {
      expect(installed[name], `${name}이 생겼다 — 그날 이 한계 문단을 다시 적어야 한다`).toBeUndefined();
    }
    // vitest 설정 파일도 없다(= node 환경 기본값). 생기는 날 environment 지정을 함께 봐야 한다.
    expect(existsSync(join(adminRoot, "vitest.config.ts"))).toBe(false);
  });
});
