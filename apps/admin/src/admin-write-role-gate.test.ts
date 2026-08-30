import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, type AdminRole } from "./lib/admin-api";
import { ADMIN_EDITOR_WRITE_ROLE_NOTICE, ADMIN_WRITE_ROLE_NOTICE } from "./lib/admin-role-copy";

/**
 * 라운드 77 트랙 D(GAP-077 #4) — **통하지 않는 저장 UI를 세우지 않는다.**
 *
 * 라운드 76 리뷰 M-1이 **문장**을 고치며 이유로 적어 둔 사실이 **화면**에는 그대로 남아
 * 있었다: 어드민 내비에 역할 제한이 없어 `analyst` 계정도 준비템·링크·고지 문구 화면까지 걸어
 * 들어오는데, 그 셋이 역할을 `isEditor` **하나로만** 읽어 갈래가 둘뿐이었다 — 편집자면
 * "검토 요청", **아니면 곧바로 저장**. `analyst`는 "아니면" 쪽에 떨어져 `admin`과 똑같은
 * 화면을 봤다([추가]·[저장] 버튼 · 성공 배너 문안까지). 서버에서 `analyst`에게 열린 쓰기
 * 경로는 **0건**이므로 그 버튼은 예외 없이 403으로 끝났다.
 *
 * 같은 저장소가 그 답을 이미 두 번 적어 두었다 — `app/categories/page.tsx`(`canEdit`)와
 * `app/reviews/page.tsx`(`isAdmin`)가 표는 남기고 **편집 컨트롤만** 감춘다. 이 트랙은 그 답을
 * 나머지 셋에 세우고, 그 판정을 여기 값으로 묶는다.
 *
 * 이 계약이 지키는 것은 넷이다.
 *  ⓐ **전수 단언** — 쓰기를 부르는 어드민 화면 전수에서 **제출 컨트롤이 역할 게이트를 지난다**
 *    (한 벌을 안 지나는 화면이 생기면 대장이 빨개진다 · 파생 단언 · 스윕 뿌리도 값이다).
 *  ⓑ **`canEdit`의 뜻이 서버와 같다** — `admin` 직접 저장 · `editor` 검토 요청 · `analyst` 없음
 *    (세 역할 전수 · 서버의 `RequireAdminRoles` 전수에서 파생).
 *  ⓒ **부정 단언** — 캡션 문자열의 사본이 저장소에 **하나뿐**이다.
 *  ⓓ **내비 게이트와 컨트롤 게이트는 서로 다른 축**이다(`NAV_ITEMS`의 `roles` 셋 무변경).
 *
 * ⚠️ 그리고 **바뀌지 않은 것**도 값으로 남는다: `isEditor` 갈래의 문안 전부와 쓰기 catch
 * 자리 수(2·2·2 — 라운드 76 B의 `WRITE_ERROR_COPY_SITES`가 세는 그 수).
 *
 * ---------------------------------------------------------------------------
 * 라운드 78 트랙 C(GAP-078 #3) — **통하지 않는 편집 UI를 세우지 않는다.**
 *
 * 라운드 77이 감춘 것은 **제출 컨트롤뿐**이었고, 그 사실을 이 대장이 스스로 적고 있었다:
 * `submits`(제출 컨트롤)를 세는 칸은 있는데 **편집 컨트롤을 세는 칸이 없었다.** 그래서
 * `analyst`는 오늘도 [수정]을 눌러 편집 폼을 열고, 라벨·분류·가격대를 고치고, **저장 버튼을
 * 찾다가** 그 자리의 캡션 한 줄을 읽었다 — *누르기 전에 말한다* 가 **고친 뒤**로 밀려 있었다.
 * 빈 생성 폼은 더 조용했다: **읽을 데이터가 0건**이라 "값을 보는 것은 정당하다"는 근거가
 * 아예 적용되지 않는데도 폼 전체가 그려졌다.
 *
 * 답은 이번에도 옆 탭이 이미 갖고 있었다 — `app/categories/page.tsx`는 행의 입력칸을
 * `isEditing`일 때만 그리고, `isEditing`에 들어가는 문을 `canEdit` 뒤에 둔다. 그래서 그
 * 화면에서 `analyst`가 편집 가능한 입력칸을 보는 경로가 **구조적으로 0건**이다.
 *
 * 이 트랙이 더하는 것은 대장의 칸 하나(`edits`)와 그것을 무는 단언 넷이다.
 *  ⓔ **전수 단언** — 쓰기가 역할로 갈리는 화면의 **편집 가능 컨트롤 전수**가 넷 중 하나로
 *    갈린다: 게이트 안(`gated`) · 자물쇠(`locked`) · 편집 상태의 문이 게이트 안(`stateGates`) ·
 *    **조회용이라 잠그지 않는다**(`viewOnly` — 이유가 함께 적힌다). ⚠️ 판정은 라운드 77 리뷰
 *    S-2가 세운 **갈래 위치 판정**(`submitIsInsideGate`) 그대로다 — 부분 문자열이 아니다.
 *  ⓕ **재현 단언** — 자물쇠가 풀리거나 갈래가 뒤집힌 소스가 **실제로 빨개진다**(S-2의 규율).
 *  ⓖ **여닫이 토글의 라벨이 사실을 말한다** — `!canEdit`이면 `"수정"`이 아니라 `"보기"`이고,
 *    ⚠️ 그 낱말은 **이미 이 콘솔에 있던 것**이다(새 문장 0건 · 새 낱말 0건).
 *  ⓗ ⚠️ `<select>`·체크박스에 `readOnly`가 없어 `disabled`로 갈리는 이유가 **주석에 값으로**
 *    적혀 있다(다음 라운드가 그 비대칭을 결함으로 읽지 않도록).
 *
 * ⚠️ 여기서도 **바뀌지 않은 것**이 값이다: `submits`·`allows`·`kind`·`SCREEN_NOTICE_CONSTANTS`는
 * 한 칸도 바뀌지 않았고(아래 총합 단언), **필터·검색 입력칸은 잠기지 않는다** — 조회는
 * `analyst`의 일이고, 자물쇠가 가는 자리는 **폼 컴포넌트 안**뿐이라는 것이 이 트랙의 경계다.
 */

const adminRoot = process.cwd();
const repoRoot = join(adminRoot, "..", "..");

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readRepoSource(relativePath: string): string {
  const filePath = join(repoRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * 주석은 화면에 서지 않는다 — 사본을 셀 때도, 게이트를 찾을 때도 코드만 본다.
 *
 * ## ⚠️ 라운드 78 리뷰 S-7 — `//`가 늘 주석인 것은 아니다
 *
 * 종전에는 `\/\/[^\n]*`를 그대로 지웠다. 그래서 **문자열 안의 `//`** 부터 줄 끝까지가 통째로
 * 사라졌고, 이 콘솔에는 그런 줄이 실제로 있다(`app/links/page.tsx`의
 * *"URL은 http:// 또는 https:// 로 시작해야 해요."*). 그 줄에서 사라지는 것은 문장뿐이 아니라
 * **그 뒤의 코드**(닫는 따옴표·세미콜론·같은 줄의 속성)이고, 이 파일의 그물은 전부 그 결과 위에
 * 선다 — 편집 컨트롤 하나가 그렇게 조용히 사라지면 "전수" 단언이 아무 말도 하지 않는다.
 * 트랙 C가 JSX 여닫이 필터에서 배운 그 병이다(강화가 침묵으로 되돌아간다).
 *
 * 그래서 줄 주석은 **따옴표를 세면서** 지운다(줄 단위 — 이 저장소의 문자열은 줄을 넘지 않는다).
 *
 * ⚠️ **남는 한계도 값으로 적는다**: JSX **텍스트**(따옴표 밖)에 있는 `//`는 여전히 주석으로
 * 읽힌다(같은 파일의 `<span className={styles.hint}>http:// …</span>`). 그것까지 가르려면 JSX
 * 파서가 필요하고, 오늘 그 자리가 삼키는 것은 **텍스트뿐**이라(속성·게이트가 아니다) 이 계약이
 * 보는 값은 바뀌지 않는다. 아래 재현 단언이 두 사실을 함께 못박는다.
 */
function codeOnly(source: string): string {
  const withoutBlocks = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .map((line) => stripLineComment(line))
    .join("\n");
}

/** 한 줄에서 **따옴표 밖의** `//`부터 줄 끝까지를 지운다(리뷰 S-7). */
function stripLineComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "/" && line[i + 1] === "/") return `${line.slice(0, i)} `;
  }
  return line;
}

