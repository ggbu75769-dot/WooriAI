import { randomBytes, randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getSeoulToday } from "@wooriai/domain";
import type { ChildStageCode, ItemStatus, NecessityLevel, ProductPlatform } from "@wooriai/domain";
import { LINK_PRICE_MAX_AGE_DAYS } from "@wooriai/contracts";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isHttpOrHttpsUrl } from "../common/validation/url-scheme";
import { hashClickIp, isAllowedAffiliateUrl, PRODUCT_LINK_NOT_FOUND_ERROR } from "../items-commerce/affiliate-link-guard.util";
import { type StageBandLabel } from "../items-commerce/stage-bands";
import { withCommissionDisclosure } from "../items-commerce/share-disclosure";
import type { LinkHealthStatus } from "../worker/jobs/link-health.job";
import { rankItemsForTab, type ItemTab } from "./item-ranking";
import { ITEM_TIMING_LABEL_MISMATCH_CODE, judgeTimingLabelAgainstStages } from "./timing-label-range";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import { cleanOptionalText, fromDateOnly, toChildDto, type DbClient } from "./store-shared";

type ItemTemplateRow = {
  id: string;
  code: string;
  name: string;
  // 라운드 49 C-02: 준비템이 속한 지출 분류(categories.id). 시드 63개 전부에 값이 있는데도
  // 이 행 타입에 없어서 앱 DTO 조립부에서 존재 자체가 보이지 않았다(Prisma 행에는 늘 있었다).
  categoryId: string | null;
  necessityLevel: NecessityLevel;
  timingLabel: string | null;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  // 라운드 48 T1: 의료/영양제 성격이라 전문가 확인 안내가 필요한 준비템(DNC-020).
  // 스키마(migration 000001)와 시드에는 처음부터 있었지만 어떤 DTO에도 실리지 않아
  // 앱/어드민 어디에서도 볼 수 없던 필드다.
  medicalDisclaimerRequired: boolean;
  displayOrder: number;
  active: boolean;
};

type ItemTemplateWithStages = ItemTemplateRow & { stageCodes: ChildStageCode[] };

type ProductLinkRow = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  displayOrder: number;
  active: boolean;
  // COM-105 link health (migration 000009): "ok" | "broken" | "unstable",
  // null = never checked. Optional so hand-built rows in older code/tests
  // keep compiling; Prisma rows always carry both.
  healthStatus?: string | null;
  healthCheckedAt?: Date | null;
  // 라운드 51 #9 (마이그레이션 000020): 판매처별 가격 스냅샷과 그 **확인 시각**.
  // healthStatus와 같은 이유로 optional이다(예전 코드/테스트의 손수 만든 행 호환).
  // 둘의 관계 규칙은 toProductLinkDto 주석 참고 — 하나만 있으면 둘 다 내보내지 않는다.
  priceSnapshotKrw?: number | null;
  priceCheckedAt?: Date | null;
  // 라운드 64 D(#8): 공개 리다이렉트 `GET /r/:code`가 찾는 그 코드(마이그레이션 000007,
  // NOT NULL UNIQUE). 지금까지 이 컬럼을 읽는 곳은 그 컨트롤러 한 줄뿐이라 라우트가
  // 도달 불가였다 — 어드민 DTO가 실어 주면서 운영이 공유용 URL을 만들 수 있게 된다.
  // healthStatus와 같은 이유로 optional(손수 만든 행 호환); Prisma 행에는 늘 있다.
  redirectCode?: string | null;
};

export type AdminItemTemplateInput = {
  name?: string;
  categoryId?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  priceMinKrw?: number | null;
  priceMaxKrw?: number | null;
  reasonText?: string;
  skipReasonText?: string | null;
  usedSecondhandOk?: boolean;
  safetyNote?: string | null;
  medicalDisclaimerRequired?: boolean;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

/**
 * 라운드 51 #9 메모: 여기에는 가격(priceSnapshotKrw)이 **없다** — 어드민 단건
 * 생성/수정 경로는 가격을 쓰지 않는다. 가격을 쓰는 유일한 어드민 경로는 CSV 벌크
 * 교체(admin/product-link-bulk.service.ts)이고, 그 자리에서 확인 시각(000020)을
 * 함께 남긴다. 언젠가 이 입력에 가격을 더한다면 같은 규칙(가격을 쓸 때만
 * price_checked_at을 now로)을 그 자리에도 붙여야 한다.
 */
export type AdminProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string | null;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string | null;
  active?: boolean;
};

/**
 * TEST-124: 탭 정의(ItemTab)와 탭 술어·정렬은 순수 모듈 item-ranking.ts로 옮겼다.
 * 여기서 다시 내보내는 것은 기존 import 경로(`./items-catalog.service`)를 깨지 않기 위해서다.
 */
export type { ItemTab };

/**
 * UX-W(C1): 링크 헬스 워커(COM-105, LinkHealthJob)가 product_links.health_status에
 * 남긴 판정을 앱 상세의 링크 **순서**에만 반영하는 강등 표다. 값이 클수록 뒤로 간다.
 *
 * 왜 필요한가: 워커는 죽은 링크를 이미 알고 있는데 앱 경로는 그 값을 읽지 않아서,
 * displayOrder가 가장 앞인 링크가 깨져 있으면 사용자는 매번 첫 줄에서 404를 만난다.
 * (핵심 루프의 "구매 링크 클릭"이 그 자리에서 끊긴다.)
 *
 * 등급 근거:
 *  - broken(2): 4xx 또는 5홉 초과 리디렉트 = **확정된 죽은 링크**. 맨 뒤로 보낸다.
 *  - unstable(1): 5xx·타임아웃·네트워크 오류 = 일시적일 수 있고 워커가 다음 회차에
 *    바로 재확인한다(link-health.job.ts의 후보 조건). 그래서 broken처럼 맨 뒤로
 *    내리지 않고 그 **중간**에 둔다 — 살아 있을 가능성이 높은 링크를 죽은 링크와
 *    같은 취급으로 벌주지 않으면서, 방금 도달 실패한 링크를 "정상 확인됨"보다는
 *    뒤에 둔다.
 *  - ok / null(미확인) / 미지의 값(0): 문제의 근거가 없으므로 큐레이션 순서를 그대로
 *    둔다. 미확인을 ok보다 뒤로 내리면, 워커가 꺼져 있거나(LINK_HEALTH_ENABLED 기본
 *    off) 일부만 확인된 흔한 상태에서 이득 없이 어드민이 정한 순서만 흐트러진다.
 *
 * DNC-009 무관: 이건 추천 **점수**가 아니라 사용자 보호용 표시 순서다. 수수료율·제휴
 * 여부는 이 계산에 전혀 들어가지 않고(입력은 health_status 하나), 응답 필드와 링크
 * 개수도 그대로다 — toProductLinkDto는 health를 노출하지 않는다(계약 무변경).
 */
const PRODUCT_LINK_HEALTH_DEMOTION: Record<string, number> = { unstable: 1, broken: 2 };

function productLinkHealthRank(healthStatus: string | null | undefined): number {
  return PRODUCT_LINK_HEALTH_DEMOTION[healthStatus ?? ""] ?? 0;
}

/**
 * 앱 상세용 링크 정렬: 헬스 강등 등급을 1순위로 두고, **같은 등급 안에서는
 * displayOrder 순서를 그대로** 유지한다(어드민이 정한 큐레이션 순서 보존).
 * 전부 ok/미확인이면 결과는 종전과 완전히 동일하다.
 */
function sortProductLinksForApp<T extends { displayOrder: number; healthStatus?: string | null }>(links: T[]): T[] {
  return [...links].sort(
    (left, right) =>
      productLinkHealthRank(left.healthStatus) - productLinkHealthRank(right.healthStatus) ||
      left.displayOrder - right.displayOrder
  );
}

