# 27. 글로벌 SaaS 100개 벤치마크 패턴 요약

## 1. 분석 그룹

| 그룹 | 서비스 | 가져올 패턴 |
|---|---|---|
| Work OS | Linear, Jira, Asana, monday.com, ClickUp, Trello, Wrike, Smartsheet, Height, Basecamp | 상태, 프로젝트, 필터, 공유 뷰, 진행률 |
| Workflow/BPM | ServiceNow, Camunda, Zapier, Make, n8n, Workato, Tray.io, Boomi, Power Automate, Retool | 승인, 자동화, 감사, 조건 분기 |
| LLMOps/Eval | LangSmith, Braintrust, Langfuse, Humanloop, Galileo, Arize Phoenix, W&B Weave, Helicone, Promptfoo, Guardrails AI | trace, eval, scorer, feedback, regression |
| Observability | Datadog, New Relic, Sentry, Grafana, Honeycomb, Splunk, Elastic, PagerDuty, Opsgenie, Better Stack | 지표, 이벤트, 알림, 장애 추적 |
| Knowledge | Notion, Confluence, Coda, Airtable, Google Workspace, Microsoft 365, Guru, Slab, Slite, Dropbox | 문서/테이블/카드형 협업 |
| CRM/CS | Salesforce, HubSpot, Zendesk, Intercom, Freshdesk, Front, Gainsight, ChurnZero, Gong, Outreach | 고객응대 품질, 파이프라인, 활동 로그 |
| Security/GRC | Okta, Auth0, Vanta, Drata, OneTrust, Wiz, Snyk, Semgrep, CrowdStrike, Microsoft Purview | 접근제어, 감사증거, 보안 이벤트 |
| BI/Product Analytics | Amplitude, Mixpanel, PostHog, Looker, Tableau, Power BI, Hex, Metabase, Mode, Segment | funnel, cohort, metric card, dashboard |
| Finance/Ops | Ramp, Brex, Coupa, SAP Ariba, NetSuite, QuickBooks, Xero, Odoo, Zoho, Shopify | 승인/비용/구매 판단 근거 |
| Product Craft | Stripe, Vercel, Figma, Slack, Discord, Toss, Attio, Linear, Shopify, Notion | 단순한 CTA, 숫자, 고급스러운 카드, 빠른 액션 |

## 2. AgentProof 적용 원칙

1. Linear처럼 빠르게 상태를 바꾸고 필터링한다.
2. Jira처럼 작업/위험/승인 상태가 명확하다.
3. ServiceNow처럼 사람 승인과 감사 로그를 남긴다.
4. Camunda처럼 사람+AI+시스템 이벤트를 end-to-end 증거로 묶는다.
5. LangSmith처럼 결과별 trace를 남긴다.
6. Braintrust처럼 scorer와 verdict를 명확히 한다.
7. Datadog처럼 운영 숫자와 위험을 한눈에 보여준다.
8. Vanta처럼 증거 기반 신뢰도를 보여준다.
9. Toss처럼 글보다 숫자와 CTA가 먼저다.
10. Stripe처럼 브랜드 완성도를 높인다.

## 3. 화면별 적용

| 화면 | 가져올 패턴 |
|---|---|
| Landing | Stripe/Toss: 큰 메시지, 짧은 문장, 숫자 proof |
| Survey Result | Toss: 결과 요약 + 하나의 다음 액션 |
| Board | Linear/Notion: 카드와 빠른 액션 |
| Dashboard | Datadog/Amplitude: metric cards + breakdown |
| Report | Vanta/Drata: audit proof + pass/conditional verdict |
| Admin | Jira/ServiceNow: queue, status, approval |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
