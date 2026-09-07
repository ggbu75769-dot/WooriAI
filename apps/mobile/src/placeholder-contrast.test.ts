import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { semanticColors } from "./design-system/tokens/color";
import { theme } from "./theme";

/**
 * 라운드 106 A11Y-대비 — **입력칸 플레이스홀더 글자의 명도 대비**를 값으로 물어 두는 자리.
 *
 * ## 무엇이 문제였나 (두 시점)
 * 종전(그때는 참): 플레이스홀더 색은 자기 이름이 없었고, 화면마다 가까운 회색 토큰을 빌려 썼다 —
 * `gray300`(#E5DFDB) 다섯 자리 · `semanticColors.textDisabled`(#A99E97) 두 자리 ·
 * `gray600`(#5F5854) 다섯 자리. 그때는 "연한 회색" 하나로 테두리·비활성·안내문을 같이 말하는 것이
 * 자연스러운 재사용이었다.
 * → 이제: 플레이스홀더는 자기 토큰(`theme.colors.text.placeholder` / `semanticColors.textPlaceholder`,
 * 둘 다 #756C66)을 갖는다. 아래 실측이 그 이유다.
 *
 * ## 왜 토큰을 "쪼갰"는가 — gray300의 값을 올릴 수는 없었다
 * `gray300`은 플레이스홀더보다 **테두리·스위치 트랙·구분선·비활성 버튼 배경**의 이름이다(앱 소스
 * 전수에서 60여 자리, 그 대부분이 색이 아니라 선이다). 값을 4.5:1까지 끌어올리면 그 선들이 전부
 * 진해져 승인 캡처의 픽셀이 움직인다 — DNC-017이 말하는 "임의 교체"가 바로 그 모양이다. 그래서
 * 값을 올린 것이 아니라 **이름을 하나 더 만들었다**: gray300·textDisabled의 값과 자리는 무변경이다.
 *
 * ## 대비 계산 (WCAG 2.x 상대휘도)
 * 아래 `contrastRatio`는 이 테스트가 가진 **독립 오라클**이다 — 앱 소스에 대비 계산 함수가 없으므로
 * 검사 대상 코드로 기대값을 만드는 순환이 아니고, 기대 수치는 전부 손으로 적은 리터럴이다.
 */

