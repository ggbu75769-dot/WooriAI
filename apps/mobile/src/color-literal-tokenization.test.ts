import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { semanticColors } from "./design-system/tokens/color";
import { theme } from "./theme";

/**
 * 라운드 101 웨이브 2 TK — **색 리터럴 토큰화 1차의 값 대조표**(다크 모드 선행 · 시각 무변화).
 *
 * 이 라운드는 아래 6파일의 hex·rgba 리터럴을 theme.presentation의 **같은 값** 토큰으로
 * 치환했다. "시각 무변화(렌더 픽셀 0 변화)"의 증명은 두 겹이다:
 *  ① 이 파일 — 치환한 자리마다 **두 시점**을 나란히 기록한다: 종전 리터럴(여기 값으로
 *     박아 둔 문자열)과 오늘의 토큰 값이 바이트 단위로 같다. 토큰 값이 한 글자라도 움직이면
 *     여기서 빨간다(DNC-017: 값 교체는 개정 이력 없이 하지 않는다).
 *  ② 기존 계약들 — design-foundation.test.ts의 hex 스냅샷(종전 10개 서피스 키·값 무수정),
 *     픽셀락 6종(EXP-001 등 비세션 렌더), a11y-contract. 값이 같으므로 전부 그대로 그린이다.
 *
 * 치환하지 못한 자리(계약이 리터럴을 바이트로 무는 곳)는 이 라운드가 건드리지 않았다 —
 * app/launch-animation.tsx(a11y-contract가 소스 리터럴 단언 · 무접촉 계약),
 * app/(tabs)/index.tsx · app/expenses/new.tsx(이번 웨이브 타 트랙과 충돌 — 다음 차수 몫),
 * 그리고 6파일 밖의 hairline 사본들(more/family/records 등 — design-restore-p2d.test.ts가
 * 그 줄들을 바이트로 문다 · 다음 차수 몫).
 *
 * ⚠️ 두 시점(라운드 101 TK2) — 위 셋째 줄의 "hairline 사본들"은 **2차가 회수했다**: more ·
 * family · records · 탭바(_layout) · CSV 내보내기 카드 · 기록 캘린더 · 날짜 피커의 hairline
 * 변종 전부다(아래 "TK2" describe들). design-restore-p2d.test.ts가 바이트로 물던 세 줄
 * (moreSectionGroupStyle · familyPlusButtonStyle · familyMemberRowStyle)은 그 대장 자체를
 * 종전 리터럴 줄 → 토큰 줄로 함께 이관했고, 값 동일성의 증명은 이 파일의 대조표다.
 * launch-animation(무접촉 계약)과 index.tsx · new.tsx(타 트랙 충돌)는 여전히 다음 차수 몫이다.
 *
 * ⚠️ 라운드 101 리뷰 L-TK1 — 잔여 hairlineStrong 사본이 위 목록 밖에 **세 자리 더 있다**
 * (2차가 "전부"라고 적었지만 재실측이 셋을 더 찾았다 — 남은 자리는 이름으로 적어야 다음
 * 차수가 목록을 다시 세지 않는다):
 *  · app/(onboarding)/child-profile.tsx:283 — 관계 선택 칩 외곽선("rgba(74, 63, 53, 0.10)")
 *  · app/items/[itemTemplateId].tsx:1512 — 준비템 상세의 카드 외곽선(같은 0.10 변종)
 *  · app/settings/children.tsx:156 — 아이 관리 카드 외곽선(같은 0.10 변종)
 * 셋 다 new.tsx·index.tsx와 같은 "다음 차수 몫"이다(이 라운드는 명기만 하고 치환하지 않는다 —
 * 줄 번호는 라운드마다 밀릴 수 있으므로 바늘은 파일:값이고 줄은 오늘의 길잡이다).
 *
 * ⚠️ 두 시점(라운드 102 TK3) — 위 명기 세 자리와 new.tsx(1차 때 웨이브 충돌로 제외됐던
 * 그 파일 — 0.10 변종 10자리 실측)는 **3차가 회수했다**(아래 "TK3" describe들). 추가로
 * 준비템 상세의 플로팅 크롬 서피스(흰 82% → 신규 floatingChromeSurface)와 design-system
 * BudgetHeroCard 진행 바 트랙(흰 32% → semanticColors 신규 progressTrackInverse — theme이
 * 아니라 design-system 토큰이다: 그 레이어는 theme을 부르지 않는다)도 함께 회수했다.
 * 3차 뒤의 잔여 목록(코드 색 리터럴 전수 재실측):
 *  · app/(tabs)/index.tsx:409("rgba(74, 63, 53, 0.10)") · :572("rgba(255, 255, 255, 0.18)")
 *    — 이번 라운드 병렬 트랙과 충돌(무접촉) · 다음 차수 몫
 *  · app/launch-animation.tsx — a11y-contract가 소스 리터럴을 단언하는 무접촉 계약(치환 대상 아님)
 */
