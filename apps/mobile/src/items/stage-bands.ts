import { isChildStageCode, type ChildStageCode } from "@wooriai/domain";

export type StageBandLabel = "0-6개월" | "6-12개월" | "12-24개월" | "24개월+";

export type StageBandDefinition = {
  label: StageBandLabel;
  stages: ChildStageCode[];
};

export const bandDefinitions: StageBandDefinition[] = [
  { label: "0-6개월", stages: ["pregnancy_early", "pregnancy_mid", "pregnancy_late", "newborn_0_3", "infant_4_6"] },
  { label: "6-12개월", stages: ["infant_7_12"] },
  { label: "12-24개월", stages: ["toddler_1_3"] },
  { label: "24개월+", stages: ["toddler_1_3", "kid_4_7", "elementary", "middle_school"] }
];

const stageToBandLabel: Record<ChildStageCode, StageBandLabel> = {
  pregnancy_early: "0-6개월",
  pregnancy_mid: "0-6개월",
  pregnancy_late: "0-6개월",
  newborn_0_3: "0-6개월",
  infant_4_6: "0-6개월",
  infant_7_12: "6-12개월",
  toddler_1_3: "12-24개월",
  kid_4_7: "24개월+",
  elementary: "24개월+",
  middle_school: "24개월+"
};

export function bandForStage(stage: ChildStageCode): StageBandLabel {
  return stageToBandLabel[stage];
}

export function bandStages(label: StageBandLabel): ChildStageCode[] {
  return bandDefinitions.find((band) => band.label === label)?.stages ?? [];
}

export function itemMatchesBand(
  item: { stageCodes?: ChildStageCode[]; timingLabel?: string },
  label: StageBandLabel
): boolean {
  if (item.stageCodes && item.stageCodes.length > 0) {
    const stages = bandStages(label);
    return item.stageCodes.some((code) => stages.includes(code));
  }
  return !item.timingLabel || item.timingLabel === label;
}

export type ResolveDefaultStageLabelInput = {
  /**
   * The child's current stage code.
   *
   * 라운드 69 트랙 C: 원천이 `/home` 응답에서 **`["children"]` 캐시의 선택된 아이**로 옮겼다
   * (app/(tabs)/items.tsx). 두 값은 서버에서 같은 함수 한 벌이 만든다
   * (apps/api/src/onboarding/store-shared.ts의 `toChildDto` — `/home`은
   * reporting-store.service.ts가, `/children`은 onboarding-core.service.ts가 그 함수를 부른다),
   * 즉 **정의상 같은 값**이라 판정 규칙은 한 줄도 바뀌지 않았다.
   */
  currentStage: unknown;
  /** True while a pixel-lock capture run is in progress -- must render deterministically. */
  isPixelLockMode: boolean;
  /** True once the user has tapped a chip -- their choice must not be overridden. */
  hasManualSelection: boolean;
  /** Returned whenever the child's stage can't (or shouldn't) be resolved. */
  fallback: StageBandLabel;
};

/**
 * 기본 칩 판정의 결과 — **값과 "그 값이 어디서 왔는지"를 함께** 돌려준다.
 *
 * 라운드 69 트랙 C: 종전에는 `StageBandLabel` 하나만 돌려줬고, 그래서 화면은 "12-24개월"이
 * 아이의 실제 시기인지 아무것도 몰라서 쓴 폴백인지 **구조적으로 구분할 수 없었다**. 임신
 * 28주 사용자에게 걸음마기 준비물을 권하면서 그 이유를 말하지 않던 침묵의 원인이 이 반환
 * 타입이다(라운드 61 S-4 · 68 #2가 세운 "0건과 모름은 다르다"와 같은 형식).
 */
export type ResolvedStageBand = {
  /** 화면이 기본으로 선택하는 칩. */
  label: StageBandLabel;
  /**
   * 이 라벨이 **아이의 실제 시기**에서 나왔는가. `false`면 `fallback`을 그대로 돌려준 것이다
   * (픽셀 락 캡처 · 사용자의 수동 선택 · 시기를 모름 — 셋 다 폴백이지만 화면이 말을 걸 대상은
   * 마지막 하나뿐이라, 호출부가 그 셋을 나눠 판단한다).
   */
  resolved: boolean;
};

