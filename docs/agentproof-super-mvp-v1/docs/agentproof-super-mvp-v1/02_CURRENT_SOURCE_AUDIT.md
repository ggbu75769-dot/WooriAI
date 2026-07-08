# 02. 현재 소스 분석서

## 1. 현재 저장소 성격

대상 저장소는 `agentproofKR/agentproofKR.github.io`다. 현재 구조는 랜딩 페이지를 넘어, 다음 기능 골격을 이미 갖고 있다.

- Next.js static export
- GitHub Pages 배포
- Supabase Edge Function 기반 제출
- Supabase Postgres migrations
- 무료 업무진단
- 10일 Proof Test 신청/설계
- Proof Board
- AI Validation
- Dashboard
- Report
- Admin dashboards
- ProofCore 도메인 모델
- PII/민감정보 탐지/마스킹
- Project access token/scope 설계

## 2. 현재 route map

| Route | 현재 역할 | Super MVP 판정 |
|---|---|---|
| `/` | 랜딩 | 유지, 숫자/브랜딩 강화 |
| `/survey` | 무료 진단 | 유지 |
| `/survey/[persona]` | 역할별 진단 | 유지 |
| `/survey/result` | 결과 | Board 바로 생성 CTA로 전환 |
| `/proof/pilot-design/start` | 파일럿 설계 시작 | 질문 시작이 아니라 Board 생성 준비로 변경 |
| `/proof/pilot-design/questions` | 추가 설문 | 필수 경로에서 제거, 고급 설정으로 숨김 |
| `/proof/pilot-design/draft` | 설계 초안 | 1페이지 확인 화면으로 축소 |
| `/proof/board` | 파일럿 업무 보드 | 핵심 제품 화면으로 격상 |
| `/proof/dashboard` | 파일럿 대시보드 | Evidence Dashboard로 강화 |
| `/proof/report` | 10일 결과표 | 대표/팀장용 숫자 리포트로 강화 |
| `/proof/ai-validation` | AI 답변 검사 | Board 탭 또는 모드로 병합 |
| `/proof/convert` | 전환 문의 | Report CTA와 연결 |
| `/admin/dashboard` | 운영자 홈 | 유지/강화 |
| `/admin/pilot-applications` | 신청 검토 | 유지 |
| `/admin/projects` | 프로젝트 관리 | token/report scope 강화 |
| `/admin/reports` | 리포트 검수 | P0 핵심 |
| `/admin/audit-security` | 보안 감사 | P0 핵심 |
| `/admin/conversions` | 전환 문의 | P0 핵심 |
| `/admin/ai-settings` | AI provider/routing | P1 또는 운영자 전용 |

## 3. 핵심 파일 분석

| 파일 | 현재 역할 | 개선 방향 |
|---|---|---|
| `components/home/HomeHero.tsx` | 랜딩 hero, 숫자 샘플, CTA | Proof Board/10일 결과표 미리보기 강화 |
| `components/proof/ProofPages.tsx` | Proof 화면 대부분이 한 파일에 집중 | Super MVP 이후 점진적 컴포넌트 분리 필요 |
| `lib/proof.ts` | ResultCard, BoardMetrics, WorkProfile, 정책, 제출 helper | 사용자 용어/Board summary DTO 강화 |
| `lib/proofCore.ts` | WorkContract, ProofSession, ProofEvent, ProofScore, Verdict | Super MVP score/report의 핵심 엔진으로 연결 |
| `lib/proofRepository.ts` | local/supabase repository abstraction 일부 | Supabase-first read/write로 확장 |
| `lib/proofReport.ts` | report helper | visual scorecard/report reliability 강화 |
| `lib/proofSubmission.ts` | Edge submit wrapper | read endpoint/summary endpoint 필요 |
| `supabase/functions/proof-submit/index.ts` | write payload 처리 | query/summary/job/access 검증 강화 |
| `supabase/migrations/*.sql` | proof tables 존재 | job tables/indexes/summary views 추가 |

## 4. 현재 강점

1. 이미 MVP 흐름이 구현되어 있다.
2. ResultCard 구조가 사용자 가치와 잘 맞는다.
3. BoardMetrics가 숫자 중심 설계에 적합하다.
4. proofCore가 WorkContract/ProofSession/ProofScore/Verdict/EvidenceLedger까지 포함한다.
5. PII/토큰/원문 저장 정책에 대한 의식이 이미 있다.
6. Supabase migrations와 Edge contract가 있어 1000명 운영 MVP로 확장 가능하다.
7. 관리자 화면이 이미 존재해 P0 운영형 MVP에 적합하다.

## 5. 현재 가장 큰 gap

| Gap | 위험 | 해결 |
|---|---|---|
| 진단 후 파일럿 내부 추가 설문 | 전환 이탈 | 진단 결과 기반 Board 자동 생성 |
| localStorage 중심 UX | 실제 운영 데이터 불일치 | Supabase-first hydration |
| Board/Dashboard/Report 분리 약함 | 숫자 흐름이 안 보임 | shared summary DTO |
| CSV 동기 처리 가능성 | 50행 이상 지연/timeout | proof_jobs 도입 |
| ResultCard UI 정보 과다 | 사용자가 바로 못 봄 | Toss식 카드 재설계 |
| Token URL 장기 노출 | 보안 리스크 | token exchange/expiry/scope 강화 |
| Report 글 중심 | 대표 판단 어려움 | Proof Score/도표/판정 중심 |

## 6. 우선 적용 순서

1. `/survey/result` → `/proof/board` 바로 생성 CTA.
2. `/proof/pilot-design/questions` 필수 경로 제거.
3. Proof Board 상단 KPI와 ResultCard 재설계.
4. ProofScore/Verdict/EvidenceLedger를 Dashboard/Report에 연결.
5. Supabase summary endpoint와 repository read 모델 추가.
6. CSV job 처리와 필수 indexes 추가.
7. Admin report publish/conversion funnel 완성.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