const MILLIS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" → 그 날 자정(UTC)의 밀리초. 형식이 어긋나면 null. */
function dayMillis(dateOnly: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const millis = Date.UTC(Number(dateOnly.slice(0, 4)), Number(dateOnly.slice(5, 7)) - 1, Number(dateOnly.slice(8, 10)));
  return Number.isFinite(millis) ? millis : null;
}

/**
 * 라운드 64 D(#4) — 이 가격 스냅샷이 **앱에서 이미 보이지 않는 나이**인가.
 *
 * 앱은 확인한 지 `LINK_PRICE_MAX_AGE_DAYS`(계약)를 넘긴 스냅샷을 아예 그리지 않는다
 * (apps/mobile/src/items/link-price.ts 규칙 5). 그 판정은 정직하지만 **아무에게도
 * 보고되지 않았다** — 어느 날부터 가격 비교가 통째로 비어도 운영은 알 길이 없었다.
 * 이 술어의 결과만 어드민 DTO에 실어(숫자는 싣지 않는다) 표가 그 사실을 말하게 한다.
 *
 * 앱과 같은 **서울 달력 날짜 단위**로 센다(UTC 시각을 기기/서버 타임존으로 읽으면 하루가
 * 밀리고, 만료 경계에서 하루 오차는 곧 틀린 표시다). 시각이 없으면 만료가 아니라
 * **모름**이므로 false다 — "시각 없음"은 화면이 따로 이름으로 말한다(가격만 있고 시각이
 * 없는 링크는 앱에 애초에 실리지 않는다는 사실도 같은 자리에서 보여야 한다).
 * 오늘을 해석할 수 없거나 미래 시각이면 만료로 부르지 않는다(모르는 것을 단정하지 않는다).
 */
function isPriceSnapshotExpired(priceCheckedAt: Date | null | undefined, today: string = getSeoulToday()): boolean {
  if (!priceCheckedAt) return false;
  let checkedDay: string;
  try {
    checkedDay = getSeoulToday(priceCheckedAt);
  } catch {
    return false;
  }
  const checkedMillis = dayMillis(checkedDay);
  const todayMillis = dayMillis(today.slice(0, 10));
  if (checkedMillis === null || todayMillis === null) return false;
  const ageDays = (todayMillis - checkedMillis) / MILLIS_PER_DAY;
  if (ageDays < 0) return false;
  return ageDays > LINK_PRICE_MAX_AGE_DAYS;
}

/**
 * 라운드 64 D(#8) — 공개 리다이렉트(`GET /api/v1/r/:code`)의 공유용 절대 URL.
 *
 * 라운드 67 #4: 소비자가 둘이 됐다 — 어드민 링크 표의 복사 버튼(`toAdminProductLinkDto`)과
 * **앱의 클릭 응답**(`clickProductLink`의 `shareUrl`). 조립을 한 자리에 두는 이유는 아래
 * 그대로이고, 앱도 서버가 만든 문자열을 **그대로** 싣는다(앱에서 조립 0건).
 *
 * 베이스 URL 관례는 가족 초대 링크가 이미 쓰는 것 그대로다
 * (`INVITE_LINK_BASE_URL`, 미설정 시 dev 플레이스홀더 —
 * apps/api/src/households/household-runtime.service.ts createInvite ·
 * scripts/check-env.ts). 조립을 **서버가** 하는 이유: 이 값은 API 프로세스의 환경변수라
 * 어드민 번들(브라우저)에서는 읽을 수 없고, 어드민 오리진(`/api/v1`만 리라이트한다)에
 * 붙여 만들면 API가 아닌 곳을 가리키는 죽은 링크가 나간다.
 *
 * 라운드 64 C-1 — 경로에 **`/api/v1`이 들어간다**. 종전 조립(`${base}/r/${code}`)은 존재하지
 * 않는 경로를 가리켰다: `AffiliateRedirectController`는 `@Controller("r")`이고 전역 프리픽스
 * 예외 목록(bootstrap.ts `setGlobalPrefix("api/v1", { exclude: ["invite/:token"] })`)에는
 * 초대 랜딩만 있어서, 실제로 응답하는 라우트는 `/api/v1/r/:code` 하나뿐이다 — e2e 6곳과
 * 스모크(scripts/qa/server-smoke.sh), 레이트리밋 주석까지 전부 그 경로를 전제한다.
 * 그래서 운영이 복사해 뿌린 URL은 전부 404였고, 도달 불가를 고치려던 기능이 도달 불가인
 * 주소를 내보내고 있었다.
 *
 * 초대 링크처럼 프리픽스 없는 **짧은 URL**로 개통하는 선택지는 라우트를 바꾸는 일이라(공개
 * 경로를 하나 더 여는 별도 판단) 여기서 하지 않는다. 여기서는 **지금 실제로 응답하는 경로**를
 * 가리키게만 고친다 — 라우트·프리픽스 예외는 그대로다.
 */
function publicRedirectShareUrl(redirectCode: string): string {
  const base = (process.env.INVITE_LINK_BASE_URL ?? "https://wooriai.local").replace(/\/+$/, "");
  return `${base}/api/v1/r/${redirectCode}`;
}

/**
 * `health_status`의 "확정된 죽은 링크" 값. 워커가 적는 문자열 그대로다
 * (worker/jobs/link-health.job.ts의 `LinkHealthStatus` — 4xx 또는 5홉 초과 리디렉트).
 * 정렬 강등표(`PRODUCT_LINK_HEALTH_DEMOTION`)가 같은 값을 키로 쓰지만, 그 표는 이번 변경의
 * 무접촉 대상이라 여기서 상수 하나를 따로 세운다(표의 등급 구성은 한 글자도 바뀌지 않는다).
 *
 * 라운드 68 리뷰 S-2: 타입 주석은 워커의 `LinkHealthStatus`다 — 그 유니온에서 값 하나가
 * 사라지거나 이름이 바뀌면 여기가 **컴파일 타임에** 터진다(문자열 리터럴로 두면 조용히 아무
 * 링크도 막지 않는 상태가 된다). type-only import라 런타임 결합은 0이다(워커 모듈은 이 경로로
 * 적재되지 않는다).
 */
const PRODUCT_LINK_HEALTH_BROKEN: LinkHealthStatus = "broken";

/**
 * 라운드 76 트랙 E — 어드민이 시기를 하나도 고르지 않고 준비템을 만들 때 서는 기본 스테이지.
 *
 * 종전에는 `adminCreateItemTemplate` 안에 리터럴로 박혀 있었다. 값은 한 글자도 바뀌지 않고,
 * 이름이 생긴 이유는 둘이다: ⓐ 저장 경로의 "준비 시기" 판정이 **실제로 저장될 시기 집합**을
 * 봐야 하고(생성에서 시기가 비면 그 집합이 이 기본값이다), ⓑ 검토(초안) 경로가 발행 시점과
 * **같은 기본값**으로 판정해야 우회로가 생기지 않는다(admin/content-revisions.service.ts).
 */
export const DEFAULT_ADMIN_ITEM_STAGE_CODES: ChildStageCode[] = ["infant_4_6"];

/**
 * 라운드 76 트랙 E — **"준비 시기"가 시기 선택과 명백히 어긋나면 그 자리에서 400.**
 *
 * 판정 자체는 `timing-label-range.ts`(순수 모듈 · 시드 계약과 같은 로직)가 하고, 여기서는 그
 * 사유를 HTTP 모양으로 바꾸기만 한다. 저장 경로와 검토(초안) 경로가 **같은 이 함수**를 부른다
 * — 검토가 우회로가 되지 않게 하려면 사유를 만드는 자리가 하나여야 한다.
 *
 * ⚠️ 메시지는 어긋난 구간을 그대로 말하고 **재시도를 권하지 않는다**: 운영자가 값을 고쳐야만
 * 통과하는 유일한 실패라 "다시 시도해 주세요"는 거짓 안내가 된다(R19-F와 같은 판단).
 * ⚠️ 빈 라벨·파싱되지 않는 라벨(서술·임신·세 표기)은 판정 대상이 아니라 오늘과 똑같이 저장된다.
 */
