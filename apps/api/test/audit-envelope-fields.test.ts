import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { toExpenseAuditSnapshot } from "../src/onboarding/store-shared";

/**
 * 라운드 107 트랙 A(정찰 S1-1) — **감사 봉투에 무엇이 실리는지를 세는 계약.** DB 불필요.
 *
 * ## 왜 이 파일이 생겼나
 *
 * 이 저장소는 *"감사 봉투에 사용자 자유 문자열을 싣지 않는다"* 를 **네 곳에서 명문으로** 세워
 * 두었다 — `custom-items.service.ts`(*"이름은 싣지 않는다"*) ·
 * `import-pipeline.service.ts`(파일명·행 원문 금지) · `kakao-auth.service.ts`(*"PII 0건"*) ·
 * `onboarding-core.service.ts` 예산 봉투(*"지출 원문도 없다"*). 그런데 **지출 봉투만 그 규율
 * 밖**이었고, 그 사실을 세는 테스트는 저장소 전체에서 0건이었다
 * (`audit-logger.service.test.ts`는 영속화만 본다). 약속이 주석에만 있으면 그것은 약속이 아니다 —
 * `request-log-fields.test.ts`가 요청 로그에서 세운 그 규율과 **같은 형식**으로 여기서 센다.
 *
 * 그 사이 실제로 새던 것: 사용자가 적은 품목명·판매처·메모가 `audit_logs`에 730일 남고,
 * 어드민 감사 뷰어 JSON과 그 화면의 CSV(최대 1,000행/파일)로 나가고, **계정을 삭제해도**
 * 지워지지 않았다(파기 잡 phase 3은 `actor_user_id`만 null로 만든다).
 *
 * ## 이 파일이 세는 둘
 *
 *  ⓐ **지출 감사 봉투의 키 집합이 값이다** — `toExpenseAuditSnapshot`이 내놓는 키가 대장과
 *    **정확히** 일치하고(부정 단언: 그 밖의 키 0건), 원문 자유 문자열은 값으로도 도달 불가.
 *  ⓑ **전수 스윕** — `apps/api/src/**`의 `auditLogger.record({...})` 호출부를 전량 긁어,
 *    **before/after 봉투를 다는 action의 목록**이 아래 대장과 정확히 일치할 것.
 *
 * ⚠️ **ⓑ가 빨개진 라운드에게**: 이 테스트는 "봉투가 하나 늘었다/줄었다"를 잡는 트립와이어다.
 * 대장에 한 줄을 더하는 것이 고치는 방법이고, 더하기 전에 **그 봉투에 사용자 자유 문자열이
 * 실리는지**를 판단해 호출부 주석에 남길 것. 대장을 조용히 맞추는 것은 이 파일의 목적을
 * 정확히 무력화한다.
 */

const SRC_DIR = join(__dirname, "..", "src");

// ---------------------------------------------------------------------------
// ⓐ 지출 감사 봉투의 키 집합
// ---------------------------------------------------------------------------

/**
 * `toExpenseAuditSnapshot`이 내놓아야 하는 **키의 전부**. 빼고 남긴 축의 근거는 그 함수
 * 머리말(`src/onboarding/store-shared.ts`)에 있다 — 여기서는 그 판단이 코드와 어긋나지
 * 않는지만 센다.
 */
const EXPENSE_AUDIT_SNAPSHOT_KEYS = [
  "amountKrw",
  "categoryId",
  "childId",
  "expenseId",
  "expenseType",
  "linkedItemTemplateId",
  "linkedProductLinkId",
  "paymentMethod",
  "source",
  "spentOn"
];

/** 봉투에 **값으로 서면 안 되는** 축. `changed`의 축 이름으로만 남는다. */
const FORBIDDEN_ENVELOPE_KEYS = ["itemName", "merchant", "memo", "createdByUserId"];

