import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ADM-127: 카테고리 관리 화면. API는 조회가 모든 어드민 역할, 수정만 admin 전용
// (RequireAdminRoles("admin") in the API's admin-categories.controller.ts).
describe("Categories API client (ADM-127)", () => {
  it("exposes list/update against /admin/categories with the four editable axes", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("listAdminCategories");
    expect(api).toContain("updateAdminCategory");
    expect(api).toContain('"/admin/categories"');
    expect(api).toContain("AdminCategoryUpdateInput");
    for (const field of ["name?: string", "displayOrder?: number", "active?: boolean", "selectable?: boolean"]) {
      expect(api).toContain(field);
    }
  });

  it("has no create/delete category function (DNC-007: 행 삭제·id 변경 금지)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).not.toContain("createAdminCategory");
    expect(api).not.toContain("deleteAdminCategory");
  });
});

describe("Categories page (ADM-127)", () => {
  it("lists every category with the 코드/이름/순서/사용/노출 columns", () => {
    const source = readSource("app/categories/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listAdminCategories");
    for (const column of ["<th>코드</th>", "<th>이름</th>", "<th>표시 순서</th>", "<th>사용</th>", "<th>노출</th>"]) {
      expect(source).toContain(column);
    }
  });

  it("edits inline through updateAdminCategory and never offers add/delete", () => {
    const source = readSource("app/categories/page.tsx");
    expect(source).toContain("updateAdminCategory");
    expect(source).toContain("categoryDraftPatch");
    expect(source).toContain("categoryDraftError");
    expect(source).not.toContain("deleteAdminCategory");
    expect(source).not.toContain("createAdminCategory");
    // 삭제/추가 버튼 라벨이 화면에 존재하지 않는다.
    expect(source).not.toContain(">삭제<");
    expect(source).not.toContain("카테고리 추가");
  });

  it("warns about the CAT-124 mobile-alias contract before re-exposing an alias row", () => {
    const source = readSource("app/categories/page.tsx");
    // 인라인 힌트 + 저장 직전 확인 문구, 두 곳 모두.
    expect(source).toContain("별칭 행을 노출로 바꾸면 앱 선택 목록에 다시 나타나요.");
    expect(source).toContain("selectableToggleWarning");
    expect(source).toContain("window.confirm");
  });

  // R28-F3: 사용(active)을 끄는 것도 앱에서 눈에 띄는 변화라 저장 전에 확인한다.
  // 문구는 이제 정확해야 한다 — 라벨은 유지되고, 사라지는 것은 "고를 수 있음"뿐이다.
  it("confirms before turning active OFF, and says labels are kept (R28-F3)", () => {
    const source = readSource("app/categories/page.tsx");
    expect(source).toContain("activeToggleWarning");
    expect(source).toContain("patch.active === false");
    // 안내 카드 문구도 정정됐다: "사용을 끄면 이름 표시에도 쓰이지 않아요"는 더는 사실이 아니다.
    expect(source).not.toContain("사용을 끄면 이름 표시에도 쓰이지 않아요");
    expect(source).toContain("이미 기록된 지출의 표시 이름은 그대로 유지돼요");
  });

  it("reuses the shared admin page styles and clears the session on auth errors", () => {
    const source = readSource("app/categories/page.tsx");
    expect(source).toContain("admin-page.module.css");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
  });

  it("hides the edit controls from non-admin roles (the API 403s the PATCH)", () => {
    const source = readSource("app/categories/page.tsx");
    expect(source).toContain('session?.admin.role === "admin"');
    expect(source).toContain("수정은 관리자(admin) 권한이 필요해요");
  });

  it("is reachable from the admin nav", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain('{ href: "/categories", label: "카테고리 관리" }');
  });
});

// ADM-127: 사용자 조회. 개인정보를 다루므로 API가 admin 전용이고, 조회 자체가
// 감사 로그에 남는다(admin.user_lookup.search).
describe("End-user lookup API client (ADM-127)", () => {
  it("exposes a read-only search against /admin/users-lookup", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("lookupAdminEndUsers");
    expect(api).toContain("/admin/users-lookup?");
    expect(api).toContain('params.set("query"');
    expect(api).toContain("AdminLookupUser");
    expect(api).toContain("expenseCount");
  });

  it("types the result without any expense amount or other minimized PII field", () => {
    const api = readSource("src/lib/admin-api.ts");
    for (const forbidden of ["amountKrw", "phone", "providerUserId", "birthDate", "dueDate", "profileImageUrl"]) {
      expect(api).not.toContain(forbidden);
    }
  });
});

describe("Users lookup page (ADM-127)", () => {
  it("searches by email/nickname and renders result cards", () => {
    const source = readSource("app/users-lookup/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("lookupAdminEndUsers");
    expect(source).toContain("이메일 또는 닉네임");
    expect(source).toContain("조회 결과");
  });

  it("shows household/child summaries and the expense COUNT only", () => {
    const source = readSource("app/users-lookup/page.tsx");
    expect(source).toContain("가구");
    expect(source).toContain("childSummary");
    expect(source).toContain("{user.expenseCount}건");
    // 금액 표기가 화면에 등장해서는 안 된다.
    expect(source).not.toContain("원</");
    expect(source).not.toContain("amount");
  });

  it("is read-only: no write API call anywhere on the page", () => {
    const source = readSource("app/users-lookup/page.tsx");
    for (const write of ["method: \"PATCH\"", "method: \"POST\"", "method: \"PUT\"", "updateAdminUser"]) {
      expect(source).not.toContain(write);
    }
    expect(source).toContain("읽기 전용");
  });

  it("gates the page to admin role and clears the session on auth errors", () => {
    const source = readSource("app/users-lookup/page.tsx");
    expect(source).toContain('session?.admin.role === "admin"');
    expect(source).toContain("관리자(admin) 권한에서만 사용할 수 있어요");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
  });

  it("tells the operator the lookup itself is audited", () => {
    const source = readSource("app/users-lookup/page.tsx");
    expect(source).toContain("감사 로그에 남아요");
  });

  it("is reachable from the admin nav for admin sessions only", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain('{ href: "/users-lookup", label: "사용자 조회", roles: ["admin"] }');
  });
});