export function requireTimingLabelMatchesStages(timingLabel: string | null | undefined, stageCodes: readonly string[]) {
  const mismatch = judgeTimingLabelAgainstStages(timingLabel, stageCodes);
  if (!mismatch) return;
  throw new BadRequestException({
    code: ITEM_TIMING_LABEL_MISMATCH_CODE,
    message: mismatch.message,
    details: { reason: mismatch.reason }
  });
}

/**
 * 라운드 68 C(#4) — **밖으로 내보내도 되는 주소인가.**
 *
 * 라운드 64 S-1·67 #4가 쓴 그 문장을 한 칸 넓힌 것이다: "누르면 404가 나는 주소는 내보내지
 * 않는다." 지금까지 그 규율은 `active`(= 어드민이 내렸는가) 하나에만 걸려 있었는데, 우리에게는
 * **더 강한 근거**가 이미 있다 — `health_status = "broken"`은 워커가 실제로 눌러 보고 4xx(또는
 * 5홉 초과 리디렉트)를 받은 링크다. 어드민이 아직 내리지 않았을 뿐 그 주소는 죽어 있고, 그것을
 * `/r/:code`로 감싸 카카오톡으로 내보내면 **우리 도메인을 거쳐 죽은 주소에 데려다 놓으면서**
 * `affiliate_clicks`에 익명 행까지 남긴다(있지도 않은 유입을 우리 숫자로 센다).
 *
 * 멈추는 것은 **밖으로 나가는 사본 하나뿐**이다. 여는 URL(`redirectUrl`)·링크 목록·개수·정렬은
 * 한 글자도 바뀌지 않고, 링크를 목록에서 감추지도 않는다: 워커는 기본 off이고
 * (`LINK_HEALTH_ENABLED`), 판정이 묵었거나 틀릴 수 있으며(정상 쇼핑몰에서도 5홉 초과가 난다),
 * 감추는 순간 "그런 판매처가 없다"는 **없는 사실**을 말하게 된다. `toProductLinkDto`에 health를
 * 노출하지도 않는다(계약 무변경 — "깨졌어요" 배지는 24시간 묵은 판정으로 판매처를 공개 비난하는
 * 표시다).
 *
 * `unstable`은 막지 않는다 — 5xx·타임아웃·네트워크 오류라 일시적일 수 있고 워커가 다음 회차에
 * 바로 재확인한다. 강등표의 등급 근거와 **같은 판단**이다: 살아 있을 가능성이 높은 링크를 죽은
 * 링크와 같은 취급으로 벌주지 않는다.
 *
 * ⚠️ **`LINK_HEALTH_ENABLED`가 꺼진 배포에서는 이 함수가 아무것도 바꾸지 않는다** —
 * `health_status`가 전부 null이라 모든 링크가 종전대로 공유 URL을 받는다. 그것이 오늘의 운영
 * 기본값이고, 어드민도 그 상태를 정직하게 말하고 있다(`worker-health-view.ts` — "링크 검사:
 * 꺼짐(LINK_HEALTH_ENABLED=0)"). 이 변경이 실제로 무언가를 막으려면 워커를 켜야 한다.
 *
 * 앱은 이 값이 없으면 **공유 버튼 자체를 내린다**(app/items/[itemTemplateId].tsx의
 * `canSharePurchaseLink`). 원문 제휴 URL로 떨어지는 폴백은 두지 않는다 — 그것은 라운드 67 #4가
 * 없애려던 바로 그 값이고(집계에 남지 않고, 어드민이 내려도 회수할 수 없다), 여기서는 **우리가
 * 죽은 줄 아는 주소**이기까지 하다. 공유할 수 있는 주소가 없다는 것이 사실이므로, 없는 것을
 * 대신 지어내지 않는다.
 *
 * 어드민 표의 복사 버튼(`toAdminProductLinkDto.redirectShareUrl`)은 **무접촉**이다: 운영은 죽은
 * 링크를 직접 눌러 봐야 하고, 그 표에는 판정이 이미 열로 서 있어(`healthStatus` — broken 필터도
 * 있다) 앱에서 무슨 일이 벌어지는지 읽을 수 있다. 가격 열(`priceExpired`)이 "앱에는 이미 보이지
 * 않는다"를 어드민에만 말하게 한 것과 같은 자리다.
 *
 * 라운드 68 리뷰 S-1: `healthStatus`는 **선택이 아니라 필수**다(값은 여전히 `null` 가능 —
 * 미확인이라는 사실이다). optional이면 그 열을 빼먹은 `select`가 조용히 통과하고, 이 함수는
 * 모든 링크를 "broken 아님"으로 읽어 죽은 주소를 다시 내보내게 된다. 필수로 두면 그 실수가
 * 컴파일 타임에 잡힌다.
 */
function shareableRedirectUrl(link: { redirectCode: string | null; healthStatus: string | null }): string | undefined {
  if (!link.redirectCode) return undefined;
  if (link.healthStatus === PRODUCT_LINK_HEALTH_BROKEN) return undefined;
  return publicRedirectShareUrl(link.redirectCode);
}

