import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_ROLES_KEY,
  HouseholdRoleGuard,
  RequireHouseholdRoles
} from "../src/common/guards/household-role.guard";

/**
 * ⚠️ **두 시점 — 이 파일이 재는 갈래가 하나에서 둘로 늘었다.**
 *
 * 종전(그때는 참): 이 파일은 **역할이 선언된 뒤**의 판정만 셌다 — 허용 역할 통과 · 그 밖 403 ·
 * 데코레이터가 메타데이터를 실제로 붙이는가. 그때도 그 셋은 정확했고 지금도 그대로 선다.
 *
 * → 이제: **선언이 아예 없는 갈래**(`requiredRoles.length === 0` → `return true`)를 함께 잰다.
 * 그 갈래는 `@UseGuards(HouseholdRoleGuard)`만 붙이고 `@RequireHouseholdRoles(...)`를 빠뜨렸을 때
 * 밟히는데, 예외도 로그도 없이 **조용히 전부 통과**한다. 대칭 자리인 어드민 쪽은 같은 fail-open을
 * 이유와 함께 적고 전용 테스트를 세워 두었다(`src/admin/require-admin-roles.decorator.ts`의
 * 머리말 · `test/admin-auth-guard-metadata.test.ts`). 가구 쪽에만 그 한 쌍이 없었다.
 *
 * ## fail-open을 **유지**한다 — 근거 셋 (소스 변경 0건)
 *
 * 1. **오늘 열린 경로가 0건이다(실측).** 이 저장소에서 `HouseholdRoleGuard`를 다는 자리는 둘뿐이고
 *    (`households/custom-categories.controller.ts` 클래스 · `onboarding/children.controller.ts`
 *    핸들러) 둘 다 `@RequireHouseholdRoles(...)`를 함께 달고 있다. 즉 fail-closed로 뒤집어도
 *    **오늘 달라지는 응답이 한 건도 없다** — 고칠 실물 결함이 없고, 남는 것은 미래의 실수뿐이다.
 * 2. **그 미래의 실수는 이 파일 아래쪽 스윕이 더 이르게, 더 시끄럽게 잡는다.** 런타임 403은 그
 *    라우트를 실제로 눌러 본 사람에게만 보이지만, 스윕은 데코레이터를 빠뜨린 커밋에서 바로
 *    빨개진다. 같은 결함을 더 앞에서 막는 장치가 서면 런타임 의미론을 바꿀 이유가 사라진다.
 * 3. **어드민 쪽의 비대칭은 "역할 키는 fail-closed여야 한다"가 아니다.** 그쪽이 갈라 둔 축은
 *    *확장의 방향*이다 — `ADMIN_ROLES_KEY`는 **fail-open이고 그대로 두었으며**(못 읽으면 "역할
 *    제한 없음"), 클래스까지 읽게 넓힌 것이 *조이는* 방향이라 안전했다. 반대로
 *    `ADMIN_MFA_EXEMPT_KEY`는 fail-closed라 같은 확장이 *푸는* 방향이 되므로 핸들러 전용으로
 *    남겼다. 그리고 그 데코레이터의 머리말은 의미론의 기준으로 **이 가드 파일을 지목한다**
 *    ("`common/guards/household-role.guard.ts`와 같은 의미론"). 둘 중 하나만 뒤집으면 그
 *    상호 참조가 거짓이 되고, 다음 사람이 배워야 할 규칙이 하나에서 둘로 는다.
 *
 * 그래서 이 파일이 하는 일은 **방향을 바꾸는 것이 아니라 방향을 고정하는 것**이다: 아래 첫
 * describe가 "선언이 없으면 통과한다"를 명문으로 붙잡고, 둘째 describe가 "그 상태로 배포되는
 * 라우트는 0건"을 스윕으로 붙잡는다.
 */

function createContext(role: string, householdId = "household-1") {
  const handler = () => undefined;
  Reflect.defineMetadata(HOUSEHOLD_ROLES_KEY, ["owner", "co_parent"], handler);

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        params: { householdId },
        user: {
          households: [{ id: "household-1", role }]
        }
      })
    })
  };
}

describe("HouseholdRoleGuard", () => {
  it("allows explicitly permitted household roles", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    expect(guard.canActivate(createContext("owner") as never)).toBe(true);
    expect(guard.canActivate(createContext("co_parent") as never)).toBe(true);
  });

  it("rejects authenticated users without a permitted household role", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    expect(() => guard.canActivate(createContext("viewer") as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(createContext("owner", "other-household") as never)).toThrow(
      ForbiddenException
    );
  });

  it("stores required role metadata with the decorator", () => {
    class TestController {
      @RequireHouseholdRoles("viewer")
      handler() {
        return true;
      }
    }

    expect(Reflect.getMetadata(HOUSEHOLD_ROLES_KEY, TestController.prototype.handler)).toEqual([
      "viewer"
    ]);
  });
});

