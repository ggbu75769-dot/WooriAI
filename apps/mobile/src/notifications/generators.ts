import { reachedBudgetBoundaries } from "@wooriai/domain";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import { budgetUsagePercent } from "../home/budget-progress";
import {
  daysInYearMonth,
  previousYearMonth,
  sumMonthExpensesThroughDay,
  type ComparableExpenseRecord
} from "../home/last-month-comparison";
import type { WeeklySummary } from "../home/weekly-summary";
import { formatKrw } from "../money";
import { subjectParticle } from "../text/korean-particles";
import { shareTotalLine } from "../reports/share-text";
import { isIsoCalendarDate, isoCalendarDaysBetween, seoulCalendarDate, seoulIsoWeekKey } from "./iso-week";
import type { AppNotificationCandidate } from "./notification.store";

/**
 * NOTI-102 notification generators: pure functions from data the app already has (home summary,
 * purchase-followup clicks) to candidate notifications with STABLE dedupeKeys. The store's
 * dedupe memory (notification.store.ts seenDedupeKeys) guarantees each key fires at most once,
 * so re-running a generator on every home refetch is safe -- stability of the key IS the
 * "fire once" semantics:
 *
 * - budget_80 / budget_100 key on childId + the yearMonth (R19-D), so each fires at most once per
 *   CHILD per month and re-arms automatically when the month rolls over. The childId scope was
 *   missing before: with two children, whichever child's budget alert fired first suppressed the
 *   other child's alert for the rest of the month (stage_transition/weekly_summary were already
 *   child-scoped).
 * - stage_transition keys on childId + the NEW stage label, so each stage change fires once.
 * - purchase_pending keys on itemTemplateId + clickedAt, so each product-link click fires once
 *   (a fresh re-click has a new clickedAt and may fire again).
 * - weekly_summary (NOTI-103) keys on childId + the Seoul-calendar ISO week, so it fires at most
 *   once per child per week and re-arms every Monday 00:00 KST.
 * - monthly_wrapup (GAP-066 #8) keys on childId + the Seoul-calendar **지난달**, so it fires at most
 *   once per child per month and re-arms at 매월 1일 00:00 KST.
 */

/* R19-D: the old `BUDGET_WARNING_RATIO = 0.8` float ratio is gone -- nothing imported it and the
 * 80% threshold is now the domain module's exact integer comparison (spent*5 >= budget*4). */

export type BudgetNotificationInput = {
  /** Scopes the dedupeKey so each child gets its own monthly budget alert (R19-D). */
  childId: string;
  /** e.g. "2026-08" (HomeSummary.monthly.yearMonth). */
  yearMonth: string;
  budgetKrw: number;
  spentKrw: number;
  /**
   * 라운드 79 B (GAP-079 #2) — 이 달에 아직 서버가 모르는 **이 아이의 되돌아올 변경**이 있는가
   * (`hasRecoverablePendingRecordsForMonth`). `true`면 **발화하지 않는다**: record_gap(라운드 54
   * P1-3)·monthly_wrapup(GAP-066 #8)이 이미 지고 있는 것과 **같은 판단**이고, 같은 갈래 형식이다.
   *
   * ⚠️ **라운드 79 리뷰(M-3·S-1) — 게이트의 단위가 형제 둘과 다르다. 그것이 이 자리의 판정이다.**
   *
   * 형제 둘이 보는 `hasPendingRecordsForChild`는 ⓐ `syncState !== "synced"` **전부**를 세고
   * ⓑ **달을 가리지 않는다**. 예산 경계에 그 술어를 그대로 쓰면 두 가지가 어긋난다.
   *  - **종점 상태**: `failed`·`conflict` 행은 사용자가 재시도하거나 폐기할 때까지 **영구히**
   *    남는다. 그 한 행이 그 달의 예산 알림을 **영영** 침묵시킨다 — 대가가 "지연"이 아니라
   *    "그 달 전체 손실"이 된다(record_gap은 주 단위 dedupe라 성질이 다르다).
   *  - **달**: 3월에 실패한 행이 8월 예산 알림을 막을 이유가 없다. 배너가 보는 재조정 술어
   *    (`hasPendingMonthAdjustments` — src/home/budget-edit.ts)는 **이번 달 행만** 센다.
   * 그래서 이 게이트는 **회복 가능한 상태(pending·syncing) × 그 달**로 좁힌다 — 배너가 서버
   * 집계 대신 캐시를 고르는 바로 그 조건과 같은 달 단위이고, 침묵의 끝이 사용자의 폐기가 아니라
   * **동기화**라는 사실이 술어 자체로 보장된다.
   *
   * 이유: 이 판정의 입력(`spentKrw`)은 `/home`의 **서버 집계**(`monthly.usedAmountKrw`)다.
   * 같은 화면의 예산 배너·진행바·히어로는 그 값이 아니라 대기 행까지 재조정한 값을 읽으므로
   * (`src/home/budget-edit.ts`의 `resolveThisMonthUsedKrw`), 대기 행이 있는 순간 두 표면이
   * 서로 다른 "이번 달"을 본다. 판정 함수는 셋이 공유하지만(@wooriai/domain의
   * `reachedBudgetBoundaries` — 서버 푸시·홈 배너·인앱 알림) **먹이는 수가 다르다.**
   * 그 어긋남은 양방향이다: 재조정 합계만 82%면 배너는 서고 알림함은 비어 있고, 반대로 이 기기에
   * 삭제 대기 행이 있어 재조정 합계가 79%인데 서버가 80%면 **배너 없이 알림만 뜨면서 그 달의
   * dedupeKey를 태운다**(그 뒤 진짜로 넘겨도 그 달에는 다시 오지 않는다).
   *
   * 대가는 **손실이 아니라 지연**이다: 억제된 평가는 키를 쓰지 않으므로(형제 둘과 같은 성질)
   * 아웃박스가 확정돼 서버 집계가 올라오면 다음 평가가 정확한 값으로 **정확히 한 번** 발화한다.
   * 그동안에도 사용자가 사실을 못 보는 것이 아니다 — 같은 순간 홈 배너가 재조정 값으로 화면에서
   * 말하고 있고, 서버 푸시는 지출 커밋 시점에 `push_boundary_marks` 클레임으로 따로 간다
   * (at-most-once — apps/api/src/push/push-dispatch.service.ts).
   */
  hasRecoverablePendingMonthRecords?: boolean;
};

/**
 * R19-D: the 80%/100% judgement comes from @wooriai/domain's reachedBudgetBoundaries -- the same
 * function the home banner (src/home/budget-warning.ts) and the server push dispatcher
 * (apps/api/src/push/push-dispatch.service.ts) use, so the three surfaces agree on which boundary
 * a given (budget, spent) pair has reached. budgetKrw <= 0 means "no budget set" (the home API
 * returns amountKrw: 0 then) and never nags -- that is the domain function's hasBudget: false.
 *
 * Buckets (identical to the banner's):
 * - reached 100% (spent >= budget) -> budget_100, EXACTLY at budget gets the banner's
 *   "모두 사용했어요" copy. Before R19-D this case fell into budget_80 ("80%를 사용했어요") while
 *   the banner and the server push both said "모두 사용했어요" -- three surfaces, three answers
 *   for the same month. "초과" itself stays strict > (0원 초과라고 말하면 허위 데이터).
 * - 80% <= usage < 100% -> budget_80.
 * Never both at once -- crossing straight past 100% yields only budget_100.
 *
 * legacyDedupeKeys 주의 (R19 M-3, 의도된 트레이드오프): 아래 legacy 키(`budget_80:{yearMonth}`)는
 * 월 스코프일 뿐 childId 스코프가 아니다 -- R19-D 이전 앱이 그렇게 썼기 때문이다. 그래서 업데이트가
 * 걸친 그 한 달 동안, 다자녀 계정에서 legacy 키를 이미 본 사용자는 **둘째 아이의 알림까지** 함께
 * 억제된다(새 키는 아이별로 다르지만, 둘 다 같은 legacy 키를 가리키므로). 중복 발화("이미 본 알림이
 * 다시 뜬다")보다 한 달치 누락이 덜 나쁘다고 판단해 그대로 둔다. 자기 소멸적이다: 키가 월 스코프라
 * 다음 달이면 legacy 키가 매칭되지 않고, 릴리스가 한 달 지나면 legacyDedupeKeys 자체를 지우면 된다.
 * (FIX-119B/F4로 억제 시 새 키도 dedupe 메모리에 기록되지만, 그것은 억제를 legacy 키 수명에서
 * 독립시킬 뿐 억제 범위를 넓히지도 좁히지도 않는다.)
 *
 * 라운드 79 B (GAP-079 #2): 판정 앞에 **게이트 하나**가 섰다 — 이 달에 서버가 모르는 이 아이의
 * **되돌아올** 지출 변경이 있으면(`hasRecoverablePendingMonthRecords`) 후보를 만들지 않는다.
 * 규칙이 아니라 **입력**이 갈리던 자리이고, 형제 알림 둘이 이미 같은 이유로 침묵한다(위 필드
 * 주석 · `RecordGapInput`의 `hasPendingLocalRecords` 주석 — "서버 스냅샷이 모르는 기록을 두고
 * 단언하지 않는다"). 대기 행이 없으면 종전과 한 글자도 다르지 않다.
 * ⚠️ 라운드 79 리뷰(M-3): 이 게이트의 단위는 형제 둘과 **일부러 다르다**(위 필드 주석 — 종점
 * 상태와 달을 가른다. 그래야 대가가 "지연"이라는 서술이 참으로 남는다).
 *
 * Copy note: unlike the live banner, an in-app notification is a SNAPSHOT that stays in the list,
 * so the 초과 case deliberately keeps the amount-free "이번 달 예산을 초과했어요" -- a frozen
 * "1원 초과했어요" row would read as stale once the month runs on. The banner (live) and the push
 * (delivered immediately) do name the amount.
 */
