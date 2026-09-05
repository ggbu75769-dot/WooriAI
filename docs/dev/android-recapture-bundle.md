# Android 재캡처 동반 묶음 — 이월 대장 (라운드 98 확정)

픽셀락 기준 이미지의 권위는 Android 캡처다(`scripts/pixel-lock/android-pixel-lock.ts`,
`docs/dev/toss-T3-entry-EXP001-change-request.md` §정식 기준 이미지 갱신). 원격 개발
환경에는 기기가 없어 기준 이미지를 정식으로 갈 수 없으므로, **기준 이미지가 갈려야만
반입할 수 있는 변경 전부**를 이 묶음으로 모아 이월한다. 전부 코스메틱이며 출시 차단이
아니다. 사용자 실기기 QA(30분 코스) 때 한 세션에서 일괄 수행하는 것을 권장한다.

## 묶음 내용 (재캡처 1회로 함께 닫을 것)

| # | 항목 | 걸린 락 | 근거 |
|---|---|---|---|
| 1 | EXP-001 기준 이미지 교체 (결제 세그먼트·금액 28/34 — 코드는 이미 반영됨) | EXP-001 | `docs/dev/toss-T3-entry-EXP001-change-request.md` (승인 원본과의 의도된 편차 2건) |
| 2 | caption 토큰 11/16 → 12/18 단일화 (토스 리뷰가 원복 — 재대조 동반 2단계 몫) | 6종 전부 | 토스 라운드 TOSS-R 결정. `state-screen-conventions.test.ts`가 현행 11/16을 핀 |
| 3 | 홈 퀵액션 라벨 '추천템'→'준비템'·'성장 리포트'→'리포트' (탭 라벨 정합) | HOME-001 | 토스 이월 #10 — 락 분기 안 문자열 |
| 4 | 가져오기 안내 '검수 후 승인하기 전까지…' 재작성 | IMP-003 + a11y-contract 앵커 | 토스 이월 #7 — 고위험 계약 변경, 변경 요청 문서화 후 수행 |
| 5 | 4탭 화면 제목 문법 통일 + 제목·부제 마침표 규칙 일괄 | HOME/REP/ITEM-001 | 토스 이월 #8·#9 — 승인 수치 편차 문서화 전제 |

## 수행 절차 (기기 확보 시)

1. 위 2~5의 코드 변경을 한 브랜치에 모은다(각 항목의 근거 문서·이월 표기를 커밋에 인용).
2. `scripts/pixel-lock/build-pixel-apk.ts` → `EXPO_PUBLIC_PIXEL_LOCK=1` 빌드 →
   `wooriai:///pixel-lock?screen=<ID>` 6종 캡처(`androidNormalization: "tailCropFill"`).
3. `docs/ui-pixel-lock/reference-crops/` 기준 이미지 교체 + 편차 근거로 이 문서와 각
   항목의 근거 문서를 인용.
4. 관련 소스 계약(핀) 이관: `state-screen-conventions.test.ts`(caption),
   `a11y-contract.test.ts`(IMP-003 앵커) 등 — 코드와 같은 커밋에서.

## 이 묶음에 넣지 않은 것

- **기록 탭(records.tsx) 시각 변경** — 기록 탭에는 픽셀락이 없어 라운드 98에서 즉시 반입.
- **준비템 탭 루트 ‹ 제거(onBack 전달 중단)** — 라운드 98 T-C가 수행. 소스 계약이 이를
  막으면 T-C 보고에 따라 이 묶음으로 승격한다.
- **money.ts '원' 단위 축소** — 금액 표시 잠금 인접이라 재캡처와 무관하게 보류(재론 금지).
