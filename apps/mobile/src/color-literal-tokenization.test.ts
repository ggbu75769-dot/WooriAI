import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