export function budgetNotifications(input: BudgetNotificationInput): AppNotificationCandidate[] {
  const { childId, yearMonth, budgetKrw, spentKrw, hasRecoverablePendingMonthRecords } = input;
  // 라운드 79 B: 서버가 모르는 그 달의 기록이 이 기기에 남아 있는 동안에는 경계를 단언하지 않는다
  // (record_gap·monthly_wrapup과 같은 규율 -- 키를 태우지 않으므로 동기화 뒤 정확히 한 번 뜬다).
  // 라운드 79 리뷰(M-3): "남아 있다"의 뜻은 **되돌아올 행**이다 -- 종점 상태(failed·conflict)는
  // 사용자가 폐기하기 전까지 영구히 남으므로 그것까지 세면 침묵이 그 달 내내 풀리지 않는다.
  if (hasRecoverablePendingMonthRecords) return [];
  const status = reachedBudgetBoundaries({ budgetKrw, spentKrw });
  if (!status.reached80) return [];
  if (status.reached100) {
    return [
      {
        type: "budget_100",
        title: status.exceeded ? "이번 달 예산을 초과했어요" : "이번 달 예산을 모두 사용했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: `budget_100:${childId}:${yearMonth}`,
        legacyDedupeKeys: [`budget_100:${yearMonth}`],
        childId
      }
    ];
  }
  return [
    {
      type: "budget_80",
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해 보세요.",
      dedupeKey: `budget_80:${childId}:${yearMonth}`,
      legacyDedupeKeys: [`budget_80:${yearMonth}`],
      childId
    }
  ];
}

export type StageTransitionInput = {
  childId: string;
  childName: string;
  /** Current stage label from the home summary (HomeSummary.child.stageLabel). */
  stageLabel: string;
  /** What this device last saw for the child (notification.store.ts lastSeenStageByChild),
   * null/undefined on first sighting -- the first sighting only records, never notifies. */
  lastSeenStageLabel: string | null | undefined;
};

export function stageTransitionNotification(input: StageTransitionInput): AppNotificationCandidate | null {
  const { childId, childName, stageLabel, lastSeenStageLabel } = input;
  if (!stageLabel || !lastSeenStageLabel || lastSeenStageLabel === stageLabel) return null;
  // 라운드 96 T5 — ⚠️ 두 시점: 종전 제목은 두 형태를 함께 적는 꼴(`『${childName}』이(가) …`)이었다.
  // 태명은 사용자가 지은 값이라 받침이 갈리므로, 조사를 값에서 고른다(subjectParticle — 받침 판정은
  // korean-particles.ts 한 자리다). 낱말·어순·마침표는 그대로다.
  return {
    type: "stage_transition",
    title: `『${childName}』${subjectParticle(childName)} ${stageLabel}에 들어섰어요.`,
    body: "새 준비템을 확인해 보세요.",
    dedupeKey: `stage_transition:${childId}:${stageLabel}`,
    childId
  };
}

export function purchasePendingDedupeKey(entry: Pick<PurchaseFollowupEntry, "itemTemplateId" | "clickedAt">): string {
  return `purchase_pending:${entry.itemTemplateId}:${entry.clickedAt}`;
}

/** Recovers the itemTemplateId from a purchase_pending dedupeKey so app/notifications.tsx can
 * route a row tap to /items/[itemTemplateId] without widening the persisted entry shape.
 * Robust to ":" inside the id itself (the clickedAt suffix is always the last segment). */
export function itemTemplateIdFromPurchaseDedupeKey(dedupeKey: string): string | null {
  const parts = dedupeKey.split(":");
  if (parts[0] !== "purchase_pending" || parts.length < 3) return null;
  const itemTemplateId = parts.slice(1, -1).join(":");
  return itemTemplateId.length > 0 ? itemTemplateId : null;
}

/**
 * purchase_pending: one candidate per still-pending purchase-followup click inside the same
 * 3min-24h window the COM-108 prompt uses (isPromptEligible in purchase-followup.store.ts):
 * younger than PURCHASE_FOLLOWUP_MIN_AGE_MS the user is probably still mid-purchase, older
 * than PURCHASE_FOLLOWUP_MAX_AGE_MS the click is stale -- the prompt stays silent then and
 * this notification must too. Read-only over the followup entries.
 */
export function purchasePendingNotifications(
  entries: PurchaseFollowupEntry[],
  now: number
): AppNotificationCandidate[] {
  return entries
    .filter((entry) => {
      if (entry.status !== "pending") return false;
      const age = now - entry.clickedAt;
      return age >= PURCHASE_FOLLOWUP_MIN_AGE_MS && age <= PURCHASE_FOLLOWUP_MAX_AGE_MS;
    })
    .map((entry) => ({
      type: "purchase_pending" as const,
      title: `『${entry.itemName}』 구매 확인이 기다리고 있어요.`,
      body: "구매하셨다면 지출로 기록해 보세요.",
      dedupeKey: purchasePendingDedupeKey(entry),
      childId: entry.childId
    }));
}

/**
 * UX-J: 홈 주간 카드가 이미 만든 실제 주간 숫자(src/home/weekly-summary.ts). `WeeklySummary`가
 * 그대로 만족하는 부분집합이라 홈은 계산 결과를 통째로 넘기면 되고, 여기서 문장을 다시 만들지
 * 않으므로 카드와 알림의 문구·비교 의미론이 갈릴 여지가 없다(`text`는 "이번 주 84,200원 ·
 * 지난주 같은 요일까지보다 12,000원 적게 썼어요" 꼴이고, 부분 주 비교라는 사실을 "같은 요일까지"로
 * 스스로 밝힌다). 타입 전용 import라 런타임 의존은 생기지 않는다.
 */
export type WeeklySpendSnapshot = Pick<WeeklySummary, "totalKrw" | "text">;

/**
 * 라운드 37 G-1 — 주간 값의 **세 가지** 상태. `WeeklySpendSnapshot | null` 두 가지로는 "아직
 * 모른다"와 "영영 못 낸다"가 구분되지 않아, 콜드 스타트의 경합에서 주간 알림 키가 폴백 문구로
 * 소진됐다(아래 weeklySummaryNotification 문서 참고).
 *
 *  - `undefined` = **판정 불가**. 주간 값을 만드는 지출 캐시가 아직 로딩 중이다. 이번 평가에서는
 *    주간 후보를 만들지 않고 다음 평가로 미룬다(키를 쓰지 않으므로 확정값으로 다시 뜬다).
 *  - `null` = **판정됨, 값 없음**. 지출 캐시가 확정 실패해 이번 주 숫자를 낼 수 없다 -> 월 페이스 폴백.
 *  - 객체 = 홈 주간 카드가 실제로 만든 값(0원인 주도 포함).
 */
export type WeeklySpendResolution = WeeklySpendSnapshot | null | undefined;