// ---------------------------------------------------------------------------
// 대장. 키는 어드민 루트 기준 경로다.
// ---------------------------------------------------------------------------

type GateKind =
  /** 폼·표는 남고 **제출 컨트롤만** 역할로 갈린다(이 트랙이 셋에 세운 모양 · 오늘 다섯). */
  | "control"
  /** 화면 전체가 역할 뒤에 있다(렌더 전에 early return — 안내 한 줄만 남는다). */
  | "screen";

/**
 * 라운드 78 트랙 C — 폼 컴포넌트 하나에 걸리는 **자물쇠**.
 *
 * 그 함수 안의 편집 컨트롤 **전수**가 자물쇠 하나를 지고, 그 폼이 서는 자리 전수가 자물쇠를
 * 게이트에 묶는다. 폼은 그대로 렌더되므로 읽기 권한자가 **값을 보는 것**은 종전과 같다.
 */
type LockedForm = {
  /** 같은 파일 안의 폼 컴포넌트 함수 이름. */
  component: string;
  /** 그 함수 안에서 자물쇠로 쓰이는 식(`readOnly={<lock>}` · `disabled={<lock>}`). */
  lock: string;
  /** 그 폼이 서는 자리가 자물쇠를 **게이트에** 묶는 속성(전수가 이 속성을 진다). */
  bind: string;
  /** 그 폼이 서는 자리 전수(자리마다 하나씩 붙는 식별 조각). */
  mounts: string[];
};

/**
 * ⚠️ **라운드 78 리뷰 S-6 — 게이트 안에 선 자리의 자물쇠는 오늘 죽은 값이다.**
 *
 * `app/items/page.tsx`·`app/links/page.tsx`의 생성 카드는 `canEdit`이 참인 갈래에서만 그려지는데,
 * 그 안의 폼도 `readOnly={!canEdit}`를 진다 — 그 식은 그 갈래에서 **언제나 거짓**이다.
 * **지우지 않는다**는 것이 이 계약의 판정이고, 사유를 값으로 적어 둔다(다음 라운드가 "죽은 prop"
 * 으로 읽고 지우면 아래 ⓑ가 조용히 사라진다).
 */
const GATED_MOUNT_LOCK_REASON =
  "ⓐ 폼이 서는 자리 전수가 같은 자물쇠 식을 져서 읽는 사람이 '어느 자리가 게이트 안인가'를 따로 판단할 필요가 없다. ⓑ 게이트가 걷히는 날 그 폼은 잠긴 채로 남는다 — 안전한 쪽으로 고장 난다.";

/**
 * 라운드 78 트랙 C — 편집 상태에 들어가는 **문**이 게이트 안이라 렌더 경로가 구조적으로 0건인
 * 자리(오늘 `/categories` 하나 — 이 트랙이 나머지에 옮겨 심은 그 답의 원본이다).
 */
type StateGate = {
  /** 그 입력칸을 그리는 상태 식별자(입력칸은 이 상태가 참인 갈래에만 있다). */
  state: string;
  /** 그 상태로 들어가는 유일한 문(게이트가 참인 갈래 안에 있어야 한다). */
  entry: string;
};

/** 라운드 78 트랙 C — 값을 고칠 수 있는 자리 전수와, 그 자리가 역할에 갈리는 방법. */
type EditControls = {
  /** 게이트가 참인 갈래 안에서만 렌더되는 자리(빈 생성 폼 — 읽을 데이터가 0건이다). */
  gated: string[];
  /** 렌더되지만 잠기는 폼(편집 폼 — 값을 보는 것은 정당하다). */
  locked: LockedForm[];
  /** 편집 상태의 문이 게이트 안이라 입력칸이 아예 그려지지 않는 자리. */
  stateGates: StateGate[];
  /** 렌더되고 눌리지만 **라벨이 역할을 말하는** 여닫이 토글. */
  toggles: string[];
  /** ⚠️ 잠그지 않는 입력칸과 그 이유 — 조회는 `analyst`의 일이다(제외 사유는 이 스윕의 단위로). */
  viewOnly: Readonly<Record<string, string>>;
};

type WriteScreen = {
  /** 그 화면이 세운 게이트 식별자(`const <gate> = …`). */
  gate: string;
  kind: GateKind;
  /** 게이트가 통과시키는 역할. 서버 기준과 같은 뜻이어야 한다(아래 ⓑ). */
  allows: AdminRole[];
  /** 그 게이트를 지나야 하는 **제출 컨트롤**의 onClick 바인딩 전수. */
  submits: string[];
  /** 라운드 78 트랙 C — 그 화면의 **편집 컨트롤** 전수(ⓔ). */
  edits: EditControls;
  /** 내비에서의 자리(ⓓ가 두 축이 다르다는 것을 여기서 읽는다). */
  href: string;
  /** 서버 쪽 근거 — 그 쓰기를 지키는 데코레이터가 사는 파일. */
  server: string;
};

/** 편집 컨트롤이 하나도 없는 화면(오늘 `app/users/page.tsx` — 화면 전체가 게이트 뒤다). */
const NO_EDIT_CONTROLS: EditControls = { gated: [], locked: [], stateGates: [], toggles: [], viewOnly: {} };

const ADMIN_WRITE_SCREENS: Readonly<Record<string, WriteScreen>> = {
  // 이 트랙이 연 셋. 편집자는 검토 요청 경로가 **실제로 통하므로** 게이트를 지난다.
  "app/items/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleCreate}", "onClick={handleEditSave}"],
    edits: {
      gated: ['idPrefix="create"'],
      locked: [
        {
          component: "ItemFormFields",
          lock: "readOnly",
          bind: "readOnly={!canEdit}",
          mounts: ['idPrefix="create"', "idPrefix={`edit-${item.id}`}"]
        }
      ],
      stateGates: [],
      toggles: ['{editingId === item.id ? "닫기" : canEdit ? "수정" : "보기"}'],
      viewOnly: {
        'id="item-filter-query"':
          "준비템 이름 부분 일치 검색 — 이미 받아온 목록을 좁히는 조회 입력이고 서버로 나가는 값이 없다.",
        'id="item-filter-missing-links"':
          "상품 링크 없는 준비템만 보기 — 같은 조회 필터다. 조회를 잠그면 analyst의 일 자체가 막힌다."
      }
    },
    href: "/items",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  "app/links/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleCreate}", "onClick={handleEditSave}"],
    edits: {
      gated: ['idPrefix="create"'],
      locked: [
        {
          component: "LinkFormFields",
          lock: "readOnly",
          bind: "readOnly={!canEdit}",
          mounts: ['idPrefix="create"', "idPrefix={`edit-${link.id}`}"]
        }
      ],
      stateGates: [],
      toggles: ['{editingId === link.id ? "닫기" : canEdit ? "수정" : "보기"}'],
      viewOnly: {
        'id="link-filter-query"': "제목·URL 부분 일치 검색 — 받아온 목록을 좁히는 조회 입력이다.",
        'id="link-filter-item"': "준비템별 좁히기 — 같은 조회 필터이고 어떤 쓰기 경로에도 실리지 않는다.",
        'id="link-filter-active"': "활성 링크만 보기 — 같은 조회 필터다."
      }
    },
    href: "/links",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  "app/disclosures/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleSave}", "onClick={handleAddKey}"],
    edits: {
      // 이 화면의 생성 카드는 폼 컴포넌트가 아니라 인라인이라, 두 칸이 각각 게이트 안에 선다.
      gated: ['id="new-disclosure-key"', 'id="new-disclosure-text"'],
      locked: [
        { component: "DisclosureRow", lock: "!canEdit", bind: "canEdit={canEdit}", mounts: ["key={disclosure.key}"] }
      ],
      stateGates: [],
      // 목록의 문구는 카드마다 늘 펼쳐져 있다 — 여닫이 토글이 없는 유일한 화면이다.
      toggles: [],
      viewOnly: {}
    },
    href: "/disclosures",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  // 이미 정직하던 둘. 이 트랙이 한 글자도 바꾸지 않고 **같은 축임을 값으로** 적는다.
  "app/categories/page.tsx": {
    // 카테고리에는 검토 경로가 없다(콘텐츠 리비전의 entityType이 아니다) — 그래서 admin뿐이다.
    gate: "canEdit",
    kind: "control",
    allows: ["admin"],
    submits: ["onClick={() => saveEdit(category)}"],
    // ⚠️ **이 화면이 답의 원본이다**(라운드 78 트랙 C가 나머지 셋에 옮겨 심은 그 모양).
    // 행의 입력칸은 `isEditing`일 때만 그려지고, `isEditing`에 들어가는 문은 `canEdit` 뒤에
    // 있다 — 그래서 analyst가 편집 가능한 입력칸을 보는 경로가 **구조적으로 0건**이다.
    edits: {
      gated: [],
      locked: [],
      stateGates: [{ state: "isEditing", entry: "onClick={() => startEdit(category)}" }],
      // 토글 자체가 게이트 안이라(‘-’ 한 글자가 그 자리에 선다) 라벨을 바꿀 자리가 없다.
      toggles: [],
      viewOnly: {
        'id="category-search"': "코드·이름 검색 — 전량(시드 21행)을 좁히는 조회 입력이다.",
        'id="category-group"': "구분 필터 — 같은 조회 입력이고 저장 경로에 실리지 않는다."
      }
    },
    href: "/categories",
    server: "apps/api/src/admin/admin-categories.controller.ts"
  },
  "app/reviews/page.tsx": {
    gate: "isAdmin",
    kind: "control",
    allows: ["admin"],
    submits: [
      "onClick={handleApprove}",
      "onClick={handleReject}",
      "onClick={() => handleSchedule(scheduleAt || null)}",
      "onClick={() => handleSchedule(null)}",
      "onClick={() => handleRollback(revision.id)}"
    ],
    // 예약 시각·반려 사유 두 칸은 승인/반려 블록 안에 있고, 그 블록이 통째로 `isAdmin` 뒤다.
    edits: {
      gated: ['id="schedule-at"', 'id="reject-note"'],
      locked: [],
      stateGates: [],
      toggles: [],
      viewOnly: { 'id="status-filter"': "검토 목록의 상태 필터 — 목록 조회 인자이지 리비전을 고치는 값이 아니다." }
    },
    href: "/reviews",
    server: "apps/api/src/admin/content-revisions.controller.ts"
  },
  // 세 번째 모양: 화면 전체가 역할 뒤다. 컨트롤을 하나씩 감출 필요가 없다 —
  // 개인정보를 다루는 화면이라 **표 자체가** admin 전용이기 때문이다(내비도 함께 감춘다).
  "app/users/page.tsx": {
    gate: "isAdmin",
    kind: "screen",
    allows: ["admin"],
    submits: [],
    // 렌더 전에 돌아서므로 감출 컨트롤도, 잠글 폼도 남지 않는다(아래 단언이 그 순서를 읽는다).
    edits: NO_EDIT_CONTROLS,
    href: "/users",
    server: "apps/api/src/admin/admin-users.controller.ts"
  }
};

