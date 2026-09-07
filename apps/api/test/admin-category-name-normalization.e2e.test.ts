import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { customCategoryNameMaxLength } from "../src/finance/dto/custom-categories.dto";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * 라운드 109 — **어드민 분류 이름 유입 지점의 접기와 거절**.
 *
 * 왜 이 파일이 생겼나(실측이 먼저였다):
 * 종전(그때는 참): `admin/dto/admin-categories.dto.ts`의 `@Transform`은 `.trim()`뿐이었다.
 * `trim()`은 이름 **양끝**만 손대므로 이름 **안쪽**의 개행·제어문자는 `@MinLength(1)`·
 * `@MaxLength(50)`을 그대로 통과해 `categories.name`에 앉았다. 이 스위트를 쓰기 전에 같은
 * 경로(PATCH /admin/categories/:id)로 재현한 값 — 아래 표는 **그때 실제로 관측된 것**이다:
 *
 *   요청 name(이스케이프 표기)     | 응답 | 저장된 코드포인트
 *   ------------------------------|------|------------------------------------------------
 *   "\u202E전세 500만원"          | 200  | U+202E U+C804 U+C138 U+0020 U+0035 U+0030 …
 *   "산후\u0085도우미"            | 200  | U+C0B0 U+D6C4 U+0085 U+B3C4 U+C6B0 U+BBF8
 *   "산후\n도우미"                | 200  | U+C0B0 U+D6C4 U+000A U+B3C4 U+C6B0 U+BBF8
 *   "\u200B\u200B"(ZWSP만)        | 200  | U+200B U+200B
 *   "산후  도우미"(겹공백)        | 200  | … U+D6C4 U+0020 U+0020 U+B3C4 …
 *   "❤️" x 26 (52 CP)   | 500  | (저장 안 됨 — Prisma P2000 → INTERNAL_SERVER_ERROR)
 *
 * 그 셋이 각각 무엇을 깨뜨리는지는 DTO 주석이 적는다. 여기서는 **고친 뒤의 값**을 리터럴로
 * 못 박는다(조립기를 다시 불러 만든 값과 비교하지 않는다).
 *
 * 시드 21행은 건드리지 않는다: 이 파일이 만든 전용 code 접두 행에만 쓰고 afterEach에서 지운다
 * (admin-categories-users-lookup.e2e.test.ts와 같은 규율 · 같은 이유).
 */

const PASSWORD = "r109-e2e-password-1";

/** 이 스위트 전용 카테고리 code 접두사 — 자가 치유 스윕의 기준이기도 하다. */
const TEST_CATEGORY_CODE_PREFIX = "r109_name_";

function parseSetCookies(response: request.Response): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const headers: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies: Record<string, string> = {};
  for (const header of headers) {
    const [pair] = header.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
  }
  return cookies;
}

