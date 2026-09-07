import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminUser } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AdminAuthGuard } from "../src/admin/admin-auth.guard";
import { AdminMfaExempt } from "../src/admin/admin-mfa-exempt.decorator";
import { RequireAdminRoles } from "../src/admin/require-admin-roles.decorator";

/**
 * A-1 — AdminAuthGuard가 읽는 **두 메타데이터 키의 방향**을 고정한다. DB 불필요.
 *
 * 종전에는 두 키 모두 `reflector.get(..., context.getHandler())`로 **핸들러만** 읽었다.
 * 그때도 클래스에 `@RequireAdminRoles(...)`를 단 컨트롤러가 저장소에 0건이라 실제로 열린
 * 경로는 없었지만, 두 키의 놓쳤을 때 방향이 서로 반대라 위험이 대칭이 아니었다:
 *
 *  - ADMIN_ROLES_KEY  : 없으면 "역할 제한 없음" → **fail-open**. 다음 사람이 컨트롤러 전체를
 *                       admin 전용으로 만들려고 클래스에 붙이면, 그 컨트롤러의 모든 라우트가
 *                       editor·analyst에게 조용히 열렸을 것이다(예외도 로그도 없다).
 *  - ADMIN_MFA_EXEMPT_KEY : 없으면 MFA를 **요구** → **fail-closed**. 그래서 이 키는 지금도
 *                       핸들러 전용으로 남긴다 — 클래스까지 읽게 만드는 것이 오히려 확장이다.
 *
 * 이 파일은 그 두 문장을 실행 가능한 형태로 붙잡는다. e2e로는 재현할 수 없다(클래스에 그
 * 데코레이터를 단 컨트롤러가 없고, 만들려면 이 트랙의 편집 금지 파일을 건드려야 한다).
 */

const ENROLLED_ADMIN = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "guard-metadata@wooriai.local",
  role: "editor",
  mfaEnabledAt: new Date("2026-01-01T00:00:00.000Z")
} as unknown as AdminUser;

const UNENROLLED_ADMIN = {
  ...ENROLLED_ADMIN,
  mfaEnabledAt: null
} as unknown as AdminUser;

function buildGuard(admin: AdminUser) {
  const sessions = {
    async validateSession() {
      return { admin, sessionId: "session-1" };
    }
  };
  const legacyGuard = {
    canActivate() {
      throw new Error("legacy fallback must not run: the request carries an admin_session cookie");
    }
  };
  return new AdminAuthGuard(new Reflector(), sessions as never, legacyGuard as never);
}

/**
 * GET이라 CSRF 이중 제출 검사는 지나간다(state-changing 메서드만 검사한다).
 *
 * `handler`로는 **프로토타입의 메서드 자체**를 넘겨야 한다 — `SetMetadata`의 메서드
 * 데코레이터가 메타데이터를 그 함수 객체에 붙이므로, 감싼 화살표 함수를 넘기면
 * 리플렉터가 핸들러 메타데이터를 못 찾아 테스트가 클래스 쪽만 재게 된다.
 */
function contextFor(handler: (...args: never[]) => unknown, target: object): ExecutionContext {
  const request = { headers: { cookie: "admin_session=any-token" }, method: "GET" };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => target
  } as unknown as ExecutionContext;
}

// 클래스 전체를 admin 전용으로 선언한 컨트롤러 — 오늘 저장소에는 없지만, 다음 사람이
// 가장 자연스럽게 쓸 모양이다.
@RequireAdminRoles("admin")
class ClassGatedController {
  listed() {}

  @RequireAdminRoles("admin", "editor")
  widened() {}
}

class HandlerGatedController {
  @RequireAdminRoles("admin")
  restricted() {}

  open() {}
}

// MFA 면제를 클래스에 단 컨트롤러 — 이쪽은 **무시되어야** 한다.
@AdminMfaExempt()
class ClassExemptController {
  handler() {}
}

class HandlerExemptController {
  @AdminMfaExempt()
  exempt() {}

  gated() {}
}

describe("AdminAuthGuard 메타데이터 방향 (A-1)", () => {
  it("ADMIN_ROLES_KEY: 클래스에 붙은 역할 제한이 적용된다 (fail-open 방향이라 반드시 읽어야 한다)", async () => {
    const guard = buildGuard(ENROLLED_ADMIN); // role: editor
    const context = contextFor(ClassGatedController.prototype.listed, ClassGatedController);

    // 종전 구현(핸들러 전용)에서는 이 호출이 그냥 true였다 — 그것이 A-1의 조용한 구멍이다.
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: "ADMIN_FORBIDDEN" },
      status: 403
    });
  });

  it("ADMIN_ROLES_KEY: 핸들러가 클래스를 덮는다 (household-role.guard.ts와 같은 의미론)", async () => {
    const guard = buildGuard(ENROLLED_ADMIN); // role: editor
    const context = contextFor(ClassGatedController.prototype.widened, ClassGatedController);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("ADMIN_ROLES_KEY: 핸들러에만 붙은 종전 관례는 그대로 동작한다 (제한 라우트 403 · 무표시 라우트 통과)", async () => {
    const restricted = contextFor(HandlerGatedController.prototype.restricted, HandlerGatedController);
    await expect(buildGuard(ENROLLED_ADMIN).canActivate(restricted)).rejects.toMatchObject({
      response: { code: "ADMIN_FORBIDDEN" }
    });

    const open = contextFor(HandlerGatedController.prototype.open, HandlerGatedController);
    await expect(buildGuard(ENROLLED_ADMIN).canActivate(open)).resolves.toBe(true);
  });

  it("ADMIN_MFA_EXEMPT_KEY: 클래스에 붙여도 면제되지 않는다 (fail-closed라 핸들러 전용으로 남긴다)", async () => {
    const guard = buildGuard(UNENROLLED_ADMIN);
    const context = contextFor(ClassExemptController.prototype.handler, ClassExemptController);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: "ADMIN_MFA_SETUP_REQUIRED" },
      status: 403
    });
  });

  it("ADMIN_MFA_EXEMPT_KEY: 핸들러에 붙은 면제는 종전 그대로 통한다", async () => {
    const exempt = contextFor(HandlerExemptController.prototype.exempt, HandlerExemptController);
    await expect(buildGuard(UNENROLLED_ADMIN).canActivate(exempt)).resolves.toBe(true);

    const gated = contextFor(HandlerExemptController.prototype.gated, HandlerExemptController);
    await expect(buildGuard(UNENROLLED_ADMIN).canActivate(gated)).rejects.toMatchObject({
      response: { code: "ADMIN_MFA_SETUP_REQUIRED" }
    });
  });
});