/**
 * 캡션을 세우는 화면과 **그 화면이 부르는 상수**(라운드 77 리뷰 S-1).
 *
 * 값은 대장의 `allows`에서 파생되어야 한다 — 게이트가 editor를 통과시키는 화면이
 * *"관리자(admin) 권한이 필요해요"* 라고 말하면 캡션이 화면 자신의 게이트보다 한 칸 위를
 * 요구한다. `app/reviews`·`app/users`는 캡션을 세우지 않는다(전자는 버튼만 감추고,
 * 후자는 화면 전체가 자기 문장을 지고 돌아선다).
 */
const SCREEN_NOTICE_CONSTANTS: Readonly<Record<string, string>> = {
  "app/categories/page.tsx": "ADMIN_WRITE_ROLE_NOTICE",
  "app/items/page.tsx": "ADMIN_EDITOR_WRITE_ROLE_NOTICE",
  "app/links/page.tsx": "ADMIN_EDITOR_WRITE_ROLE_NOTICE",
  "app/disclosures/page.tsx": "ADMIN_EDITOR_WRITE_ROLE_NOTICE"
};

/**
 * 스윕이 걷는 뿌리와 **걷지 않는 뿌리·이유**(라운드 75 D가 조회 쪽에, 라운드 76 B가 쓰기 쪽에
 * 세운 그 형식).
 */
const GATE_SWEEP_ROOTS = ["app"] as const;

const NON_SWEPT_ROOTS: Readonly<Record<string, string>> = {
  "src/components":
    "쓰기를 부르는 자리가 하나 있는데(ProductLinkBulkReplace의 CSV 일괄 적용) 그 패널은 자기 " +
    "안에서 역할을 읽지 않는다 — **마운트 지점**인 app/links/page.tsx가 `session.admin.role === " +
    '"admin"`일 때만 세운다. 게이트가 화면 쪽에 있으므로 이 대장의 단위(화면)로 이미 세어진다. ' +
    "셸(AdminShell)의 쓰기 다섯은 계정 자신의 비밀번호·MFA라 역할과 무관하다.",
  "src/lib":
    "화면이 아니라 판정·API 래퍼·세션 컨텍스트 모듈이다. 버튼이 서는 자리가 아니고, 역할을 " +
    "읽는 유일한 모듈(admin-token-context)은 세션을 나르기만 한다."
};

/** 어드민 화면 소스 전수(테스트 파일 제외). */
function screenPaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      found.push(relative(adminRoot, fullPath).split(sep).join("/"));
    }
  };
  for (const root of GATE_SWEEP_ROOTS) walk(join(adminRoot, ...root.split("/")));
  return found.sort();
}

/**
 * `admin-api.ts`가 내보내는 **쓰기 함수 전수**(파생 — 손 목록이 아니다).
 *
 * 상태를 바꾸는 메서드를 실어 보내는 함수와, 그것을 부르는 한 겹 합성 함수
 * (`draftAndSubmitContentRevision` = create + submit)가 전부다.
 */
function adminApiWriteFunctions(): string[] {
  const api = readSource("src/lib/admin-api.ts");
  const bodies = new Map<string, string>();
  for (const chunk of api.split(/\nexport (?:async )?function /).slice(1)) {
    const name = /^([A-Za-z0-9_]+)/.exec(chunk)?.[1];
    if (name) bodies.set(name, chunk);
  }
  const writes = new Set<string>();
  for (const [name, body] of bodies) {
    if (/method: "(?:POST|PATCH|PUT|DELETE)"/.test(body)) writes.add(name);
  }
  for (const [name, body] of bodies) {
    if (writes.has(name)) continue;
    if ([...writes].some((write) => new RegExp(`\\b${write}\\(`).test(body))) writes.add(name);
  }
  return [...writes].sort();
}

/**
 * 라운드 78 트랙 C — 그 `{`가 **JSX 표현식 컨테이너**의 것인가.
 *
 * 종전에는 감싸는 `{` 전부를 후보로 삼았는데, 그중에는 **함수 본문**의 `{`도 있었다
 * (`function ContentReviewsPageContent() {`). 본문 전체를 하나의 표현식으로 읽으면 최상위
 * 삼항이 없어 `&&` 갈래로 떨어지고, 그 `&&` 앞쪽에 `const isAdmin = …` 선언이 있기만 하면
 * **본문 안의 아무 자리나** "게이트 안"으로 읽혔다 — S-2가 부분 문자열에서 잡은 그 병의
 * 블록 판이다(편집 컨트롤을 세기 시작하자 `/reviews`의 상태 필터에서 드러났다).
 *
 * JSX 컨테이너의 `{` 앞에 오는 비공백 문자는 `>`(태그의 끝) · `(`(갈래를 감싼 괄호) ·
 * `}`(앞선 컨테이너)뿐이다. ⚠️ `=>`의 `>`는 화살표 함수 **본문**이라 제외한다.
 */
function opensJsxExpression(source: string, open: number): boolean {
  let cursor = open - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  const previous = source[cursor];
  if (previous === ">") return source[cursor - 1] !== "=";
  return previous === "(" || previous === "}";
}

/**
 * `index` 자리를 감싸는 JSX 표현식 블록들의 여는 `{` 위치(가장 안쪽부터).
 *
 * 뒤에서 앞으로 걸으며 깊이를 세므로, 게이트가 어느 깊이에 있든(카드 안 · 표의 셀 안) 찾는다.
 * "게이트 문자열이 파일 어딘가에 있다"가 아니라 **그 컨트롤이 실제로 그 조건 안에 있다**를
 * 묻는 것이 이 함수의 요점이다.
 */
