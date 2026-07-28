# Android 앱 디자인 딥리서치 — 온보딩, 선택, 날짜, 준비템

- 조사일: 2026-07-18
- 조사 범위: Google Play 공식 앱 상세 13개, 공식 Android 스크린샷 자산 153개
- 직접 시각 검토: 66개 화면
- 보조 자료: 공개 Mobbin 화면/플로우, Android Developers 컴포넌트·접근성 가이드
- 적용 원칙: 공개 화면의 정보 구조와 단계 흐름은 직접 재구성할 수 있다. 스크린샷·아이콘·일러스트·브랜드 문구는 복제하지 않고 WooriAI 컴포넌트와 콘텐츠로 구현한다.

## 조사 카탈로그

| 앱 | 공식 스크린샷 자산 | 직접 검토 | 주로 본 패턴 | WooriAI에 채택 | 채택하지 않음 |
|---|---:|---:|---|---|---|
| [YNAB](https://play.google.com/store/apps/details?id=com.youneedabudget.evergreen.app&hl=en) | 7 | 7 | 목표·예산 진행률, 요약 우선 | 숫자 요약 뒤 한 가지 다음 행동 | 금융 전문용어와 고밀도 표 |
| [Flo](https://play.google.com/store/apps/details?id=org.iggymedia.periodtracker&hl=en) | 13 | 6 | 큰 상태 선택 타일, 한 화면 한 질문 | 아이 상태를 상호 배타적인 큰 선택지로 제시 | 과도한 브랜드 일러스트 |
| [Clue](https://play.google.com/store/apps/details?id=com.clue.android&hl=en) | 16 | 6 | 아이콘+레이블 다중 선택, 달력 상태 | 색상 이외의 선택 표시, 명시적 날짜 상태 | 분석 기능을 온보딩에 과다 노출 |
| [BabyCenter](https://play.google.com/store/apps/details?id=com.babycenter.pregnancytracker&hl=en) | 8 | 8 | 현재 주차·단계, 짧은 진행 표시 | 현재 단계와 다음 할 일을 먼저 설명 | 콘텐츠 카드의 과밀 배치 |
| [What to Expect](https://play.google.com/store/apps/details?id=com.wte.view&hl=en) | 8 | 8 | 주차 중심 대시보드, 단계별 도구 | 날짜가 만드는 단계 맥락을 명확히 표시 | 광고·콘텐츠 피드 구조 |
| [Pregnancy+](https://play.google.com/store/apps/details?id=com.hp.pregnancy.lite&hl=en) | 8 | 2 | 큰 현재 단계, 주차 진행률 | 입력 결과의 단계 신뢰감 | 실사형 태아 이미지 중심 UI |
| [Todoist](https://play.google.com/store/apps/details?id=com.todoist&hl=en) | 13 | 6 | 전 행 체크, 그룹 제목, 보조 메타데이터 | 준비템 행 전체를 체크 대상으로 사용 | 프로젝트 관리용 복잡한 분류 |
| [TickTick](https://play.google.com/store/apps/details?id=com.ticktick.task&hl=en) | 21 | 6 | 섹션별 항목 수, 완료 상태 | 선택 수/전체 수와 그룹 문맥 | 캘린더·습관 기능의 혼합 |
| [Google Tasks](https://play.google.com/store/apps/details?id=com.google.android.apps.tasks&hl=en) | 10 | 4 | 단순 체크리스트, 완료 그룹 수 | 항목보다 상태와 개수를 우선 | 지나치게 희박한 정보 밀도 |
| [Microsoft To Do](https://play.google.com/store/apps/details?id=com.microsoft.todos&hl=en) | 16 | 4 | 체크 상태, 간결한 목록 계층 | 텍스트·아이콘을 함께 쓴 선택 피드백 | 사진 배경·장식 중심 목록 |
| [Bring!](https://play.google.com/store/apps/details?id=ch.publisheria.bring&hl=en) | 18 | 3 | 카테고리 묶음, 항목 수 | 준비템의 짧은 그룹 제목과 개수 | 상업적 이미지 그리드와 높은 밀도 |
| [N26](https://play.google.com/store/apps/details?id=de.number26.android&hl=en) | 8 | 1 | 요약 카드, 단일 핵심 행동 | 결과를 먼저 보여주는 요약 | 금융 앱 특유의 차가운 시각 언어 |
| [Revolut](https://play.google.com/store/apps/details?id=com.revolut.revolut&hl=en) | 7 | 5 | 강한 CTA, 단일 목표 | 화면당 하나의 우선 행동 | 다크·프리미엄 판매 스타일 |
| **합계** | **153** | **66** |  |  |  |

## 공개 플로우 보조 검토

- [Revolut 온보딩 플로우](https://mobbin.com/explore/flows/835f959d-7928-45a7-a4f7-fdec964e7270): 단계당 한 질문, 강한 다음 행동, 진행 맥락을 확인했다.
- [Panera 생일 날짜 선택](https://mobbin.com/explore/screens/7777133c-2591-4174-975e-b90288d63a32): 날짜를 먼저 고른 뒤 확인/취소로 확정하는 패턴을 확인했다.
- [Mobbin 체크박스 모음](https://mobbin.com/explore/mobile/ui-elements/checkbox): 체크박스를 별도 작은 타깃이 아니라 행 전체 상호작용으로 쓰는 사례를 비교했다.

Mobbin 유료 MCP 없이 접근 가능한 공개 페이지와 공식 스토어를 사용했다. 공개 페이지에서 확인한 구조와 흐름은 재구성할 수 있지만, 화면 이미지를 앱 자산으로 복사하지 않는다.

## 공식 Android 기준과 교차 검증

- [Date pickers](https://developer.android.com/develop/ui/compose/components/datepickers): 모달 날짜 선택은 임시 선택값을 `OK/Cancel`로 확정하는 구조다. WooriAI의 날짜는 시트를 닫기 전까지 draft에 쓰지 않는다.
- [Radio buttons](https://developer.android.com/develop/ui/compose/components/radio-button): 상호 배타적인 상태 선택은 전체 행을 선택 가능하게 만들고 radio 의미를 제공한다.
- [Checkboxes](https://developer.android.com/develop/ui/compose/components/checkbox): 체크/미체크를 명시하고, 부모 제어로 하위 항목 전체를 선택할 수 있다.
- [Buttons](https://developer.android.com/develop/ui/compose/components/button): filled는 핵심 행동, outlined는 중요하지만 보조적인 명시 선택, text는 낮은 우선순위 행동에 사용한다.
- [Progress indicators](https://developer.android.com/develop/ui/compose/components/progress): 정확한 진행을 알면 determinate 상태로 현재/전체를 전달한다.
- [Accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): 상호작용 타깃은 최소 48dp이고, 커스텀 선택 컴포넌트도 역할·상태를 함께 노출한다.
- [Adaptive layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps): 화면 너비에 맞춰 패딩과 최대 너비를 조절한다. 현재 `OnboardingScaffold`의 반응형 폭 계약을 유지한다.

## 반복해서 확인된 디자인 원칙

1. 온보딩은 한 화면에서 하나의 결정을 요구하고, 현재 단계와 전체 단계를 항상 보여준다.
2. 선택은 색상만 바꾸지 않고 체크/라디오 아이콘, 텍스트, 접근성 상태를 함께 갱신한다.
3. 날짜는 탐색 중 값과 확정된 값을 분리하고, 사용자가 확인하기 전에는 draft를 변경하지 않는다.
4. 준비템은 카드 묶음보다 체크리스트가 중심이다. 선택 수/전체 수를 먼저 보여주고, 행 전체가 48dp 이상의 선택 타깃이어야 한다.
5. “명시적으로 없음”과 “나중에 결정”은 서로 다른 의미다. 명시적 답변은 outlined, 단순 연기는 text 버튼으로 위계를 분리한다.
6. 최종 확인 전에는 아이 프로필이나 준비 완료 데이터를 서버에 만들지 않는다.

## 이번 적용 결정

- 유지: 단계형 진행 표시, 큰 상태 선택 카드, 날짜 확인/취소 시트, 체크 가능한 준비템 전 행.
- 개선: 준비템을 `선택 수 / 전체 수` determinate 요약으로 변경한다.
- 개선: 추천 품목 전체 선택/선택 해제를 한 번에 수행할 수 있게 한다.
- 개선: Todoist·Google Tasks처럼 하나의 그룹 안에서 항목을 훑고 체크하는 평면 목록 구조를 사용한다.
- 개선: 준비템 핵심 CTA를 “N개를 준비 완료로 표시”로 명확히 쓴다.
- 개선: “아직 준비한 물건이 없어요”를 outlined 보조 행동, “나중에 할게요”를 text 행동으로 배치한다.
- 보존: `selected`, `completed_none`, `skipped` 상태를 합치지 않고 최종 확인 전까지 draft에만 저장한다.

## 검증 기준

- 선택 수가 체크된 추천 품목 수와 일치한다.
- 전체 선택/해제 후 개별 항목을 다시 선택할 수 있다.
- 추천 목록이 없거나 외부 검수 차단 상태일 때 임의 품목을 만들지 않는다.
- 명시적 없음은 `completed_none`, 나중에 하기는 `skipped`로 저장된다.
- 최종 확인 이전의 네트워크 쓰기 요청 수는 0이다.
- 설치된 Android 앱의 adb screencap 전에는 시각 완료를 주장하지 않는다.
