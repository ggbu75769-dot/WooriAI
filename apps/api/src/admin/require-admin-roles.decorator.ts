import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

export const ADMIN_ROLES_KEY = "adminRoles";

/**
 * Restricts a route to the given admin roles when authenticated via the admin JWT
 * (AdminAuthGuard). Routes without this decorator are open to any active admin
 * user regardless of role. The legacy dev/test `x-admin-token` fallback path is not
 * subject to this check — it grants full access, matching its dev-only purpose.
 *
 * ---
 *
 * ⚠️ **두 시점 — 이제 붙일 수 있는 자리가 둘이다(라운드 108 T23 이후).**
 *
 * 종전(그때는 참): 위 문단이 *"Restricts a **route**"* 라고만 적은 것은 정확했다. 그때
 * `AdminAuthGuard`는 이 키를 `reflector.get(ADMIN_ROLES_KEY, context.getHandler())`로 읽어
 * **핸들러 하나만** 봤고, 클래스에 이 데코레이터를 단 컨트롤러도 저장소에 0건이었다. 즉 클래스에
 * 붙이는 것은 문법적으로 가능하되 **아무 효력이 없었고**(예외도 로그도 없이 무시됐다), 그것이
 * 이 문단이 라우트만 말한 이유다.
 *
 * → 이제: 가드가 `getAllAndOverride(ADMIN_ROLES_KEY, [handler, class])`로 읽는다. 그래서
 *  · **클래스에 붙이면 그 컨트롤러의 모든 라우트**가 그 역할로 좁혀지고,
 *  · **핸들러가 클래스를 덮는다**(같은 저장소의 `common/guards/household-role.guard.ts`와 같은
 *    의미론). 클래스로 기본값을 세우고 특정 라우트만 의도적으로 넓히거나 좁힐 수 있다.
 * 실행 가능한 형태의 고정은 `apps/api/test/admin-auth-guard-metadata.test.ts`가 진다.
 *
 * ⚠️ **그리고 이 키와 MFA 면제 키는 놓쳤을 때의 방향이 서로 반대다** — 가드가 그 둘을 다르게
 * 읽는 이유가 이것이고, 그 사실이 **데코레이터 쪽에서도 읽혀야** 다음 사람이 "둘 다 클래스까지
 * 읽게 맞추자"는 대칭 오해를 하지 않는다.
 *  · **이 키(`ADMIN_ROLES_KEY`)는 fail-open이다.** 못 읽으면 위 문단 그대로 *"역할 제한 없음"* 이
 *    된다. 그래서 클래스까지 읽는 쪽이 **안전한 방향의 확장**이다(놓치던 선언을 이제 지킨다).
 *  · **`ADMIN_MFA_EXEMPT_KEY`(admin-mfa-exempt.decorator.ts)는 fail-closed다.** 못 읽으면 MFA를
 *    **요구**한다. 그래서 그 키는 지금도 **핸들러 전용**으로 남아 있다 — 클래스까지 읽게 만들면
 *    컨트롤러 하나에 붙은 `@AdminMfaExempt()`가 그 컨트롤러의 모든 라우트를 MFA 게이트에서
 *    빼내는 **fail-open 확장**이 된다. 같은 모양의 변경이 한쪽에서는 조이고 다른 쪽에서는
 *    푸는 것이 이 비대칭의 실물이다.
 */
export const RequireAdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
