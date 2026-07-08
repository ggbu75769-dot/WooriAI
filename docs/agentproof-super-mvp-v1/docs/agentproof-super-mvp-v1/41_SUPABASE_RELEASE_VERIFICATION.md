# 41. Supabase Release Verification

## 1. Migration 검증

- [ ] 기존 테이블 drop 없음
- [ ] migration idempotent
- [ ] indexes 생성
- [ ] proof_jobs/proof_job_items foreign key 확인
- [ ] RLS/Edge service role 동작 확인

## 2. Edge Function 검증

- [ ] allowed origins 확인
- [ ] kind allowlist 확인
- [ ] CORS preflight 확인
- [ ] idempotency 처리
- [ ] project access 검증
- [ ] report_view guard 확인
- [ ] error shape 통일

## 3. 운영 데이터 검증

- [ ] survey submit 성공
- [ ] create board from survey 성공
- [ ] text intake 성공
- [ ] quick feedback 성공
- [ ] project summary read 성공
- [ ] report publish 성공
- [ ] conversion request 성공
- [ ] data request 성공

## 4. 보안 검증

- [ ] raw token DB 미저장
- [ ] encrypted email/phone
- [ ] raw text analytics 미포함
- [ ] raw file delete_after_parse evidence
- [ ] admin raw source audit reason required


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