const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * 신규 토큰 → 종전 리터럴. 오른쪽 값이 **치환 전 소스에 적혀 있던 그 바이트**다(두 시점의
 * 왼쪽 시점). rgba의 공백 유무까지 종전 표기 그대로 옮겼다 — 값을 "정규화"하는 순간 이 표는
 * 더 이상 종전 리터럴의 기록이 아니게 된다.
 */
const newTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  // 헤어라인 2종(#4A3F35 8%/10% — 카드·칩 외곽선 관례값).
  ["hairline", "rgba(74, 63, 53, 0.08)"],
  ["hairlineStrong", "rgba(74, 63, 53, 0.10)"],
  // 코랄 히어로 위 흰 반투명(홈 히어로 진행 바 트랙 · 준비 히어로 트랙/구분선).
  ["heroProgressTrack", "rgba(255,255,255,0.45)"],
  ["heroOverlaySoft", "rgba(255,255,255,0.28)"],
  // 리포트 추이 카드 격자선.
  ["chartGridLine", "rgba(255, 107, 82, 0.08)"],
  // 지출 분류 팔레트 위 아이콘 잉크(item-visuals.ts).
  ["categoryIconInk", "#443F3C"],
  // 준비 목록 분류 헤더의 진행 바 트랙.
  ["prepGroupProgressTrack", "#F5E8DF"],
  // 준비 목록 그룹 카드 틴트/잉크 10쌍(c20deeb 이식본 DSN-053 P2-B의 리터럴 그대로).
  ["prepTintCoral", "#FFF0EC"],
  ["prepInkCoral", "#C54A2C"],
  ["prepTintPink", "#FFF0F4"],
  ["prepInkPink", "#B8476C"],
  ["prepTintLavender", "#EEE9FF"],
  ["prepInkLavender", "#7157A8"],
  ["prepTintMint", "#E5F7F2"],
  ["prepInkMint", "#147A66"],
  ["prepTintSky", "#EAF3FF"],
  ["prepInkSky", "#2866A3"],
  ["prepTintButter", "#FFF6DD"],
  ["prepInkButter", "#A86400"],
  ["prepTintViolet", "#F1EDFF"],
  ["prepInkViolet", "#6553A3"],
  ["prepTintSeafoam", "#EAF8F4"],
  ["prepInkSeafoam", "#19735F"],
  ["prepTintPowderBlue", "#EEF5FF"],
  ["prepInkPowderBlue", "#3268A8"],
  ["prepTintSand", "#F7F1EA"],
  ["prepInkSand", "#8A5A2B"]
];

/**
 * 값이 **이미 토큰에 있던** 자리 둘 — 새 키 없이 기존 이름을 불렀다. 종전 리터럴이 그 기존
 * 토큰의 값과 같다는 사실이 곧 치환의 안전 근거다.
 */
const reusedTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  ["dangerSurface", "#FFF0ED"], // app/(auth)/login.tsx errorCard 배경
  ["importCanvas", "#FFFCFA"] // app/import/index.tsx screen 배경
];

/**
 * 라운드 101 TK2 — 2차(1차 잔여 회수)의 대조표. 신규 키는 hairlineHeavy 하나다: #4A3F35
 * 12% — 가족 화면 "가족 초대하기" 버튼(familyInviteButtonStyle) 외곽선의 종전 리터럴이다.
 */
const tk2NewTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  ["hairlineHeavy", "rgba(74, 63, 53, 0.12)"]
];

/**
 * 2차의 나머지 자리는 전부 **1차가 만든 토큰의 재사용**이다 — 종전 리터럴이 그 토큰의 값과
 * 바이트 단위로 같다는 사실이 치환의 안전 근거다(값 교체 0건).
 */
const tk2ReusedTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  ["hairline", "rgba(74, 63, 53, 0.08)"], // more 5자리 · family 4자리 · 탭바 · CSV 카드
  ["hairlineStrong", "rgba(74, 63, 53, 0.10)"] // family `+` 버튼 · 기록 검색 입력 · 캘린더 칸 · 날짜 피커 카드
];

describe("라운드 101 TK — 토큰 값 = 종전 리터럴 값(두 시점 대조)", () => {
  it("신규 presentation 토큰의 값이 종전 리터럴과 바이트 단위로 같다", () => {
    for (const [token, formerLiteral] of newTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });

  it("기존 토큰을 재사용한 자리의 종전 리터럴도 그 토큰의 값 그대로다", () => {
    for (const [token, formerLiteral] of reusedTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });
});

/**
 * 치환한 자리의 파일별 계약: 토큰 참조가 **실재**하고(양의 끝), 종전 리터럴은 코드에서
 * **사라졌다**(음의 끝). 음의 단언은 따옴표째로 본다 — 주석이 값을 산문으로 언급하는 것
 * (예: "#4A3F35 10%")은 코드가 아니므로 잡지 않는다.
 */
describe("라운드 101 TK — 치환 자리의 소스 계약", () => {
  it("src/ui.tsx: 카드 헤어라인 · 히어로 진행 바 트랙 · 차트 격자선", () => {
    const src = readSource("src/ui.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairline,");
    expect(src).toContain("backgroundColor: theme.colors.presentation.heroProgressTrack,");
    expect(src).toContain("backgroundColor: theme.colors.presentation.chartGridLine,");
    for (const gone of ['"rgba(74, 63, 53, 0.08)"', '"rgba(255,255,255,0.45)"', '"rgba(255, 107, 82, 0.08)"']) {
      expect(src, `종전 리터럴이 남아 있다: ${gone}`).not.toContain(gone);
    }
  });

  it("app/(auth)/login.tsx: 동의 카드 헤어라인 · 로그인 실패 카드 배경", () => {
    const src = readSource("app/(auth)/login.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairline,");
    expect(src).toContain("backgroundColor: theme.colors.presentation.dangerSurface,");
    for (const gone of ['"rgba(74, 63, 53, 0.08)"', '"#FFF0ED"']) {
      expect(src, `종전 리터럴이 남아 있다: ${gone}`).not.toContain(gone);
    }
  });

  it("app/import/index.tsx: 카드 헤어라인 4자리 · 화면 캔버스", () => {
    const src = readSource("app/import/index.tsx");
    // 파일·재개·되돌리기·안내·미리보기 카드가 같은 헤어라인을 쓴다 — 자리 수까지 문다.
    expect(src.match(/borderColor: theme\.colors\.presentation\.hairline,/g) ?? []).toHaveLength(4);
    expect(src).toContain("backgroundColor: theme.colors.presentation.importCanvas,");
    for (const gone of ['"rgba(74, 63, 53, 0.08)"', '"#FFFCFA"']) {
      expect(src, `종전 리터럴이 남아 있다: ${gone}`).not.toContain(gone);
    }
  });

  it("app/expenses/[expenseId].tsx: 선물 체크박스 헤어라인(토스 리뷰 L이 예고한 그 일괄 이관)", () => {
    const src = readSource("app/expenses/[expenseId].tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53, 0.10)"');
  });

  it("src/preparation/item-visuals.ts: 분류 팔레트 위 아이콘 잉크", () => {
    const src = readSource("src/preparation/item-visuals.ts");
    expect(src).toContain("iconColor: theme.colors.presentation.categoryIconInk");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"#443F3C"');
  });

  it("src/preparation/PreparationListParity.tsx: 그룹/밴드 표·히어로 오버레이·그룹 진행 바", () => {
    const src = readSource("src/preparation/PreparationListParity.tsx");
    // 그룹 10쌍 — 표의 각 줄이 tint/ink 토큰 짝을 이름으로 부른다.
    for (const hue of ["Coral", "Pink", "Lavender", "Mint", "Sky", "Butter", "Violet", "Seafoam", "PowderBlue", "Sand"]) {
      expect(src, `prepTint${hue}`).toContain(`tint: theme.colors.presentation.prepTint${hue}`);
      expect(src, `prepInk${hue}`).toContain(`color: theme.colors.presentation.prepInk${hue}`);
    }
    // 시기 밴드 셋은 같은 값의 틴트 토큰을 공유한다(coral/mint/butter — 종전에도 같은 hex였다).
    expect(src.match(/tint: theme\.colors\.presentation\.prepTintCoral/g) ?? []).toHaveLength(2);
    expect(src.match(/tint: theme\.colors\.presentation\.prepTintMint/g) ?? []).toHaveLength(2);
    expect(src.match(/tint: theme\.colors\.presentation\.prepTintButter/g) ?? []).toHaveLength(2);
    // 히어로의 흰 반투명 두 자리(진행 바 트랙 · 펼침 구분선)와 그룹 진행 바 트랙.
    expect(src).toContain("backgroundColor: theme.colors.presentation.heroOverlaySoft,");
    expect(src).toContain("borderTopColor: theme.colors.presentation.heroOverlaySoft,");
    expect(src).toContain("backgroundColor: theme.colors.presentation.prepGroupProgressTrack,");
    // 종전 리터럴 전수 — 하나라도 남으면 그 자리는 토큰화가 덜 끝난 것이다.
    const goneLiterals = [
      '"rgba(255,255,255,0.28)"',
      '"#F5E8DF"',
      ...newTokenFormerLiterals
        .filter(([token]) => token.startsWith("prepTint") || token.startsWith("prepInk"))
        .map(([, formerLiteral]) => `"${formerLiteral}"`)
    ];
    for (const gone of goneLiterals) {
      expect(src, `종전 리터럴이 남아 있다: ${gone}`).not.toContain(gone);
    }
  });
});

describe("라운드 101 TK2 — 토큰 값 = 종전 리터럴 값(두 시점 대조 · 2차)", () => {
  it("신규 hairlineHeavy 토큰의 값이 종전 리터럴과 바이트 단위로 같다", () => {
    for (const [token, formerLiteral] of tk2NewTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });

  it("1차 토큰을 재사용한 자리의 종전 리터럴도 그 토큰의 값 그대로다", () => {
    for (const [token, formerLiteral] of tk2ReusedTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });
});

/**
 * 2차 치환 자리의 파일별 계약 — 1차와 같은 문법이다: 토큰 참조의 실재(자리 수까지)와 종전
 * 리터럴의 부재(따옴표째). design-restore-p2d.test.ts가 물던 세 줄은 그쪽 대장이 토큰 줄로
 * 이관되어 계속 물고 있으므로, 여기서는 파일 전체의 자리 수와 리터럴 부재만 문다.
 */
describe("라운드 101 TK2 — 치환 자리의 소스 계약(2차)", () => {
  it("app/(tabs)/more.tsx: 가구 카드·구획 그룹·미리보기 그룹 3 + 행 구분선 2", () => {
    const src = readSource("app/(tabs)/more.tsx");
    expect(src.match(/borderColor: theme\.colors\.presentation\.hairline,/g) ?? []).toHaveLength(3);
    expect(src.match(/borderBottomColor: theme\.colors\.presentation\.hairline,/g) ?? []).toHaveLength(2);
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("app/family/index.tsx: 초대 그룹·멤버 행·대기 행 3 + 행 구분선 1 + `+` 버튼 + 초대 버튼", () => {
    const src = readSource("app/family/index.tsx");
    expect(src.match(/borderColor: theme\.colors\.presentation\.hairline,/g) ?? []).toHaveLength(3);
    expect(src.match(/borderBottomColor: theme\.colors\.presentation\.hairline,/g) ?? []).toHaveLength(1);
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineHeavy,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("app/family/invite.tsx · accept/[token].tsx: 실측 결과 색 리터럴 0건(치환할 자리 없음)", () => {
    for (const path of ["app/family/invite.tsx", "app/family/accept/[token].tsx"]) {
      const src = readSource(path);
      expect(src, `${path}에 hairline 리터럴이 있다`).not.toContain("rgba(74, 63, 53");
      expect(src, `${path}에 hex 리터럴이 있다`).not.toMatch(/Color: "#[0-9A-Fa-f]{3,8}"/);
    }
  });

  it("app/(tabs)/records.tsx: 검색 입력 외곽선(0.10 변종)", () => {
    const src = readSource("app/(tabs)/records.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("app/(tabs)/_layout.tsx: 탭바 상단 구분선", () => {
    const src = readSource("app/(tabs)/_layout.tsx");
    expect(src).toContain("borderTopColor: theme.colors.presentation.hairline,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("src/export/ExpenseCsvExport.tsx: 내보내기 카드 외곽선", () => {
    const src = readSource("src/export/ExpenseCsvExport.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairline,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("src/expenses/RecordsCalendar.tsx: 캘린더 칸 외곽선(0.10 변종)", () => {
    const src = readSource("src/expenses/RecordsCalendar.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("src/expenses/ExpenseDatePicker.tsx: 날짜 피커 카드 외곽선(0.10 변종)", () => {
    const src = readSource("src/expenses/ExpenseDatePicker.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });
});

/**
 * 라운드 102 TK3 — 3차(2차 잔여 회수)의 대조표. theme 신규 키는 floatingChromeSurface
 * 하나(흰 82% — 준비템 상세 플로팅 크롬 원형 버튼 서피스, ITEM-002 승인 캡처의 값)다.
 * design-system 쪽 신규 키는 semanticColors.progressTrackInverse 하나(흰 32% —
 * BudgetHeroCard 진행 바 트랙)다: ModV1Primitives는 design-system 레이어라 theme을 부르지
 * 않으므로 토큰의 집도 그 레이어의 대장(tokens/color.ts)이다. rgba 공백 표기는 종전 리터럴
 * 그대로다(0.82는 공백 있음 · 0.32는 공백 없음 — 정규화하지 않는다).
 */
const tk3NewTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  ["floatingChromeSurface", "rgba(255, 255, 255, 0.82)"]
];

const tk3NewSemanticTokenFormerLiterals: ReadonlyArray<[keyof typeof semanticColors, string]> = [
  ["progressTrackInverse", "rgba(255,255,255,0.32)"]
];

/**
 * 3차의 나머지 자리는 전부 **1차가 만든 hairlineStrong의 재사용**이다 — 라운드 101 리뷰
 * L-TK1이 명기한 세 자리(child-profile·준비템 상세·아이 관리)와 new.tsx의 0.10 변종
 * 10자리(실측: 단독 borderColor 8 + 삼항의 기본 가지 2).
 */
const tk3ReusedTokenFormerLiterals: ReadonlyArray<[keyof typeof theme.colors.presentation, string]> = [
  ["hairlineStrong", "rgba(74, 63, 53, 0.10)"]
];

describe("라운드 102 TK3 — 토큰 값 = 종전 리터럴 값(두 시점 대조 · 3차)", () => {
  it("신규 floatingChromeSurface 토큰의 값이 종전 리터럴과 바이트 단위로 같다", () => {
    for (const [token, formerLiteral] of tk3NewTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });

  it("신규 semanticColors.progressTrackInverse의 값이 종전 리터럴과 바이트 단위로 같다", () => {
    for (const [token, formerLiteral] of tk3NewSemanticTokenFormerLiterals) {
      expect(semanticColors[token], `semanticColors.${token}`).toBe(formerLiteral);
    }
  });

  it("1차 토큰을 재사용한 자리의 종전 리터럴도 그 토큰의 값 그대로다", () => {
    for (const [token, formerLiteral] of tk3ReusedTokenFormerLiterals) {
      expect(theme.colors.presentation[token], `presentation.${token}`).toBe(formerLiteral);
    }
  });
});

/**
 * 3차 치환 자리의 파일별 계약 — 1·2차와 같은 문법: 토큰 참조의 실재(자리 수까지)와 종전
 * 리터럴의 부재(따옴표째). new.tsx의 픽셀락(EXP-001)·entry-screen-visual-restore 노드
 * 계약은 값 불변이므로 그대로 그린이다 — 여기서는 파일의 자리 수와 리터럴 부재만 문다.
 */
describe("라운드 102 TK3 — 치환 자리의 소스 계약(3차)", () => {
  it("app/(onboarding)/child-profile.tsx: 달력 열기 버튼 외곽선(0.10 변종 — L-TK1 명기 자리)", () => {
    const src = readSource("app/(onboarding)/child-profile.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("app/settings/children.tsx: 달력 열기 버튼 외곽선(0.10 변종 — L-TK1 명기 자리)", () => {
    const src = readSource("app/settings/children.tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("app/items/[itemTemplateId].tsx: 메모 입력 외곽선(L-TK1 명기 자리) + 플로팅 크롬 서피스", () => {
    const src = readSource("app/items/[itemTemplateId].tsx");
    expect(src).toContain("borderColor: theme.colors.presentation.hairlineStrong,");
    expect(src).toContain("backgroundColor: theme.colors.presentation.floatingChromeSurface,");
    for (const gone of ['"rgba(74, 63, 53,', '"rgba(255, 255, 255, 0.82)"']) {
      expect(src, `종전 리터럴이 남아 있다: ${gone}`).not.toContain(gone);
    }
  });

  it("app/expenses/new.tsx: 0.10 변종 전수 10자리(단독 8 + 삼항 기본 가지 2)", () => {
    const src = readSource("app/expenses/new.tsx");
    expect(src.match(/theme\.colors\.presentation\.hairlineStrong/g) ?? []).toHaveLength(10);
    // 삼항 두 자리는 강조 가지(danger·mainCoral)를 그대로 두고 기본 가지만 토큰을 부른다.
    expect(src).toContain("borderColor: dateInputError ? theme.colors.danger : theme.colors.presentation.hairlineStrong,");
    expect(src).toContain("borderColor: expanded ? theme.colors.mainCoral : theme.colors.presentation.hairlineStrong,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(74, 63, 53,');
  });

  it("src/design-system/components/ModV1Primitives.tsx: 예산 히어로 진행 바 트랙(design-system 토큰)", () => {
    const src = readSource("src/design-system/components/ModV1Primitives.tsx");
    expect(src).toContain("backgroundColor: semanticColors.progressTrackInverse,");
    expect(src, "종전 리터럴이 남아 있다").not.toContain('"rgba(255,255,255,0.32)"');
  });
});
