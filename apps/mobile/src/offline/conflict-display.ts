import { buildCategoryNameLookup, categoryCatalog, type ServerCategoryName } from "../categories";
import { formatSpentOn } from "../expenses/records-list-view";
import { formatKrw } from "../money";
import { localCategoryNameKo } from "../api/local-fixtures";

/**
 * 라운드 45 UX-AA(후보 4): 동기화 충돌 화면(app/sync-status.tsx)의 "두 값 나란히 보기"가
 * 보여주는 **표시 전용** 문자열.
 *
 * 고치는 것: 그 화면은 두 후보 값을 `String(entry.localValue ?? "-")`로 그렸다. 그래서 카테고리는
 * UUID가 통째로("c0a7e901-0000-4c01-…"), 금액은 자릿수 없는 원시 숫자("45900"), 구분·결제 수단은
 * 서버 enum 원문("expense", "card")이 나왔다. 어느 쪽을 고를지 정해야 하는 화면에서 두 후보가
 * 사람이 읽을 수 없는 값이면, 그 선택은 사실상 찍기다.
 *
 * ⚠️ 표시 전용이다. 여기서 만든 문자열은 화면에만 쓰이고, **저장되는 merged 페이로드에는 원시
 * 값(entry.serverValue)이 그대로 들어간다** -- 포맷된 문자열이 저장으로 새어 들어가면 서버에
 * "45,900원"이나 "카드"가 그대로 올라간다. sync-status.tsx의 병합 루프와 이 모듈의 테스트가
 * 그 불변을 함께 잠근다.
 *
 * 순수 모듈인 이유: 화면은 vitest에서 렌더되지 않으므로(react-native 네이티브 바인딩 없음)
 * 판정을 화면 밖으로 빼야 검증할 수 있다(src/offline/expense-list-reconciliation.ts와 같은 관례).
 */

/** 값이 비어 있을 때(null·undefined·빈 문자열). 예전의 "-"를 대신한다. */
export const CONFLICT_EMPTY_VALUE_LABEL = "없음";

/**
 * 서버 목록에도, 앱이 아는 정적 카테고리에도 없는 categoryId.
 *
 * 이 자리에서만 "기타"(buildCategoryNameLookup의 폴백)를 쓰지 않는다: 충돌 화면은 두 후보를
 * **구별하라고** 내미는 화면이라, 서로 다른 두 UUID를 똑같이 "기타"로 적으면 같은 값처럼 보인다.
 * 모른다고 말하는 편이 정직하다.
 */
export const CONFLICT_UNKNOWN_CATEGORY_LABEL = "알 수 없는 분류";

/**
 * 라운드 45 O-4: 미지 categoryId에 **짧은 구분자**를 병기한다.
 *
 * "기타"를 피해 "알 수 없는 분류"로 바꿔도, 미지 id가 두 개면 두 후보가 여전히 글자까지 같아
 * 구별이 안 됐다 — 무엇을 고르든 같은 것을 고르는 화면이었다. UUID 전체를 그리면 다시 읽을 수
 * 없는 값이 되므로, 끝 4자만 붙여 "서로 다르다"는 사실만 보이게 한다. 4자는 이름이 아니라
 * **구별용 꼬리표**다.
 *
 * 라운드 46 Q-10 — 꼬리 4자로 충분한 근거를 실제 도달 집합으로 정정한다. 종전 주석은
 * "시드·픽스처 UUID는 앞부분이 겹치고 뒤에서 갈린다"며 모바일 별칭 8행
 * (`c0a7e901-0000-4c0…`)의 모양을 근거로 들었는데, 그 8행은 이 함수에 **도달하지 않는다**:
 * `buildConflictValueFormatter`가 categoryCatalog(정적 8타일)와 데모 픽스처를 먼저 걸러
 * 이름을 붙이기 때문이다(isKnownServerIds / isKnownStaticCategoryId).
 *
 * 여기까지 오는 id는 캐시가 비었을 때의 **서버 카테고리 행**(정식 12행 + 가져오기 스텁)이다.
 * 그 행들의 id는 Postgres `gen_random_uuid()`가 만든 값이라(schema.prisma의 Category.id)
 * 앞뒤 어디도 고정 접두사가 없다 — 꼬리 4자(16진 4자리)는 그 안에서 충분히 갈린다. 즉 꼬리를
 * 쓰는 이유는 "앞이 겹쳐서"가 아니라 "전 구간이 임의라 어느 4자를 잘라도 같은 구별력"이고,
 * 끝자리는 그 중 읽기 편한 선택일 뿐이다.
 */