/** 위 세 상태를 화면의 쿼리 상태에서 만들어 내는 순수 규칙(홈이 그대로 부른다). */
export type WeeklySpendResolutionInput = {
  /** `evaluateWeeklySummary` 결과. 아직/영영 못 내면 null. */
  weekly: WeeklySpendSnapshot | null;
  /**
   * 주간 값의 원천인 지출 쿼리(["expenses", childId, 이번 달/지난달])가 **확정 실패**했는지.
   * 로딩 중은 false다 -- 그때는 "아직 모른다"이지 "못 낸다"가 아니다.
   */
  expensesFailed: boolean;
};

export function resolveWeeklySpendForNotification({
  weekly,
  expensesFailed
}: WeeklySpendResolutionInput): WeeklySpendResolution {
  if (weekly) return weekly;
  return expensesFailed ? null : undefined;
}

export type WeeklySummaryInput = {
  childId: string;
  childName: string;
  /** HomeSummary.monthly.amountKrw -- 0 means "no monthly budget set". */
  budgetKrw: number;
  /** HomeSummary.monthly.usedAmountKrw -- the month-to-date total. */
  spentKrw: number;
  /** Epoch ms "now", used only to derive the Seoul-calendar ISO week identity. */
  now: number;
  /**
   * UX-J + 라운드 37 G-1: 홈이 계산한 이번 주 합계. **세 상태를 반드시 구분해서** 넘긴다
   * (WeeklySpendResolution 참고): 객체 = 실주간 값, `null` = 확정 실패라 월 페이스 폴백,
   * `undefined` = 아직 모름이라 이번 평가에서는 주간 알림을 만들지 않는다.
   * 선택 항목이 아니라 **필수**다 -- 넘기지 않은 호출부가 조용히 "판정 불가"로 떨어지면
   * 주간 알림이 영영 안 뜨는 회귀를 아무도 못 잡는다.
   */
  weekly: WeeklySpendResolution;
};

/**
 * NOTI-103 weekly summary. UX-J부터 **진짜 이번 주 합계**를 말한다.
 *
 * 낡은 전제(라운드 32 이전): "HomeSummary만으로는 주간 합계를 낼 수 없다 -- recentExpenses는
 * 서버에서 3건으로 잘려 오고(apps/api/src/onboarding/reporting-store.service.ts), 새 API 호출은
 * NOTI-103이 금지한다." 그래서 이 알림은 **월 누적·예산 페이스**를 대신 말했다. 그 전제는 UX-A
 * 이후 거짓이다: 홈은 이미 `["expenses", childId, 이번 달/지난달]` 캐시(기록 탭과 공유, 오프라인
 * 대기 행까지 재조정)로 `evaluateWeeklySummary`를 돌려 주간 카드를 그린다. 새 요청 없이 그 값을
 * 그대로 받아 쓴다 -- 알림과 홈 카드가 **같은 숫자**를 말하게 하는 것이 이 변경의 요지다.
 *
 * Semantics:
 * - once per Seoul-calendar ISO week per child: the dedupeKey is
 *   weekly_summary:{childId}:{isoYear}-W{isoWeek}, so with the store's seenDedupeKeys memory the
 *   first evaluation (i.e. first app open with home data) of a week ingests it and every later
 *   evaluation that week is a no-op; Monday 00:00 KST starts a fresh key. UX-J도 키를 건드리지
 *   않는다 -- 문구만 바뀐다.
 * - `weekly` 있음: 문구는 홈 카드 첫 줄 그대로다. 이번 주 합계가 0원이면 candidate 자체를 만들지
 *   않는다("이번 주 지출은 아직 없어요"를 목록에 얼려 두는 것은 소음이다). 월 누적과 같은 이유로
 *   자연스러운 결과가 따라온다: 그 주에 지출이 생기면(키가 아직 안 쓰였으므로) 그때 발화한다.
 * - `weekly === undefined`(판정 불가): **후보 자체를 만들지 않는다**(라운드 37 G-1). 콜드 스타트
 *   에서는 /home 응답이 `["expenses", …]` 캐시보다 먼저 도착하는 것이 정상 순서인데, 종전에는
 *   그 첫 평가가 주간 값을 "없음"으로 읽고 월 페이스 폴백으로 발화해 **그 주의 dedupeKey를
 *   소진**했다. 잠시 뒤 지출 캐시가 도착해 진짜 주간 문구를 만들어도 dedupe에 막혀, 홈 카드는
 *   "이번 주 84,200원"인데 알림함에는 그 주 내내 월 누적 문구만 남았다. 발화를 미루면(키를 쓰지
 *   않으면) 같은 주의 다음 평가가 확정값으로 정확히 한 번 ingest한다. dedupeKey는 불변이다.
 * - `weekly === null`(확정 실패): 종전 월 페이스 문구로 폴백한다. 지출 캐시가 정말로 실패했다고
 *   주간 알림이 통째로 사라지면 안 된다 -- 그때는 월 누적도 사실이므로 그것을 말한다.
 *   - zero (or negative/invalid) month-to-date spend: return null -- a "0원 지금까지" summary is
 *     pure noise.
 *   - budget unset (amountKrw 0 from the home API): still fire, total only, no percentage.
 *   - budget set: "예산의 NN%" with NN from `budgetUsagePercent` (src/home/budget-progress.ts) --
 *     may legitimately read 0% for tiny spend or exceed 100% when over budget (`clampToFull:
 *     false`: 초과 구간을 100으로 접지 않는다 -- 여기에는 프로그레스 바가 없고 초과 사실을 숨길
 *     이유도 없다).
 *     라운드 38 H-3: 그 반올림을 여기서 직접 하던 동안, 99.5%~99.99%인 달에 홈은 "남은 예산 N원 ·
 *     99%"인데 이 알림만 "예산의 100%예요"라고 말했다(홈의 미소진 100% 캡을 알림이 몰랐다).
 *     같은 함수를 쓰므로 이제 그 경계에서 두 화면이 갈릴 수 없다.
 */
export function weeklySummaryNotification(input: WeeklySummaryInput): AppNotificationCandidate | null {
  const { childId, childName, now } = input;
  const title = weeklySummaryTitle(input);
  if (!title) return null;
  return {
    type: "weekly_summary",
    title,
    body: `『${childName}』 지출 내역을 확인해 보세요.`,
    dedupeKey: `weekly_summary:${childId}:${seoulIsoWeekKey(now)}`,
    childId
  };
}

/** 위 문서의 세 갈래(판정 불가 / 실주간 / 월 페이스 폴백). null이면 이번 평가에서는 알리지 않는다. */
function weeklySummaryTitle(input: WeeklySummaryInput): string | null {
  const { weekly, budgetKrw, spentKrw } = input;
  // 판정 불가(undefined): 아직 주간 값을 낼 수 없다 -- 폴백으로 키를 태우지 않고 미룬다(G-1).
  if (weekly === undefined) return null;
  // 넘어온 주간 값이 온전할 때만 그것을 쓴다. 망가진 값(NaN 합계·빈 문구)은 "주간 값이 없다"와
  // 같이 다뤄 폴백으로 보낸다 -- 빈 제목의 알림을 목록에 남기지 않기 위해서다.
  if (weekly && Number.isFinite(weekly.totalKrw) && weekly.text.length > 0) {
    return weekly.totalKrw > 0 ? weekly.text : null;
  }
  if (!Number.isFinite(spentKrw) || spentKrw <= 0) return null;
  // 라운드 96 T5 — ⚠️ 두 시점: 종전 폴백은 "…원을 **함께했어요**"였다. 이 문장의 주어는 지출
  // 합계라 "함께했다"는 비문이고(무엇과 함께인지가 없다), 이 알림이 실제로 세는 사실은 사용자가
  // 그 금액을 **기록했다**는 것이다. 조사(`을`)와 나머지 낱말은 그대로다.
  return budgetKrw > 0
    ? `이번 달 지금까지 ${formatKrw(spentKrw)} · 예산의 ${budgetUsagePercent({ budgetKrw, spentKrw, clampToFull: false })}%예요`
    : `이번 달 지금까지 ${formatKrw(spentKrw)}을 기록했어요`;
}

