import type { NecessityLevel } from "@wooriai/domain";
import { apiErrorCodeOf } from "../api/api-error";
import { objectParticle } from "../text/korean-particles";
import type { ExpenseLinkParamsWithSource } from "./expense-link-prompt";
import { bandDefinitions, type StageBandLabel } from "./stage-bands";

/**
 * 라운드 100 T3 — **커스텀 품목 입력의 검증·문구·기본값·조사·a11y 단일 소스** (설계 문서
 * docs/5차/round100-custom-items-design.md §4.2 · §9.6).
 *
 * 화면(app/(tabs)/items.tsx의 진입점 · src/items/CustomItemSheet.tsx의 시트 ·
 * app/items/[itemTemplateId].tsx의 수정/삭제 갈래)은 이 모듈을 **그리기만** 한다 — 문장·경계를
 * 화면에 다시 적으면 두 벌이 되고 한쪽만 낡는다(text-limits · status-mutation-messages 관례).
 *
 * ## 값의 출처 — 이 모듈은 경계를 짓지 않고 **미러**한다
 *
 * - 이름 상한 80 · 아이당 한도 200은 packages/contracts(`CUSTOM_ITEM_NAME_MAX_LENGTH` ·
 *   `CUSTOM_ITEM_MAX_PER_CHILD`)가 수기 단일 소스다. 모바일은 contracts를 import하지 않으므로
 *   (known-limitations §D) 여기 사본을 두되, 대조는 옆 테스트(custom-item-form.test.ts)가 계약
 *   소스를 읽어서 문다 — `src/expenses/text-limits.ts`와 같은 관례. ⚠️ 라운드 95 공통 금지에
 *   따라 새 `export const`는 0건이고 값은 함수가 돌려준다(§6.3).
 * - 실패 문장은 로컬 대역(src/api/local-backend.ts)이 서버 §9.3과 같은 해요체로 이미 던지는
 *   그 문장들이다. 여기서 같은 바이트를 들고, 옆 테스트가 로컬 대역 소스와 맞댄다 — 데모
 *   세션과 실서버가 같은 실패에 다른 말을 하지 않게 하기 위해서다.
 *
 * ## 시기 밴드·필수도 어휘
 *
 * - 시기 밴드 4칩의 라벨은 `bandDefinitions`(src/items/stage-bands.ts)에서 그대로 온다 —
 *   그 라벨이 곧 서버로 보내는 `stageBand` 값이라(§1.3) 목록을 손으로 복제하면 조용히 어긋난다
 *   (ITEM-121이 시기 칩에 세운 그 규칙 그대로).
 * - 필수도 3칩의 문구(꼭 필요해요 / 있으면 편해요 / 선택이에요)는 §9.6 확정값이고, 스토어
 *   소개문(docs/store/play-listing.md §2)이 이미 쓰는 그 세 단계 어휘다 — 새 어휘를 짓지 않는다.
 *
 * react-native/react-query import 0건인 순수 모듈 — vitest node 환경에서 그대로 테스트한다.
 */

/** 계약 `CUSTOM_ITEM_NAME_MAX_LENGTH`(= custom_items.name varchar(80))의 사본. 대조는 옆 테스트. */
export function customItemNameMaxLength(): number {
  return 80;
}

/** 계약 `CUSTOM_ITEM_MAX_PER_CHILD`(아이당 활성 상한)의 사본. 대조는 옆 테스트. */
export function customItemMaxPerChild(): number {
  return 200;
}

/** 서버가 하는 것(§9.2 "트림 후 재검증")과 같은 정규화 — 저장 직전에 화면이 한 번 지난다. */
export function normalizeCustomItemName(raw: string): string {
  return raw.trim();
}

/**
 * 이름 검증. 통과하면 null, 아니면 그 자리에 세울 문장.
 *
 * 문장은 로컬 대역(local-backend.ts `requireCustomItemName`)이 던지는 것과 같은 바이트다 —
 * 시트의 사전 판정과 저장 실패가 같은 실패를 다른 말로 부르지 않게 한다. ⚠️ "이미 들어 있는
 * 값"도 판정한다(text-limits 관례): TextInput의 maxLength는 새 타이핑만 막고, 프리필·붙여넣기
 * 경로로 들어온 초과분은 이 판정이 잡는다.
 */
export function validateCustomItemName(raw: string): string | null {
  const name = normalizeCustomItemName(raw);
  if (!name) return "준비물 이름을 입력해 주세요.";
  if (name.length > customItemNameMaxLength()) {
    return `준비물 이름은 ${customItemNameMaxLength()}자까지 입력할 수 있어요.`;
  }
  return null;
}

