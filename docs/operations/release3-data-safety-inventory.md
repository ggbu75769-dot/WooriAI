# Release 3 Data Safety inventory

이 문서는 Play Console 답변의 코드 기반 초안이며 법률·운영자 승인을 대체하지 않는다.

| 데이터 | 목적 | 저장 위치 | 기본값/동의 | 삭제·보존 |
| --- | --- | --- | --- | --- |
| OAuth provider subject | 로그인·계정 연결 | PostgreSQL `oauth_identities` | 로그인 시 필수 | 탈퇴 worker에서 unlink 후 삭제 |
| email/phone/display name | 계정·지원 | PostgreSQL `users` | provider/사용자 입력 | 탈퇴 시 null/anonymize |
| 가족·아이 profile | 가족 협업·추천 | PostgreSQL | 기능 사용 시 | 소유권/공동가족 규칙 후 삭제 또는 비식별 보존 |
| 지출·결제수단 label | 기록·리포트 | PostgreSQL, mobile local state | 사용자 입력 | export/delete 정책 적용 |
| import 파일 | Excel import | object storage + metadata | 명시적 upload | retention 승인값 후 삭제 |
| device/push token | 알림 | PostgreSQL | 알림 허용 시 | device disable/탈퇴 시 삭제 |
| analytics event | 제품 분석 | PostgreSQL | opt-in, 기본 OFF | revoke 후 신규 수집 차단, 보존기간 승인 필요 |
| consent/legal hash | 법적 증적 | PostgreSQL append-only event | 필수/선택 구분 | 법정 보존정책 승인 필요 |
| privacy export | 사용자 export | object storage | 사용자 요청 | TTL 만료 삭제 |
| support reason code | 신고·지원 | PostgreSQL | 사용자 요청 | 자유문 미수집, 보존기간 승인 필요 |
| request/audit metadata | 보안·운영 | structured log/PostgreSQL | 정당한 운영 목적 | raw IP/user-agent/token 금지 |

미확정: 법적 운영자, 최종 privacy/terms URL, 공급자별 processor 목록, 국가/지역, retention 기간, 암호화/KMS 증적, data sharing 여부. 확정 전 Data Safety 제출 및 공개 출시를 차단한다.