function enclosingExpressionOpeners(source: string, index: number): number[] {
  const openers: number[] = [];
  let depth = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const char = source[cursor];
    if (char === "}") depth += 1;
    else if (char === "{") {
      if (depth === 0) {
        if (opensJsxExpression(source, cursor)) openers.push(cursor);
      } else depth -= 1;
    }
  }
  return openers;
}

/** `open`의 `{`와 짝을 이루는 `}`의 위치. */
function matchingBrace(source: string, open: number): number {
  let depth = 0;
  for (let cursor = open; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{") depth += 1;
    else if (source[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return -1;
}

/**
 * 표현식 하나의 **최상위 삼항**(`조건 ? 참갈래 : 거짓갈래`)을 가른다.
 * 옵셔널 체이닝(`?.`)과 널 병합(`??`)은 삼항이 아니므로 건너뛴다.
 * 삼항이 아니면(`조건 && (…)`) 갈림점을 끝으로 둔다 — 그 경우 갈래는 "참" 하나다.
 */
function splitTopLevelTernary(expression: string): { question: number; colon: number } {
  let depth = 0;
  let question = -1;
  let nested = 0;
  for (let cursor = 0; cursor < expression.length; cursor += 1) {
    const char = expression[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (depth === 0 && char === "?") {
      if (expression[cursor + 1] === "." || expression[cursor + 1] === "?") {
        cursor += 1;
        continue;
      }
      if (question === -1) question = cursor;
      else nested += 1;
    } else if (depth === 0 && char === ":" && question !== -1) {
      if (nested > 0) {
        nested -= 1;
        continue;
      }
      return { question, colon: cursor };
    }
  }
  return { question: question === -1 ? expression.length : question, colon: expression.length };
}

/**
 * 라운드 77 적대적 리뷰 S-2 — **게이트 판정은 부분 문자열이 아니다.**
 *
 * 종전 판정은 머리말이 게이트 **이름을 담기만** 하면 통과였다. 그래서 갈래가 뒤집혀도
 * (`{!canEdit ? <저장 버튼/> : <캡션/>}`) 초록이었다 — 정확히 이 계약이 막으려던 결함을
 * 재현해도 아무것도 빨개지지 않는다. 이제 **컨트롤이 어느 갈래에 있는지**까지 읽는다:
 * 조건이 긍정(`canEdit ? …`)이면 참 갈래에, 부정(`!canEdit ? …`)이면 거짓 갈래에 있어야
 * 통과한다(카테고리 화면이 실제로 쓰는 모양이 후자다).
 */
function submitIsInsideGate(source: string, index: number, gate: string): boolean {
  const identifier = new RegExp(`(^|[^A-Za-z0-9_$.])${gate}\\b`);
  const negated = new RegExp(`(^|[^A-Za-z0-9_$.])!\\s*\\(?\\s*${gate}\\b`);
  for (const open of enclosingExpressionOpeners(source, index)) {
    const close = matchingBrace(source, open);
    if (close < 0 || close < index) continue;
    const expression = source.slice(open + 1, close);
    const offset = index - (open + 1);
    let { question, colon } = splitTopLevelTernary(expression);
    // 삼항이 아니면 `조건 && (…)` 모양을 본다 — 갈래는 "참" 하나이고 거짓 갈래가 없다.
    if (question === expression.length) {
      const and = expression.indexOf("&&");
      if (and < 0) continue;
      question = and;
      colon = expression.length;
    }
    const condition = expression.slice(0, question);
    if (!identifier.test(condition)) continue;
    const inTrueBranch = offset > question && offset < colon;
    const inFalseBranch = offset > colon;
    if (negated.test(condition) ? inFalseBranch : inTrueBranch) return true;
  }
  return false;
}

/** 값을 고칠 수 있는 JSX 태그 셋(버튼은 제출 쪽 대장이 `submits`로 이미 센다). */
const EDITABLE_TAGS = ["input", "textarea", "select"] as const;

type EditableControl = { tag: string; index: number; attrs: string };

/**
 * 여는 태그 하나의 속성 문자열. `[^>]*`로 자를 수 없다 — 속성 값 안의 화살표 함수
 * (`onChange={(event) => …}`)가 `>`를 품기 때문이다. 그래서 중괄호 깊이를 세며 걷는다.
 */
function jsxTagAttributes(source: string, start: number): string {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0 && source[cursor - 1] !== "=") return source.slice(start, cursor);
  }
  return source.slice(start);
}

/** 소스 안의 편집 가능 컨트롤 전수(⚠️ 주석을 지운 소스에 걸어야 한다 — 주석에도 태그가 적힌다). */
function editableControls(source: string): EditableControl[] {
  const found: EditableControl[] = [];
  for (const tag of EDITABLE_TAGS) {
    for (const match of source.matchAll(new RegExp(`<${tag}\\b`, "g"))) {
      const index = match.index ?? -1;
      found.push({ tag, index, attrs: jsxTagAttributes(source, index + tag.length + 1) });
    }
  }
  return found.sort((left, right) => left.index - right.index);
}

/**
 * 그 컨트롤에 걸려야 하는 **자물쇠 속성**.
 *
 * ⚠️ 두 속성으로 갈리는 이유가 이 함수의 본체다: `readOnly`는 값을 읽고 복사할 수 있게
 * 남기지만 `<select>`와 `<input type="checkbox">`에는 그 속성이 없다(HTML 명세 — 걸어도
 * 무시된다). 선택형에서 같은 뜻을 내는 것은 `disabled`뿐이다.
 */
function lockAttributeFor(control: EditableControl, lock: string): string {
  const selectLike = control.tag === "select" || /type="checkbox"/.test(control.attrs);
  return selectLike ? `disabled={${lock}}` : `readOnly={${lock}}`;
}

/** 같은 파일 안의 최상위 함수 하나가 차지하는 구간(다음 최상위 함수 앞까지). */
function topLevelFunctionRange(source: string, name: string, where: string): { start: number; end: number } {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `${where}에서 function ${name}(를 찾지 못했어요`).toBeGreaterThan(-1);
  const next = source.slice(start + 1).search(/\n(?:export )?(?:default )?function \w+\(/);
  return { start, end: next < 0 ? source.length : start + 1 + next };
}

/** 주석만 남긴 소스(ⓗ가 사유를 찾는 자리 · 줄바꿈·들여쓰기는 한 칸으로 접는다). */
function commentsOnly(source: string): string {
  return [...source.matchAll(/\/\*([\s\S]*?)\*\//g), ...source.matchAll(/\/\/([^\n]*)/g)]
    .map((match) => match[1])
    .join("\n")
    .replace(/\s+/g, " ");
}

/**
 * `const <gate> = <expr>;`의 **뜻**을 역할 집합으로 읽는다.
 *
 * 식은 `session.admin.role === "역할"`(옵셔널 체이닝 허용)을 `||`로 이은 모양만 허용한다 —
 * 부정이나 다른 값이 섞이면 여기서 실패한다(뜻을 읽지 못하는 게이트는 계약이 될 수 없다).
 */
function rolesAcceptedBy(source: string, gate: string, where: string): AdminRole[] {
  const expression = new RegExp(`const ${gate} = ([^;]+);`).exec(codeOnly(source))?.[1];
  expect(expression, `${where}에서 const ${gate} 선언을 찾지 못했어요`).toBeTruthy();
  const terms = expression!.split("||").map((term) => term.trim());
  const roles: AdminRole[] = [];
  for (const term of terms) {
    const match = /^session\??\.admin\.role === "([a-z_]+)"$/.exec(term);
    expect(match, `${where}의 ${gate}에 읽을 수 없는 갈래가 있어요: ${term}`).toBeTruthy();
    roles.push(match![1] as AdminRole);
  }
  return roles;
}

/** 서버가 `RequireAdminRoles`로 지키는 역할 전수(어드민 컨트롤러 전부에서 파싱). */
function serverGuardedRoles(): string[] {
  const dir = join(repoRoot, "apps", "api", "src", "admin");
  const roles = new Set<string>();
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".controller.ts")) continue;
    const source = readFileSync(join(dir, entry), "utf8");
    for (const match of source.matchAll(/@RequireAdminRoles\(([^)]*)\)/g)) {
      for (const literal of match[1].matchAll(/"([a-z_]+)"/g)) roles.add(literal[1]);
    }
  }
  expect(roles.size, "어드민 컨트롤러에서 RequireAdminRoles를 하나도 찾지 못했어요").toBeGreaterThan(0);
  return [...roles].sort();
}

// ---------------------------------------------------------------------------

describe("제출 컨트롤은 예외 없이 역할 게이트를 지난다 (라운드 77 트랙 D ⓐ)", () => {
  it("쓰기를 부르는 화면 전수가 대장에 있다 (파생 단언 · 손 목록이 아니다)", () => {
    const writeFunctions = adminApiWriteFunctions();
    // 그물이 실제로 쳐졌다는 증거(정규식이 죽으면 이 하한이 먼저 빨개진다).
    expect(writeFunctions.length, "admin-api.ts의 쓰기 함수").toBeGreaterThan(10);
    expect(writeFunctions).toContain("createItemTemplate");
    expect(writeFunctions).toContain("updateDisclosure");
    expect(writeFunctions).toContain("updateAdminCategory");
    // 한 겹 합성도 쓰기로 읽힌다(편집자의 검토 요청 경로).
    expect(writeFunctions).toContain("draftAndSubmitContentRevision");
    // 조회는 쓰기가 아니다 — 그물이 아무거나 잡고 있지 않다는 반대 방향 증거.
    for (const read of ["listItemTemplates", "listAdminCategories", "listAuditLogs", "lookupAdminEndUsers"]) {
      expect(writeFunctions, `${read}는 조회다`).not.toContain(read);
    }

    const callsWrite = screenPaths().filter((path) => {
      const source = codeOnly(readSource(path));
      return writeFunctions.some((name) => new RegExp(`\\b${name}\\(`).test(source));
    });
    expect(
      callsWrite.sort(),
      "쓰기를 부르는 화면이 대장과 다릅니다 — 새 화면이면 게이트를 세우고 대장에 적으세요"
    ).toEqual(Object.keys(ADMIN_WRITE_SCREENS).sort());
  });

  it("대장의 모든 제출 컨트롤이 자기 화면의 역할 게이트 **안**에 있다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const source = readSource(path);
      expect(source, `${path}에 ${screen.gate} 게이트가 있다`).toContain(`const ${screen.gate} =`);
      for (const submit of screen.submits) {
        const index = source.indexOf(submit);
        expect(index, `${path}: ${submit} 바인딩이 실재한다`).toBeGreaterThan(-1);
        expect(source.indexOf(submit, index + 1), `${path}: ${submit}가 한 자리다`).toBe(-1);
        expect(
          submitIsInsideGate(source, index, screen.gate),
          `${path}: ${submit}가 역할 게이트(${screen.gate})가 참인 갈래 밖에 서 있어요`
        ).toBe(true);
      }
    }
  });

  /**
   * 라운드 77 적대적 리뷰 S-2 — **뒤집힌 게이트가 실제로 빨개진다.**
   *
   * 판정이 부분 문자열이던 동안에는 이 재현이 초록이었다(머리말에 `canEdit`이 들어 있으니까).
   * 계약이 무는 것이 "이름이 근처에 있다"가 아니라 **"컨트롤이 참 갈래에 있다"** 라는 사실을
   * 뒤집힌 소스로 못박는다 — 이 단언이 없으면 강화 자체가 침묵으로 되돌아갈 수 있다.
   */
  it("갈래가 뒤집히면 판정이 거짓이 된다 (재현 · 부정 단언)", () => {
    const submit = "onClick={handleCreate}";
    const honest = `<div>{canEdit ? (<button ${submit}>추가</button>) : (<p>캡션</p>)}</div>`;
    const flipped = `<div>{!canEdit ? (<button ${submit}>추가</button>) : (<p>캡션</p>)}</div>`;
    // 카테고리 화면이 실제로 쓰는 모양 — 부정이 앞에 서고 컨트롤은 거짓 갈래에 있다.
    const negatedHonest = `<div>{!canEdit ? (<span>-</span>) : (<button ${submit}>저장</button>)}</div>`;
    // 게이트 이름이 근처에 있기만 한 자리(종전 판정이 통과시키던 모양).
    const bare = `<div>{canEdit ? null : null}</div><button ${submit}>추가</button>`;

    expect(submitIsInsideGate(honest, honest.indexOf(submit), "canEdit")).toBe(true);
    expect(submitIsInsideGate(negatedHonest, negatedHonest.indexOf(submit), "canEdit")).toBe(true);
    expect(submitIsInsideGate(flipped, flipped.indexOf(submit), "canEdit"), "뒤집힌 게이트가 통과했어요").toBe(false);
    expect(submitIsInsideGate(bare, bare.indexOf(submit), "canEdit"), "게이트 밖 컨트롤이 통과했어요").toBe(false);
  });

  it("컨트롤 게이트는 다섯이고, 나머지 한 자리는 화면 전체가 역할 뒤다", () => {
    const byKind = (kind: GateKind) =>
      Object.entries(ADMIN_WRITE_SCREENS)
        .filter(([, screen]) => screen.kind === kind)
        .map(([path]) => path)
        .sort();
    expect(byKind("control")).toEqual([
      "app/categories/page.tsx",
      "app/disclosures/page.tsx",
      "app/items/page.tsx",
      "app/links/page.tsx",
      "app/reviews/page.tsx"
    ]);
    expect(byKind("screen")).toEqual(["app/users/page.tsx"]);

    // 화면 전체 게이트는 렌더 전에 돌아선다 — 감출 컨트롤이 남지 않는다.
    const users = readSource("app/users/page.tsx");
    expect(users).toContain("if (!isAdmin) {");
    expect(users).toContain("관리자 계정 관리는 관리자(admin) 권한에서만 사용할 수 있어요.");
    expect(ADMIN_WRITE_SCREENS["app/users/page.tsx"].submits).toEqual([]);
  });

  it("스윕 범위가 값이고, 걷지 않는 뿌리는 이유와 함께 적혀 있다", () => {
    expect([...GATE_SWEEP_ROOTS]).toEqual(["app"]);
    expect(screenPaths().length, "어드민 화면 소스 전수").toBeGreaterThan(10);
    for (const [root, reason] of Object.entries(NON_SWEPT_ROOTS)) {
      expect(existsSync(join(adminRoot, ...root.split("/"))), `${root}가 실재한다`).toBe(true);
      expect(reason.trim().length, `${root}의 제외 이유`).toBeGreaterThan(40);
      expect([...GATE_SWEEP_ROOTS], `${root}는 걷는 뿌리가 아니다`).not.toContain(root);
    }
    // 제외 이유가 오늘도 사실이다 — CSV 패널의 게이트는 **마운트 지점**에 있다.
    expect(readSource("app/links/page.tsx")).toContain('session.admin.role === "admin" ? <ProductLinkBulkReplace');
    expect(readSource("src/components/ProductLinkBulkReplace.tsx"), "패널은 자기 안에서 역할을 읽지 않는다").not.toContain(
      "admin.role"
    );
  });

  it("대장의 서버 근거 파일이 실재하고, 그 자리가 admin 전용이다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const server = readRepoSource(screen.server);
      expect(server, `${path}의 근거 ${screen.server}에 역할 데코레이터가 있다`).toContain('@RequireAdminRoles("admin")');
    }
  });
});

