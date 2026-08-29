# 우리아이 정적 지원 사이트 (SITE-113)

Play 스토어 등록의 **지원 URL**과 **개인정보처리방침 URL** 호스팅을 위한 순수 정적
페이지. 빌드 도구·JS 프레임워크·외부 CDN 없이 HTML + `site.css` 하나로 구성된다.
Cloudflare Pages 무료 플랜 배포를 전제로 한다.

## 구성

| 파일 | 용도 |
|---|---|
| `index.html` | 앱 소개 랜딩 (스토어 문구 재활용, 다운로드 버튼은 출시 전까지 비활성) |
| `faq.html` | 자주 묻는 질문 11개 (실제 구현 기준) |
| `support.html` | 문의 안내 + 계정·데이터 삭제 절차 (Play Console 지원 URL 대상) |
| `site.css` | 공통 스타일 (시스템 폰트, DNC-017 팔레트) |

법적 문서 3종(`privacy-policy.html`, `terms-of-service.html`, `account-deletion.html`)은
**`infra/legal/`이 원본**이며, 이 디렉터리의 페이지들이 상대 경로(`./privacy-policy.html` 등)로
링크한다. 따라서 배포 시 legal 문서를 같은 디렉터리로 복사해야 한다(아래 참고).

> 주의: `infra/legal/*.html`의 `[대괄호]` placeholder([운영 주체명], [지원 이메일] 등)와
> 이 사이트의 동일 placeholder는 **출시 전 확정 후 교체**해야 하며, 교체 전에는 대외
> 공개 링크로 사용하지 않는다. 이 사이트 페이지의 `[지원 이메일]`·`[운영 주체명]`도
> 같은 시점에 함께 교체한다.

## 배포용 디렉터리 만들기 (legal 문서 복사)

배포 산출물 디렉터리(`dist/`)에 사이트와 legal 문서를 합친다. 리포지토리 루트에서:

```bash
mkdir -p /tmp/wooriai-site && cp infra/site/*.html infra/site/site.css infra/legal/*.html /tmp/wooriai-site/
```

(`/tmp/wooriai-site`는 임시 산출물 폴더 — 리포지토리 안에 두고 싶다면 gitignore된
경로를 사용한다. `infra/site/` 자체에 legal 사본을 커밋하지 않는다.)

## Cloudflare Pages 배포 (무료)

### 방법 A — 대시보드 직접 업로드 (가장 간단)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets** (Direct Upload)
2. 프로젝트 이름 입력 (예: `wooriai-site`) → 위에서 만든 산출물 폴더
   (`/tmp/wooriai-site`)를 통째로 드래그해 업로드
3. 배포 완료 후 `https://wooriai-site.pages.dev` 형태의 URL 발급
   (필요 시 Custom domains 탭에서 보유 도메인 연결)

### 방법 B — wrangler CLI

```bash
npx wrangler login
npx wrangler pages project create wooriai-site --production-branch main   # 최초 1회
npx wrangler pages deploy /tmp/wooriai-site --project-name wooriai-site
```

무료 플랜 한도(월 500회 배포, 무제한 대역폭)로 충분하다. 빌드 명령은 필요 없다
(정적 파일 그대로 서빙).

## Play Console URL 매핑

배포 도메인을 `https://wooriai-site.pages.dev`라고 할 때:

| Play Console 입력란 | URL | 비고 |
|---|---|---|
| 개인정보처리방침 URL (필수) | `https://wooriai-site.pages.dev/privacy-policy.html` | `infra/legal/privacy-policy.html` 사본 |
| 지원 URL (선택) | `https://wooriai-site.pages.dev/support.html` | 문의·삭제 절차 안내 |
| 데이터 안전 — 계정 삭제 URL | `https://wooriai-site.pages.dev/account-deletion.html` | `infra/legal/account-deletion.html` 사본 |
| (참고) 앱 소개 랜딩 | `https://wooriai-site.pages.dev/` | `index.html` |

커스텀 도메인을 연결하면 위 표의 도메인만 바꿔 입력한다. Play Console에 입력한 뒤에는
URL 경로를 바꾸지 않는다(심사·정책 링크가 깨진다).

