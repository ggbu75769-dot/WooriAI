# 37. 개발자 핸드오프 체크리스트

## 1. 작업 시작 전

- [ ] `AGENTS.md` 읽음
- [ ] `00_README_FOR_CODEX.md` 읽음
- [ ] 작업 task prompt 읽음
- [ ] 현재 파일 직접 확인
- [ ] 변경 범위 5줄 이하로 정리

## 2. UX 변경 체크

- [ ] 한국어 UI 유지
- [ ] 중복 설문 재도입 없음
- [ ] 숫자 KPI 우선 표시
- [ ] CTA는 하나만 명확히 강조
- [ ] 모바일 320px 이상 가로 스크롤 없음
- [ ] keyboard focus 확인

## 3. 데이터/보안 체크

- [ ] raw token 저장/log 없음
- [ ] raw text analytics 없음
- [ ] email/company analytics 없음
- [ ] report scope guard 확인
- [ ] admin raw source reason 필수
- [ ] idempotencyKey 사용

## 4. 테스트 체크

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 `pnpm test:e2e`
- [ ] 보안 변경 시 `pnpm test:security`
- [ ] build 필요 시 `pnpm build`

## 5. PR 설명 템플릿

```md
## 변경 요약
- 

## 관련 Task
- AP-SMVP-XXX

## 변경 파일
- 

## 사용자 흐름 확인
- 

## 보안/개인정보 확인
- 

## 테스트
- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm test:e2e
- [ ] pnpm test:security

## 남은 리스크
- 
```


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
