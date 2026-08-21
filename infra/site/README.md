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

## 검증

배포 전 로컬에서 링크 무결성만 확인하면 된다. 예: 산출물 폴더에서 각 HTML이 참조하는
`href`/`src`(상대 경로)가 실제 파일로 존재하는지 확인한다. 별도 빌드·테스트 파이프라인은
없다(release:gate 범위 밖).
