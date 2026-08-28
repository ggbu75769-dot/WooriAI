/**
 * 라운드 61 S-2/S-5 — 온보딩 단계 분해(`/admin/analytics/summary`의 `onboardingSteps`)를 읽는
 * 두 순수 함수.
 *
 * ## 왜 페이지에서 떼어 냈나 (S-5)
 *
 * 이 둘은 `app/analytics/page.tsx` 안의 지역 함수였고, 그 동작을 지키던 것은 페이지 소스를
 * 문자열로 대조하는 테스트뿐이었다("summary.onboardingSteps.find(...)라는 글자가 있는가").
 * 그런 테스트는 **글자만** 지킨다: 같은 뜻의 리팩터링에도 빨개지고, 반대로 글자가 남은 채
 * 동작이 틀어지면 조용히 통과한다. 여기로 옮기면 vitest가 진짜로 호출해 볼 수 있다
 * (`src/lib/*`의 다른 순수 모듈들과 같은 관례 — category-rows.ts, item-filters.ts 등).
 *
 * 계약 왕복 자체("API가 정말 이 배열을 이 순서로 내려주는가")는 여기서 지키지 않는다. 그것은
 * 이 앱 밖의 사실이고, `apps/api`의 어드민 분석 e2e가 **실행으로** 고정한다. 이 모듈이 지는
 * 책임은 "그 배열이 왔을 때, 그리고 오지 않았을 때 화면이 무엇을 그리는가"뿐이다.
 *
 * ## 왜 `?? []` 방어가 필요한가 (S-2)
 *
 * `onboardingSteps`는 라운드 61 #5에 추가된 필드다. 어드민 화면은 배포된 API와 **버전이 다를
 * 수 있다**(정적 번들이 먼저 갈 수도, API 롤백이 있을 수도 있다). 그 필드가 없는 응답에서
 * 종전 코드는 `undefined.find(...)`로 던졌고, 그 예외는 카드 한 장이 아니라 **분석 페이지
 * 전체**를 오류 경계로 떨어뜨렸다 — 나머지 KPI까지 함께 사라진다.
 *
 * 방어의 결과는 "0으로 표시"다. 그것이 거짓이 아닌 이유: 이 값이 **0건일 때도 API는 항상 그
 * 단계를 0으로 실어 보낸다**(레지스트리 전 단계 zero-fill). 즉 화면에서 0과 "필드 없음"은
 * 원래 같은 그림이고, 여기서 새로 지어내는 숫자는 없다. 그 옆의 "분류 불가"·"동의한 사용자만"
 * 고지(page.tsx)는 그대로 서 있어 이 숫자를 전량으로 읽게 만들지도 않는다.
 */

/** 이 판정이 읽는 것만 — `AdminOnboardingStepBreakdown`(admin-api.ts)과 구조 호환. */
export type OnboardingStepCountRow = { step: string; count: number };

/**
 * 응답에서 이 두 함수가 보는 유일한 필드. **선택**인 것이 요점이다 — 위 S-2 문단대로 구버전
 * API의 응답에는 이 키가 아예 없을 수 있고, 타입이 그 가능성을 인정해야 방어가 의미를 갖는다
 * (admin-api.ts의 `AdminAnalyticsSummary`는 **현재 계약의 미러**라 필수로 남는다 — 그쪽을
 * 선택으로 바꾸면 "지금 API가 무엇을 주기로 했는가"를 읽을 수 없게 된다).
 */
export type OnboardingStepsSource = { onboardingSteps?: readonly OnboardingStepCountRow[] | null };

/**
 * 기간 내 해당 온보딩 단계의 진입 건수. API가 계약 레지스트리 순서로 전 단계를 0건 포함해
 * 내려주므로 목록에 없는 단계는 실제로 0건이다(page.tsx의 `eventCount`와 같은 판단).
 *
 * **배열 위치를 믿지 않는다**(라운드 61 #5): 화면의 미러 순서와 응답 순서가 같더라도, 같다는
 * 사실에 기대는 대신 `step` 값으로 찾는다 — 한쪽 순서가 바뀌어도 숫자가 엉뚱한 단계에 붙지 않는다.
 */
export function onboardingStepCount(summary: OnboardingStepsSource, step: string): number {
  return (summary.onboardingSteps ?? []).find((entry) => entry.step === step)?.count ?? 0;
}

/** 4단계로 분류된 합 (step이 없거나 알 수 없는 행은 API가 어느 단계에도 넣지 않는다). */
export function classifiedOnboardingStepTotal(summary: OnboardingStepsSource): number {
  return (summary.onboardingSteps ?? []).reduce((sum, entry) => sum + entry.count, 0);
}
