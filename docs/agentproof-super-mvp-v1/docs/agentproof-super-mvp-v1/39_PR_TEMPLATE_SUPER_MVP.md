# 39. Super MVP PR Template

```md
# AP-SMVP-XXX — 제목

## 1. 목적


## 2. 변경 요약

- 

## 3. 사용자 흐름 변화

Before:

After:

## 4. 변경 파일

- 

## 5. 보안/개인정보 영향

- [ ] raw text 저장/노출 없음
- [ ] token 저장/노출 없음
- [ ] analytics 개인정보 없음
- [ ] report scope guard 영향 확인

## 6. 테스트

- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm test:e2e
- [ ] pnpm test:security
- [ ] pnpm build

## 7. 스크린샷/캡처

- Desktop:
- Mobile:

## 8. 남은 리스크

- 
```


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