/** 저장값을 **코드포인트 나열**로 읽는다 — 보이지 않는 글자는 눈으로 비교할 수 없다. */
function codePointsOf(value: string): string {
  return [...value]
    .map((character) => `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

describe("라운드 109 — 어드민 분류 이름: 접기와 보이지 않는 문자 거절", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const createdCategoryIds: string[] = [];
  const createdAdminUserIds: string[] = [];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);

    // 앞선 실행이 중간에 죽어 남긴 **이 스위트 전용** 행을 먼저 쓸어낸다(접두사가 이 파일
    // 것만 고르므로 시드 21행은 절대 대상이 아니다).
    const leftovers = await prisma.category.findMany({
      where: { code: { startsWith: TEST_CATEGORY_CODE_PREFIX } },
      select: { id: true }
    });
    await prisma.category.deleteMany({ where: { id: { in: leftovers.map((row) => row.id) } } });
  });

  afterEach(async () => {
    try {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      await prisma.adminSession.deleteMany({ where: { adminUserId: { in: createdAdminUserIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminUserIds } } });
    } finally {
      createdCategoryIds.length = 0;
      createdAdminUserIds.length = 0;
      await app.close();
    }
  });

  /** admin-categories-users-lookup.e2e.test.ts와 같은 실제 플로우: 로그인 + TOTP 등록. */
  async function adminSession() {
    const email = `r109-${randomUUID()}@wooriai.local`;
    const admin = await prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role: "admin", active: true }
    });
    createdAdminUserIds.push(admin.id);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookies = parseSetCookies(loginResponse);
    const cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    const csrfToken = cookies.admin_csrf as string;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: await generateTotp({ secret: setupStart.body.secret as string }) })
      .expect(200);

    return { cookie, csrfToken };
  }

  /** 시드 행을 건드리지 않기 위한 전용 카테고리. 이름은 호출부가 준다(중복 검사 회피). */
  async function createTestCategory(name: string) {
    const category = await prisma.category.create({
      data: {
        code: `${TEST_CATEGORY_CODE_PREFIX}${randomUUID().slice(0, 8)}`,
        name,
        // 시드 정식(10~999)·별칭/스텁(1001~1009) **뒤**, 커스텀 대역(2000~) **앞**의 빈 칸.
        //
        // 왜 큰 값(예: 50_000)이 아닌가 — 실측으로 깨졌다: 이 행들은 `household_id IS NULL`이라
        // `GET /categories`에 그대로 실리고, custom-categories.e2e.test.ts는 "커스텀 행이 목록의
        // **마지막**"을 단언한다(displayOrder ASC). 큰 값을 쓰면 이 스위트가 사는 동안 그 단언이
        // 남의 실행에서 깨진다. 1500은 그 단언을 건드리지 않는 유일한 대역이다.
        displayOrder: 1_500,
        active: true,
        selectable: true
      }
    });
    createdCategoryIds.push(category.id);
    return category;
  }

  function patchName(session: { cookie: string; csrfToken: string }, categoryId: string, name: string) {
    return request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ name });
  }

  async function storedName(categoryId: string): Promise<string> {
    const row = await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } });
    return row?.name ?? "";
  }

  // ------------------------------------------------------------------ 상한 대조

  it("상한 50은 세 자리에서 같은 값이다 — DTO 리터럴 · 커스텀 쪽 상수 · 컬럼 폭", () => {
    const dtoSource = readFileSync(join(process.cwd(), "src", "admin", "dto", "admin-categories.dto.ts"), "utf8");
    const dtoLiteral = /const CATEGORY_NAME_MAX_LENGTH = (\d+);/.exec(dtoSource);
    expect(dtoLiteral, "admin-categories.dto.ts에서 CATEGORY_NAME_MAX_LENGTH를 찾지 못했다").not.toBeNull();
    expect(Number(dtoLiteral![1])).toBe(50);

    // 같은 컬럼을 무는 다른 유입 지점(가구 커스텀). 갈리면 유입 경로마다 상한이 달라진다.
    expect(customCategoryNameMaxLength()).toBe(50);

    // 컬럼 자신 — 여기가 진짜 단일 소스이고, 위 둘은 그것을 무는 값이다.
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    expect(schema).toContain("name             String   @db.VarChar(50)");
  });

  // ------------------------------------------------------------ 접기(조용해도 안전)

  it("공백류는 조용히 한 칸으로 접힌다 — 사람이 의도한 이름이 그대로 남는다", async () => {
    const session = await adminSession();

    // 왼쪽이 요청 값, 오른쪽이 **저장되기를 기대하는 리터럴**이다.
    const folded: [string, string][] = [
      ["  산후  도우미  ", "산후 도우미"],
      ["산후\t도우미", "산후 도우미"],
      ["산후\r\n도우미", "산후 도우미"],
      ["산후\u00A0도우미", "산후 도우미"],
      ["산후\u2028도우미", "산후 도우미"],
      ["산후\u3000도우미", "산후 도우미"],
      ["산후\uFEFF도우미", "산후 도우미"]
    ];

    for (const [requested, expected] of folded) {
      // 전부 같은 이름으로 접히므로 한 번에 하나씩만 살려 둔다(중복 검사가 먼저 걸린다).
      const category = await createTestCategory(`접기전-${randomUUID().slice(0, 8)}`);
      const response = await patchName(session, category.id, requested).expect(200);

      expect(response.body.category.name, `${codePointsOf(requested)} 의 응답`).toBe(expected);
      expect(await storedName(category.id), `${codePointsOf(requested)} 의 저장값`).toBe(expected);

      // 다음 회차가 같은 이름으로 중복에 걸리지 않게 이 행을 비켜 놓는다.
      await prisma.category.update({
        where: { id: category.id },
        data: { name: `접기후-${randomUUID().slice(0, 8)}` }
      });
    }
  });

  it("공백만 있는 이름은 접힌 뒤 빈 문자열이라 400이다 (라운드 28 F2 그대로)", async () => {
    const session = await adminSession();
    const category = await createTestCategory(`공백-${randomUUID().slice(0, 8)}`);
    const before = await storedName(category.id);

    for (const blank of ["   ", "\t\t", "\u3000\u3000"]) {
      await patchName(session, category.id, blank)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    }
    expect(await storedName(category.id)).toBe(before);
  });

  // -------------------------------------------- 거절(운영자가 이유를 알아야 하는 부류)

  it("접힌 뒤에도 남는 보이지 않는 문자는 400 VALIDATION_ERROR고, 문구가 그 코드포인트를 말한다", async () => {
    const session = await adminSession();

    // 요청 값 → 오류 문구가 지목해야 하는 코드포인트(전부 리터럴).
    const rejected: [string, string][] = [
      // ① 양방향 제어 — 뒤따르는 문장의 표시 순서를 뒤집어 금액을 사실과 다르게 보이게 한다.
      ["\u202E전세 500만원", "U+202E"],
      ["전세\u202D500만원", "U+202D"],
      ["\u202A전세 500만원", "U+202A"],
      ["\u200F전세 500만원", "U+200F"],
      ["\u2066전세 500만원", "U+2066"],
      // ② NEL — JS `\s`가 모르는 줄바꿈. iOS CoreText는 문단 구분자로 취급한다.
      ["산후\u0085도우미", "U+0085"],
      // ③ 폭 0 문자 — 이것만으로 된 이름은 종전에 빈 이름 검사도 통과했다.
      ["\u200B\u200B", "U+200B"],
      ["산후\u200B도우미", "U+200B"],
      ["산후\u200D도우미", "U+200D"],
      ["산후\u00AD도우미", "U+00AD"],
      // ④ C0 제어 — NUL은 PostgreSQL이 아예 받지 못한다.
      ["산후\u0000도우미", "U+0000"],
      // ⑤ 짝 없는 서로게이트 — 유효한 UTF-8이 아니라 저장 자체가 500이 될 값이다.
      ["산후\uD800도우미", "U+D800"]
    ];

    for (const [requested, expectedCodePoint] of rejected) {
      const category = await createTestCategory(`거절-${randomUUID().slice(0, 8)}`);
      const before = await storedName(category.id);

      const response = await patchName(session, category.id, requested).expect(400);
      expect(response.body.error.code, `${codePointsOf(requested)} 의 코드`).toBe("VALIDATION_ERROR");

      const field = response.body.error.details.fields[0];
      expect(field.field).toBe("name");
      expect(field.constraints.isSafeDisplayName).toBe(
        `이름에 화면에 보이지 않는 문자가 있어요(${expectedCodePoint}). 그 문자를 지우고 다시 저장해 주세요.`
      );

      // 거절은 **한 글자도 저장하지 않는다** — 부분 저장이 남으면 거절의 뜻이 없다.
      expect(await storedName(category.id), `${codePointsOf(requested)} 의 저장값`).toBe(before);
    }
  });

  it("정상 이모지 이름은 거절되지 않는다 — 없는 위험을 지어내지 않는다", async () => {
    const session = await adminSession();
    const category = await createTestCategory(`이모지-${randomUUID().slice(0, 8)}`);

    // 서로게이트 **쌍**(짝이 맞는 U+1F423)과 변형 선택자(U+FE0F)는 위험 집합이 아니다.
    const emojiName = "\u{1F423} 병아리 ❤️";
    const response = await patchName(session, category.id, emojiName).expect(200);
    expect(response.body.category.name).toBe(emojiName);
    expect(await storedName(category.id)).toBe(emojiName);
  });

  // ------------------------------------------------------------------ 길이 계수

  it("길이는 컬럼과 같은 단위(코드포인트)로 센다 — 종전 500이던 이모지 이름이 400이 된다", async () => {
    const session = await adminSession();
    const category = await createTestCategory(`길이-${randomUUID().slice(0, 8)}`);
    const before = await storedName(category.id);

    // "❤️"(하트+변형 선택자) 26쌍 = 52코드포인트. class-validator의 @MaxLength(50)은
    // 변형 선택자를 빼고 26으로 세어 통과시켰고, varchar(50)은 52로 세어 22001을 던졌다 —
    // 그 결과가 500 INTERNAL_SERVER_ERROR였다(실측).
    const heartName = "❤️".repeat(26);
    expect([...heartName].length).toBe(52);

    const response = await patchName(session, category.id, heartName).expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields[0].constraints.maxStoredCodePoints).toBe(
      "이름은 50자까지 저장할 수 있어요(지금 52자예요)."
    );
    expect(await storedName(category.id)).toBe(before);

    // 딱 50코드포인트는 종전대로 통과하고 51은 종전대로 400이다(경계는 움직이지 않았다).
    const fifty = "가".repeat(50);
    await patchName(session, category.id, fifty).expect(200);
    expect(await storedName(category.id)).toBe(fifty);
    await patchName(session, category.id, "가".repeat(51))
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    expect(await storedName(category.id)).toBe(fifty);
  });

  // ---------------------------------------- 저장값 = 비교 키의 근거값 (라운드 107 D6)

  it("저장값과 중복 비교 키가 같은 접기를 지난다 — 공백 종류만 다른 이름은 중복이다", async () => {
    const session = await adminSession();
    const baseName = `산후 도우미 ${randomUUID().slice(0, 8)}`;
    await createTestCategory(baseName);
    const other = await createTestCategory(`다른-${randomUUID().slice(0, 8)}`);
    const before = await storedName(other.id);

    // 탭·겹공백은 접힌 뒤 위 이름과 같아진다. 종전에도 비교 키는 접었지만(라운드 107 D6)
    // 저장값은 접지 않았다 — 이제는 둘이 같은 접기를 지나므로 어긋날 수 없다.
    const collisions = [baseName.replace("산후 도우미", "산후\t도우미"), baseName.replace("산후 도우미", "산후  도우미")];
    for (const collision of collisions) {
      await patchName(session, other.id, collision)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_CATEGORY_NAME_DUPLICATE"));
    }
    expect(await storedName(other.id)).toBe(before);
  });
});