function priceBandText(priceMinKrw: number | null, priceMaxKrw: number | null) {
  if (priceMinKrw == null && priceMaxKrw == null) {
    return undefined;
  }
  if (priceMinKrw != null && priceMaxKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}~${priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  if (priceMinKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}원부터`;
  }
  return `${priceMaxKrw!.toLocaleString("ko-KR")}원 이하`;
}

/**
 * REF-118: preparation-item catalog + commerce surface split out of the former
 * onboarding-store.service.ts god service — stage-filtered item tabs, item
 * detail with product links, per-child item status, affiliate click logging
 * (COM-106 allowlist behavior unchanged), and the admin catalog CRUD
 * (item templates, product links, disclosures, click summary). Public HTTP
 * contract, error codes and response shapes are unchanged.
 */
@Injectable()
export class ItemsCatalogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(ExpensesStoreService) private readonly expensesStore: ExpensesStoreService
  ) {}

  /**
   * ITEM-121: `stageBand`는 선택적이다.
   * - 생략(기존 호출자 전부): 아이의 **현재 단계** 기준 — 종전 동작 그대로다.
   * - 지정: 그 **시기 밴드** 기준 — 현재 단계와 다른 시기의 준비물도 미리 볼 수 있고
   *   (예비 부모의 "다음 시기 미리 보기"), prepared/not_needed 탭도 같은 밴드로 좁힌다.
   *   단 tab="all"(전 상태 스냅샷)은 밴드를 무시한다 — item-ranking.ts의 FIX/F4 참고.
   */
  async listItems(user: AuthenticatedUser, childId: string, tab: ItemTab = "now", stageBand?: StageBandLabel) {
    await this.childAccess.requireChildAccess(user, childId);
    const items = await this.itemsForChild(childId, tab, stageBand);
    return { items: items.map(({ item, status }) => this.toItemSummaryDto(item, status)) };
  }

  async getItemDetail(user: AuthenticatedUser, childId: string, itemTemplateId: string) {
    await this.childAccess.requireChildAccess(user, childId);
    const item = await this.requireItemTemplate(itemTemplateId);
    // 라운드 49 C-04: 상태와 연결된 지출 id를 **한 번에** 읽는다(예전 itemStatusFor와 같은
    // 조회 1건 — select에 컬럼 하나가 더해질 뿐이다).
    const statusRow = await this.itemStatusRowFor(childId, itemTemplateId);
    const status = statusRow.status;
    const linkedExpense = await this.linkedExpenseDto(childId, statusRow.expenseId);
    const linkRows = await this.prisma.productLink.findMany({
      where: { itemTemplateId: item.id, active: true },
      orderBy: { displayOrder: "asc" }
    });
    // UX-W(C1): 깨진 링크를 뒤로 보낸다. 집합·개수·필드는 그대로이고 순서만 바뀐다 —
    // 근거는 PRODUCT_LINK_HEALTH_DEMOTION 주석.
    const links = sortProductLinksForApp(linkRows);
    const disclosures = await this.disclosuresByKey();

    return {
      ...this.toItemSummaryDto(item, status),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      // 라운드 48 T1: 앱 상세가 "구매 전 의사·약사와 상담해 주세요" 안내를 그릴 근거
      // (DNC-020). 가산 필드라 구버전 클라이언트는 무영향이다.
      medicalDisclaimerRequired: item.medicalDisclaimerRequired,
      // 라운드 49 C-04: 이 준비템으로 실제 기록한 지출(없으면 null). 지금까지 연결은
      // child_item_statuses.expense_id에 쌓이기만 하고 어느 응답에도 없어서, 앱에서는
      // "지출 → 준비템"만 보이고 그 반대 방향은 볼 길이 없었다(핵심 루프의 마지막 확인).
      linkedExpense,
      productLinks: links.map((link) => this.toProductLinkDto(link, disclosures))
    };
  }

  async updateItemStatus(user: AuthenticatedUser, childId: string, itemTemplateId: string, status: ItemStatus, expenseId?: string) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const item = await this.requireItemTemplate(itemTemplateId);
    if (expenseId) {
      await this.expensesStore.requireExpenseBelongsToChild(user, expenseId, childId);
    }
    await this.setChildItemStatus(user, childId, itemTemplateId, status, expenseId);
    return this.toItemSummaryDto(item, status);
  }

  async clickProductLink(
    user: AuthenticatedUser,
    productLinkId: string,
    input: { childId: string; referrerScreenId?: string },
    requestMeta?: { ip?: string; userAgent?: string }
  ) {
    const child = await this.childAccess.requireChildAccess(user, input.childId);
    const productLink = await this.prisma.productLink.findFirst({ where: { id: productLinkId, active: true } });
    if (!productLink) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "상품 링크를 찾을 수 없어요." });
    }
    await this.requireItemTemplate(productLink.itemTemplateId);

    const redirectUrl = productLink.affiliateUrl ?? productLink.url;
    this.requireHttpUrl(redirectUrl);
    // COM-106: same allowlist check as the public GET /r/:code redirect (§4). A disallowed
    // domain returns the same 404 as "link not found" — see PRODUCT_LINK_NOT_FOUND_ERROR's
    // doc comment for why the codes are unified — and the click is not logged.
    if (!isAllowedAffiliateUrl(redirectUrl)) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }

    // 라운드 64 S-4: 고지 문구 조회를 **쓰기 앞**으로 옮긴다. 순수 읽기라(디스클로저 테이블
    // 조회 한 건 — 클릭 행과 아무 관계가 없다) 순서를 바꿔도 결과가 같지만, 뒤에 두면 조회가
    // 실패했을 때 클릭은 이미 기록된 채로 500이 나간다: 사용자는 링크를 못 열고, 집계에는
    // 열린 적 없는 클릭이 쌓인다(허위 수치). 앞에 두면 실패가 "클릭 없음 + 500"으로 정직해진다.
    const disclosureText = await this.resolveClickDisclosureText(productLink);

    // subId is a self-generated uuid (never derived from user/child identifiers) reused as
    // the row's own id, per round5a-sprint2-plan.md §4's "subId=clickId — PII 금지".
    const clickId = randomUUID();
    const click = await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        userId: user.id,
        householdId: child.householdId,
        childId: input.childId,
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        referrerScreenId: input.referrerScreenId,
        subId: clickId,
        ipHash: hashClickIp(requestMeta?.ip),
        userAgent: requestMeta?.userAgent ?? null
      }
    });

    return {
      clickId: click.id,
      redirectUrl,
      // 라운드 64 D(#5ⓑ): 이 응답만 **종별 기본 고지**를 지나지 않았다. 목록/상세 DTO와
      // 어드민 DTO는 둘 다 `defaultDisclosureFor`를 지나 링크의 `disclosure_text`가 비면
      // 어드민이 관리하는 기본 문구(affiliate_purchase / sponsored_product)로 채워 주는데,
      // 클릭 응답은 저장된 값만 실었다. 재현 조건은 이상 상황이 아니라 **운영의 정상
      // 경로**다: 어드민이 제휴 링크를 만들며 문구 칸을 비우고 고지 CMS의 기본값에
      // 기대는 것(그러라고 만든 기능이다). 그 순간 상세 목록은 고지를 말하고, 바로 그
      // 링크를 눌러 뜨는 확인 카드는 고지 대신 "구매 링크"라고만 썼다 — 구매 CTA에
      // 가장 가까운 자리에서 고지가 사라지는 DNC-010 위반이다.
      //
      // 고지 대상이 아닌 일반 링크는 **종전 그대로 undefined**다(없는 고지를 지어내지
      // 않는다). 그 경우 조회를 아예 하지 않으므로 클릭 경로에 쿼리가 늘지도 않는다.
      disclosureText,
      /**
       * GAP-067 #4 — 앱이 **밖으로 내보내는** URL. 여는 URL(`redirectUrl`)과는 다른 값이다.
       *
       * 고치는 문제: 링크를 열지 못했을 때 뜨는 카드의 "링크 공유하기"가 `redirectUrl`
       * (= 저장된 원문 제휴 URL)을 그대로 카카오톡으로 내보냈다. 그러면 ⓐ 그 사본으로 산
       * 구매는 `affiliate_clicks`에 아무 흔적이 없고(우리가 만든 유입인데 우리 숫자에는
       * 없다), ⓑ 어드민이 깨진 링크를 `active=false`로 내려도 이미 나간 사본은 **영원히
       * 산다** — 운영이 링크를 회수할 수단이 앱 안에만 있었다.
       *
       * `/api/v1/r/:code`를 지나면 둘 다 닫힌다: 그 클릭은 익명 행으로 집계에 남고
       * (마이그레이션 000008이 user/household/child를 nullable로 만든 이유가 그것이다),
       * 내려간 링크는 그 순간부터 404다(redirect.controller.ts는 `active: true`만 302로 보낸다).
       *
       * **여는 URL은 바꾸지 않는다** — 앱이 `/r/`로 직접 열면 이 클릭 행과 리다이렉트가
       * 만드는 익명 행이 겹쳐 한 번의 클릭이 두 번 세어진다(허위 수치).
       *
       * 라운드 64 S-1과 **같은 규율**: 누르면 404가 나는 주소는 내보내지 않는다. 여기서
       * `active`를 다시 보지 않는 이유는 위 조회가 이미 `active: true`로 좁혔기 때문이다
       * (비활성 링크의 클릭은 PRODUCT_LINK_NOT_FOUND로 끝난다). 조립은 어드민 DTO와 **같은
       * 함수 한 자리**다(앱에서 잇지 않는다).
       *
       * 라운드 68 C(#4) — 그 규율에 **`health_status`가 함께 걸린다**: 워커가 눌러 보고 4xx를
       * 받은 링크(`broken`)는 어드민이 아직 내리지 않았어도 죽은 주소다. 판정과 그 경계
       * (unstable은 막지 않는 이유 · 워커가 꺼진 배포에서는 아무것도 달라지지 않는다는 사실 ·
       * 앱이 폴백 대신 버튼을 내리는 이유)는 `shareableRedirectUrl` 머리말에 있다.
       */
      shareUrl: shareableRedirectUrl(productLink)
    };
  }

  /** 클릭 응답의 고지 문구. 저장된 재정의가 없고 고지 대상일 때만 기본 문구를 읽는다. */
  private async resolveClickDisclosureText(link: {
    disclosureText: string | null;
    isAffiliate: boolean;
    isSponsored: boolean;
  }): Promise<string | undefined> {
    if (link.disclosureText) return link.disclosureText;
    if (!link.isAffiliate && !link.isSponsored) return undefined;
    return this.defaultDisclosureFor(link, await this.disclosuresByKey());
  }

  /**
   * Stage-sorted "now" tab summaries, consumed by ReportingStoreService.getHome.
   *
   * ⚠️ 호출 전 접근검증 필수 (FIX-118B/F5): REF-118 분리 때 다른 서비스가 쓰려고
   * public이 된 childId 기반 조회다 — `user` 인자가 없고 권한 확인도 하지
   * 않는다. 호출자가 먼저 ChildAccessService.requireChildAccess를 통과시켜야
   * 한다(getHome이 그 규약을 지킨다). listItems처럼 user를 받는 메서드는 스스로
   * 확인하므로 이 경고 대상이 아니다.
   */
  async recommendedItemsForChild(childId: string) {
    const items = await this.itemsForChild(childId, "now");
    return items.map(({ item, status }) => this.toItemSummaryDto(item, status));
  }

  // ---------------------------------------------------------------------------
  // admin catalog
  // ---------------------------------------------------------------------------

  async adminListItemTemplates() {
    const items = await this.listItemTemplatesWithStages(false);
    const links = await this.prisma.productLink.findMany();
    const disclosures = await this.disclosuresByKey();
    const linksByItem = this.groupBy(links, (link) => link.itemTemplateId);
    // 라운드 64 정보 반영: "오늘"은 목록당 **한 번** 정한다 — 행마다 다시 계산하면 낭비일 뿐
    // 아니라, 자정을 걸친 큰 목록에서 앞줄과 뒷줄의 만료 판정 기준일이 갈릴 수 있다.
    const today = getSeoulToday();
    return {
      items: items.map((item) => this.toAdminItemDetailDto(item, linksByItem.get(item.id) ?? [], disclosures, today))
    };
  }

  async adminCreateItemTemplate(input: AdminItemTemplateInput) {
    const normalized = this.normalizeAdminItemTemplateInput(input, {});
    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.itemTemplate.create({
        data: {
          code: `admin_${Date.now()}_${randomBytes(3).toString("hex")}`,
          name: normalized.name!,
          categoryId: input.categoryId ?? null,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          medicalDisclaimerRequired: normalized.medicalDisclaimerRequired ?? false,
          displayOrder: await this.nextItemDisplayOrder(tx),
          active: normalized.active ?? true
        }
      });
      await this.replaceItemTemplateStages(tx, item.id, normalized.stageCodes ?? DEFAULT_ADMIN_ITEM_STAGE_CODES);
      return item;
    });

    const withStages = await this.requireItemTemplateAnyStatus(created.id);
    return this.toAdminItemDetailDto(withStages, [], await this.disclosuresByKey());
  }

  async adminUpdateItemTemplate(itemTemplateId: string, input: AdminItemTemplateInput) {
    const item = await this.requireItemTemplateAnyStatus(itemTemplateId);
    const normalized = this.normalizeAdminItemTemplateInput(input, item);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.itemTemplate.update({
        where: { id: itemTemplateId },
        data: {
          name: normalized.name!,
          categoryId: input.categoryId ?? undefined,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          medicalDisclaimerRequired: normalized.medicalDisclaimerRequired ?? false,
          active: normalized.active ?? true
        }
      });
      if (normalized.stageCodes) {
        await this.replaceItemTemplateStages(tx, itemTemplateId, normalized.stageCodes);
      }
      return row;
    });

    const withStages = await this.requireItemTemplateAnyStatus(updated.id);
    const links = await this.prisma.productLink.findMany({ where: { itemTemplateId } });
    return this.toAdminItemDetailDto(withStages, links, await this.disclosuresByKey());
  }

  async adminListProductLinks() {
    // UX-X(R43) C7: 어드민 목록 정렬 고정 — 준비템별로 묶고 그 안에서는 노출 순서대로.
    // 종전에는 정렬이 없어 같은 준비템의 링크들이 표 곳곳에 흩어져 보였다(DB 반환
    // 순서에 의존). 결과 집합은 그대로이고 순서만 결정적이 된다.
    const links = await this.prisma.productLink.findMany({
      orderBy: [{ itemTemplateId: "asc" }, { displayOrder: "asc" }]
    });
    const disclosures = await this.disclosuresByKey();
    // 라운드 64 정보 반영: 만료 판정의 기준일은 목록당 한 번만 읽는다(행마다 getSeoulToday()를
    // 부르면 자정 경계에서 같은 응답 안의 행들이 서로 다른 "오늘"로 판정될 수 있다).
    const today = getSeoulToday();
    return { links: links.map((link) => this.toAdminProductLinkDto(link, disclosures, today)) };
  }

  async adminCreateProductLink(input: AdminProductLinkInput) {
    if (!input.itemTemplateId) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template is required." });
    }
    await this.requireItemTemplateAnyStatus(input.itemTemplateId);
    if (!input.platform || !input.title?.trim() || !input.url?.trim()) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(input.url);
    if (input.affiliateUrl) {
      this.requireHttpUrl(input.affiliateUrl);
    }

    const link = await this.prisma.productLink.create({
      data: {
        itemTemplateId: input.itemTemplateId,
        platform: input.platform,
        title: input.title.trim(),
        url: input.url.trim(),
        affiliateUrl: cleanOptionalText(input.affiliateUrl ?? undefined),
        isAffiliate: input.isAffiliate ?? false,
        isSponsored: input.isSponsored ?? false,
        disclosureText: cleanOptionalText(input.disclosureText ?? undefined),
        displayOrder: await this.nextProductLinkDisplayOrder(input.itemTemplateId),
        active: input.active ?? true
      }
    });
    return this.toAdminProductLinkDto(link, await this.disclosuresByKey());
  }

  async adminUpdateProductLink(productLinkId: string, input: AdminProductLinkInput) {
    const current = await this.requireProductLinkAnyStatus(productLinkId);
    const itemTemplateId = input.itemTemplateId ?? current.itemTemplateId;
    await this.requireItemTemplateAnyStatus(itemTemplateId);

    const title = input.title === undefined ? current.title : input.title.trim();
    const url = input.url === undefined ? current.url : input.url.trim();
    if (!title || !url) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(url);
    const affiliateUrl =
      input.affiliateUrl === undefined ? current.affiliateUrl : cleanOptionalText(input.affiliateUrl ?? undefined);
    if (affiliateUrl) {
      this.requireHttpUrl(affiliateUrl);
    }

    const updated = await this.prisma.productLink.update({
      where: { id: productLinkId },
      data: {
        itemTemplateId,
        platform: input.platform ?? current.platform,
        title,
        url,
        affiliateUrl,
        isAffiliate: input.isAffiliate ?? current.isAffiliate,
        isSponsored: input.isSponsored ?? current.isSponsored,
        disclosureText:
          input.disclosureText === undefined ? current.disclosureText : cleanOptionalText(input.disclosureText ?? undefined),
        active: input.active ?? current.active
      }
    });
    return this.toAdminProductLinkDto(updated, await this.disclosuresByKey());
  }

  async adminListDisclosures() {
    const rows = await this.prisma.disclosure.findMany({ orderBy: { key: "asc" } });
    return { disclosures: rows.map((row) => ({ key: row.key, text: row.text })) };
  }

  async adminUpdateDisclosure(key: string, text: string) {
    const cleanedText = text.trim();
    if (!cleanedText) {
      throw new BadRequestException({ code: "ADMIN_DISCLOSURE_REQUIRED", message: "Disclosure text is required." });
    }
    const row = await this.prisma.disclosure.upsert({
      where: { key },
      update: { text: cleanedText },
      create: { key, text: cleanedText }
    });
    return { key: row.key, text: row.text };
  }

  async adminAffiliateClickSummary() {
    const grouped = await this.prisma.affiliateClick.groupBy({
      by: ["platform"],
      _count: { _all: true }
    });
    const totalClicks = grouped.reduce((sum, group) => sum + group._count._all, 0);
    return {
      totalClicks,
      byPlatform: grouped.map((group) => ({ platform: group.platform, count: group._count._all }))
    };
  }

  // ---------------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------------

  private async requireItemTemplate(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item || !item.active) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "준비템을 찾을 수 없어요." });
    }
    return item;
  }

  private async requireItemTemplateAnyStatus(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
    }
    return item;
  }

  private async requireProductLinkAnyStatus(productLinkId: string): Promise<ProductLinkRow> {
    const link = await this.prisma.productLink.findUnique({ where: { id: productLinkId } });
    if (!link) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
    }
    return link;
  }

  private async itemTemplateWithStages(itemTemplateId: string): Promise<ItemTemplateWithStages | null> {
    const item = await this.prisma.itemTemplate.findUnique({ where: { id: itemTemplateId } });
    if (!item) return null;
    // GAP-072 트랙 D: `priorityWeight`가 오늘 정하는 것은 **이 배열 안의 순서 하나뿐**이다
    // (쓰는 쪽이 전부 `stageCodes.length - index`라 작성자가 적은 순서를 되감을 뿐이다).
    // 항목 간 순위는 rankItemsForTab이 정하고 그 경로는 이 값을 읽지 않는다 —
    // 선언은 schema.prisma의 `priorityWeight` 주석에 있다.
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId },
      orderBy: { priorityWeight: "desc" }
    });
    return { ...item, stageCodes: stages.map((stage) => stage.stageCode) };
  }

  private async listItemTemplatesWithStages(activeOnly: boolean): Promise<ItemTemplateWithStages[]> {
    const items = await this.prisma.itemTemplate.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { displayOrder: "asc" }
    });
    if (items.length === 0) return [];
    // GAP-072 트랙 D: 위 itemTemplateWithStages와 같다 — `priorityWeight`는 `stageCodes`
    // 배열의 순서만 복원하고, 목록의 항목 순서는 `orderBy: { displayOrder: "asc" }`(바로 위)와
    // rankItemsForTab이 정한다.
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId: { in: items.map((item) => item.id) } },
      orderBy: { priorityWeight: "desc" }
    });
    const stagesByItem = this.groupBy(stages, (stage) => stage.itemTemplateId);
    return items.map((item) => ({
      ...item,
      stageCodes: (stagesByItem.get(item.id) ?? []).map((stage) => stage.stageCode)
    }));
  }

  private toItemSummaryDto(item: ItemTemplateWithStages, status: ItemStatus) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status,
      // 라운드 49 C-02: 준비템 → 지출 기록 프리필이 분류까지 넘길 수 있게 하는 가산 필드.
      // timingLabel과 같은 관례로 null은 undefined로 정리한다(계약 uuid().optional()).
      // 금액은 싣지 않는다 — priceBandText는 범위라 특정 값을 프리필하면 지어낸 값이 된다.
      categoryId: item.categoryId ?? undefined,
      // CON-115: DB에서 null인 timingLabel은 undefined로 정리해 계약(z.string().optional())과
      // 모바일 타입(timingLabel?: string)에 맞춘다 — null이 그대로 나가면 계약 위반.
      timingLabel: item.timingLabel ?? undefined,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      stageCodes: item.stageCodes
    };
  }

  /**
   * 라운드 51 #9 — 판매처별 가격의 **정직한** 노출 규칙(계약만; 화면 배선은 다음 라운드).
   *
   * `price_snapshot_krw`는 DB·어드민 CSV·시드에 전부터 있었지만 앱 응답에는 실리지
   * 않았다. 스냅샷 가격은 "언젠가 확인한 값"이라, 언제 확인했는지를 함께 말하지 않으면
   * 사용자는 그것을 현재가로 읽는다 — 그 자체가 허위 표시다. 그래서 서버가 다음 규칙을
   * **강제**한다(둘 중 하나라도 없으면 둘 다 생략):
   *
   *   priceCheckedAt이 null이면 priceSnapshotKrw도 내려보내지 않는다.
   *   priceSnapshotKrw가 null이면 priceCheckedAt도 내려보내지 않는다(홀로 남은 시각은
   *   가리킬 값이 없다).
   *
   * 클라이언트가 "가격은 있는데 시각이 없으니 그냥 보여주자"를 고를 수 없도록 이 판단을
   * 화면이 아니라 여기 한 곳에 둔다. product-link-price-honesty.e2e.test.ts가 세 조합
   * (둘 다 있음 / 가격만 / 시각만)을 고정한다.
   *
   * DNC-009: 이 값들은 **표시용**이다. 준비템 추천·정렬(item-ranking.ts)은 링크를 아예
   * 보지 않으며(RankableItem에 가격 필드가 없다), 링크 정렬도 displayOrder와 헬스
   * 강등만 본다 — 같은 e2e가 가격을 흔들어도 순서가 변하지 않음을 고정한다.
   */
  private toProductLinkDto(link: ProductLinkRow, disclosures: Map<string, string>) {
    const priceKrw = link.priceSnapshotKrw ?? null;
    const priceCheckedAt = link.priceCheckedAt ?? null;
    // 둘 다 있을 때만 둘 다 싣는다(가산 optional — 구버전 클라이언트는 이 두 키를 무시한다).
    const datedPrice =
      priceKrw !== null && priceCheckedAt !== null
        ? { priceSnapshotKrw: priceKrw, priceCheckedAt: priceCheckedAt.toISOString() }
        : {};
    return {
      id: link.id,
      platform: link.platform,
      title: link.title,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link, disclosures),
      ...datedPrice
    };
  }

  private toAdminItemDetailDto(
    item: ItemTemplateWithStages,
    links: ProductLinkRow[],
    disclosures: Map<string, string>,
    today: string = getSeoulToday()
  ) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status: "not_prepared" as const,
      // 라운드 49 QA(P3-6): 어드민 수정 폼이 분류를 프리필하려면 저장된 값이 필요하다. 폼은
      // 이미 `item.categoryId ?? ""`로 읽을 준비가 돼 있었는데(apps/admin app/items/page.tsx)
      // 응답에 이 키가 없어 늘 "분류 없음"으로 열렸고, 운영자가 다른 칸만 고쳐 저장해도 화면과
      // 저장된 값이 서로 다른 말을 했다. 앱용 DTO(toItemSummaryDto/toItemDetailDto)는 null을
      // undefined로 정리하지만(계약 optional), 어드민 응답은 **"분류 없음"과 "모름"을 구분해야
      // 하므로** null을 그대로 싣는다(priceMinKrw/priceMaxKrw와 같은 취급).
      categoryId: item.categoryId ?? null,
      timingLabel: item.timingLabel,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      // ADM-124: 어드민 편집 폼이 가격대를 프리필하려면 표시용 문구(priceBandText)가 아니라
      // 원시 값이 필요하다. 예전에는 문구만 내려줘서 수정 폼의 가격 칸이 늘 비어 있었고,
      // 그 결과 "값을 바꾸지 않음"과 "값을 지움"을 구분할 수 없었다(가격대 삭제 불가).
      // 앱용 DTO(toItemSummaryDto/toItemDetailDto)는 그대로다 — 어드민 응답만 넓힌다.
      priceMinKrw: item.priceMinKrw,
      priceMaxKrw: item.priceMaxKrw,
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      // 라운드 48 T1: 어드민 편집 폼이 체크박스를 프리필하려면 저장된 값이 필요하다.
      medicalDisclaimerRequired: item.medicalDisclaimerRequired,
      active: item.active,
      stageCodes: item.stageCodes,
      // UX-X(R43) M-5: 사용자 관점의 구매처 수. productLinks 자체는 비활성 링크까지
      // 그대로 둔다 — 어드민은 내려둔 링크를 보고 되살릴 수 있어야 한다 — 대신
      // "이 준비템을 연 사용자에게 실제로 보이는 링크가 몇 개인가"를 서버가 한 번만
      // 정해서 내려준다. 종전에는 어드민 목록이 productLinks.length를 그대로 세어,
      // 전부 비활성인 준비템이 "링크 1"로 표시되고 '상품 링크 없음만 보기'에서도
      // 빠졌다 — 구매처가 0인 지점(핵심 루프가 끊기는 지점)이 그대로 가려졌다.
      activeLinkCount: links.filter((link) => link.active).length,
      productLinks: [...links]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((link) => this.toAdminProductLinkDto(link, disclosures, today))
    };
  }

  /**
   * 어드민용 링크 DTO. 앱용(toProductLinkDto)과 달리 **값을 감추지 않는다** — 어드민은
   * 자기가 쓴 값을 되읽어야 하고, 그러려면 "앱에서 보이지 않는 상태"도 함께 보여야 한다.
   *
   * 라운드 64 D(#4): 가격 두 필드를 **가산**한다. 지금까지 가격을 쓰는 유일한 경로가
   * CSV 일괄 교체였는데(product-link-bulk.service.ts) 어드민 어디에서도 그 값을 되읽을
   * 수 없었다 — 500행을 적용하고 받는 것은 숫자 셋뿐이고, 표에는 `healthStatus`만 있고
   * 가격 열은 없었다. 앱 DTO의 "둘 다 있을 때만" 규칙은 **여기서는 쓰지 않는다**:
   * 어드민에는 한쪽만 있는 상태(레거시 행: 가격만 있고 확인 시각 NULL)야말로 봐야 하는
   * 사실이고, 그 상태를 화면이 이름으로 말한다("시각 없음"). 값은 그대로 싣되,
   * **앱에서 이미 보이지 않는지**(180일 경과)는 서버가 판정해 `priceExpired`로 내려준다 —
   * 문턱 숫자(LINK_PRICE_MAX_AGE_DAYS)를 어드민 소스에 다시 박지 않기 위해서다.
   *
   * DNC-009: 이 값들은 여전히 **표시 전용**이다. 링크 정렬(sortProductLinksForApp)도
   * 준비템 추천(item-ranking.ts)도 가격을 보지 않으며 이 변경은 어느 쪽도 건드리지 않는다.
   *
   * 라운드 64 D(#8): `redirectCode`와 그 코드로 만든 공유용 절대 URL. DNC-010 때문에
   * 이 URL은 **혼자 나가면 안 된다** — 같은 행의 공유 전용 문구(`shareDisclosureText`)를
   * 어드민 화면이 복사 문구에 함께 싣는다(apps/admin src/lib/link-share.ts).
   *
   * 라운드 64 S-1: 그 URL은 **활성 링크에만** 싣는다. `GET /api/v1/r/:code`는
   * `active: true`인 행만 302로 보내므로(redirect.controller.ts), 비활성 행에도 URL을
   * 실으면 어드민 표에 누르는 순간 404가 나는 버튼이 선다 — 죽은 버튼을 만들지 않는다는
   * 같은 규율이다(`redirectCode` 자체는 계속 싣는다: 운영이 링크를 되살리면 같은 코드가
   * 그대로 다시 도달 가능해지는 사실이 어드민에 보여야 한다).
   *
   * 라운드 64 M-1: `shareDisclosureText`는 **앱 밖으로 나가는 문구**다. 표시·편집용
   * `disclosureText`(운영이 쓴 값을 되읽는 칸)는 그대로 두고, 공유에 붙는 문구만 따로
   * 싣는다 — 제휴 링크면 수수료 문장이 반드시 들어 있다(`withCommissionDisclosure`,
   * items-commerce/share-disclosure.ts). 앱의 `purchaseLinkShareMessage`가 지나는
   * 규율(라운드 44 N-2)과 같은 것을 어드민 복사에도 세우는 자리다.
   */
  private toAdminProductLinkDto(
    link: ProductLinkRow,
    disclosures: Map<string, string>,
    today: string = getSeoulToday()
  ) {
    const disclosureText = link.disclosureText ?? this.defaultDisclosureFor(link, disclosures);
    return {
      id: link.id,
      itemTemplateId: link.itemTemplateId,
      platform: link.platform,
      title: link.title,
      url: link.url,
      affiliateUrl: link.affiliateUrl,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText,
      // 제휴가 아닌 링크는 종전 그대로다 — 없는 수수료 고지를 지어내지 않는다(라운드 43 M-1).
      shareDisclosureText: link.isAffiliate
        ? withCommissionDisclosure(disclosureText, disclosures.get("affiliate_purchase"))
        : disclosureText,
      active: link.active,
      // COM-105: worker-written health verdict, surfaced on the admin links
      // page only (the app-facing toProductLinkDto stays unchanged).
      healthStatus: link.healthStatus ?? null,
      healthCheckedAt: link.healthCheckedAt ?? null,
      priceSnapshotKrw: link.priceSnapshotKrw ?? null,
      priceCheckedAt: link.priceCheckedAt ?? null,
      priceExpired: isPriceSnapshotExpired(link.priceCheckedAt, today),
      redirectCode: link.redirectCode ?? null,
      redirectShareUrl: link.active && link.redirectCode ? publicRedirectShareUrl(link.redirectCode) : null
    };
  }

  private async itemsForChild(
    childId: string,
    tab: ItemTab,
    stageBand?: StageBandLabel
  ): Promise<Array<{ item: ItemTemplateWithStages; status: ItemStatus }>> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) return [];

    const stageCode = toChildDto(child).currentStage as ChildStageCode;
    const activeItems = await this.listItemTemplatesWithStages(true);
    const statuses = await this.prisma.childItemStatus.findMany({ where: { childId } });
    const statusByItem = new Map(statuses.map((row) => [row.itemTemplateId, row.status]));
    const statusFor = (itemId: string): ItemStatus => statusByItem.get(itemId) ?? "not_prepared";

    // TEST-124: 탭 술어(시기·상태)와 정렬은 순수 모듈 item-ranking.ts가 판단한다.
    // 여기 남는 것은 DB 조회와 상태 결합뿐이라, 경계 조건은 DB 없는 단위 테스트
    // (test/item-ranking.test.ts)로 고정된다. 응답 집합·순서는 추출 전과 동일하다.
    const itemById = new Map(activeItems.map((item) => [item.id, item]));
    const ranked = rankItemsForTab(
      activeItems.map((item) => ({
        id: item.id,
        stageCodes: item.stageCodes,
        necessityLevel: item.necessityLevel,
        status: statusFor(item.id),
        displayOrder: item.displayOrder
      })),
      { tab, stageCode, stageBand }
    );

    return ranked.map((entry) => ({ item: itemById.get(entry.id)!, status: entry.status }));
  }

  /**
   * 라운드 49 C-04: 상세 한 건의 준비 상태 + 연결된 지출 id.
   *
   * 예전 `itemStatusFor`가 status만 돌려주면서 같은 행의 expenseId를 버렸다. 조회 횟수는
   * 그대로(findUnique 1건)이고 select에 컬럼 하나가 더해질 뿐이다. 행이 없으면 종전과 같이
   * `not_prepared`(+ 연결 없음)로 본다.
   */
  private async itemStatusRowFor(
    childId: string,
    itemTemplateId: string
  ): Promise<{ status: ItemStatus; expenseId: string | null }> {
    const row = await this.prisma.childItemStatus.findUnique({
      where: { childId_itemTemplateId: { childId, itemTemplateId } },
      select: { status: true, expenseId: true }
    });
    return { status: row?.status ?? "not_prepared", expenseId: row?.expenseId ?? null };
  }

  /**
   * 라운드 49 C-04: 연결된 지출을 상세 응답에 실을 수 있는 최소 모양으로 읽는다.
   *
   * ⚠️ `deletedAt: null`은 선택이 아니라 정확성 조건이다. 지출 삭제(소프트 삭제)는 연결
   * (child_item_statuses.expense_id)을 되돌리지 않으므로(store-shared.ts deleteExpense 주석),
   * 필터 없이 읽으면 **사용자가 지운 지출의 금액**이 준비템 상세에 계속 떠 있게 된다 —
   * 총액과 어긋나는 허위 표시다. 삭제됐으면 연결이 없는 것과 같이 null을 돌려준다.
   *
   * `childId`도 함께 건다: 접근 검증은 호출자가 이미 마쳤지만, 다른 아이의 지출 id가
   * 어떤 경로로든 이 열에 남아 있어도 그 금액이 새어 나가지 않게 한다(방어적 좁히기).
   */
  private async linkedExpenseDto(
    childId: string,
    expenseId: string | null
  ): Promise<{ id: string; amountKrw: number; spentOn: string } | null> {
    if (!expenseId) return null;
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, childId, deletedAt: null },
      select: { id: true, amountKrw: true, spentOn: true }
    });
    if (!expense) return null;
    return { id: expense.id, amountKrw: expense.amountKrw, spentOn: fromDateOnly(expense.spentOn) };
  }

  /**
   * 사용자가 상태를 **명시적으로 고른** 경로(PATCH .../status)의 쓰기 지점이므로
   * 무조건 덮어쓴다 — gifted/not_needed로 바꾸는 것도, 거기서 다시 되돌리는 것도
   * 사용자의 의도다. 지출 기록이 자동으로 준비 완료를 표시하는 경로는 이와 달리
   * 이미 정리된 상태를 보존해야 해서 별도 규칙을 쓴다:
   * store-shared.ts의 markLinkedItemPrepared (R19-B) 참고.
   */
  private async setChildItemStatus(
    user: AuthenticatedUser,
    childId: string,
    itemTemplateId: string,
    status: ItemStatus,
    expenseId?: string | null
  ) {
    await this.prisma.childItemStatus.upsert({
      where: { childId_itemTemplateId: { childId, itemTemplateId } },
      update: { status, expenseId: expenseId ?? null, updatedByUserId: user.id },
      create: { childId, itemTemplateId, status, expenseId: expenseId ?? null, updatedByUserId: user.id }
    });
  }

  private async disclosuresByKey(): Promise<Map<string, string>> {
    const rows = await this.prisma.disclosure.findMany();
    return new Map(rows.map((row) => [row.key, row.text]));
  }

  private normalizeAdminItemTemplateInput(input: AdminItemTemplateInput, existing: Partial<ItemTemplateWithStages>) {
    const name = input.name ?? existing.name;
    const necessityLevel = input.necessityLevel ?? existing.necessityLevel;
    const reasonText = input.reasonText ?? existing.reasonText;
    if (!name?.trim() || !necessityLevel || !reasonText?.trim()) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template fields are required." });
    }
    const skipReasonText = cleanOptionalText(input.skipReasonText ?? existing.skipReasonText ?? undefined);
    if (necessityLevel !== "essential" && !skipReasonText) {
      throw new BadRequestException({
        code: "ADMIN_SKIP_REASON_REQUIRED",
        message: "Non-essential preparation items need skip guidance."
      });
    }
    const timingLabel = cleanOptionalText(input.timingLabel ?? existing.timingLabel ?? undefined) ?? "";
    const stageCodes = input.stageCodes?.length ? input.stageCodes : existing.stageCodes;
    // 라운드 76 트랙 E — **저장되기 전에 "준비 시기"가 시기 선택과 같은 나이를 말하는지 본다.**
    // 판정 대상은 실제로 저장될 조합이다: 생성·수정 어느 쪽이든 여기서 합쳐진 값이 그대로
    // 행이 되고, 시기가 비면 `adminCreateItemTemplate`이 세우는 기본값이 그 자리를 채운다.
    // 검토(초안) 경로도 같은 판정을 지난다(admin/content-revisions.service.ts) — 발행이
    // 결국 이 함수를 지나므로 어느 쪽으로 들어와도 어긋난 값은 저장되지 않는다.
    requireTimingLabelMatchesStages(timingLabel, stageCodes ?? DEFAULT_ADMIN_ITEM_STAGE_CODES);
    return {
      name: name.trim(),
      necessityLevel,
      timingLabel,
      // ADM-124: undefined(필드 미전송) = 그대로 두기, null = 지우기. 예전에는 `??`라
      // null도 "미전송"과 똑같이 기존 값으로 되돌아가서, 한 번 넣은 가격대를 지울 방법이
      // 아예 없었다(timingLabel/safetyNote가 ""→null로 지워지는 것과 어긋났다).
      priceMinKrw: input.priceMinKrw === undefined ? existing.priceMinKrw ?? null : input.priceMinKrw,
      priceMaxKrw: input.priceMaxKrw === undefined ? existing.priceMaxKrw ?? null : input.priceMaxKrw,
      reasonText: reasonText.trim(),
      skipReasonText,
      usedSecondhandOk: input.usedSecondhandOk ?? existing.usedSecondhandOk ?? false,
      safetyNote: cleanOptionalText(input.safetyNote ?? existing.safetyNote ?? undefined),
      // 라운드 48 T1: usedSecondhandOk와 같은 관례 — 안 보내면 기존 값 유지, 신규 생성의
      // 기본값은 false(스키마 default와 동일).
      medicalDisclaimerRequired: input.medicalDisclaimerRequired ?? existing.medicalDisclaimerRequired ?? false,
      active: input.active ?? existing.active ?? true,
      stageCodes
    };
  }

  private async replaceItemTemplateStages(tx: DbClient, itemTemplateId: string, stageCodes: ChildStageCode[]) {
    await tx.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
    for (const [index, stageCode] of stageCodes.entries()) {
      await tx.itemTemplateStage.create({
        data: { itemTemplateId, stageCode, priorityWeight: stageCodes.length - index }
      });
    }
  }

  private async nextItemDisplayOrder(client: DbClient) {
    const max = await client.itemTemplate.aggregate({ _max: { displayOrder: true } });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private async nextProductLinkDisplayOrder(itemTemplateId: string) {
    const max = await this.prisma.productLink.aggregate({
      where: { itemTemplateId },
      _max: { displayOrder: true }
    });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private defaultDisclosureFor(link: { isSponsored: boolean; isAffiliate: boolean }, disclosures: Map<string, string>) {
    if (link.isSponsored) return disclosures.get("sponsored_product");
    if (link.isAffiliate) return disclosures.get("affiliate_purchase");
    return undefined;
  }

  private requireHttpUrl(value: string) {
    if (!isHttpOrHttpsUrl(value)) {
      throw new BadRequestException({
        code: "PRODUCT_LINK_URL_SCHEME_INVALID",
        message: "상품 링크 주소는 http 또는 https로 시작해야 해요."
      });
    }
  }

  private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }
}
