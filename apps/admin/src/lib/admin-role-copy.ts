/**
 * 라운드 77 트랙 D(GAP-077 #4) — **통하지 않는 저장 UI를 세우지 않는다.**
 *
 * 어드민 내비에는 역할 제한이 없어 `analyst` 계정도 준비템·링크·고지 문구 화면까지 걸어
 * 들어온다(그리고 그것이 옳다 — 분석가는 그 표를 **읽어야** 한다). 문제는 그 화면들이 역할을
 * `isEditor` 하나로만 읽어 갈래가 둘뿐이었다는 것이다: 편집자면 "검토 요청", **아니면 곧바로
 * 저장**. `analyst`는 "아니면" 쪽에 떨어져 `admin`과 똑같은 저장 UI를 보고, 누르면 서버의
 * 403만 받았다(그 403의 문장은 영문이라 라운드 76 리뷰 M-1이 폴백으로 되돌려 두었는데,
 * 그 폴백도 *"입력값을 확인하고 다시 시도해 주세요"* 라 무엇을 해야 하는지 말하지 못한다).
 *
 * 답은 이 저장소가 **이미 두 번 고른 답**이다(`app/categories/page.tsx`·`app/reviews/page.tsx`):
 * 표와 폼은 그대로 두고 **편집 컨트롤만** 감춘 뒤, 그 자리에 이유를 한 줄 세운다.
 *
 * 이 모듈은 그 한 줄이 사는 **한 자리**다. 종전에는 `app/categories/page.tsx`에 인라인으로
 * 있었고, 화면 셋이 그것을 각자 베끼면 사본이 넷이 된다 — 라운드 75 P-4가 경고한 드리프트의
 * 씨앗이 정확히 그 모양이다. ⚠️ **문자열은 바이트 불변**이다(새 한국어 문구 0건).
 *
 * ⚠️ **이 모듈은 문자열 상수 하나다** — `Record` 표도 배열도 아니라서 라운드 75 트랙 E의
 * 상수 표 전수 스크레이프(`src/admin-canonical-mirrors.test.ts`의 `scrapeConstantTables`)가
 * 세는 단위가 아니다. 그래서 그 대장에도, `NON_MIRROR_CONSTANT_TABLES` 제외 목록에도 새 줄이
 * 필요 없다(그 파일은 이 트랙의 무접촉 대상이다). 여기에 표를 하나라도 더하는 라운드는 그
 * 대장부터 열어야 한다.
 *
 * 관련 계약: `src/admin-write-role-gate.test.ts`(제출 컨트롤의 역할 게이트 전수 · 사본 하나 단언).
 */

/**
 * 쓰기가 `admin` 전용인 화면에서 **조회 권한자에게 서는 한 줄**.
 *
 * 서버 기준과 같은 말을 한다 — 준비템·링크·고지 문구·카테고리의 직접 쓰기는
 * `@RequireAdminRoles("admin")`이고(`apps/api/src/admin/admin.controller.ts` ·
 * `admin-categories.controller.ts`), 편집자는 콘텐츠 검토 경로로 돌아간다
 * (`content-revisions.controller.ts` = `admin, editor`). `analyst`에게 열린 쓰기 경로는 0건이다.
 */
export const ADMIN_WRITE_ROLE_NOTICE = "지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요.";
