# 05. IA 및 라우트 설계서

## 1. IA 원칙

- Public은 유입과 진단까지만 담당한다.
- Product는 `Proof Board`, `Dashboard`, `Report` 3개 축으로 단순화한다.
- Admin은 운영/검수/전환/보안만 담당한다.
- 기존 route를 가능한 유지해 regression을 줄인다.
- 사용자 화면에는 개발 용어를 숨긴다.

## 2. Public IA

```txt
/
/survey
/survey/[persona]
/survey/result
/privacy
/privacy/request
/beta-terms
/login
```

## 3. Product IA

```txt
/proof/board
/proof/dashboard
/proof/report
/proof/result-cards/[id]
/proof/convert
/proof/workspace         # legacy compatibility, board로 redirect 또는 alias
/proof/ai-validation    # P0에서는 board mode로 병합 안내
/proof/pilot-design/start     # Board 생성 확인 화면
/proof/pilot-design/draft     # optional 확인 화면
/proof/pilot-design/questions # optional advanced settings only
```

## 4. Admin IA

```txt
/admin/dashboard
/admin/pilot-applications
/admin/projects
/admin/reports
/admin/result-cards
/admin/audit-security
/admin/conversions
/admin/ai-settings
```

## 5. 라우트별 변경 정책

| Route | P0 정책 |
|---|---|
| `/survey/result` | CTA: “10일 Proof Board 바로 만들기”. 진단 결과 기반 context 저장/전송 |
| `/proof/pilot-design/start` | 질문 시작 제거. 진단 결과를 요약하고 “Board 만들기” 확인 |
| `/proof/pilot-design/questions` | 직접 URL 접근 시 “고급 설정”으로 표시. 필수 funnel에서 제외 |
| `/proof/pilot-design/draft` | 긴 초안 제거. 1페이지 설정 확인/수정만 |
| `/proof/board` | 핵심 화면. KPI, input, result cards, next action |
| `/proof/dashboard` | Evidence Dashboard. 숫자/차트/ProofScore |
| `/proof/report` | 10일 결과표. 대표/팀장 공유용 |
| `/proof/convert` | report/context 기반 전환 문의 |
| `/proof/ai-validation` | “Board에서 외부 AI 답변 검사 모드 사용” 안내 또는 redirect |

## 6. URL 파라미터 정책

| 파라미터 | 용도 | 보안 정책 |
|---|---|---|
| `project` | proof project id | UUID format validate |
| `token` | legacy raw access token | 즉시 session exchange 권장, log 저장 금지 |
| `mode` | board input mode | `paste`, `csv`, `external_ai_review` |
| `source` | CTA source | analytics-safe 값만 허용 |
| `report` | report id | report_view scope 필요 |

## 7. Legacy compatibility

기존 사용자가 가진 URL을 깨지 않기 위해 아래 정책을 쓴다.

- `/workspace` → `/proof/board`로 안내/redirect.
- `/proof/workspace` → `/proof/board` alias.
- `/proof/ai-validation` → board external AI mode 안내.
- `/proof/pilot-design/questions`는 404로 만들지 말고 optional advanced settings로 둔다.

## 8. Navigation

### Product top nav

```txt
Proof Board | 대시보드 | 10일 결과표 | 운영 전환
```

### Admin nav

```txt
운영 홈 | 신청 | 프로젝트 | 결과 카드 | 리포트 | 보안 감사 | 전환 문의 | AI 설정
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