/** WCAG 2.x 8비트 채널 선형화. */
function linearizeChannel(value8bit: number): number {
  const channel = value8bit / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x 상대휘도. `#rrggbb`만 받는다(이 파일이 재는 토큰은 전부 그 형식이다). */
function relativeLuminance(hex: string): number {
  expect(hex, `${hex} should be a #rrggbb literal`).toMatch(/^#[0-9A-Fa-f]{6}$/);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearizeChannel(red) + 0.7152 * linearizeChannel(green) + 0.0722 * linearizeChannel(blue);
}

/** 소수 둘째 자리까지 — 정찰 문서와 토큰 주석이 적는 자릿수 그대로. */
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

describe("라운드 106 — 플레이스홀더 잉크의 대비(오라클은 이 파일의 WCAG 계산기)", () => {
  it("계산기 자신이 알려진 두 극단을 맞춘다(오라클 검산)", () => {
    // 검은 글자/흰 배경 = 21:1, 같은 색끼리 = 1:1. 계산기가 틀어지면 아래 수치도 못 믿는다.
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#767676", "#FFFFFF")).toBe(4.54); // WCAG 문서의 관례적 경계값
    expect(contrastRatio("#C94627", "#C94627")).toBe(1);
  });

  it("종전 값들의 실측 — 왜 고쳤는지가 숫자로 남는다", () => {
    // gray300은 오늘도 테두리로 살아 있다(값 무변경). 이 줄은 "플레이스홀더로 쓰면 안 되는 이유"다.
    expect(theme.colors.gray300).toBe("#E5DFDB");
    expect(contrastRatio("#E5DFDB", "#FFFFFF")).toBe(1.32);
    expect(contrastRatio("#E5DFDB", "#FFFDFC")).toBe(1.3);

    // textDisabled도 값·자리 무변경(토글 off 아이콘 · 비활성 라벨 · 접기 셰브런).
    expect(semanticColors.textDisabled).toBe("#A99E97");
    expect(contrastRatio("#A99E97", "#FFFFFF")).toBe(2.62);

    // gray600은 AA는 넘겼지만 입력값과의 구별선(3:1) 아래였다.
    expect(theme.colors.gray600).toBe("#5F5854");
    expect(contrastRatio("#5F5854", "#FFFFFF")).toBe(6.98);
    expect(contrastRatio("#5F5854", "#211E1C")).toBe(2.38);
  });

  it("오늘 값 #756C66은 앱의 세 배경 전부에서 본문 AA(4.5:1)를 넘는다", () => {
    expect(theme.colors.text.placeholder).toBe("#756C66");
    expect(semanticColors.textPlaceholder).toBe("#756C66");
    // 두 대장의 사본이 갈리면 화면마다 다른 회색이 된다.
    expect(semanticColors.textPlaceholder).toBe(theme.colors.text.placeholder);

    // 실제 플레이스홀더가 앉는 배경: 흰 입력칸(cream.surface) · 화면 바탕(cream.bg) · 흐린 면(surfaceAlt).
    expect(contrastRatio("#756C66", "#FFFFFF")).toBe(5.13);
    expect(contrastRatio("#756C66", "#FFFDFC")).toBe(5.06);
    expect(contrastRatio("#756C66", "#F8F6F4")).toBe(4.76);
  });

  it("그러면서 입력값과 구별을 잃지 않는다 — 대비를 더 올리지 않은 이유", () => {
    // 이 자리들의 입력값 색은 전부 text.primary다(inputStyle.color / semanticColors.textPrimary).
    expect(theme.colors.text.primary).toBe("#211E1C");
    expect(semanticColors.textPrimary).toBe("#211E1C");

    // 플레이스홀더 ↔ 입력값 = 3.23:1. WCAG가 "구별된다"고 부르는 최소선(3:1)을 넘는다.
    // (앞색은 **토큰에서** 읽는다 — 값이 움직이면 읽힘 쪽뿐 아니라 이 구별 쪽에서도 빨개져야 한다.)
    expect(contrastRatio(theme.colors.text.placeholder, "#211E1C")).toBe(3.23);
    expect(contrastRatio(semanticColors.textPlaceholder, "#211E1C")).toBe(3.23);

    // 정찰이 제안했던 gray600으로 올렸다면 읽힘은 6.98:1로 좋아지지만 구별은 2.38:1로 선 아래로
    // 떨어진다 — 플레이스홀더가 "이미 적힌 값"으로 읽히는 쪽의 실패다. 그 거래를 값으로 남긴다.
    expect(contrastRatio("#5F5854", "#211E1C")).toBe(2.38);
    expect(contrastRatio("#756C66", "#211E1C")).toBeGreaterThan(contrastRatio("#5F5854", "#211E1C"));
  });
});

const mobileRoot = process.cwd();

function listAppSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (relativeDir: string): void => {
    for (const entry of readdirSync(join(mobileRoot, relativeDir), { withFileTypes: true })) {
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(relativePath);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      found.push(relativePath);
    }
  };
  walk("app");
  walk("src");
  return found.sort();
}

/**
 * 모집단 스윕 — 새 화면이 다시 gray300/textDisabled를 빌려 쓰면 여기서 먼저 빨개진다.
 * (`src/a11y-contract.test.ts:127`의 `lowContrastCoralTextPattern`은 소문자 `color:` 프로퍼티의
 * **coral 토큰만** 보므로 `placeholderTextColor=`는 그 정규식의 모집단 밖이다 — 그 대장은
 * 편집하지 않고, 이 축만 여기서 센다.)
 */
describe("라운드 106 — placeholderTextColor 전수 스윕", () => {
  const allowedExpressions = ["theme.colors.text.placeholder", "semanticColors.textPlaceholder"];

  function placeholderExpressions(relativePath: string): string[] {
    const source = readFileSync(join(mobileRoot, relativePath), "utf8");
    return [...source.matchAll(/placeholderTextColor=\{([^}]*)\}/g)].map((match) => match[1].trim());
  }

  it("앱 소스의 placeholderTextColor는 플레이스홀더 토큰 둘만 쓴다", () => {
    const offenders: string[] = [];
    for (const relativePath of listAppSourceFiles()) {
      for (const expression of placeholderExpressions(relativePath)) {
        if (!allowedExpressions.includes(expression)) offenders.push(`${relativePath}: ${expression}`);
      }
    }
    expect(offenders, "플레이스홀더 토큰 밖의 색을 쓰는 자리").toEqual([]);
  });

  it("자리 수를 값으로 적어 둔다(정찰 S2 발견 3의 7자리 + 이미 통과였던 5자리 = 12)", () => {
    const counts = new Map<string, number>();
    for (const relativePath of listAppSourceFiles()) {
      const found = placeholderExpressions(relativePath).length;
      if (found > 0) counts.set(relativePath, found);
    }
    expect(Object.fromEntries([...counts].sort())).toEqual({
      "app/expenses/new.tsx": 1,
      "app/expenses/recurring.tsx": 4,
      "app/settings/amount-presets.tsx": 1,
      "app/settings/app-lock.tsx": 1,
      "app/settings/categories.tsx": 2,
      "src/design-system/components/ModV1Primitives.tsx": 1,
      "src/preparation/PreparationListParity.tsx": 1,
      "src/security/AppLockOverlay.tsx": 1
    });
  });
});