/**
 * GAP-054 #6 — 기록 공백 알림(record_gap)이 발화하는 최소 공백. 3일이다.
 *
 * 가계부 앱의 표준 리마인더이고(격차 분석 §P1-6), 이보다 짧으면 주말 하루 쉰 사람에게까지
 * 말을 걸게 된다. 값이 한 곳에만 있어야 문구("N일 동안")와 판정이 갈리지 않는다.
 */
export const RECORD_GAP_MIN_DAYS = 3;

/** 마지막 기록 날짜를 뽑을 때 필요한 최소 모양(HomeSummary.recentExpenses가 그대로 만족한다). */
export type RecordedExpenseLike = { spentOn?: string | null };

/**
 * 이 아이의 **마지막 지출 날짜**(YYYY-MM-DD). 기록이 하나도 없으면 null.
 *
 * `/home`의 `recentExpenses`는 전 기간 최신 3건이다(정렬 spentOn desc — apps/api의
 * reporting-store.service.ts). 그래서 목록이 비어 있다는 것은 "이 아이에게 기록이 하나도 없다"와
 * 같은 뜻이고, 비어 있지 않으면 그 안에 반드시 가장 최근 기록이 들어 있다. 순서에 기대지 않고
 * 최댓값을 직접 고르는 이유는, 날짜 문자열 비교가 이 형식에서 정확하고(사전식 = 시간순) 정렬
 * 계약이 바뀌어도 이 판정이 따라 무너지지 않기 때문이다. 날짜 형식이 아닌 값은 건너뛴다.
 */
export function latestRecordedOn(records: ReadonlyArray<RecordedExpenseLike | null | undefined>): string | null {
  let latest: string | null = null;
  for (const record of records) {
    const spentOn = record?.spentOn;
    if (!isIsoCalendarDate(spentOn)) continue;
    if (latest === null || spentOn > latest) latest = spentOn;
  }
  return latest;
}

/**
 * `LocalExpenseRow`(src/offline/types.ts)에서 이 판정에 필요한 것만 — 구조 호환.
 *
 * `payload.spentOn`은 **범위 판정에만** 쓴다(아래 `PendingRecordScope` ·
 * `hasRecoverablePendingRecordsForMonth`). 선택 필드라 범위 없이 부르는 호출부는 종전 그대로다.
 */
export type PendingRecordRowLike = {
  childId?: string | null;
  syncState?: string | null;
  payload?: { spentOn?: string | null } | null;
};

/**
 * 라운드 80 B (GAP-080 #2) — 대기 행을 **어느 범위에서** 세는가.
 *
 * 라운드 79까지 형제 둘(record_gap·monthly_wrapup)의 게이트는 범위가 없었다: 이 아이의
 * 미동기화 행이 **하나라도** 있으면 침묵했다. 그 게이트가 세는 상태에는 `failed`·`conflict`가
 * 들어 있고(큐가 스스로 다시 보내지 않는 **종점**), 그 행은 사용자가 재시도하거나 폐기할
 * 때까지 남는다 — 그래서 4xx로 거절된 한 행이 남은 기기에서 두 알림은 **영영** 발화하지
 * 않았다(그 사이 dedupeKey는 태워지지 않으므로 문제는 dedupe가 아니라 평가 자체다).
 *
 * ⚠️ 답은 "상태를 좁힌다"가 아니다(그 행도 사용자가 실제로 만든 기록이다 — 예산 게이트가
 * 상태로 좁힌 것은 그 알림의 대가가 *그 달 전체*였기 때문이고, 그 판단은 그대로다).
 * **좁히는 축은 범위다**: 그 알림이 단언하는 것을 보면 **어떤 행이 판정을 바꿀 수 있는지**가
 * 정해진다.
 *  - `record_gap`은 *"마지막 기록 이후 N일"* 을 말한다 → `lastRecordedOn`보다 **뒤인** 행만
 *    그 판정을 바꾼다. 3월에 실패한 행은 8월의 공백 판정을 바꿀 수 없다.
 *  - `monthly_wrapup`은 *"지난달 총액"* 을 말한다 → **지난달** 행만 그 판정을 바꾼다.
 *
 * 좁혀도 규율("서버가 모르는 기록을 두고 단언하지 않는다")은 한 글자도 약해지지 않는다 —
 * 오히려 그 규율이 원래 뜻하던 것에 정확해진다. 범위 **안**의 행은 종점 상태여도 여전히
 * 침묵시킨다(상태 집합은 형제 둘에서 종전 그대로다).
 */
export type PendingRecordScope =
  /**
   * record_gap — 그 알림이 말하는 시점(`lastRecordedOn`) **뒤**의 행만 센다.
   *
   * ⚠️ 라운드 80 리뷰 M-3 — **상한(`until`)이 함께 있어야 범위가 닫힌다.** `after` 하나만으로는
   * 서울 기준 **미래 날짜**의 대기 행이 언제나 범위 안이다(그 날짜는 정의상 `lastRecordedOn`보다
   * 뒤다). 그런데 그 행은 서버가 **`EXPENSE_FUTURE_DATE`(400)로 영구 거절**하는 행이라
   * (`apps/api/src/onboarding/store-shared.ts` · `src/expenses/failed-row-prefill.ts`) 종점
   * `failed`로 굳고, 그 기기의 `record_gap`은 라운드 80 B 뒤에도 **영영 멈춘 채로 남았다** —
   * 이 트랙이 닫으려던 바로 그 영구 정지가 한 갈래만 남아 있었다.
   * 상한은 **오늘(서울)** 이다: 서버가 받아 줄 수 있는 날짜의 끝이 오늘이고, 이 알림이 세는
   * "마지막 기록"도 오늘까지의 사실이다. 상한을 주지 않으면 종전과 정확히 같은 답이다.
   */
  | { kind: "after"; date: string; until?: string | null }
  /** monthly_wrapup — 그 알림이 말하는 달(지난달)의 행만 센다. */
  | { kind: "month"; yearMonth: string };

/**
 * GAP-054 라운드 54 P1-3 — 이 기기에 **아직 서버가 모르는 이 아이의 지출 행**이 있는가.
 *
 * 판정 규칙은 리포트 탭 고지(src/reports/pending-scope-notice.ts)·예산 화면
 * (src/home/budget-edit.ts의 `hasPendingMonthAdjustments`)과 **같다**: `syncState !== "synced"`
 * 인 행(대기 중인 생성·수정, 삭제 대기, 실패, 충돌)이 하나라도 있으면 서버 스냅샷은 이 기기가
 * 아는 사실을 아직 모른다. **상태 축은 라운드 80에서도 한 글자도 바뀌지 않았다.**
 *
 * 라운드 80 B — 셋째 인자로 **범위**를 받는다(`PendingRecordScope`). 범위를 주지 않으면 종전과
 * 정확히 같은 답이고(달 무관·시점 무관), 주면 그 범위 안의 행만 센다. 날짜를 읽을 수 없는 행은
 * 범위가 있을 때 **세지 않는다** — 예산 게이트(`hasRecoverablePendingRecordsForMonth`)·배너의
 * 재조정 술어와 같은 태도다(모르는 것을 참으로 세지 않는다).
 *
 * react-native·expo-router에 의존하지 않는 순수 함수다(이 모듈의 규율) — 호출부(홈 화면)가
 * 이미 구독 중인 스냅샷 행을 그대로 넘긴다. 새 요청도 새 구독도 없다.
 */
export function hasPendingRecordsForChild(
  rows: ReadonlyArray<PendingRecordRowLike | null | undefined> | null | undefined,
  childId: string | null | undefined,
  scope?: PendingRecordScope | null
): boolean {
  if (!childId || !rows) return false;
  return rows.some((row) => {
    if (row?.childId !== childId) return false;
    if (typeof row?.syncState !== "string" || row.syncState === "synced") return false;
    if (!scope) return true;
    const spentOn = row.payload?.spentOn;
    if (!isIsoCalendarDate(spentOn)) return false;
    // 사전식 비교 = 시간순(YYYY-MM-DD) — latestRecordedOn이 최댓값을 고르는 것과 같은 근거다.
    if (scope.kind !== "after") return spentOn.startsWith(scope.yearMonth);
    if (spentOn <= scope.date) return false;
    // 라운드 80 리뷰 M-3: 상한 밖(= 서울 기준 미래 날짜)은 세지 않는다 — 서버가 영구 거절하는
    // 행이라 그 행이 동기화돼 판정을 바꾸는 일이 **없다**.
    return !isIsoCalendarDate(scope.until) || spentOn <= scope.until;
  });
}

