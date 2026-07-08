# 25. 배포 / 릴리즈 Runbook

## 1. 로컬 검증

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
pnpm build
```

## 2. Supabase 검증

- migration dry run
- proof-submit Edge function deploy check
- CORS allowed origins
- RLS/권한 확인
- token scope/status/expiry 테스트
- QA data cleanup

## 3. 배포 전 체크리스트

- [ ] `/version.json` 생성 확인
- [ ] secret이 bundle/log/docs에 없음
- [ ] `NEXT_PUBLIC_SURVEY_API_URL` 설정 확인
- [ ] `LEGAL_OPERATOR_NAME` 설정 확인
- [ ] Supabase variables/secrets 확인
- [ ] report/published guard 확인
- [ ] raw source audit reason 필수 확인

## 4. GitHub Pages 배포

- main push 또는 수동 workflow.
- deploy-pages workflow 확인.
- live domain 최신 SHA 반영 확인.

## 5. Smoke test

- 랜딩 CTA
- 무료 진단 시작
- 결과 페이지
- Board 생성
- text intake sample
- feedback click
- dashboard open
- report guard
- admin dashboard load

## 6. Rollback 기준

- survey submit 깨짐
- proof text intake 5xx 증가
- token scope guard 오작동
- 개인정보/토큰 노출 발견
- mobile board 가로 스크롤 발생
- report unpublished 공개 노출


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