describe("편집 컨트롤도 예외 없이 역할에 갈린다 (라운드 78 트랙 C ⓔ)", () => {
  /**
   * 화면 하나의 편집 가능 컨트롤 전수를 대장의 **네 방법**으로 갈라 본다.
   * `how`가 null인 자리가 하나라도 있으면 그 화면에는 `analyst`가 고칠 수 있는 칸이 남아 있다.
   */
  function classifyEditControls(path: string, screen: WriteScreen) {
    const source = codeOnly(readSource(path));
    const lockedRanges = screen.edits.locked.map((form) => ({
      form,
      range: topLevelFunctionRange(source, form.component, path)
    }));
    return editableControls(source).map((control) => {
      const locked = lockedRanges.find(({ range }) => control.index > range.start && control.index < range.end);
      if (locked) {
        const attribute = lockAttributeFor(control, locked.form.lock);
        return { control, how: "locked" as const, ok: control.attrs.includes(attribute), detail: attribute };
      }
      if (submitIsInsideGate(source, control.index, screen.gate)) {
        return { control, how: "gated" as const, ok: true, detail: screen.gate };
      }
      const stateGate = screen.edits.stateGates.find((gate) => submitIsInsideGate(source, control.index, gate.state));
      if (stateGate) {
        // 상태가 입력칸을 그리고, **그 상태로 들어가는 문**이 게이트 안이어야 뜻이 있다.
        const entry = source.indexOf(stateGate.entry);
        return {
          control,
          how: "state" as const,
          ok: entry > -1 && submitIsInsideGate(source, entry, screen.gate),
          detail: stateGate.entry
        };
      }
      const exempt = Object.entries(screen.edits.viewOnly).find(([needle]) => control.attrs.includes(needle));
      if (exempt) return { control, how: "view" as const, ok: exempt[1].trim().length > 20, detail: exempt[0] };
      return { control, how: null, ok: false, detail: "" };
    });
  }

  it("편집 가능 컨트롤 전수가 넷 중 하나로 갈린다 (전수 단언 · 대장이 모르는 자리 0건)", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      if (screen.kind !== "control") continue;
      const classified = classifyEditControls(path, screen);
      // 그물이 실제로 쳐졌다는 증거(태그 파싱이 죽으면 이 하한이 먼저 빨개진다).
      expect(classified.length, `${path}의 편집 가능 컨트롤`).toBeGreaterThan(0);
      for (const entry of classified) {
        const where = `<${entry.control.tag} ${entry.control.attrs.trim().slice(0, 60)}`;
        expect(entry.how, `${path}: 대장이 모르는 편집 컨트롤이 있어요 — ${where}`).not.toBeNull();
        expect(entry.ok, `${path}: ${where}가 ${entry.how}(${entry.detail})의 조건을 지키지 않아요`).toBe(true);
      }
      // 제외 목록이 낡지 않았다 — 이유가 적힌 칸이 오늘도 그 화면에 실재한다.
      for (const needle of Object.keys(screen.edits.viewOnly)) {
        expect(
          classified.some((entry) => entry.how === "view" && entry.detail === needle),
          `${path}: ${needle}는 이제 없는 칸이에요 — 제외 목록에서 지우세요`
        ).toBe(true);
      }
    }
  });

  it("잠긴 폼은 서는 자리 전수가 자물쇠를 게이트에 묶는다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const source = codeOnly(readSource(path));
      for (const form of screen.edits.locked) {
        const mounts = [...source.matchAll(new RegExp(`<${form.component}\\b`, "g"))].map((match) =>
          jsxTagAttributes(source, (match.index ?? 0) + form.component.length + 1)
        );
        expect(mounts.length, `${path}: ${form.component}가 서는 자리`).toBe(form.mounts.length);
        for (const attrs of mounts) {
          expect(attrs, `${path}: ${form.component} 한 자리가 자물쇠(${form.bind})를 묶지 않아요`).toContain(form.bind);
        }
        for (const needle of form.mounts) {
          expect(mounts.filter((attrs) => attrs.includes(needle)), `${path}: ${needle}가 한 자리다`).toHaveLength(1);
        }
        // ⚠️ 리뷰 S-6: 게이트 **안**에 선 자리도 예외가 아니다 — 그 자물쇠는 오늘 죽은 값이지만
        // 그 사실이 이 계약을 약하게 만들지 않는다(사유는 GATED_MOUNT_LOCK_REASON).
        for (const gated of screen.edits.gated) {
          if (!form.mounts.includes(gated)) continue;
          const gatedMount = mounts.find((attrs) => attrs.includes(gated));
          expect(gatedMount, `${path}: ${gated} 자리를 찾지 못했어요`).toBeDefined();
          expect(gatedMount, `${path}: 게이트 안의 자리도 자물쇠를 묶는다 — ${GATED_MOUNT_LOCK_REASON}`).toContain(
            form.bind
          );
        }
        // 그 폼 안에 실제로 잠글 것이 있다(빈 그물이 아니다).
        const range = topLevelFunctionRange(source, form.component, path);
        const inside = editableControls(source).filter(
          (control) => control.index > range.start && control.index < range.end
        );
        expect(inside.length, `${path}: ${form.component} 안의 편집 컨트롤`).toBeGreaterThan(0);
      }
    }
  });

  it("빈 생성 폼은 게이트 안에 있다 — 거기에는 읽을 데이터가 0건이기 때문이다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const source = codeOnly(readSource(path));
      for (const needle of screen.edits.gated) {
        const index = source.indexOf(needle);
        expect(index, `${path}: ${needle} 바인딩이 실재한다`).toBeGreaterThan(-1);
        expect(source.indexOf(needle, index + 1), `${path}: ${needle}가 한 자리다`).toBe(-1);
        expect(
          submitIsInsideGate(source, index, screen.gate),
          `${path}: ${needle}가 역할 게이트(${screen.gate})가 참인 갈래 밖에 서 있어요`
        ).toBe(true);
      }
    }
  });

  it("여닫이 토글의 라벨이 사실을 말한다 — 그 낱말은 이미 이 콘솔에 있었다 (ⓖ)", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const source = readSource(path);
      for (const toggle of screen.edits.toggles) {
        expect(source, `${path}: ${toggle}`).toContain(toggle);
        expect(toggle, `${path}: 토글이 게이트(${screen.gate})를 읽는다`).toContain(screen.gate);
        expect(toggle, `${path}: 읽기 권한자에게는 "보기"다`).toContain('"보기"');
        expect(toggle, `${path}: 닫기는 그대로다`).toContain('"닫기"');
      }
      if (!screen.edits.toggles.length) continue;
      // 새 낱말 0건 — "보기"는 이 화면이 필터 라벨로 이미 쓰던 낱말이다.
      expect(
        (codeOnly(source).match(/보기/g) ?? []).length,
        `${path}: "보기"가 이 화면의 새 낱말이 됐어요`
      ).toBeGreaterThan(screen.edits.toggles.length);
    }
  });

  /**
   * 라운드 77 적대적 리뷰 S-2의 규율을 편집 컨트롤 쪽에도 — **강화가 침묵으로 되돌아가지 않게.**
   * 자물쇠가 풀린 폼과 갈래가 뒤집힌 생성 폼이 실제로 빨개지는 것을 뒤집힌 소스로 못박는다.
   */
  it("자물쇠가 풀리거나 갈래가 뒤집히면 판정이 거짓이 된다 (재현 · 부정 단언)", () => {
    const honest = `<div>{canEdit ? (<input id="new-key" type="text" />) : (<p>캡션</p>)}</div>`;
    const flipped = `<div>{!canEdit ? (<input id="new-key" type="text" />) : (<p>캡션</p>)}</div>`;
    expect(submitIsInsideGate(honest, editableControls(honest)[0].index, "canEdit")).toBe(true);
    expect(
      submitIsInsideGate(flipped, editableControls(flipped)[0].index, "canEdit"),
      "뒤집힌 생성 폼이 통과했어요"
    ).toBe(false);

    // ⚠️ 함수 본문의 `{`는 게이트 컨테이너가 아니다. 종전 판정으로는 선언이 앞에 있기만 하면
    // 본문 **전체**가 "게이트 안"이었다(`/reviews`의 상태 필터가 그 첫 사례였다).
    const body = 'function Screen() {\n  const canEdit = a && b;\n  return (<div><input id="filter" /></div>);\n}';
    expect(
      submitIsInsideGate(body, body.indexOf('id="filter"'), "canEdit"),
      "함수 본문이 게이트 갈래로 읽혔어요"
    ).toBe(false);

    // 자물쇠는 태그마다 다르다 — 선택형에 readOnly를 걸면 브라우저가 무시하므로 통과하지 않는다.
    const select = editableControls(`<select disabled={readOnly}>`)[0];
    expect(select.attrs).toContain(lockAttributeFor(select, "readOnly"));
    const checkbox = editableControls(`<input type="checkbox" readOnly={readOnly} />`)[0];
    expect(checkbox.attrs, "체크박스에 readOnly는 자물쇠가 아니다").not.toContain(lockAttributeFor(checkbox, "readOnly"));
    const unlocked = editableControls(`<input type="text" value={form.name} />`)[0];
    expect(unlocked.attrs, "자물쇠 없는 입력칸이 통과했어요").not.toContain(lockAttributeFor(unlocked, "readOnly"));
    // 화살표 함수의 `>`에서 속성 읽기가 끊기지 않는다(끊기면 자물쇠를 못 보고 조용히 초록이 된다).
    const arrow = editableControls(`<input type="text" onChange={(event) => set(event.target.value)} readOnly={readOnly} />`)[0];
    expect(arrow.attrs, "화살표 함수 뒤의 속성을 놓쳤어요").toContain("readOnly={readOnly}");
  });

  it("readOnly와 disabled로 갈리는 이유가 주석에 값으로 적혀 있다 (ⓗ)", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      if (!screen.edits.locked.length) continue;
      const comments = commentsOnly(readSource(path));
      expect(comments, `${path}: <select>에 readOnly가 없다는 사실`).toContain("readOnly 속성이 없다");
      expect(comments, `${path}: 그래서 disabled로 갈린다는 사실`).toContain("disabled");
    }
  });

  it("화면 전체가 게이트 뒤인 화면에는 감출 편집 컨트롤이 남지 않는다 (users)", () => {
    const path = "app/users/page.tsx";
    expect(ADMIN_WRITE_SCREENS[path].edits).toEqual(NO_EDIT_CONTROLS);
    const source = codeOnly(readSource(path));
    const earlyReturn = source.indexOf("if (!isAdmin) {");
    expect(earlyReturn, "users 화면의 early return").toBeGreaterThan(-1);
    const controls = editableControls(source);
    expect(controls.length, "그 화면에도 입력칸은 있다").toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.index, `${path}: 입력칸이 early return보다 앞에 서 있어요`).toBeGreaterThan(earlyReturn);
    }
  });

  /**
   * ⚠️ **라운드 78 리뷰 S-7 — 이 파일의 그물이 서는 바닥을 재현으로 못박는다.**
   * `codeOnly`가 문자열 안의 `//`를 주석으로 먹으면 **그 줄의 나머지 코드**가 사라지고, 그 위에
   * 선 "전수" 단언들은 아무 말도 하지 않는다. 트랙 C가 여닫이 필터에서 배운 그 규율대로,
   * 고친 사실과 **남은 한계**를 둘 다 값으로 적는다.
   */
  it("codeOnly는 문자열 안의 //를 주석으로 먹지 않는다 (리뷰 S-7의 재현)", () => {
    const fixture = [
      'const message = "URL은 http:// 또는 https:// 로 시작해야 해요.";',
      '<input id="after-string" readOnly={readOnly} /> // 이 줄 주석은 사라진다',
      "const gate = role === 'admin'; // 따옴표가 닫힌 뒤의 주석도 사라진다"
    ].join("\n");
    const stripped = codeOnly(fixture);

    // ⓐ 문자열 안의 `//` 뒤가 살아남는다 — 종전에는 여기서 닫는 따옴표와 세미콜론이 사라졌다.
    expect(stripped).toContain('"URL은 http:// 또는 https:// 로 시작해야 해요.";');
    // ⓑ 그리고 같은 파일에서 그 줄 뒤의 편집 컨트롤도 그대로 보인다(그물이 서는 바닥이다).
    expect(stripped).toContain('readOnly={readOnly}');
    // ⓒ 진짜 줄 주석은 여전히 사라진다(고친 것이 판정을 뒤집지 않았다).
    expect(stripped).not.toContain("이 줄 주석은 사라진다");
    expect(stripped).not.toContain("따옴표가 닫힌 뒤의 주석도 사라진다");
    expect(stripped).toContain("const gate = role === 'admin';");

    // ⓓ ⚠️ **남은 한계**: JSX 텍스트(따옴표 밖)의 `//`는 오늘도 주석으로 읽힌다. 그 자리가
    //    삼키는 것은 텍스트뿐이라(속성·게이트가 아니다) 이 계약의 값은 바뀌지 않는다 —
    //    그 사실을 값으로 적어 둔다(다음 라운드가 다시 발견하지 않도록).
    const jsxText = codeOnly("<span>http:// 로 시작하는 주소</span>");
    expect(jsxText).not.toContain("</span>");

    // 그리고 그 한계가 실제 화면 파일에서 무엇을 삼키는지도 못박는다 — 힌트 문장 한 줄이다.
    const linksSource = codeOnly(readSource("app/links/page.tsx"));
    const urlInput = linksSource.indexOf('id={`${idPrefix}-url`}');
    expect(urlInput, "URL 입력칸").toBeGreaterThan(-1);
    expect(linksSource.slice(urlInput, urlInput + 400)).toContain("readOnly={readOnly}");
  });

  it("종전 칸은 한 칸도 바뀌지 않았다 — submits 총합과 캡션 표 (라운드 78 트랙 C ⓒ)", () => {
    const submitTotal = Object.values(ADMIN_WRITE_SCREENS).reduce((sum, screen) => sum + screen.submits.length, 0);
    expect(submitTotal, "제출 컨트롤 총합(라운드 77이 센 값)").toBe(12);
    expect(Object.keys(SCREEN_NOTICE_CONSTANTS).sort()).toEqual([
      "app/categories/page.tsx",
      "app/disclosures/page.tsx",
      "app/items/page.tsx",
      "app/links/page.tsx"
    ]);
  });
});