/**
 * 라운드 79 리뷰(M-3·S-1) — **아웃박스가 스스로 풀 수 있는** 동기화 상태.
 *
 * `SyncState`(src/offline/types.ts)의 다섯 중 `failed`·`conflict`는 **종점**이다: 큐가 자동으로
 * 다시 보내지 않고, 사용자가 동기화 상태 화면에서 재시도하거나 폐기해야 사라진다. `synced`는
 * 서버가 이미 아는 행이다. 남는 둘(`pending`·`syncing`)만이 "곧 서버가 알게 될 변경"이다.
 */
export const RECOVERABLE_PENDING_SYNC_STATES = ["pending", "syncing"] as const;

/**
 * 라운드 79 리뷰(M-3·S-1) — 예산 경계 게이트의 술어. **그 달**에 **곧 서버가 알게 될** 이 아이의
 * 변경이 있는가.
 *
 * 형제 둘(`hasPendingRecordsForChild`)과 일부러 두 가지가 다르다.
 *  ⓐ **상태**: 회복 가능한 둘만 센다(위 상수). 종점 상태까지 세면 실패 한 행이 그 달의 예산
 *     알림을 영영 막아, 그 게이트의 대가가 "지연"이 아니라 "그 달 전체 손실"이 된다.
 *  ⓑ **달**: 이번 달 행만 센다 — 홈 배너가 서버 집계 대신 재조정 캐시를 고르는 조건
 *     (`hasPendingMonthAdjustments` — src/home/budget-edit.ts)과 **같은 단위**다. 두 표면이
 *     같은 순간 같은 "이번 달"을 보게 하는 것이 이 게이트의 목적이므로 단위도 같아야 한다.
 *     ⚠️ 그 모듈을 import하지 않는 이유: 이 파일은 알림 층의 순수 모듈이고(react-native·홈 층에
 *     의존하지 않는다) 상태 집합도 다르다. 같은 달 단위를 쓴다는 사실은 계약이 문다
 *     (generators.test.ts — 두 술어를 같은 행으로 나란히 돌린다).
 *
 * 달을 모르면(`yearMonth`가 없으면) false다 — 판정할 수 없는 것을 참으로 세지 않는다.
 *
 * ⚠️ 라운드 80 B — **오늘 두 술어가 갈리는 축은 상태 하나다.** 형제 둘도 이제 범위를 갖고
 * (`PendingRecordScope` — 시점 / 지난달), 그 범위는 각자의 알림이 단언하는 것에서 나온다.
 * 예산만 상태로도 좁히는 이유는 그대로다: 그 알림의 dedupe 단위가 **달**이라 종점 상태 한 행의
 * 대가가 "지연"이 아니라 그 달 전체였다(형제 둘의 대가는 범위를 좁힌 지금 각자의 재무장 주기다).
 * 세 게이트의 단위는 계약이 한 표로 나란히 돌린다(generators.test.ts — 라운드 80 B ⓐ).
 */
export function hasRecoverablePendingRecordsForMonth(
  rows: ReadonlyArray<PendingRecordRowLike | null | undefined> | null | undefined,
  childId: string | null | undefined,
  yearMonth: string | null | undefined
): boolean {
  if (!childId || !yearMonth || !rows) return false;
  return rows.some(
    (row) =>
      row?.childId === childId &&
      typeof row?.syncState === "string" &&
      (RECOVERABLE_PENDING_SYNC_STATES as readonly string[]).includes(row.syncState) &&
      typeof row?.payload?.spentOn === "string" &&
      row.payload.spentOn.startsWith(yearMonth)
  );
}

export type RecordGapInput = {
  childId: string;
  /**
   * 이 아이의 마지막 지출 날짜(`latestRecordedOn`).
   * - 문자열: 그 날짜부터 공백을 센다.
   * - `null`: 기록이 **하나도 없다**(신규 사용자) -> 알리지 않는다. 첫 기록 유도는 홈의 첫 실행
   *   안내 카드(src/home/first-run-guide.ts)가 이미 맡고 있어서, 여기서 또 말하면 같은 사람에게
   *   같은 잔소리가 두 번 간다.
   * - `undefined`: 호출부가 값을 넘기지 않았다(판정 불가) -> 역시 알리지 않는다.
   */
  lastRecordedOn?: string | null;
  /**
   * GAP-054 라운드 54 P1-3 — 이 기기에 아직 올라가지 않은 이 아이의 지출 행이 있는가
   * (`hasPendingRecordsForChild`). `true`면 **발화하지 않는다.**
   *
   * 이유: 이 알림의 유일한 근거인 `/home`의 `recentExpenses`는 **서버가 아는 기록**뿐이다.
   * 며칠째 연결 없이 로컬로만 적어 온 사용자에게 그 목록은 비어 있거나 낡아 있고, 그 상태에서
   * "마지막 지출 기록이 N일 전"이라고 말하면 방금 적은 기록을 앱이 통째로 부정하는 셈이다 —
   * 사용자가 반박할 수 있는 거짓말이 가장 나쁜 종류다. 모르는 동안에는 침묵하고, 아웃박스가
   * 확정돼 `["home"]`이 무효화되면 다음 평가가 정확한 값으로 판단한다(같은 주에는 dedupe가
   * 한 번만 허용하므로 뒤늦게 두 번 뜨지도 않는다).
   *
   * ⚠️ 라운드 80 B: **행을 넘기는 호출부(실제 앱 경로)에서는 아래 `pendingRecordRows`가 이긴다.**
   * 이 boolean은 행을 쥐고 있지 않은 호출부(모듈 테스트 등)의 종전 갈래로 남는다.
   */
  hasPendingLocalRecords?: boolean;
  /**
   * 라운드 80 B (GAP-080 #2) — 위 게이트를 **범위로 좁히는** 대기 행들(홈이 이미 구독 중인
   * 오프라인 스냅샷 그대로 — 새 요청·새 구독 0건).
   *
   * 이 알림이 단언하는 것은 *"마지막 기록 이후 N일"* 이므로, 그 판정을 바꿀 수 있는 행은
   * **`lastRecordedOn`보다 뒤인 행**뿐이다(`PendingRecordScope` 주석). 그래서 행을 받으면
   * 게이트를 그 범위로 좁힌다 — 3월에 실패한 한 행이 8월의 공백 리마인더를 영영 막던 자리다.
   * 범위 **안**의 행은 상태를 가리지 않고(종점 포함) 종전처럼 침묵시킨다.
   *
   * ⚠️ 경계는 **엄격히 뒤**(`>`)다. 같은 날의 행은 "N일"을 바꾸지 못하기 때문이고, 그 하루를
   * 범위에 넣으면 그날의 종점 상태 행 하나가 이 알림을 다시 영구히 멈출 수 있다. 남는 자리
   * 하나는 값으로 적어 둔다: **마지막 기록 자신의 삭제 대기**는 실제 공백을 더 길게 만드는데
   * 범위 밖이라 세지 않는다 — 그때도 이 문장은 서버가 아는 기록을 그대로 말하므로 없는 기록을
   * 지어내지 않고(공백을 과장하지도 않는다), 그 행이 확정되면 다음 평가가 더 긴 공백으로 말한다.
   *
   * 값이 없으면(`undefined`) 위 boolean 그대로다 — 종전 호출부의 답은 한 글자도 바뀌지 않는다.
   */
  pendingRecordRows?: ReadonlyArray<PendingRecordRowLike | null | undefined> | null;
  /** Epoch ms "now" -- 서울 달력 날짜와 주 식별자를 여기서 뽑는다. */
  now: number;
};

