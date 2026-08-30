import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 75 적대적 리뷰 채택(P-1의 남은 사실) — **탈퇴 행을 쓰는 경로가 값이다.** DB 불필요.
 *
 * P-1이 고친 것은 하나다: 거절될 로그인이 `users` 행을 쓰지 못하게 했다. 그런데 그 자리의
 * 구조는 그대로다 — 파기 잡이 탈퇴 시각을 아는 방법이 여전히 `users.updated_at`
 * (Prisma `@updatedAt`) 하나뿐이라, **탈퇴한 행을 쓰는 새 경로가 생기면 파기 시계가 다시
 * 밀린다.** P-1의 부정 단언은 그 새 경로에 대해 **침묵한다**(그 단언은 카카오 로그인 시도
 * 하나만 본다). known-limitations P-1이 그 사실을 문서에 적어 뒀는데, 라운드 74 O-4의 규율은
 * 그 반대를 말한다 — **산문은 아무 단언도 깨지 못한다.**
 *
 * 그래서 이 파일이 `apps/api/src/**`에서 `user.update(`·`user.updateMany(`를 **전수로** 긁어,
 * 자리 셋이 **이유와 함께** 값으로 적혀 있는지 본다. 넷째 자리가 생기는 순간 여기가 빨개지고,
 * 그것을 여는 사람이 두 답 중 하나를 고르게 된다: **status를 보고 쓰거나, 왜 안 봐도 되는지를
 * 값으로 적거나.**
 *
 * ⚠️ **이 파일은 소스를 읽기만 한다** — 로직·상수·마이그레이션 0건.
 */

const API_DIR = join(__dirname, "..");
const SRC_DIR = join(API_DIR, "src");

/** `apps/api/src/**`의 `.ts` 전수(테스트·d.ts 제외). */
function sourcePaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".d.ts") || /\.(?:test|spec)\.ts$/.test(entry.name)) continue;
      found.push(relative(SRC_DIR, fullPath).split(sep).join("/"));
    }
  };
  walk(SRC_DIR);
  return found.sort();
}

/** 주석은 걷어낸다 — 이 저장소의 서버 주석은 자기가 무엇을 고쳤는지 설명하려고 코드를 인용한다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** `prisma.user.update(` · `tx.user.updateMany(` … 꼴의 쓰기 자리. */
const USER_ROW_WRITE = /\buser\.(update|updateMany)\(/g;

/**
 * `users` 행에 쓰는 자리 전수와 그 이유.
 *
 * ⚠️ **`user.create(`는 이 목록 밖이다** — 새 행은 탈퇴 행일 수 없다(생성 시 status는 `active`).
 * 여기서 세는 것은 **이미 있는 행을 만지는** 경로뿐이다.
 */
const USER_ROW_WRITE_SITES: Readonly<Record<string, { count: number; reason: string }>> = {
  "households/household-runtime.service.ts": {
    count: 2,
    reason:
      "① `attemptFindOrCreateProviderUser`의 로그인 갱신 — GAP-075 A 이후 `existing.status === \"active\"`" +
      "일 때만 `lastLoginAt`을 쓴다(거절될 로그인은 행을 만지지 않는다). " +
      "② `withdrawUser` — 탈퇴 그 자체를 만드는 쓰기라 `updated_at`이 **탈퇴 시각이 되는** 자리다. " +
      "이 둘이 탈퇴 행의 시계를 정하는 전부이고, 셋째가 생기면 그 시계가 다시 밀린다."
  },
  "worker/jobs/data-retention-purge.job.ts": {
    count: 1,
    reason:
      "파기 잡 phase 3의 **익명화** 쓰기다. 살아 있는 공유 가구 행이 참조해 하드 삭제할 수 없는 " +
      "탈퇴 행에서 식별자를 지운다 — 즉 이 쓰기는 시계를 미는 것이 아니라 **약속을 이행하는** 쪽이고, " +
      "그 뒤 `deletedAt`이 찍혀 같은 행이 다시 후보가 되지 않는다."
  }
};

describe("탈퇴 행을 쓰는 경로 전수 (라운드 75 적대적 리뷰 · P-1의 남은 사실)", () => {
  const writeCounts = (): Record<string, number> => {
    const found: Record<string, number> = {};
    for (const path of sourcePaths()) {
      const source = codeOnly(readFileSync(join(SRC_DIR, ...path.split("/")), "utf8"));
      const count = (source.match(USER_ROW_WRITE) ?? []).length;
      if (count > 0) found[path] = count;
    }
    return found;
  };

  it("스윕이 실제로 서버 소스를 훑는다 (빈 답이 조용히 통과하지 않게)", () => {
    expect(sourcePaths().length).toBeGreaterThan(100);
    expect(existsSync(join(SRC_DIR, "households", "household-runtime.service.ts"))).toBe(true);
    // 바늘 검증: 주석 안의 인용은 놓아주고 살아 있는 호출만 잡는다.
    expect((codeOnly('// await tx.user.update({ … })').match(USER_ROW_WRITE) ?? []).length).toBe(0);
    expect((codeOnly("await tx.user.update({ where: { id } });").match(USER_ROW_WRITE) ?? []).length).toBe(1);
  });

  it("`users` 행을 쓰는 자리가 예외 없이 이유와 함께 값으로 적혀 있다", () => {
    expect(writeCounts()).toEqual(
      Object.fromEntries(Object.entries(USER_ROW_WRITE_SITES).map(([path, entry]) => [path, entry.count]))
    );
    for (const [path, entry] of Object.entries(USER_ROW_WRITE_SITES)) {
      expect(entry.reason.trim().length, `${path}의 사유가 값으로 남아 있다`).toBeGreaterThan(60);
    }
  });

  it("로그인 갱신은 오늘도 status 갈래 안에 있다 (P-1이 고친 그 줄)", () => {
    const source = readFileSync(join(SRC_DIR, "households", "household-runtime.service.ts"), "utf8");
    // 갱신은 `active`일 때만이고, 그 밖의 status는 찾은 행을 그대로 돌려준다.
    expect(source).toMatch(
      /existing\.status === "active"\s*\?\s*await tx\.user\.update\(\{[\s\S]{0,160}?lastLoginAt: new Date\(\)/
    );
    expect(source).toContain(": existing");
    // 그리고 그 경로를 여는 사람이 반드시 읽는 자리에 경고가 남아 있다(라운드 74 O-4의 규율).
    expect(source).toContain("must not write to the row");
  });

  it("탈퇴 시각의 단일 소스가 아직 `updated_at`이다 (이 스윕이 필요한 이유)", () => {
    const schema = readFileSync(join(API_DIR, "prisma", "schema.prisma"), "utf8");
    const userModel = /model User \{([\s\S]*?)\n\}/.exec(schema)?.[1];
    expect(userModel, "schema.prisma에서 model User를 찾지 못했어요").toBeTruthy();
    expect(userModel!).toContain("@updatedAt");
    // `withdrawn_at` 컬럼이 생기면 이 스윕의 근거가 바뀐다 — 그때 이 파일을 다시 판정한다.
    expect(userModel!).not.toContain("withdrawnAt");
  });
});