// ---------------------------------------------------------------------------
// 메타데이터 부재 갈래 + 클래스/핸들러 우선순위
// (어드민 쌍둥이 test/admin-auth-guard-metadata.test.ts와 같은 모양)
// ---------------------------------------------------------------------------

/**
 * 메타데이터를 **아무 데도 붙이지 않은** 실행 컨텍스트. 핸들러는 프로토타입의 메서드 자체를
 * 넘긴다 — `SetMetadata`의 메서드 데코레이터가 메타데이터를 그 함수 객체에 붙이므로, 감싼
 * 화살표 함수를 넘기면 리플렉터가 핸들러 쪽을 못 찾아 클래스 쪽만 재게 된다(어드민 쌍둥이의
 * `contextFor`가 적어 둔 그 함정 그대로다).
 */
function contextFor(handler: (...args: never[]) => unknown, target: object, role = "viewer") {
  return {
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({
      getRequest: () => ({
        params: { householdId: "household-1" },
        user: { households: [{ id: "household-1", role }] }
      })
    })
  };
}

// 가드만 달고 역할 선언을 빠뜨린 컨트롤러 — 오늘 저장소에는 없지만, 빠뜨렸을 때의 모양이다.
class UndeclaredController {
  handler() {}
}

// 클래스 전체를 owner/co_parent로 좁힌 컨트롤러(= custom-categories.controller.ts의 모양).
@RequireHouseholdRoles("owner", "co_parent")
class ClassGatedController {
  inherited() {}

  @RequireHouseholdRoles("viewer")
  narrowed() {}
}

