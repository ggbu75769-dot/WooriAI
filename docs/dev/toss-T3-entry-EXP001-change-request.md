# 변경 요청 — EXP-001 픽셀 락 기준 이미지 갱신 (T3-entry)

- 트랙: T3-entry (지출 입력 시트)
- 날짜: 2026-09-04
- 대상: `docs/ui-pixel-lock/reference-crops/1_png_quick_expense.png` (EXP-001 기준 이미지)
  - ⚠️ 이 트랙은 `docs/**` 쓰기가 금지라 **기준 이미지 파일 자체는 갈지 않았다.**
    갈아 끼우는 손은 메인 세션이고, 이 문서와 아래 재캡처 산출물이 그 근거다.
- ⚠️ **저장소 승격(토스 리뷰 M)**: 이 문서는 T3 세션 스크래치패드에만 있었고
  `entry-screen-visual-restore.test.ts`·커밋 5f1b599가 "변경 요청 문서와 함께 간다"고
  적은 그 문서가 저장소에 없었다 — 토스 리뷰가 `docs/dev/`로 승격했다. 아래 "산출물
  (scratchpad)" 경로들은 T3 세션의 로컬 캡처라 저장소에는 없다(재현 절차는 본문 그대로
  유효). **기준 이미지 교체(§정식 기준 이미지 갱신)는 여전히 승인 후 Android 재캡처 몫
  으로 남아 있다** — 이 문서가 커밋된 시점에도 `1_png_quick_expense.png`는 승인 원본
  그대로다. 또한 토스 리뷰가 T1의 caption 11→12 재지향을 원복해, EXP-001의 비세션 렌더
  편차는 이 문서의 2건(금액 표시·결제 세그먼트)만 남는다.

## 왜 기준 이미지가 갈려야 하는가 (의도된 비세션 렌더 변화 2건)

EXP-001 캡처는 세션 없는 초기 렌더를 찍는다(app/pixel-lock.tsx가 clearSession 후
/expenses/new 이동). T3-entry는 그 비세션 렌더에 **의도적으로** 두 가지를 바꿨다.

1. **결제 수단: 순환 버튼 → 세그먼트.** 종전에는 카드 하나가 탭마다 값을 순환했다
   (지금 값 말고는 보이지 않고, 원하는 값까지 최대 3탭). 이제 네 값(카드·현금·계좌 이체·
   모바일 결제)이 전부 보이는 pill 세그먼트로, 어느 값이든 1탭이다. 이 카드는 비세션에도
   렌더되므로 기준 이미지의 해당 영역이 달라진다(뷰포트 아래 영역 — tailCropFill 정규화
   범위에 들어간다).
2. **요약바 금액 입력: 22px·148px 고정 상자 → 28/34·flex 배분.** 금액은 이 화면의 가장
   중요한 숫자인데 품목명(15px)과 한 급 차이였다. 기준 이미지 하단 요약바의 금액 상자
   크기·글자 크기가 달라진다. ('원' 14/800 위계·beige/mainCoral 문법은 그대로다.)

비세션 렌더의 **노드 수·순서는 바꾸지 않았다**: 품목명 블록 상향 이동은 세션 렌더에만
적용되고, 비세션의 숨은 품목명 입력칸은 원래 자리에 그대로 있다(app/expenses/new.tsx의
"라운드 96 T3" 주석과 entry-screen-visual-restore.test.ts의 노드 순서 계약 참고).

부수: 웹 캡처 한정으로, 금액 입력 숫자가 상자 밖 오른쪽으로 밀려 보이지 않던 기존 결함
(CSS min-width:auto가 flex 수축을 막음)을 `minWidth: 0`으로 고쳤다. 네이티브(Yoga)는
기본값이 0이라 Android 캡처에는 무영향이고, 웹 재캡처에서만 숫자가 상자 안으로 돌아온다.

## 재캡처 절차 (이번 라운드에 수행한 것 · 웹 근사 캡처)

1. `cd apps/mobile && EXPO_OFFLINE=1 CI=1 EXPO_PUBLIC_TEST_LOGIN=1 npx expo start --web --port 8230`
2. Playwright(chromium, 390×844, DPR 2)로 `http://localhost:8230/pixel-lock?screen=EXP-001`
   로드 → "지출 기록" 렌더 대기 → 뷰포트 캡처.
3. 산출물(scratchpad):
   - `toss-T3-entry-exp001-before.png` (변경 전)
   - `toss-T3-entry-exp001-after.png` (변경 후)
   - 세션 경로: `toss-T3-entry-session-before/after.png`,
     `toss-T3-entry-itemname-under-tiles-after.png`,
     `toss-T3-entry-payment-segment-after.png`,
     `toss-T3-entry-payment-segment-selected-after.png`,
     `toss-T3-entry-focus-flow-after.png` (타일 탭 → 금액 입력칸 포커스,
     activeElement = "지출 금액 입력" 로그 확인)

## 정식 기준 이미지 갱신 (메인 세션 몫)

기준 이미지의 권위는 Android 캡처다(`scripts/pixel-lock/android-pixel-lock.ts`,
`androidNormalization: "tailCropFill"`). 절차:
1. `EXPO_PUBLIC_PIXEL_LOCK=1` 빌드로 `wooriai:///pixel-lock?screen=EXP-001` 캡처
   (scripts/pixel-lock/build-pixel-apk.ts → android-pixel-lock.ts 관례).
2. 산출 캡처로 `docs/ui-pixel-lock/reference-crops/1_png_quick_expense.png` 교체.
3. 교체 근거로 이 문서를 인용(위 2건이 승인 원본 c20deeb에서 의도적으로 갈라진 항목이고,
   그 두 시점 기록은 entry-screen-visual-restore.test.ts에 있다).

## 함께 남기는 변경 요청 (이 트랙이 반영하지 못한 2건)

1. **'저장 중' → '저장하는 중' 라벨 통일.** 저장소 관례는 '저장하는 중'(7개 화면)인데
   이 시트만 '저장 중'이다. 소유하지 않은 계약
   `src/expenses/entry-form-guards.test.ts:272,322`가
   `label={saveExpense.isPending ? "저장 중" : "저장하기"}`를 위치 앵커로 바이트째 물고
   있어, 이 트랙 규율(비소유 스윕이 빨개지면 내 코드를 규율에 맞춘다)에 따라 보류했다.
   라벨과 그 테스트의 앵커 두 곳을 **한 커밋**에서 함께 갱신해 달라.
2. **품목명 scrollTo 헬퍼.** 요약바 연필이 품목명 칸으로 포커스만 옮기고 스크롤은 못
   한다 — 이 화면의 스크롤러는 src/ui.tsx AppScreen(이 트랙 비접촉·ref 미전달)이라
   화면에서 scrollTo를 걸 방법이 없다. AppScreen에 ref 전달(또는 scrollTo 헬퍼 프롭)이
   서는 라운드에 함께 닫아 달라. 블록 상향 이동으로 실사용 마찰은 이미 크게 줄었다
   (품목명이 타일 바로 아래라 대부분의 경우 화면 안에 있다).