/**
 * GAP-054 #6 — 기록 리마인더 한 건.
 *
 * ## 톤 (DNC-018)
 *
 * 제목은 **사실만** 말한다. "또 잊으셨네요" 같은 책망도, "기록하지 않으면 …" 같은 불안도
 * 만들지 않는다. 본문은 가벼운 초대 한 줄이고, 하라고 시키지 않는다. 목록에 얼어붙는
 * 스냅샷이므로(notification.store.ts) 문장은 그때의 사실로 읽혀야 한다 -- 그래서 "지금",
 * "오늘" 같은 시점어를 넣지 않는다.
 *
 * ## 라운드 54 P1-3 — 제목이 말하는 "N일"이 무엇인가
 *
 * 예전 제목은 "N일 동안 기록이 없어요"였다. 그런데 이 판정이 세는 것은 **지출 날짜**
 * (`spentOn`)이지 기록한 시각이 아니다. 그래서 3주 전 영수증을 오늘 뒤늦게 적은 사용자에게
 * 곧바로 "21일 동안 기록이 없어요"가 갔다 -- 방금 기록한 사람에게 기록이 없다고 말하는,
 * 사용자가 그 자리에서 반박할 수 있는 거짓 단언이다(소급 입력은 가계부에서 가장 흔한 입력이다).
 *
 * 그래서 문장을 **판정과 같은 사실**로 바꾼다: "마지막 지출 기록이 N일 전이에요". 이것은
 * 소급 입력 직후에도 참이다(그 지출의 날짜가 실제로 21일 전이다). 세는 방법은 한 글자도
 * 바뀌지 않았고, 문장이 세는 것을 정확히 말하게 됐을 뿐이다.
 *
 * ## 언제 뜨는가
 *
 * - 마지막 지출 날짜로부터 `RECORD_GAP_MIN_DAYS`(3)일 이상 지났을 때. 날짜 차이는 서울
 *   달력에서 센다(기기 시간대와 무관 -- iso-week.ts).
 * - 기록이 하나도 없으면 뜨지 않는다(위 `lastRecordedOn` 주석).
 * - 미래 날짜의 지출을 적어 둔 경우 차이가 음수라 역시 뜨지 않는다.
 * - **이 기기에 아직 올라가지 않은 이 아이의 지출 행이 있으면 뜨지 않는다**
 *   (`hasPendingLocalRecords` 주석 -- 서버 스냅샷이 모르는 기록을 두고 단언하지 않는다).
 *   ⚠️ 라운드 80 B: 그 게이트가 세는 범위는 **`lastRecordedOn`보다 뒤인 행**이다
 *   (`pendingRecordRows` 주석). 같은 날 이전의 행은 이 문장의 "N일"을 바꾸지 못하므로 세지
 *   않는다 -- 그 행이 종점 상태(`failed`·`conflict`)로 남아 이 알림을 영영 멈추던 자리다.
 *   ⚠️ 라운드 80 리뷰 M-3: 범위에는 **상한(오늘 · 서울)** 도 있다. 미래 날짜 행은 서버가
 *   `EXPENSE_FUTURE_DATE`로 영구 거절하므로 동기화될 일이 없는데, `lastRecordedOn`보다는
 *   언제나 뒤라 상한이 없으면 그 한 행이 이 알림을 **여전히 영영 멈췄다**.
 *
 * ## 주 1회 (dedupe)
 *
 * dedupeKey가 `record_gap:{childId}:{서울 ISO 주}`라, 스토어의 dedupe 메모리가 같은 주의
 * 재평가를 전부 막는다(weekly_summary와 **같은 관례**다 -- 새 억제 장치를 만들지 않는다).
 * 공백이 이어지면 다음 주 월요일 00:00 KST에 키가 갈리며 한 번 더 뜬다: 매일 조르지 않되
 * 잊힌 채로 두지도 않는 간격이다.
 */
export function recordGapNotification(input: RecordGapInput): AppNotificationCandidate | null {
  const { childId, lastRecordedOn, hasPendingLocalRecords, pendingRecordRows, now } = input;
  if (!lastRecordedOn) return null;
  // P1-3: 서버가 모르는 기록이 이 기기에 남아 있는 동안에는 아무 말도 하지 않는다.
  // 라운드 80 B: "남아 있다"의 범위는 **이 문장이 말하는 시점 뒤**다 -- 행을 받은 호출부에서는
  // 그 범위로 좁히고(상태는 종전 그대로 전부), 행이 없으면 종전 boolean 그대로다.
  // 라운드 80 리뷰 M-3: 범위의 상한은 **오늘(서울)** 이다. 미래 날짜 행은 서버가
  // EXPENSE_FUTURE_DATE로 영구 거절하므로 동기화돼 이 판정을 바꾸는 일이 없다 — 그 행 하나가
  // 남은 기기에서 이 알림이 영영 멈추던 잔여 갈래를 여기서 닫는다.
  const hasPendingInScope = pendingRecordRows
    ? hasPendingRecordsForChild(pendingRecordRows, childId, {
        kind: "after",
        date: lastRecordedOn,
        until: seoulCalendarDate(now)
      })
    : hasPendingLocalRecords;
  if (hasPendingInScope) return null;
  const days = isoCalendarDaysBetween(lastRecordedOn, seoulCalendarDate(now));
  if (days === null || days < RECORD_GAP_MIN_DAYS) return null;
  return {
    type: "record_gap",
    title: `마지막 지출 기록이 ${days}일 전이에요`,
    body: "기록 탭에서 지난 며칠을 함께 확인해볼까요?",
    dedupeKey: `record_gap:${childId}:${seoulIsoWeekKey(now)}`,
    childId
  };
}

/* ---------------------------------------------------------------------------------------------
 * GAP-066 #8 — 지난달 정리(monthly_wrapup)
 * ------------------------------------------------------------------------------------------- */

const MONTHLY_WRAPUP_YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** dedupeKey의 첫 조각. 키를 **만드는 쪽**(여기)과 **읽는 쪽**(notification-route.ts)이 같은
 * 문자열을 쓰도록 한 번만 적는다 — purchase_pending의 키 왕복과 같은 관례다. */
export const MONTHLY_WRAPUP_DEDUPE_PREFIX = "monthly_wrapup";

/**
 * `monthly_wrapup:{childId}:{지난달 YYYY-MM}`.
 *
 * 키에 담는 달이 **이번 달이 아니라 지난달**인 이유: 이 알림의 목적지가 그 달의 리포트이고
 * (notification-route.ts), 목적지는 이 키에서 달을 되읽어 만든다. 키가 이번 달을 담으면 dedupe가
 * 세는 달과 착지하는 달이 서로 다른 사실을 말하게 되고, 그 둘이 어긋나는 날을 아무도 못 잡는다.
 * 달이 바뀌면 키도 바뀌므로 재무장은 저절로 일어난다(weekly_summary의 주 단위 키와 같은 규율).
 */
export function monthlyWrapupDedupeKey(childId: string, yearMonth: string): string {
  return `${MONTHLY_WRAPUP_DEDUPE_PREFIX}:${childId}:${yearMonth}`;
}

/**
 * dedupeKey에서 **그 알림이 말하는 달**을 되읽는다. 못 읽으면 null(목적지 쪽이 달 없는 폴백으로
 * 떨어진다 — notification-route.ts).
 *
 * childId 자체에 ":"가 들어 있어도 안전하도록 **마지막 조각**을 본다
 * (`itemTemplateIdFromPurchaseDedupeKey`가 clickedAt을 마지막 조각으로 다루는 것과 같은 이유).
 * 형식 검사까지 여기서 하는 이유는, 손상된 저장본이 착지 파라미터로 흘러가지 않게 하기 위해서다.
 */
export function yearMonthFromMonthlyWrapupDedupeKey(dedupeKey: string): string | null {
  const parts = dedupeKey.split(":");
  if (parts[0] !== MONTHLY_WRAPUP_DEDUPE_PREFIX || parts.length < 3) return null;
  const yearMonth = parts[parts.length - 1];
  return MONTHLY_WRAPUP_YEAR_MONTH_PATTERN.test(yearMonth) ? yearMonth : null;
}

