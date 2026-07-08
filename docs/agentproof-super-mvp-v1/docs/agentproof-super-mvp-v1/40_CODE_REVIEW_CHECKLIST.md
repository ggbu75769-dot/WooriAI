# 40. 코드리뷰 체크리스트

## 1. Product

- [ ] 진단 후 중복 설문 없음
- [ ] 사용자가 첫 결과 카드까지 빠르게 도달함
- [ ] 핵심 숫자가 상단에 보임
- [ ] 월 19만 원 전환 근거가 숫자로 설명됨

## 2. UI

- [ ] 한국어 쉬운 용어
- [ ] card hierarchy 명확
- [ ] 모바일 대응
- [ ] keyboard 접근성
- [ ] loading/error/empty state 존재

## 3. Logic

- [ ] score 공식이 문서와 일치
- [ ] verdict 조건이 문서와 일치
- [ ] risk flags/human gate가 누락되지 않음
- [ ] feedback status가 metrics에 반영됨

## 4. API/Data

- [ ] idempotencyKey
- [ ] Supabase source of truth
- [ ] localStorage에 민감 데이터 없음
- [ ] query indexes 고려
- [ ] error shape 일관성

## 5. Security

- [ ] token hash only
- [ ] report_view/board_access 분리
- [ ] raw source audit reason 필수
- [ ] PII masking/blocking
- [ ] analytics allowlist


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
