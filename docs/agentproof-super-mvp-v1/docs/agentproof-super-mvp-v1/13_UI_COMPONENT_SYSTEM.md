# 13. UI 컴포넌트 명세서

## 1. 공통 컴포넌트 목록

| Component | 용도 |
|---|---|
| `MetricStrip` | 상단 KPI 가로/반응형 카드 |
| `MetricCard` | 단일 숫자 카드 |
| `ProofScoreRing` | 0~100 점수 게이지 |
| `ResultCard` | AI 결과 카드 |
| `RiskChip` | 위험수준/주의표현 표시 |
| `HumanGateList` | 사람 확인 필요 항목 |
| `UsageFeedbackButtons` | 4개 사용 여부 버튼 |
| `EvidenceTimeline` | 10일 진행/이벤트 |
| `ReportVerdictCard` | 결과표 판정 |
| `ReliabilityBadge` | 리포트 신뢰도 |
| `CsvUploadPanel` | CSV/XLSX 업로드 |
| `EmptyProofBoardState` | 첫 진입 상태 |
| `AdminStatusPill` | admin 상태 표시 |

## 2. MetricStrip

### Props

```ts
type MetricStripProps = {
  proofScore?: number;
  processed: number;
  caseLimit: number;
  usageRate: number;
  savedMinutes: number;
  riskCount: number;
  humanReviewCount: number;
  reliability: '낮음' | '보통' | '높음';
};
```

### 표시 규칙

- processed: `18/50`
- usageRate: `61%`
- savedMinutes: 60분 이상이면 `2.4h`, 미만이면 `42m`
- riskCount: 0이면 green, 1~4 amber, 5+ red

## 3. ResultCard

### Props

```ts
type ResultCardProps = {
  card: ResultCard;
  onCopy(id: string): void;
  onFeedback(id: string, status: FeedbackStatus): void;
};
```

### UX

- 위험 chip은 card top-left.
- title은 1줄, summary는 최대 2줄.
- draft는 collapsible 가능하지만 기본 3~5줄 노출.
- action buttons는 항상 카드 하단 고정.

## 4. UsageFeedbackButtons

버튼 순서:

```txt
[그대로 사용] [수정 후 사용] [복사만 함] [안 씀]
```

내부 값:

- `used_as_is`
- `used_with_edits`
- `copied_only`
- `not_used`

## 5. RiskChip

| riskLevel | label | color |
|---|---|---|
| low | 위험 낮음 | green |
| medium | 주의 필요 | amber |
| high | 사람 확인 필요 | red/amber |
| blocked | 차단됨 | red |

## 6. Accessibility

- 모든 button은 `button` element.
- icon-only button은 `aria-label` 필수.
- chip 색상만으로 상태 전달 금지.
- keyboard focus visible 유지.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
