# 우리아이 브랜드 아이덴티티

## 브랜드 한 문장

**우리 아이의 오늘을 기록해 내일을 준비한다.**

우리아이는 가족 기록, 생활비, 준비물, 구매 후 상태를 한 흐름으로 연결하는 앱이다. 공식 로고 `Sprout Wallet`은 아이의 웃는 얼굴과 성장 새싹, 가족 생활비 지갑을 하나의 따뜻한 심볼로 결합한다.

## 심볼의 의미

- 웃는 아이: 가족 기록의 중심인 우리 아이
- 두 장의 새싹: 오늘의 기록이 이어 만드는 성장과 다음 준비
- 감귤색 지갑: 가족이 함께 모아보는 아이 생활비
- 오른쪽 지갑 잠금점: 기록·준비·구매 후 상태가 한곳에 안전하게 모이는 흐름

## 공식 색상

| 이름 | 값 | 용도 |
| --- | --- | --- |
| Midnight Navy | `#17324D` | 새싹, 표정, 워드마크와 단색 심볼 |
| Persimmon | `#FF6B4A` | 가족 생활비 지갑과 주요 브랜드 강조 |
| Butter | `#FFD76A` | 아이 얼굴과 성장의 따뜻함 |
| Warm Ivory | `#FFF9F3` | 앱 아이콘·시작 화면·지갑 잠금점 배경 |

그라데이션과 그림자는 공식 로고 원본에 사용하지 않는다. 네 가지 색의 역할을 바꾸거나 임의의 피부색·초록색을 추가하지 않는다.

## 형태와 여백

- 단독 심볼 최소 표시 크기: 디지털 기준 `24px`
- 가로형 로고 최소 너비: 디지털 기준 `120px`
- 보호 여백: 로고 바깥 네 방향에 최소 감귤색 점 지름만큼 확보
- 워드마크는 `우리아이` 정확한 표기를 유지하고 글자 사이를 임의로 벌리거나 줄이지 않는다.

## 공식 자산

- 컬러 아이콘 원본: `apps/mobile/assets/brand/wooriai-mark.svg`
- 투명 전경 심볼: `apps/mobile/assets/brand/wooriai-foreground.svg`
- 가로형 로고: `apps/mobile/assets/brand/wooriai-lockup.svg`
- 단색 심볼: `apps/mobile/assets/brand/wooriai-monochrome.svg`
- 알림 심볼: `apps/mobile/assets/brand/wooriai-notification.svg`
- 생성 스크립트: `scripts/generate-brand-assets.ts`
- 이미지 생성 콘셉트 보드: `apps/mobile/assets/brand/wooriai-hangul-identity-concept.png` — 방향 검토용이며 앱에 직접 사용하지 않는다.

## 금지 사용

- 심볼을 회전, 기울임, 비율 변경하지 않는다.
- 포털·나침반·하트·집·보호자 실루엣을 추가하지 않는다.
- 새싹의 두 잎, 아이 표정, 지갑 잠금점을 제거하거나 위치를 바꾸지 않는다.
- 워드마크를 AI 이미지 안의 생성 글자로 대체하지 않는다.
- 아이콘 전체를 별도 흰색 사각 타일 안에 넣어 Android 적응형 아이콘 전경으로 사용하지 않는다.
- Pixel Lock 전용 `pixel-splash-mark.png`를 제품 로고로 사용하지 않는다.

## 제품 적용

앱 아이콘, Android 적응형 아이콘, 네이티브 시작 화면, React 시작 화면, 로그인 워드마크, 모노크롬 아이콘, 알림 아이콘은 위 벡터 원본에서 재생성한다. 수정 후에는 `pnpm brand:generate`, Android 설치 캡처, `pnpm release:gate`, `pnpm pixel:android`를 다시 실행한다.