describe("ⓐ 지출 감사 봉투(toExpenseAuditSnapshot)", () => {
  /** 자유 문자열 칸이 전부 채워진 지출 한 줄 — 새면 원문 그대로 잡히도록 특징적인 값을 쓴다. */
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    childId: "22222222-2222-4222-8222-222222222222",
    householdId: "33333333-3333-4333-8333-333333333333",
    categoryId: "44444444-4444-4444-8444-444444444444",
    amountKrw: 49800,
    spentOn: new Date("2026-07-11T00:00:00.000Z"),
    itemName: "○○산부인과-초진",
    merchant: "△△조리원",
    paymentMethod: "card",
    memo: "메모원문-절대노출금지",
    linkedItemTemplateId: "55555555-5555-4555-8555-555555555555",
    linkedProductLinkId: "66666666-6666-4666-8666-666666666666",
    expenseType: "actual",
    source: "manual",
    createdByUserId: "77777777-7777-4777-8777-777777777777"
  };

  it("키 집합이 대장과 정확히 일치한다(그 밖의 키 0건)", () => {
    expect(Object.keys(toExpenseAuditSnapshot(row)).sort()).toEqual([...EXPENSE_AUDIT_SNAPSHOT_KEYS].sort());
  });

  it("자유 문자열·기록자 연결값은 키로도 값으로도 도달 불가", () => {
    const snapshot = toExpenseAuditSnapshot(row);
    for (const key of FORBIDDEN_ENVELOPE_KEYS) {
      expect(snapshot).not.toHaveProperty(key);
    }
    // 부정 단언: 직렬화한 봉투 어디에도 원문이 **부분 문자열로도** 없다
    // (다른 키에 옮겨 담는 우회를 함께 막는다).
    const serialized = JSON.stringify(snapshot);
    for (const secret of [row.itemName, row.merchant, row.memo, row.createdByUserId]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("날짜는 Date/문자열 어느 쪽으로 와도 같은 date-only 문자열이 된다", () => {
    expect(toExpenseAuditSnapshot(row).spentOn).toBe("2026-07-11");
    expect(toExpenseAuditSnapshot({ ...row, spentOn: "2026-07-11" }).spentOn).toBe("2026-07-11");
  });
});

// ---------------------------------------------------------------------------
// ⓑ 전수 스윕 — 봉투를 다는 action의 대장
// ---------------------------------------------------------------------------

/**
 * `apps/api/src/**`에서 **before/after 봉투를 하나라도 다는** 감사 action의 전부.
 * 형식은 `<src 기준 상대 경로> <action> before=<yes|no> after=<yes|no>`.
 *
 * 봉투를 아예 달지 않는 action(로그인·로그아웃 등 `record`만 하는 자리)은 여기 없다 —
 * 이 대장이 세는 것은 *"자유 문자열이 실릴 수 있는 자리"* 이기 때문이다.
 *
 * 각 줄의 오늘 판단(2026-09-07):
 *  · `expense.update`/`expense.delete` — **이 라운드가 고친 자리.** 봉투는
 *    `toExpenseAuditSnapshot`뿐이고 자유 문자열은 `changed`의 축 이름으로만 남는다.
 *  · `budget.upsert` — 금액·연월·childId만(그 서비스 주석의 명문).
 *  · `import.confirm`/`import.undo` — 상태·건수·시각만(파일명·행 원문 금지, 그 서비스 주석).
 *  · `custom_category.update` — 축 이름 목록 + active 두 값(이름 문자열 없음).
 *  · `admin.*` 여덟 자리 — 어드민이 **스스로 적은** 카탈로그/공지 문자열이다(이용자 자유
 *    문자열이 아니다). 어드민 계정은 감사 뷰어를 볼 자격이 이미 있는 사람이라 노출면이 늘지 않는다.
 *  · `household.member.remove`/`household.invite.cancel` — ⚠️ **오늘 자유 문자열이 실린다**
 *    (`displayName` = 카카오 닉네임, 정찰 S1-3). 이 트랙의 소유가 아니라 손대지 않았고,
 *    사실대로 적어 둔다 — 대장이 "괜찮다"는 뜻이 아니라 "여기 봉투가 있다"는 뜻이기 때문이다.
 */
const AUDIT_ENVELOPE_LEDGER = [
  "admin/admin-categories.controller.ts admin.category.update before=yes after=yes",
  "admin/admin-users.controller.ts admin.admin_user.update before=yes after=yes",
  "admin/admin.controller.ts admin.disclosure.update before=yes after=yes",
  "admin/content-revisions.service.ts admin.content_revision.approve_publish before=yes after=yes",
  "admin/content-revisions.service.ts admin.content_revision.rollback before=yes after=yes",
  "admin/content-revisions.service.ts admin.content_revision.schedule before=yes after=yes",
  "admin/content-revisions.service.ts admin.content_revision.scheduled_publish before=yes after=yes",
  "finance/expenses.controller.ts expense.delete before=yes after=yes",
  "finance/expenses.controller.ts expense.update before=yes after=yes",
  "households/households.controller.ts household.invite.cancel before=yes after=yes",
  "households/households.controller.ts household.member.remove before=yes after=yes",
  "imports/imports.controller.ts import.confirm before=yes after=yes",
  "imports/imports.controller.ts import.undo before=yes after=yes",
  "onboarding/budgets.controller.ts budget.upsert before=yes after=yes"
];

/**
 * 봉투를 **after 하나만** 다는 자리. before가 없다는 사실 자체가 계약이라 따로 센다
 * (`admin.user_lookup.search`가 옛 검색어 원문을 after에 담았던 그 자리다 — 지금은
 * `queryMasked`뿐이고, 파기 잡 phase 5가 옛 행을 씻는다).
 */
const AUDIT_AFTER_ONLY_LEDGER = [
  "admin/admin-auth.service.ts admin.login_failed before=no after=yes",
  "admin/admin-users-lookup.controller.ts admin.user_lookup.search before=no after=yes",
  "admin/admin-users.controller.ts admin.admin_user.create before=no after=yes",
  "admin/admin.controller.ts admin.item_template.create before=no after=yes",
  "admin/admin.controller.ts admin.item_template.update before=no after=yes",
  "admin/admin.controller.ts admin.product_link.create before=no after=yes",
  "admin/admin.controller.ts admin.product_link.update before=no after=yes",
  "admin/content-revisions.service.ts admin.content_revision.create before=no after=yes",
  "admin/content-revisions.service.ts admin.content_revision.publish_recovered before=no after=yes",
  "admin/content-revisions.service.ts admin.content_revision.reject before=no after=yes",
  "admin/product-link-bulk.controller.ts admin.product_link.bulk_replace before=no after=yes",
  "auth/auth.service.ts auth.login before=no after=yes",
  "auth/kakao/kakao-auth.service.ts auth.login before=no after=yes",
  "auth/kakao/kakao-auth.service.ts auth.login_rejected before=no after=yes",
  "households/custom-categories.service.ts custom_category.update before=no after=yes",
  "onboarding/custom-items.service.ts custom_item.delete before=no after=yes",
  "settings/settings.controller.ts account.delete before=no after=yes",
  "settings/settings.controller.ts child_profile.delete before=no after=yes",
  "settings/settings.controller.ts household.leave before=no after=yes"
];

/** 문자열 리터럴·주석을 공백으로 지운다 — 그 안의 `{`·`before:`가 스캐너를 속이지 못하게. */
function stripLiteralsAndComments(source: string): string {
  const out = source.split("");
  let index = 0;
  const blank = (from: number, to: number) => {
    for (let i = from; i < to && i < out.length; i += 1) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    if (two === "//") {
      const end = source.indexOf("\n", index);
      blank(index, end === -1 ? source.length : end);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (two === "/*") {
      const end = source.indexOf("*/", index + 2);
      blank(index, end === -1 ? source.length : end + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    const quote = source[index];
    if (quote === '"' || quote === "'" || quote === "`") {
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== quote) {
        cursor += source[cursor] === "\\" ? 2 : 1;
      }
      // 리터럴의 **내용만** 지운다: 여닫는 따옴표는 남겨야 action 값을 다시 읽을 수 있다.
      blank(index + 1, cursor);
      index = cursor + 1;
      continue;
    }
    index += 1;
  }
  return out.join("");
}

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
 * `auditLogger.record({ ... })` 호출부를 전량 긁어 `<파일> <action> before=… after=…` 줄을 만든다.
 * `before`/`after`/`action`은 **record 객체의 최상위 키일 때만** 센다(중첩 객체 안의 같은 이름은
 * 봉투가 아니다). action 문자열은 원문 소스에서 다시 읽는다 — 스캐너는 리터럴 내용을 지운 사본을
 * 쓰기 때문이다.
 */
function sweepAuditEnvelopes(): string[] {
  const lines: string[] = [];
  for (const file of collectSourceFiles(SRC_DIR)) {
    const raw = readFileSync(join(SRC_DIR, file), "utf8");
    const scan = stripLiteralsAndComments(raw);
    for (const match of scan.matchAll(/\.record\(\s*\{/g)) {
      const open = scan.indexOf("{", match.index);
      let depth = 0;
      let close = open;
      for (let i = open; i < scan.length; i += 1) {
        if (scan[i] === "{") depth += 1;
        else if (scan[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      const keys = new Set<string>();
      let actionAt = -1;
      depth = 0;
      for (let i = open; i <= close; i += 1) {
        if (scan[i] === "{" || scan[i] === "[" || scan[i] === "(") depth += 1;
        else if (scan[i] === "}" || scan[i] === "]" || scan[i] === ")") depth -= 1;
        else if (depth === 1) {
          const rest = scan.slice(i, i + 12);
          const key = /^(before|after|action)\s*:/.exec(rest);
          const previous = scan.slice(open, i).trimEnd().at(-1);
          if (key && (previous === "{" || previous === ",")) {
            keys.add(key[1]);
            if (key[1] === "action") actionAt = i + key[0].length;
          }
        }
      }
      if (!keys.has("before") && !keys.has("after")) continue;
      const action = actionAt === -1 ? "?" : (/^\s*"([^"]+)"/.exec(raw.slice(actionAt))?.[1] ?? "?");
      lines.push(
        `${file} ${action} before=${keys.has("before") ? "yes" : "no"} after=${keys.has("after") ? "yes" : "no"}`
      );
    }
  }
  return lines.sort();
}

describe("ⓑ 감사 봉투 전수 스윕", () => {
  it("before/after 봉투를 다는 action의 목록이 대장과 정확히 일치한다", () => {
    expect(sweepAuditEnvelopes()).toEqual([...AUDIT_ENVELOPE_LEDGER, ...AUDIT_AFTER_ONLY_LEDGER].sort());
  });

  it("지출 두 봉투는 `result.before`/`result.after` 한 경로로만 만들어진다", () => {
    // 부정 단언: 컨트롤러가 응답 DTO·`toExpenseDto`·`toExpenseSnapshot`을 봉투로 되돌리는
    // 회귀를 잡는다(그 셋이 자유 문자열을 담는 모양이다).
    const controller = readFileSync(join(SRC_DIR, "finance", "expenses.controller.ts"), "utf8");
    expect(controller).not.toMatch(/(before|after):\s*(toExpenseDto|toExpenseSnapshot|result\.expense)/);
  });
});