/** 시기 밴드 칩 4개의 라벨 — bandDefinitions가 단일 소스다(복제 금지, 위 머리말). */
export function customItemStageBandOptions(): StageBandLabel[] {
  return bandDefinitions.map((band) => band.label);
}

/**
 * 응답의 timingLabel(커스텀은 밴드 라벨 원문 — §9.2)을 밴드 라벨로 되읽는다. 밴드가 아니면
 * 폴백 — 수정 시트의 기본 선택이 비는 것보다 첫 칩이 서는 쪽이 낫고, 저장은 사용자가 보고
 * 있는 그 칩 값으로만 나간다(지어낸 값이 조용히 저장되는 경로가 없다).
 */
export function coerceStageBandLabel(value: unknown, fallback: StageBandLabel): StageBandLabel {
  const known = customItemStageBandOptions().find((label) => label === value);
  return known ?? fallback;
}

/** 필수도 칩 3개 — §9.6 확정 어휘(스토어 소개문의 세 단계 그대로). 기본은 essential(§1.2). */
export function customItemNecessityOptions(): Array<{ value: NecessityLevel; label: string }> {
  return [
    { value: "essential", label: "꼭 필요해요" },
    { value: "convenience", label: "있으면 편해요" },
    { value: "optional", label: "선택이에요" }
  ];
}

/** 시트가 들고 시작하는 초안. 시기 기본값 = 지금 보고 있는 칩(§4.2). */
export function initialCustomItemDraft(input: {
  name?: string;
  stageBand: StageBandLabel;
  necessityLevel?: NecessityLevel;
}): { name: string; stageBand: StageBandLabel; necessityLevel: NecessityLevel } {
  return {
    name: input.name ?? "",
    stageBand: input.stageBand,
    // 기본 essential(§1.2): essential이어야 준비율(ITEM-114) 분모에 서서 체크가 진행률을
    // 움직인다 — 커스텀 품목의 핵심 가치가 그 체크리스트 편입이다. 칩이 노출돼 있어 사용자가
    // 언제든 바꾼다(R3).
    necessityLevel: input.necessityLevel ?? "essential"
  };
}

/** 목록 아래 진입 버튼의 라벨(§9.6 확정값). */
export function customItemEntryLabel(): string {
  return "준비물 직접 추가하기";
}

/** 목록 타일 발밑 슬롯의 커스텀 표식 한 줄(§9.6 확정값 — isCustom 행에만 선다). */
export function customItemListMarkerText(): string {
  return "직접 추가한 준비물";
}

export type CustomItemSheetKind = "create" | "edit";

/**
 * 시트가 그리는 문구 한 벌. 낱말은 이 앱이 이미 쓰는 것만 쓴다 — "준비 시기"·"필수도"는 상세
 * "제품 정보" 탭의 그 줄 라벨(app/items/[itemTemplateId].tsx `productDetailFacts`)이고,
 * 자리표시자 형식(`예: …`)은 품목 메모 입력(src/items/item-memo.ts)의 관례다.
 */
export function customItemSheetCopy(kind: CustomItemSheetKind): {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  stageSectionLabel: string;
  necessitySectionLabel: string;
  saveLabel: string;
  cancelLabel: string;
} {
  return {
    title: kind === "create" ? "준비물 직접 추가" : "준비물 수정",
    nameLabel: "준비물 이름",
    namePlaceholder: "예: 아기 욕조",
    stageSectionLabel: "준비 시기",
    necessitySectionLabel: "필수도",
    saveLabel: kind === "create" ? "추가하기" : "저장하기",
    cancelLabel: "닫기"
  };
}

/** 저장 버튼의 스크린 리더 문장 — 시트 제목이 시야 밖일 때도 무엇을 저장하는지 들린다. */
export function customItemSaveAccessibilityLabel(kind: CustomItemSheetKind): string {
  return kind === "create" ? "직접 추가할 준비물 저장" : "직접 추가한 준비물 수정 저장";
}

/** 생성 성공 토스트(use-transient-notice 관례). 이름 뒤 조사는 값에서 고른다(§6.5). */
export function customItemCreatedNotice(name: string): string {
  return `『${name}』${objectParticle(name)} 준비 목록에 추가했어요.`;
}

/** 수정 성공 토스트. */
export function customItemUpdatedNotice(name: string): string {
  return `『${name}』${objectParticle(name)} 수정했어요.`;
}

