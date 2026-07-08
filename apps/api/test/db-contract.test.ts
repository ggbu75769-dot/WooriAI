import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaDir = join(apiRoot, "prisma");
const schemaPath = join(prismaDir, "schema.prisma");
const migrationPath = join(prismaDir, "migrations", "000001_init", "migration.sql");

function readRequiredFile(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("Phase 3 DB contract", () => {
  it("defines every locked table and enum in Prisma and the initial migration", () => {
    const schema = readRequiredFile(schemaPath);
    const migration = readRequiredFile(migrationPath);

    const enumNames = [
      "auth_provider",
      "user_status",
      "member_role",
      "member_status",
      "child_stage_mode",
      "child_stage_code",
      "expense_source",
      "expense_type",
      "payment_method",
      "necessity_level",
      "item_status",
      "product_platform",
      "import_status"
    ];

    const tableNames = [
      "users",
      "user_devices",
      "households",
      "household_members",
      "household_invites",
      "children",
      "categories",
      "item_templates",
      "item_template_stages",
      "expenses",
      "budgets",
      "child_item_statuses",
      "product_links",
      "affiliate_clicks",
      "import_jobs",
      "import_rows",
      "consents",
      "attachments",
      "audit_logs"
    ];

    expect(schema).toContain('provider = "prisma-client-js"');
    expect(schema).toContain('provider = "postgresql"');
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");

    for (const enumName of enumNames) {
      expect(schema).toContain(`@@map("${enumName}")`);
      expect(migration).toContain(`CREATE TYPE ${enumName} AS ENUM`);
    }

    for (const tableName of tableNames) {
      expect(schema).toContain(`@@map("${tableName}")`);
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }
  });

  it("preserves soft delete, integrity checks, indexes, and reporting views in SQL", () => {
    const schema = readRequiredFile(schemaPath);
    const migration = readRequiredFile(migrationPath);

    expect(schema).toContain("deletedAt");
    expect(schema).toContain("@@unique([authProvider, providerUserId]");
    expect(schema).toContain("@@unique([householdId, userId]");
    expect(schema).toContain("@@unique([childId, yearMonth]");
    expect(schema).toContain("@@unique([childId, itemTemplateId]");

    expect(migration).toContain("amount_krw integer NOT NULL CHECK (amount_krw > 0)");
    expect(migration).toContain("CONSTRAINT chk_children_stage_inputs CHECK");
    expect(migration).toContain("CONSTRAINT chk_budgets_first_day CHECK");
    expect(migration).toContain("CONSTRAINT chk_product_links_sponsor CHECK");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_expenses_not_deleted");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_product_links_item_platform");
    expect(migration).toContain("CREATE OR REPLACE VIEW v_child_monthly_expense_summary");
    expect(migration).toContain("CREATE OR REPLACE VIEW v_child_category_expense_summary");
    expect(migration).toContain("WHERE deleted_at IS NULL");
    expect(migration).toContain("expense_type = 'expense'");
  });
});