describe("HouseholdRoleGuard 메타데이터 부재 갈래", () => {
  /**
   * ⚠️ **이 단언은 fail-open을 승인하는 것이 아니라 고정하는 것이다.** 파일 머리말의 근거 셋을
   * 읽고 바꿀 것 — 바꾸기로 한다면 이 단언이 **가장 먼저** 빨개져야 한다(그것이 이 줄의 값이다).
   * 뒤집는 쪽을 고르면 여기가 `toThrow(ForbiddenException)`이 되고, 같은 라운드에
   * `require-admin-roles.decorator.ts`의 상호 참조 문장도 함께 움직여야 한다.
   */
  it("역할 선언이 아예 없으면 조용히 통과한다 (fail-open — 예외도 로그도 없다)", () => {
    const guard = new HouseholdRoleGuard(new Reflector());
    const context = contextFor(UndeclaredController.prototype.handler, UndeclaredController);

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("가구 구성원이 아예 아닌 사용자도 선언이 없으면 통과한다 (부재가 판정을 통째로 건너뛴다)", () => {
    const guard = new HouseholdRoleGuard(new Reflector());
    const context = {
      getHandler: () => UndeclaredController.prototype.handler,
      getClass: () => UndeclaredController,
      // 가구도 없고 householdId도 없다 — 선언이 있었다면 403이 될 요청이다.
      switchToHttp: () => ({ getRequest: () => ({ params: {}, user: { households: [] } }) })
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("클래스에 붙은 역할 제한이 그 컨트롤러의 라우트에 적용된다", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    expect(() =>
      guard.canActivate(contextFor(ClassGatedController.prototype.inherited, ClassGatedController, "viewer") as never)
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(contextFor(ClassGatedController.prototype.inherited, ClassGatedController, "owner") as never)
    ).toBe(true);
  });

  it("핸들러가 클래스를 덮는다 (getAllAndOverride의 의미론 — 어드민 쌍둥이와 같다)", () => {
    const guard = new HouseholdRoleGuard(new Reflector());

    // 클래스는 owner/co_parent만 허용하지만 핸들러가 viewer로 덮었다.
    expect(
      guard.canActivate(contextFor(ClassGatedController.prototype.narrowed, ClassGatedController, "viewer") as never)
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(ClassGatedController.prototype.narrowed, ClassGatedController, "owner") as never)
    ).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// 라우트 스윕 — 가드를 단 자리가 전부 역할을 선언했는가
// ---------------------------------------------------------------------------

const SRC_DIR = join(__dirname, "..", "src");

/** `apps/api/src/**`의 .ts 파일 전부(상대 경로, 슬래시 표기). */
function collectSourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectSourceFiles(full));
    else if (entry.name.endsWith(".ts")) found.push(relative(SRC_DIR, full).split(sep).join("/"));
  }
  return found;
}

/**
 * `HouseholdRoleGuard`를 실은 `@UseGuards(...)` 하나가 속한 **연속 데코레이터 블록**을 되돌린다.
 * 데코레이터는 대상(클래스/메서드) 바로 위에 빈 줄 없이 붙으므로, `@`로 시작하는 줄과 그
 * 여러 줄 인자 이어짐만 위아래로 훑으면 블록이 정확히 잡힌다. 주석은 블록 밖이라 섞이지 않는다.
 */
function decoratorBlockAround(lines: string[], index: number): string {
  let start = index;
  while (start > 0) {
    const previous = lines[start - 1].trim();
    if (previous.startsWith("@") || previous.endsWith(",") || previous.endsWith("(")) start -= 1;
    else break;
  }
  let end = index;
  while (end + 1 < lines.length) {
    const next = lines[end + 1].trim();
    if (next.startsWith("@") || next.endsWith(",") || next.endsWith("(") || next.startsWith(")")) end += 1;
    else break;
  }
  return lines.slice(start, end + 1).join("\n");
}

/**
 * `@UseGuards(...)`에 `HouseholdRoleGuard`가 실린 자리를 전량 긁어 `<파일>#<n> declared=…` 줄을
 * 만든다. import 줄과 문서 주석의 언급은 `@UseGuards`를 요구하는 것으로 걸러진다.
 *
 * ⚠️ **줄 번호를 싣지 않는다** — 대장이 무관한 편집(그 파일 위쪽에 주석 한 줄)마다 빨개지면
 * 다음 사람이 대장을 습관적으로 맞추게 되고, 그러면 진짜 신호도 함께 지나간다. 한 파일에 자리가
 * 둘 이상일 때를 위해 파일 안 등장 순서(`#1`, `#2`)만 붙인다 — `audit-envelope-fields.test.ts`의
 * 봉투 대장이 줄 번호 없이 `<파일> <action>`만 싣는 그 규율과 같다.
 */
function sweepHouseholdRoleGuardSites(): string[] {
  const sites: string[] = [];
  for (const file of collectSourceFiles(SRC_DIR)) {
    if (file.endsWith(".test.ts")) continue;
    const lines = readFileSync(join(SRC_DIR, file), "utf8").split(/\r?\n/);
    let seen = 0;
    lines.forEach((line, index) => {
      if (!line.trim().startsWith("@UseGuards(")) return;
      const block = decoratorBlockAround(lines, index);
      if (!block.includes("HouseholdRoleGuard")) return;
      seen += 1;
      sites.push(`${file}#${seen} declared=${block.includes("@RequireHouseholdRoles(")}`);
    });
  }
  return sites.sort();
}

/**
 * **대장**: 오늘 `HouseholdRoleGuard`를 다는 자리의 전부. 모두 `declared=true`여야 한다.
 *
 * ⚠️ **여기가 빨개진 라운드에게**: `declared=false`가 하나라도 생겼다면 그 라우트는
 * **역할 검사 없이 열린 채 배포된다**(가드가 fail-open이라 예외도 로그도 없다 — 위 첫 describe가
 * 그 사실을 명문으로 붙잡고 있다). 고치는 방법은 그 자리에 `@RequireHouseholdRoles(...)`를
 * 다는 것이지, 이 대장에 `declared=false` 줄을 더하는 것이 아니다. 자리가 정당하게 늘거나
 * 줄었을 때만 이 배열을 고친다.
 */
const HOUSEHOLD_ROLE_GUARD_SITES = [
  "households/custom-categories.controller.ts#1 declared=true",
  "onboarding/children.controller.ts#1 declared=true"
];

describe("HouseholdRoleGuard 라우트 스윕", () => {
  it("가드를 단 자리가 대장과 정확히 일치하고, 전부 역할을 선언했다", () => {
    expect(sweepHouseholdRoleGuardSites()).toEqual(HOUSEHOLD_ROLE_GUARD_SITES);
  });

  it("역할 선언을 빠뜨린 자리는 0건이다 (자리 목록과 무관한 단언 — 대장이 자리 수로 어긋나도 여기는 참이어야 한다)", () => {
    expect(sweepHouseholdRoleGuardSites().filter((site) => site.endsWith("declared=false"))).toEqual([]);
  });
});