describe("canEdit의 뜻이 서버와 같다 (라운드 77 트랙 D ⓑ)", () => {
  it("게이트가 통과시키는 역할이 대장의 값과 같다 (세 역할 전수)", () => {
    expect([...ADMIN_ROLES].sort()).toEqual(["admin", "analyst", "editor"]);
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const accepted = rolesAcceptedBy(readSource(path), screen.gate, path);
      expect([...accepted].sort(), `${path}의 ${screen.gate}가 통과시키는 역할`).toEqual([...screen.allows].sort());
      // 세 역할 전수 — 대장에 없는 역할은 예외 없이 막힌다.
      for (const role of ADMIN_ROLES) {
        expect(accepted.includes(role), `${path}: ${role}`).toBe(screen.allows.includes(role));
      }
    }
  });

  it("analyst에게 열린 쓰기 경로는 서버에도 화면에도 0건이다 (부정 단언)", () => {
    // 서버: 어드민 컨트롤러 전수의 RequireAdminRoles에 analyst가 없다.
    expect(serverGuardedRoles()).toEqual(["admin", "editor"]);
    // 화면: 어떤 게이트도 analyst를 통과시키지 않는다.
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      expect(rolesAcceptedBy(readSource(path), screen.gate, path), `${path}`).not.toContain("analyst");
    }
  });

  it("editor가 지나는 문은 검토 요청이다 — 직접 쓰기가 아니다", () => {
    // 편집자를 통과시키는 화면 셋은 전부 그 갈래에서 draft -> submit을 부른다.
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      if (!screen.allows.includes("editor")) continue;
      const source = readSource(path);
      expect(source, `${path}: 편집자 갈래`).toContain('session.admin.role === "editor"');
      expect(source, `${path}: 편집자는 검토 요청으로 간다`).toContain("draftAndSubmitContentRevision");
    }
    // 그 문이 서버에도 열려 있다(검토 경로만 admin, editor다).
    const revisions = readRepoSource("apps/api/src/admin/content-revisions.controller.ts");
    expect(revisions).toContain('@RequireAdminRoles("admin", "editor")');
    // 직접 쓰기 쪽은 admin뿐이다.
    expect(readRepoSource("apps/api/src/admin/admin.controller.ts")).not.toContain('@RequireAdminRoles("admin", "editor")');
  });

  it("isEditor 갈래의 문안은 한 글자도 바뀌지 않았다 (바이트 불변)", () => {
    const editorCopy = [
      "편집자 계정은 바로 저장하지 않고, 검토 요청을 관리자에게 보내요.",
      '{creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}',
      '{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}'
    ];
    for (const path of ["app/items/page.tsx", "app/links/page.tsx", "app/disclosures/page.tsx"]) {
      const source = readSource(path);
      for (const copy of editorCopy) expect(source, `${path}: ${copy}`).toContain(copy);
    }
    for (const path of ["app/items/page.tsx", "app/links/page.tsx"]) {
      expect(readSource(path)).toContain("저장하면 관리자에게 검토 요청이 전달돼요.");
      expect(readSource(path)).toContain('{editSubmitting ? "저장 중..." : isEditor ? "검토 요청" : "저장"}');
    }
    expect(readSource("app/disclosures/page.tsx")).toContain('{saving ? "저장 중..." : isEditor ? "검토 요청" : "저장"}');
  });

  it("쓰기 catch 자리 수가 그대로다 — 컨트롤을 감출 뿐 catch를 지우지 않는다 (2·2·2)", () => {
    // 라운드 76 B의 WRITE_ERROR_COPY_SITES가 세 화면에서 세는 값 그대로다.
    for (const path of ["app/items/page.tsx", "app/links/page.tsx", "app/disclosures/page.tsx"]) {
      const source = readSource(path);
      expect((source.match(/writeErrorMessage\((?:error|err), "/g) ?? []).length, `${path}의 쓰기 폴백`).toBe(2);
    }
  });
});

describe("캡션의 사본은 하나뿐이다 (라운드 77 트랙 D ⓒ)", () => {
  /** 사본을 세는 뿌리 — 테스트 파일은 대조하는 쪽이지 사본이 아니다(미러 대장과 같은 관례). */
  function repoCopyPaths(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
        found.push(relative(adminRoot, fullPath).split(sep).join("/"));
      }
    };
    for (const root of ["app", "src"]) walk(join(adminRoot, root));
    return found.sort();
  }

  it("두 문장이 사는 자리는 admin-role-copy.ts 하나다 (부정 단언)", () => {
    for (const notice of [ADMIN_WRITE_ROLE_NOTICE, ADMIN_EDITOR_WRITE_ROLE_NOTICE]) {
      const holders = repoCopyPaths().filter((path) => codeOnly(readSource(path)).includes(notice));
      expect(holders, `화면이 캡션을 손으로 되쓰고 있어요 — 상수를 import하세요: ${notice}`).toEqual([
        "src/lib/admin-role-copy.ts"
      ]);
    }
    // 종전에 인라인이 있던 자리도 이제 상수를 부른다(카테고리 문장은 바이트 불변).
    expect(ADMIN_WRITE_ROLE_NOTICE).toBe("지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요.");
    expect(ADMIN_EDITOR_WRITE_ROLE_NOTICE).toBe(
      "지금 계정은 조회만 할 수 있어요. 수정은 편집자(editor) 이상 권한이 필요해요."
    );
    for (const [path, constant] of Object.entries(SCREEN_NOTICE_CONSTANTS)) {
      expect(readSource(path), `${path}가 한 자리를 부른다`).toContain(`{${constant}}`);
      expect(readSource(path)).toContain('from "../../src/lib/admin-role-copy"');
    }
  });

  /**
   * 라운드 77 적대적 리뷰 S-1 — **캡션이 화면 자신의 게이트보다 위를 말하지 않는다.**
   *
   * 한 문장을 다섯 화면이 나눠 쓰면 그중 셋에서 거짓이 됐다: 준비템·링크·고지 문구의 게이트는
   * `admin || editor`인데 캡션은 *"수정은 관리자(admin) 권한이 필요해요"* 라고 요구 역할을
   * **한 칸 과장**했다. 이제 캡션은 대장의 `allows`에서 **파생**된다 — 게이트가 editor를
   * 통과시키면 editor 문장, `admin` 하나면 admin 문장이다.
   */
  it("캡션이 그 화면의 게이트에서 파생된다 (요구 역할 과장 0건)", () => {
    for (const [path, constant] of Object.entries(SCREEN_NOTICE_CONSTANTS)) {
      const screen = ADMIN_WRITE_SCREENS[path];
      expect(screen, `${path}는 대장에 있다`).toBeTruthy();
      const expected = screen.allows.includes("editor") ? "ADMIN_EDITOR_WRITE_ROLE_NOTICE" : "ADMIN_WRITE_ROLE_NOTICE";
      expect(constant, `${path}의 캡션이 게이트(${screen.allows.join("|")})와 어긋나요`).toBe(expected);
      expect(readSource(path), `${path}가 다른 캡션을 부른다`).not.toContain(
        `{${expected === "ADMIN_WRITE_ROLE_NOTICE" ? "ADMIN_EDITOR_WRITE_ROLE_NOTICE" : "ADMIN_WRITE_ROLE_NOTICE"}}`
      );
    }
    // 그리고 캡션을 세우는 화면 전수가 이 표와 같다(새 화면이 생기면 여기가 먼저 빨개진다).
    const wired = repoCopyPaths().filter((path) => /\{ADMIN_(?:EDITOR_)?WRITE_ROLE_NOTICE\}/.test(readSource(path)));
    expect(wired.sort()).toEqual(Object.keys(SCREEN_NOTICE_CONSTANTS).sort());
  });

  it("신설 모듈은 상수 표가 아니다 — 미러 스크레이프의 단위가 아닌 이유가 적혀 있다", () => {
    const module = readSource("src/lib/admin-role-copy.ts");
    // 문자열 상수 둘이다(배열도 Record도 없다 — 있으면 admin-canonical-mirrors의 대장이 필요하다).
    expect((module.match(/^export /gm) ?? []).length, "내보내는 값은 둘이다").toBe(2);
    expect(codeOnly(module)).not.toMatch(/=\s*[[{]/);
    expect(module, "스크레이프 단위가 아닌 이유가 값으로 적혀 있다").toContain("scrapeConstantTables");
  });

  /**
   * ⚠️ **인접 계약과의 충돌을 값으로 남긴다.**
   *
   * ADM-127의 계약(`src/admin-categories-users-lookup.test.ts` — *"hides the edit controls from
   * non-admin roles"*)이 **그 화면의 소스에서** 캡션 문장을 찾는다. 그 파일은 이 트랙의 무접촉
   * 대상이라, 캡션이 상수로 올라간 뒤에도 문장을 잃지 않도록 카테고리 화면에 **주석 인용**을
   * 남겼다. 인용은 화면에 서지 않으므로(위 사본 단언이 코드만 센다) 사본이 아니고, 아래 단언이
   * 인용과 상수가 갈리는 순간을 잡는다.
   */
  it("카테고리 화면의 주석 인용이 상수와 한 글자도 다르지 않다", () => {
    const page = readSource("app/categories/page.tsx");
    // 주석만 긁는다(코드는 위 사본 단언이 이미 비어 있음을 보장한다). 줄바꿈·들여쓰기는
    // 한 칸으로 접어 비교한다 — 인용이 두 줄에 걸쳐 있어도 문장은 같아야 한다.
    const comments = [...page.matchAll(/\/\*([\s\S]*?)\*\//g), ...page.matchAll(/\/\/([^\n]*)/g)]
      .map((match) => match[1])
      .join("\n")
      .replace(/\s+/g, " ");
    expect(comments, "카테고리 화면의 주석에 캡션 인용이 남아 있다").toContain(ADMIN_WRITE_ROLE_NOTICE);
    // 그리고 그 인용은 화면에 서는 사본이 아니다(코드에는 상수 호출만 있다).
    expect(codeOnly(page)).not.toContain(ADMIN_WRITE_ROLE_NOTICE);
    // 그리고 ADM-127의 계약이 찾는 조각이 그 인용 안에 그대로 있다.
    expect(page).toContain("수정은 관리자(admin) 권한이 필요해요");
  });
});

describe("내비 게이트와 컨트롤 게이트는 서로 다른 축이다 (라운드 77 트랙 D ⓓ)", () => {
  /** `NAV_ITEMS`에서 `roles`가 붙은 href 전수(소스 파싱 — 셸은 무접촉이다). */
  function navRoleGatedHrefs(): string[] {
    const shell = readSource("src/components/AdminShell.tsx");
    const block = /const NAV_ITEMS: Array<\{[^}]*\}> = \[([\s\S]*?)\n\];/.exec(shell)?.[1];
    expect(block, "AdminShell.tsx에서 NAV_ITEMS를 찾지 못했어요").toBeTruthy();
    return [...block!.matchAll(/\{ href: "([^"]+)"[^}]*roles: \[[^\]]*\][^}]*\}/g)].map((match) => match[1]).sort();
  }

  it("내비가 감추는 화면은 셋 그대로다 (NAV_ITEMS의 roles 무변경)", () => {
    expect(navRoleGatedHrefs()).toEqual(["/audit-logs", "/users", "/users-lookup"]);
  });

  it("컨트롤을 감추는 다섯은 내비에서 감추지 않는다 — 읽는 것이 분석가의 일이다", () => {
    const navGated = navRoleGatedHrefs();
    const controlGated = Object.values(ADMIN_WRITE_SCREENS).filter((screen) => screen.kind === "control");
    expect(controlGated).toHaveLength(5);
    for (const screen of controlGated) {
      expect(navGated, `${screen.href}는 내비에서 감추지 않는다`).not.toContain(screen.href);
      expect(readSource("src/components/AdminShell.tsx"), `${screen.href}가 내비에 있다`).toContain(
        `href: "${screen.href}"`
      );
    }
    // 반대 방향: 내비가 감추는 셋은 컨트롤 게이트의 축이 아니다(화면 전체가 admin 전용이거나
    // 쓰기가 아예 없다).
    const controlHrefs = controlGated.map((screen) => screen.href);
    for (const href of navGated) expect(controlHrefs, `${href}`).not.toContain(href);
  });
});
