import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHILD_SEX_VALUES, CHILD_STAGE_CODES, CHILD_STAGE_MODES, PREPARED_STEP_STATES } from "@wooriai/domain";
import { parsePrismaEnum } from "./lib/prisma-enum-parser";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const prisma = read("apps/api/prisma/schema.prisma");
const dto = read("apps/api/src/onboarding/dto/complete-onboarding.dto.ts");
const client = read("apps/mobile/src/api/client.ts");
const local = read("apps/mobile/src/api/local-backend.ts");

const checks = [
  { id: "stage-mode", actual: parsePrismaEnum(prisma, "ChildStageMode"), expected: [...CHILD_STAGE_MODES] },
  { id: "stage-code", actual: parsePrismaEnum(prisma, "ChildStageCode"), expected: [...CHILD_STAGE_CODES] },
  { id: "child-sex", actual: parsePrismaEnum(prisma, "ChildSex"), expected: [...CHILD_SEX_VALUES] },
  { id: "prepared-step", actual: parsePrismaEnum(prisma, "PreparedStepState"), expected: [...PREPARED_STEP_STATES] },
  { id: "api-shared-enums", actual: String(dto.includes("CHILD_SEX_VALUES") && dto.includes("CHILD_STAGE_CODES") && dto.includes("CHILD_STAGE_MODES")), expected: "true" },
  { id: "api-month-key", actual: String(dto.includes("yearMonthPattern") && dto.includes("@Matches(yearMonthPattern)")), expected: "true" },
  { id: "mobile-shared-input", actual: String(client.includes("type CompleteOnboardingInput = OnboardingCompletionInput")), expected: "true" },
  { id: "local-shared-normalizer", actual: String(local.includes("body = normalizeOnboardingCompletionInput(body, getSeoulToday())")), expected: "true" }
].map((check) => ({ ...check, pass: JSON.stringify(check.actual) === JSON.stringify(check.expected) }));

const result = {
  schemaVersion: 1,
  status: checks.every((check) => check.pass) ? "PASS" : "FAIL",
  actor: "API, mobile client, local standalone user",
  input: "Prisma enum, API DTO, shared domain values, mobile alias, local normalizer",
  mission: "같은 온보딩 값을 모든 계층에서 fail-closed로 해석한다.",
  checks
};
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
if (outputArg) writeFileSync(resolve(root, outputArg.slice("--output=".length)), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== "PASS") process.exitCode = 1;