/** 상세의 수정 진입 버튼 문구·낭독(§4.4 — 편집 게이트는 useItemStatusGate 재사용). */
export function customItemEditEntryLabel(): string {
  return "수정하기";
}

export function customItemEditAccessibilityLabel(name: string): string {
  return `${name} 수정하기`;
}

/** 상세의 삭제 진입 버튼 문구·낭독. */
export function customItemDeleteEntryLabel(): string {
  return "지우기";
}

export function customItemDeleteAccessibilityLabel(name: string): string {
  return `${name} 지우기`;
}

/**
 * 삭제 확인 Alert(파괴 동작 확인 관례 — 질문형 제목 + "취소" cancel + 실행 버튼, GIFTED_RESET
 * 형식). 이름을 끼우는 문장이라 조사를 값에서 고른다(§6.5 korean-particles).
 * "준비 상태도 함께 사라져요"는 사실이다 — 커스텀 품목은 상태를 행에 내장한다(§1 D1).
 */
export function customItemDeleteConfirmCopy(name: string): {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: "직접 추가한 준비물을 지울까요?",
    message: `『${name}』${objectParticle(name)} 목록에서 지워요. 준비 상태도 함께 사라져요.`,
    confirmLabel: "지우기",
    cancelLabel: "취소"
  };
}

/** §9.3 `CUSTOM_ITEM_LIMIT_EXCEEDED`의 문장 — 로컬 대역이 던지는 것과 같은 바이트. */
export function customItemLimitExceededMessage(): string {
  return `직접 추가할 수 있는 준비물은 아이당 ${customItemMaxPerChild()}개까지예요.`;
}

/** §9.3 `CUSTOM_ITEM_NOT_FOUND`의 문장 — 로컬 대역이 던지는 것과 같은 바이트. */
export function customItemNotFoundMessage(): string {
  return "직접 추가한 준비물을 찾을 수 없어요.";
}

/**
 * 로컬 대역(데모/테스트 세션)이 검증 실패에 던지는 문장 전수 — 코드 없는 Error라서 문장으로
 * 알아본다. **정확히 같은 바이트일 때만** 통과시킨다(느슨한 부분 일치는 모르는 내부 문장을
 * 화면으로 흘리는 문이 된다 — api-error.ts 화이트리스트와 같은 규율).
 */
function isKnownCustomItemFailureSentence(message: string): boolean {
  return [
    customItemLimitExceededMessage(),
    customItemNotFoundMessage(),
    "준비물 이름을 입력해 주세요.",
    `준비물 이름은 ${customItemNameMaxLength()}자까지 입력할 수 있어요.`,
    "시기를 다시 확인해 주세요.",
    "필수 정도를 다시 확인해 주세요."
  ].includes(message);
}

/**
 * 커스텀 품목 생성/수정/삭제 실패 → 화면 문장.
 *
 * 층은 셋이고 위가 이긴다(설계 §9.3 + api-error 표 관례):
 *  1. **커스텀 전용 코드** — `CUSTOM_ITEM_LIMIT_EXCEEDED`·`CUSTOM_ITEM_NOT_FOUND`는 앱 전역
 *     표(src/api/api-error.ts)에 없다(그 표의 스윕 파일 넷 밖에서 나는 코드다). 문장은 계약
 *     §9.3의 해요체 그대로 이 모듈이 진다.
 *  2. **로컬 대역의 코드 없는 Error** — 데모 세션은 같은 해요체 문장을 message로 던진다.
 *     아는 문장(정확 일치)만 그대로 올린다.
 *  3. **그 밖 전부** — 호출부가 넘긴 fallback. 호출부는 `useSaveErrorCopy(isError, error)`를
 *     넘기므로 표에 있는 코드(FORBIDDEN·CHILD_NOT_FOUND …)는 그 표의 문장이, 모르는 실패는
 *     오프라인 인지 두 문장(SAVE_ERROR_NOTICE/OFFLINE_SAVE_NOTICE)이 선다 — 문장을 여기서
 *     새로 짓지 않는다.
 */
export function customItemMutationErrorMessage(error: unknown, fallback: string): string {
  const code = apiErrorCodeOf(error);
  if (code === "CUSTOM_ITEM_LIMIT_EXCEEDED") return customItemLimitExceededMessage();
  if (code === "CUSTOM_ITEM_NOT_FOUND") return customItemNotFoundMessage();
  if (error instanceof Error && isKnownCustomItemFailureSentence(error.message)) return error.message;
  return fallback;
}