## 배포 후 앱 env 주입 (라운드 71 #4 — 앱 안에서 이 사이트를 가리킨다)

**이 절을 건너뛰면 스토어에는 지원 URL이 있는데 앱 안에는 도움으로 가는 길이 0건인 채로
출시된다.** 라운드 71 트랙 D가 더보기 탭과 설정 화면에 도움 행 둘을 세웠는데, 그 행은
**주입된 URL이 있을 때만** 선다(값이 없으면 행 자체가 만들어지지 않아 화면이 종전과 한 글자도
다르지 않다 — 약관 링크·푸시 토글과 같은 "고칠 수 없으면 정직하게 감춘다" 관례.
`apps/mobile/src/settings/support-links.ts`).

| env 키 | 값 | 앱에서 서는 행 |
|---|---|---|
| `EXPO_PUBLIC_FAQ_URL` | `https://wooriai-site.pages.dev/faq.html` | 더보기·설정의 **자주 묻는 질문** |
| `EXPO_PUBLIC_SUPPORT_URL` | `https://wooriai-site.pages.dev/support.html` | 더보기·설정의 **고객 지원** |

절차:

1. 위 배포로 두 페이지의 **공개 URL**을 확정한다(커스텀 도메인을 붙일 예정이면 그것을 먼저 붙인다 —
   나중에 도메인을 바꾸면 이미 배포된 앱이 옛 주소를 가리킨다).
2. 앱 빌드 환경에 두 키를 넣고 **다시 빌드한다**. `EXPO_PUBLIC_*`는 babel-preset-expo가
   **번들 시점에 인라인**하므로 이미 만든 APK/AAB에 값을 넣을 수는 없다 — 재빌드가 이 스위치의
   전부다. (`apps/mobile/.env` 또는 CI env. 같은 규칙을 쓰는 선례:
   `EXPO_PUBLIC_TERMS_URL`·`EXPO_PUBLIC_PRIVACY_POLICY_URL`.)
3. `https://` 또는 `http://`로 시작하는 값만 인정된다(그 밖의 값은 정규화에서 걸러져 **행이 서지
   않는다** — 죽은 링크를 만들지 않기 위한 규칙이다). 값 끝의 공백은 무시된다.
4. 빌드에서 더보기 탭과 설정 화면을 열어 행 둘이 서는지, 눌렀을 때 **외부 브라우저**로 이 페이지가
   열리는지 확인한다(앱은 인앱 웹뷰를 만들지 않는다 — `Linking.openURL` 하나). 실기기 확인 항목은
   `docs/qa/runtime-verification-required.md` §1-1 **#95**.
   ⚠️ 행은 서는데 **"링크를 열지 못했어요"만 뜨면** URL 문제가 아닐 수 있다: 앱은
   `Linking.canOpenURL`을 먼저 묻고, Android 11+에서는 매니페스트 `<queries>` 선언이 없으면
   브라우저가 있어도 false가 돌아온다(그 선언은 `expo prebuild` 템플릿에서 오며 이 저장소에는
   없다). 그때는 `app.json`/config plugin에 `queries`를 선언해 다시 prebuild한다 —
   **`android/` 손패치는 금지**(CLAUDE.md).
5. **Play Console 지원 URL과 같은 주소를 쓴다** — 위 매핑 표의 `support.html`이 앱 안 "고객 지원"
   행의 목적지와 같아야 한다(`docs/store/play-listing.md` §6 기타 등록 정보).

한 키만 주입하면 그 행 하나만 선다(둘 중 하나만 호스팅한 상태로도 안전하다). 문서 본문은 앱에
복사하지 않으므로 이 디렉터리의 HTML이 **단일 소스**이고, 문구를 고치면 재배포만으로 앱에 반영된다
(앱 재빌드가 필요한 것은 **URL이 바뀔 때뿐**이다). 판정과 배경은
`docs/operations/known-limitations.md` **L-3**.

## 검증

배포 전 로컬에서 링크 무결성만 확인하면 된다. 예: 산출물 폴더에서 각 HTML이 참조하는
`href`/`src`(상대 경로)가 실제 파일로 존재하는지 확인한다. 별도 빌드·테스트 파이프라인은
없다(release:gate 범위 밖).