export type MonthlyWrapupInput = {
  childId: string;
  /** Epoch ms "now". 달 경계는 여기서 **서울 달력**으로 뽑는다(기기 시간대와 무관 — iso-week.ts). */
  now: number;
  /**
   * 지난달 한 달치 지출 행(`["expenses", childId, 지난달]` 캐시 — 홈이 이미 받아 둔 그것).
   *
   * 세 상태의 구분은 주간 요약(`WeeklySpendResolution`)과 같은 규율이다:
   *  - `undefined`/`null` = **판정 불가**(캐시가 아직 없다) → 후보를 만들지 않는다. 키를 태우지
   *    않으므로 캐시가 도착한 다음 평가가 정확한 값으로 정확히 한 번 발화한다.
   *  - 배열 = 그 달의 전량이다(홈의 커서 루프 `fetchMonthExpenses`가 페이지를 다 모은다 —
   *    첫 페이지만 읽으면 200건 넘는 달의 합계가 조용히 작아진다).
   */
  lastMonthRecords?: ComparableExpenseRecord[] | null;
  /**
   * 이 기기에 아직 올라가지 않은 이 아이의 지출 행이 있는가(`hasPendingRecordsForChild`).
   * `true`면 **발화하지 않는다** — record_gap이 라운드 54 P1-3에서 내린 것과 **같은 판단**이다.
   * 위 캐시는 서버가 아는 행뿐이라, 로컬로만 적어 온 기록이 있는 동안 합계를 말하면 사용자가 그
   * 자리에서 반박할 수 있는 금액을 알림에 얼려 두게 된다. 아웃박스가 확정되면 `["expenses"]`가
   * 무효화되고 다음 평가가 정확한 값으로 판단한다(키를 안 썼으므로 그 달 안에 그대로 뜬다).
   *
   * ⚠️ 라운드 80 B: **행을 넘기는 호출부(실제 앱 경로)에서는 아래 `pendingRecordRows`가 이긴다.**
   */
  hasPendingLocalRecords?: boolean;
  /**
   * 라운드 80 B (GAP-080 #2) — 위 게이트를 **범위로 좁히는** 대기 행들.
   *
   * 이 알림이 단언하는 것은 *"지난달 총액"* 이므로 그 판정을 바꿀 수 있는 행은 **지난달 행**
   * 뿐이다. 그래서 행을 받으면 게이트를 그 달로 좁힌다 — 4월에 400으로 거절돼 `failed`로 남은
   * 한 행이 5월·6월·12월의 "지난달 정리"까지 영영 막던 자리다(dedupeKey가 달 단위라 그 달에
   * 다시 올 기회 자체가 없었고, 억제는 키를 태우지 않으므로 문제는 dedupe가 아니라 평가였다).
   * 그 달 **안**의 행은 상태를 가리지 않고(종점 포함) 종전처럼 침묵시킨다 — 합계를 바꿀 수 있는
   * 행이기 때문이다.
   *
   * 값이 없으면(`undefined`) 위 boolean 그대로다.
   */
  pendingRecordRows?: ReadonlyArray<PendingRecordRowLike | null | undefined> | null;
};

/**
 * GAP-066 #8 — **지난달 정리** 한 건.
 *
 * ## 무엇이 문제였나
 * 8월 1일 아침의 앱에는 7월이 없다. 홈의 이번 달 총액은 0원으로 리셋되고 예산도 비며(예산은
 * (아이, 월) 한 칸이고 이월이 없다), 한 달치 기록은 사용자가 스스로 리포트 탭에 들어가 ‹ 를 눌러야
 * 보인다. 핵심 루프의 "총액 확인"이 가장 의미 있는 그 하루에 앱이 아무 말도 하지 않았다.
 *
 * ## 언제 뜨는가 (전부 "근거가 없으면 말하지 않는다")
 * - 달이 바뀐 뒤 **첫 평가 한 번**. dedupeKey가 `monthly_wrapup:{childId}:{지난달}`이라 스토어의
 *   dedupe 메모리가 같은 달의 재평가를 전부 막고, 다음 달 1일 00:00 KST에 키가 갈린다.
 *   (그날 앱을 안 열었으면 그 달 안에 처음 여는 날 뜬다 — 주간 요약과 같은 성질이다.)
 * - **지난달 합계가 0원이면 만들지 않는다.** 주간 요약의 규칙 그대로다 — 0원 요약은 소음이고,
 *   그 사람에게는 정리할 것이 애초에 없다.
 * - 지난달 캐시가 아직 없으면 만들지 않는다(위 `lastMonthRecords` 주석 — 키를 태우지 않는다).
 * - 이 기기에 **그 달의** 미동기화 지출 행이 있으면 만들지 않는다(위 `hasPendingLocalRecords`·
 *   `pendingRecordRows` 주석 — 라운드 80 B에서 범위가 "지난달"로 좁혀졌다. 다른 달의 행은 이
 *   합계를 바꿀 수 없다).
 *
 * ## 문구 (DNC-018)
 * 새 어휘를 짓지 않는다. 금액 줄은 공유 카드가 이미 쓰는 문장 그대로이고(`shareTotalLine` —
 * "함께한 지출 1,245,700원"), 본문은 record_gap의 초대 한 줄과 같은 모양이다. 주어를 "지난달"이
 * 아니라 **"7월"**로 두는 것이 규칙의 핵심이다: 알림은 목록에 얼어붙는 스냅숏이라(notification.
 * store.ts) 시점어("지난달"·"이번 달")를 넣으면 한 달 뒤에는 스스로 거짓이 된다.
 *
 * ## 합계는 어디서 오나
 * 새 요청을 내지 않는다(NOTI-103 규칙). 홈이 "지난달 같은 시점 대비" 한 줄을 위해 이미 받아 둔
 * `["expenses", childId, 지난달]` 캐시를 훅이 읽어 넘긴다. 더하는 술어도 새로 짓지 않는다 —
 * 기록 탭 월 합계·홈 비교 한 줄과 **같은 함수**(`sumMonthExpensesThroughDay`, DNC-015에 따라
 * 선물·환불 제외)로 그 달 마지막 날까지 더한다.
 */
export function monthlyWrapupNotification(input: MonthlyWrapupInput): AppNotificationCandidate | null {
  const { childId, now, lastMonthRecords, hasPendingLocalRecords, pendingRecordRows } = input;
  const lastYearMonth = previousYearMonth(seoulCalendarDate(now));
  if (!lastYearMonth) return null;
  // 서버가 모르는 기록이 이 기기에 남아 있는 동안에는 금액을 단언하지 않는다(P1-3와 같은 규율).
  // 라운드 80 B: 그 범위는 **이 알림이 말하는 달**이다 -- 행을 받은 호출부에서는 지난달로 좁히고
  // (상태는 종전 그대로 전부), 행이 없으면 종전 boolean 그대로다.
  const hasPendingInScope = pendingRecordRows
    ? hasPendingRecordsForChild(pendingRecordRows, childId, { kind: "month", yearMonth: lastYearMonth })
    : hasPendingLocalRecords;
  if (hasPendingInScope) return null;
  if (!lastMonthRecords) return null;
  const totalKrw = sumMonthExpensesThroughDay(lastMonthRecords, lastYearMonth, daysInYearMonth(lastYearMonth));
  // 0원인 달은 정리할 것이 없다(주간 요약의 0원 규칙 그대로).
  if (totalKrw <= 0) return null;
  const month = Number(lastYearMonth.slice(5, 7));
  return {
    type: "monthly_wrapup",
    title: `${month}월 ${shareTotalLine(totalKrw)}`,
    body: `리포트 탭에서 ${month}월을 함께 확인해볼까요?`,
    dedupeKey: monthlyWrapupDedupeKey(childId, lastYearMonth),
    childId
  };
}