/**
 * "지출도 기록할까요?" 프리필의 커스텀 게이트(§4.3 · §9.6).
 *
 * `expenses.linked_item_template_id`는 `item_templates`를 향한 SQL FK라(§0 실측) 커스텀 id를
 * 실으면 저장이 FK 위반으로 죽는다. 그래서 커스텀이면 **키 자체를 걷는다** — 품목명(과 출처
 * `from`)만 남아 프리필은 그대로 되고, 자동 준비완료 연동만 없다(상태는 사용자가 방금 직접
 * 눌렀으니 잃는 것이 없다). 조립기(expenseLinkParams)는 한 벌 그대로다 — 이 함수는 조립하지
 * 않고 걷기만 한다(두 번째 조립기 금지).
 */
export function withoutCustomItemTemplateId(
  params: ExpenseLinkParamsWithSource,
  isCustom: boolean
): Omit<ExpenseLinkParamsWithSource, "itemTemplateId"> & { itemTemplateId?: string } {
  if (!isCustom) return params;
  const { itemTemplateId: _omitted, ...rest } = params;
  return rest;
}

/**
 * 목록 스냅샷에서 이 id가 커스텀 행인지 판정한다 — 프롬프트(ExpenseLinkPrompt)는 id·이름만
 * 들고 다니므로(그 타입은 이 라운드 0바이트), 게이트 시점에 tab="all" 스냅샷을 되본다.
 * prepared로 바뀐 행도 그 스냅샷에는 남아 있어(전 상태 스냅샷) detached 줄에서도 판정이 선다.
 */
export function isCustomItemInList(
  items: ReadonlyArray<{ id: string; isCustom?: boolean }> | undefined,
  itemTemplateId: string
): boolean {
  return Boolean(items?.some((item) => item.id === itemTemplateId && item.isCustom === true));
}

// ---------------------------------------------------------------------------
// 멱등 키 — 온보딩/설정 아이 생성 관례(§2.3)의 커스텀 품목 판본.
// 형식은 src/children/child-create-idempotency.ts를 그대로 따른다: 시트가 열릴 때 초안 단위
// 키 하나(지연 발급), 같은 본문의 재시도에 재사용, 성공 시 폐기. 라운드 99 F1(M)의 교훈도
// 함께 옮긴다 — 키는 **본문 지문**에 묶인다: 실패 후 입력을 고쳐 재제출하면 새 키가 나가
// 서버 409(IDEMPOTENCY_KEY_CONFLICT) 루프를 만들지 않는다(멱등 보호는 동일 본문 재시도에만
// 필요하다).
// ---------------------------------------------------------------------------

/** 한 칸 홀더 — `useRef<…>(null)`이 이 모양을 만족한다(child-create-idempotency.ts와 동형). */
export type CustomItemKeyHolder = { current: { key: string; bodyFingerprint: string } | null };

/**
 * 생성 본문의 정규화 지문(FNV-1a 32비트 — childCreateBodyFingerprint와 같은 판단: 필요한
 * 성질은 같은 본문 → 같은 값, 다른 본문 → 사실상 다른 값 둘뿐이라 암호학적일 필요가 없다).
 * 키를 정렬하고 undefined 필드를 떨궈, 같은 본문이 직렬화 순서 때문에 다른 지문을 얻지 않는다.
 */
export function customItemBodyFingerprint(body: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(body)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        if (body[key] !== undefined) normalized[key] = body[key];
        return normalized;
      }, {})
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * 암호학적 난수가 아니다 — 온보딩 쪽 생성기와 같은 근거: 키는 한 제출의 재시도 사이에서
 * 안정적이고 서로 다른 제출 사이에서 구별되기만 하면 된다. `custom-item-` 접두는 서버 멱등
 * 기록에서 온보딩(`onb-child-`)·설정(`set-child-`) 키와 구별되게 한다.
 */
export function generateCustomItemIdempotencyKey(): string {
  return `custom-item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 이 제출의 키 — 지문이 같을 때만 재사용하고, 본문이 달라졌으면 새 키를 발급한다. */
export function getOrCreateCustomItemKey(holder: CustomItemKeyHolder, bodyFingerprint: string): string {
  if (!holder.current || holder.current.bodyFingerprint !== bodyFingerprint) {
    holder.current = { key: generateCustomItemIdempotencyKey(), bodyFingerprint };
  }
  return holder.current.key;
}

/** 성공 시 폐기 — 다음 추가는 새 멱등 범위에서 시작한다(방금 만든 행과 중복 제거되지 않게). */
export function rotateCustomItemKey(holder: CustomItemKeyHolder): void {
  holder.current = null;
}