export function conflictUnknownCategoryLabel(categoryId: string): string {
  const trimmed = categoryId.trim();
  const tail = trimmed.replace(/-/g, "").slice(-4);
  return tail.length > 0 ? `${CONFLICT_UNKNOWN_CATEGORY_LABEL} (${tail})` : CONFLICT_UNKNOWN_CATEGORY_LABEL;
}

/**
 * 결제 수단 라벨. 지출 입력 화면의 칩(app/expenses/new.tsx `quickExpensePaymentMethods`)과 같은
 * 단어를 쓴다 -- 같은 값이 화면마다 다른 이름으로 보이면 안 된다. "unknown"은 그 화면에 칩이
 * 없는(=고른 적 없는) 값이라 사실 그대로 적는다.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  unknown: "알 수 없음",
  cash: "현금",
  card: "카드",
  transfer: "계좌 이체",
  mobile_pay: "모바일 결제"
};

/** 지출 구분 라벨. 기록 행·CSV와 같은 단어(records-list-view.ts의 EXPENSE_TYPE_LABELS_KO). */
const EXPENSE_TYPE_LABELS: Record<string, string> = { expense: "지출", gift: "선물", refund: "환불" };

/** `diffExpenseFieldsForDisplay`가 주는 한 항목의 값 하나를 사람이 읽는 문자열로. */
export type ConflictValueFormatter = (field: string, value: unknown) => string;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);
}

/** 앱이 이름을 아는 정적 categoryId인지(8타일 + 데모 픽스처). */
function isKnownStaticCategoryId(categoryId: string): boolean {
  return (
    categoryCatalog.some((entry) => entry.id === categoryId) ||
    typeof localCategoryNameKo[categoryId] === "string"
  );
}

/**
 * `["categories"]` 캐시(GET /categories 응답의 categories 배열)로 포매터를 만든다.
 *
 * 캐시가 없으면(콜드 스타트·오프라인 첫 실행) 정적 8타일·데모 픽스처까지만 이름을 알고, 나머지는
 * 위 CONFLICT_UNKNOWN_CATEGORY_LABEL이다 -- 새 요청을 만들지 않는다.
 */
export function buildConflictValueFormatter(
  categories?: readonly ServerCategoryName[] | null
): ConflictValueFormatter {
  const lookup = buildCategoryNameLookup(categories);
  const knownServerIds = new Set((categories ?? []).filter((category) => category?.name?.trim()).map((c) => c.id));

  return (field, value) => {
    if (isBlank(value)) return CONFLICT_EMPTY_VALUE_LABEL;

    if (field === "amountKrw") {
      return typeof value === "number" && Number.isFinite(value) ? formatKrw(value) : String(value);
    }

    if (field === "categoryId") {
      const categoryId = String(value);
      if (knownServerIds.has(categoryId) || isKnownStaticCategoryId(categoryId)) return lookup(categoryId);
      return conflictUnknownCategoryLabel(categoryId);
    }

    if (field === "spentOn") {
      // 기록 탭·홈 행과 같은 "8월 4일". 읽을 수 없는 값은 formatSpentOn이 원본을 그대로 돌려준다.
      return formatSpentOn(String(value));
    }

    // 모르는 enum 값은 **원본을 그대로 통과**시킨다(expenseTypeLabelKo와 같은 관례) -- 서버가
    // 값을 하나 더 늘렸을 때 그것을 아는 라벨로 둔갑시키는 것이 원문보다 나쁘다.
    if (field === "paymentMethod") return PAYMENT_METHOD_LABELS[String(value)] ?? String(value);
    if (field === "expenseType") return EXPENSE_TYPE_LABELS[String(value)] ?? String(value);

    return String(value);
  };
}