export type HomeNotificationInput = {
  child: { id: string; nickname: string; stageLabel: string };
  monthly: { yearMonth: string; amountKrw: number; usedAmountKrw: number };
  lastSeenStageLabel: string | null | undefined;
  followupEntries: PurchaseFollowupEntry[];
  now: number;
  /**
   * UX-J + 라운드 37 G-1: 홈 주간 카드가 이미 만든 이번 주 합계. 세 상태를 구분해 넘긴다
   * (WeeklySpendResolution): 객체 = 실주간, `null` = 확정 실패라 월 페이스 폴백,
   * `undefined` = 아직 모름이라 주간 알림을 이번 평가에서 만들지 않는다.
   */
  weekly: WeeklySpendResolution;
  /**
   * GAP-054 #6: 이 아이의 마지막 지출 날짜(`latestRecordedOn(home.recentExpenses)`).
   *
   * **optional인 이유**(위 `weekly`가 필수인 것과 다르다): 이 값을 넘기지 않는 호출부는 지금도
   * 여럿이고(src/home의 콜드 스타트 테스트 등) 그들은 record_gap을 판단할 자리가 아니다. 값이
   * 없으면 그 알림만 만들어지지 않을 뿐 나머지 평가는 종전과 한 글자도 다르지 않다. 실제 앱
   * 경로(useHomeNotificationEvaluation)가 늘 넘긴다는 사실은 notification-flow.test.ts의 소스
   * 계약이 지킨다.
   */
  lastRecordedOn?: string | null;
  /**
   * GAP-054 라운드 54 P1-3: 이 기기에 아직 올라가지 않은 이 아이의 지출 행이 있는가
   * (`hasPendingRecordsForChild`). 홈 화면이 **이미 구독 중인** 오프라인 스냅샷에서 계산해
   * 넘긴다(리포트 탭의 대기 건수 고지와 같은 주입 방식 — 새 요청도 새 구독도 없다).
   *
   * `lastRecordedOn`과 같은 이유로 optional이다: 이 값을 넘기지 않는 호출부(홈 외의 테스트 등)는
   * record_gap을 판단하는 자리가 아니고, 없으면 종전 동작 그대로다.
   *
   * GAP-066 #8: **지난달 정리도 같은 값을 본다.** 두 알림 다 "서버 스냅숏이 이 기기가 아는 사실을
   * 아직 모른다"는 같은 이유로 침묵하므로, 판정을 두 벌로 만들지 않는다.
   *
   * ⚠️ 라운드 79 리뷰(M-3): **예산 경계는 이 값을 보지 않는다.** 그 게이트는 아래
   * `hasRecoverablePendingMonthRecords`(회복 가능한 상태 × 그 달)를 본다 — 종점 상태 한 행이
   * 그 달의 알림을 영영 막지 않게 하려면 술어가 달라야 한다.
   *
   * ⚠️ 라운드 80 B: 실제 앱 경로는 이제 boolean 대신 아래 `pendingRecordRows`를 넘긴다 — 형제
   * 둘이 각자의 **범위**(시점 / 지난달)로 게이트를 좁히기 위해서다. 이 값은 행을 쥐고 있지 않은
   * 호출부의 종전 갈래로 남고, 그 답도 종전 그대로다.
   */
  hasPendingLocalRecords?: boolean;
  /**
   * 라운드 80 B (GAP-080 #2) — 형제 둘의 게이트를 **범위로 좁히는** 대기 행들. 홈 화면이 **이미
   * 구독 중인** 오프라인 스냅샷 행을 그대로 넘긴다(새 요청·새 구독 0건 — 위 값과 같은 주입 방식).
   *
   * 두 알림이 각자 자기 범위를 고른다: record_gap은 `lastRecordedOn` **뒤**, monthly_wrapup은
   * **지난달**(`PendingRecordScope`). 종전에는 범위가 없어 4xx로 거절된 한 행이 그 기기에서 두
   * 알림을 **영영** 멈췄다 — 핵심 루프의 재진입 유도 둘이 조용히 죽는 자리였다.
   * ⚠️ 예산 경계는 이 값이 아니라 `hasRecoverablePendingMonthRecords`를 본다(상태 축도 다르다).
   */
  pendingRecordRows?: ReadonlyArray<PendingRecordRowLike | null | undefined> | null;
  /**
   * 라운드 79 B (GAP-079 #2) + 리뷰(M-3·S-1) — **예산 경계 둘(budget_80·budget_100)의 게이트.**
   *
   * 같은 화면의 배너·진행바·히어로는 재조정 값(`resolveThisMonthUsedKrw`)을 읽는데 이 알림만
   * 서버 집계(`monthly.usedAmountKrw`)를 읽어, 대기 행이 있는 동안 두 표면이 서로 다른 수 위에서
   * 말했다(`BudgetNotificationInput` 주석에 방향까지 값으로 적어 둔다).
   *
   * 값은 `hasRecoverablePendingRecordsForMonth(rows, childId, 이번 달)`이고, 홈 화면이 **이미
   * 구독 중인** 오프라인 스냅샷에서 계산해 넘긴다(새 요청·새 구독 0건 — 위 값과 같은 주입 방식).
   * ⚠️ 주간 요약은 이 게이트 밖이다 — 1순위가 **홈 주간 카드가 재조정 캐시로 이미 만든 값**이라
   * 화면과 같은 수를 말하고, 서버 집계는 그 캐시가 확정 실패했을 때의 폴백뿐이다(그때는 서버 값이
   * 유일하게 아는 사실이다).
   */
  hasRecoverablePendingMonthRecords?: boolean;
  /**
   * GAP-066 #8: 지난달 한 달치 지출 행(`["expenses", childId, 지난달]` 캐시 — 홈이 "지난달 같은
   * 시점 대비" 한 줄을 위해 **이미 받아 둔** 그것을 훅이 읽어 넘긴다. 새 요청 0건).
   *
   * `lastRecordedOn`과 같은 이유로 optional이다: 이 값을 넘기지 않는 호출부는 지난달 정리를
   * 판단하는 자리가 아니고, 없으면 그 알림만 만들어지지 않을 뿐 나머지 평가는 종전 그대로다.
   */
  lastMonthRecords?: ComparableExpenseRecord[] | null;
};

/** Everything the home screen's evaluation hook needs in one pure call. */
export function evaluateHomeNotifications(input: HomeNotificationInput): AppNotificationCandidate[] {
  const candidates: AppNotificationCandidate[] = [
    ...budgetNotifications({
      childId: input.child.id,
      yearMonth: input.monthly.yearMonth,
      budgetKrw: input.monthly.amountKrw,
      spentKrw: input.monthly.usedAmountKrw,
      // 라운드 79 B (GAP-079 #2) + 리뷰(M-3·S-1): 형제 둘과 **같은 규율**이되 술어는 자기 것이다
      // — 회복 가능한 상태 × 그 달(종점 상태 한 행이 그 달을 통째로 침묵시키지 않게).
      hasRecoverablePendingMonthRecords: input.hasRecoverablePendingMonthRecords
    })
  ];
  const stage = stageTransitionNotification({
    childId: input.child.id,
    childName: input.child.nickname,
    stageLabel: input.child.stageLabel,
    lastSeenStageLabel: input.lastSeenStageLabel
  });
  if (stage) candidates.push(stage);
  candidates.push(...purchasePendingNotifications(input.followupEntries, input.now));
  // NOTI-103 + UX-J: weekly (Seoul ISO-week) summary. 홈이 주간 값을 함께 넘기면 홈 카드와 같은
  // 실제 주간 문구가 되고, 확정 실패면 종전 월 페이스 문구로 폴백한다(요청은 늘지 않는다 -- 주간
  // 값도 홈이 이미 들고 있는 지출 캐시에서 나온다). 아직 판정 불가면 이번 평가에서는 만들지
  // 않는다(라운드 37 G-1 -- 폴백 문구가 그 주의 dedupeKey를 소진하지 않게).
  const weeklyCandidate = weeklySummaryNotification({
    childId: input.child.id,
    childName: input.child.nickname,
    budgetKrw: input.monthly.amountKrw,
    spentKrw: input.monthly.usedAmountKrw,
    now: input.now,
    weekly: input.weekly
  });
  if (weeklyCandidate) candidates.push(weeklyCandidate);
  // GAP-054 #6: 기록 공백. 같은 홈 스냅샷(recentExpenses)에서 나오므로 새 요청도, 새 백그라운드
  // 작업도 없다 -- 다른 네 종류와 같은 평가 한 번에 합류한다. 기록이 0건이면 만들지 않는다.
  // 라운드 80 B: 게이트의 범위는 이 알림이 단언하는 것과 같은 단위다(lastRecordedOn 뒤).
  const recordGapCandidate = recordGapNotification({
    childId: input.child.id,
    lastRecordedOn: input.lastRecordedOn,
    hasPendingLocalRecords: input.hasPendingLocalRecords,
    pendingRecordRows: input.pendingRecordRows,
    now: input.now
  });
  if (recordGapCandidate) candidates.push(recordGapCandidate);
  // GAP-066 #8: 지난달 정리. 홈이 이미 받아 둔 지난달 캐시에서 나오므로 여기서도 새 요청은 0건이고,
  // 다른 여섯 종류와 같은 평가 한 번에 합류한다. 지난달 합계가 0원이거나 캐시가 아직 없으면
  // 만들지 않는다(둘 다 키를 태우지 않는다).
  // 라운드 80 B: 여기서도 범위가 알림의 단언과 같은 단위다(지난달).
  const monthlyWrapupCandidate = monthlyWrapupNotification({
    childId: input.child.id,
    now: input.now,
    lastMonthRecords: input.lastMonthRecords,
    hasPendingLocalRecords: input.hasPendingLocalRecords,
    pendingRecordRows: input.pendingRecordRows
  });
  if (monthlyWrapupCandidate) candidates.push(monthlyWrapupCandidate);
  return candidates;
}