/**
 * 시기를 끝내 확인하지 못했을 때 칩 줄 위에 서는 한 줄.
 *
 * 문장이 이 모듈에 있는 이유: "폴백을 썼다"를 아는 곳이 여기 하나뿐이고, 그 사실과 그것을
 * 말하는 문장이 갈라지면 다음 라운드가 한쪽만 고친다. 지어낸 이유를 말하지 않는다(왜 못
 * 불러왔는지는 이 모듈도 화면도 모른다) — 사실 하나와 사용자가 지금 할 수 있는 일 하나까지다.
 */
export const STAGE_BAND_UNRESOLVED_NOTICE = "지금 시기를 확인하지 못했어요. 시기를 직접 골라 주세요.";

/**
 * Resolves which stage-band chip should be selected by default. Prefers the band matching the
 * child's actual current stage, but always defers to `fallback` during pixel-lock capture or
 * once the user has made a manual chip selection.
 *
 * 라운드 51 #3 — `isTestSession` 폴백을 **제거했다**.
 *
 * 왜 있었나: 데모(로그인 없는 테스트) 세션에는 자동으로 만들어지는 픽스처 아이가 있었고
 * (생후 24개월 "다온이"), 그 아이가 항상 걸음마기라 기본 칩이 늘 "12-24개월"이었다. 폴백은
 * 그 사실을 굳혀 데모 렌더를 결정적으로 만드는 장치였다.
 *
 * 왜 지웠나: 그 픽스처가 사라졌다. 실기기 피드백 이후 `ensureSeeded`(src/api/local-backend.ts)는
 * **사용자 데이터를 하나도 만들지 않고**, 데모도 실계정 신규 가입과 똑같이 온보딩에서 아이를
 * 직접 입력한다. 즉 데모 아이의 시기는 사용자가 넣은 출산예정일/생년월일이 정하는 값이지
 * 고정값이 아니다. 그런데도 폴백이 남아 있어서, 임신 중인 아이를 만든 데모 사용자에게 기본
 * 칩이 "12-24개월"로 뜨고 -- 그 칩에는 임신 시기가 없으므로(bandDefinitions) -- "출산 전"
 * 칩(src/items/pre-birth-filter.ts의 shouldOfferPreBirthFilter)이 **구조적으로 절대 뜨지 않았다**.
 * 근거가 사라진 결정성 장치가 실제 기능 하나를 데모에서 통째로 가리고 있었던 셈이다.
 *
 * `isPixelLockMode` 폴백은 그대로다: ITEM-001 캡처는 세션 자체가 없어 아이도 없고, 그 렌더는
 * 한 픽셀도 흔들리면 안 된다. **그 게이트가 최우선**이라는 순서도 그대로다 — 아래 첫 줄이
 * 캡처의 결정성을 지키는 자리이고, 캡처에는 `["children"]` 쿼리 자체가 꺼져 있어(비세션)
 * 두 번째 게이트가 한 겹 더 서 있다(items.tsx의 이중 게이트 주석 · 이 파일의 테스트가 그
 * 두 겹을 값으로 증명한다).
 *
 * 라운드 69 트랙 C: 반환값이 `{ label, resolved }`다. 폴백 값 자체는 한 글자도 바뀌지 않고
 * (호출부가 넘기는 `"12-24개월"` 그대로 — ITEM-001 캡처 판정이 그 값에 걸려 있다), 바뀌는 것은
 * **그 값이 사실인 척하지 않게** 된 것뿐이다.
 */
export function resolveDefaultStageLabel(input: ResolveDefaultStageLabelInput): ResolvedStageBand {
  if (input.isPixelLockMode || input.hasManualSelection) {
    return { label: input.fallback, resolved: false };
  }
  if (!isChildStageCode(input.currentStage)) {
    return { label: input.fallback, resolved: false };
  }
  return { label: bandForStage(input.currentStage), resolved: true };
}
