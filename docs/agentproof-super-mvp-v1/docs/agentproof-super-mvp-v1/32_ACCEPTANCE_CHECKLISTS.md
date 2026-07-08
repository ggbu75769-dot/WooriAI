# 32. Acceptance Checklists

## 1. UX Flow

- [ ] `/survey/result`에서 CTA 문구가 `10일 Proof Board 바로 만들기`다.
- [ ] CTA 클릭 후 `/proof/pilot-design/questions`를 거치지 않는다.
- [ ] Board 첫 진입에서 업무 입력/샘플 실행이 보인다.
- [ ] 첫 ResultCard까지 3분 이내 UX가 가능하다.
- [ ] Board 상단에 Proof Score/처리/사용률/절감/위험/사람확인/신뢰도가 보인다.

## 2. Result Card

- [ ] 요약/초안/누락정보/주의표현/사람확인/액션이 분리되어 있다.
- [ ] 위험 수준 chip이 보인다.
- [ ] blocked 카드의 copy 정책이 안전하다.
- [ ] 4개 사용 여부 버튼이 항상 보인다.
- [ ] 클릭 후 metrics가 업데이트된다.

## 3. Dashboard/Report

- [ ] Proof Score가 0~100으로 표시된다.
- [ ] Verdict가 통과/조건부/재검증/불합격/데이터 부족으로 표시된다.
- [ ] Report 첫 화면에 5개 숫자가 보인다.
- [ ] 운영 가능 범위와 제외 범위가 함께 표시된다.
- [ ] 운영 전환 CTA가 report context를 포함한다.

## 4. Data/API

- [ ] Supabase summary read가 가능하다.
- [ ] localStorage는 source of truth가 아니다.
- [ ] CSV 업로드는 job status를 반환한다.
- [ ] idempotency key가 mutation에 사용된다.
- [ ] rate limit이 문서/코드에 반영된다.

## 5. Security

- [ ] raw token은 저장/log/analytics에 없다.
- [ ] report_view와 board_access scope가 분리된다.
- [ ] unpublished report는 공개되지 않는다.
- [ ] raw source access는 reason 없이 불가능하다.
- [ ] PII 입력은 마스킹/차단된다.

## 6. Test

- [ ] pnpm lint pass
- [ ] pnpm typecheck pass
- [ ] pnpm test pass
- [ ] relevant e2e pass
- [ ] security test pass
- [ ] mobile visual check pass


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
