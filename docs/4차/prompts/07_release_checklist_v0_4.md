# 우리아이 Phase 4 Release Checklist v0.4

아래 체크리스트는 내부 알파/베타/스토어 배포 전 공통 게이트입니다.

| Checklist ID | Category | Item | Owner | Status |
| --- | --- | --- | --- | --- |
| REL-PRE-001 | Pre-release | 코드 freeze 브랜치 생성 및 릴리즈 버전 확정 | PM/Tech Lead | Not Started |
| REL-PRE-002 | Pre-release | Do Not Change 계약 위반 여부 최종 점검 | PM/QA | Not Started |
| REL-PRE-003 | Legal | 개인정보처리방침/이용약관/제휴고지/아동정보/의료성 표현 검토 | Legal/PM | Not Started |
| REL-PRE-004 | Content | 준비템 seed와 상품 링크에 실제 비공개/테스트 링크가 섞이지 않았는지 확인 | Ops | Not Started |
| REL-PRE-005 | Analytics | onboarding_completed, expense_created, product_link_clicked 등 이벤트 수집 확인 | Data/Dev | Not Started |
| REL-INFRA-001 | Infra | 운영 env/secrets 설정 및 secret scan 통과 | DevOps | Not Started |
| REL-INFRA-002 | Infra | DB migration deploy dry-run 및 backup/rollback script 준비 | DevOps | Not Started |
| REL-INFRA-003 | Infra | S3/MinIO bucket, CORS, retention policy 확인 | DevOps | Not Started |
| REL-BUILD-001 | Build | API build/test/lint/typecheck 통과 | Backend | Not Started |
| REL-BUILD-002 | Build | Mobile iOS/Android internal build 생성 및 설치 확인 | Mobile | Not Started |
| REL-BUILD-003 | Build | Admin build/deploy smoke test 통과 | Admin | Not Started |
| REL-QA-001 | QA | QA Runbook QR-01~QR-15 통과 | QA | Not Started |
| REL-QA-002 | QA | 권한/삭제/엑셀/제휴/리포트 집계 회귀 테스트 통과 | QA | Not Started |
| REL-STORE-001 | Store | 앱명, 설명, 스크린샷, 개인정보 라벨, 심사 메모 준비 | PM/Design | Not Started |
| REL-LAUNCH-001 | Launch | 운영 배포 순서: DB → API → Admin → Mobile rollout 확인 | Release Manager | Not Started |
| REL-LAUNCH-002 | Launch | 모니터링 대시보드: error rate, latency, signup, expense_created, product_link_clicked | DevOps/Data | Not Started |
| REL-LAUNCH-003 | Launch | 롤백 기준: API 5xx > 2%, crash-free < 99%, critical data bug 발생 시 즉시 중단 | Release Manager | Not Started |
| REL-POST-001 | Post-release | 24시간/72시간/7일 지표 리뷰 및 hotfix window 운영 | PM/Tech Lead | Not Started |
