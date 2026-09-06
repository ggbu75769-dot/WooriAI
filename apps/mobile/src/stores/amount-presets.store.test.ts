import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { QUICK_AMOUNT_PRESETS_KRW, resolveAmountPresets } from "../expenses/amount-presets";
import { useAmountPresetsStore } from "./amount-presets.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 101 W2 F6a — 지출 입력 금액 프리셋 4칸의 사용자 편집값 스토어.
 *
 * sanitize 경계 자체는 순수 모듈 테스트(src/expenses/amount-presets.test.ts)가 문다. 여기서는
 * ⓐ 스토어가 그 판정 한 벌만 지나는지(persist 왕복·손상 blob·하이드레이션 보호),
 * ⓑ 화면 배선(지출 입력 소비 · 설정 편집 화면 · 설정 진입 행),
 * ⓒ 기기 단위 취향이라 세션 teardown 목록 밖이라는 사실(records-view/haptics 선례)을 고정한다.
 */
describe("useAmountPresetsStore (라운드 101 W2 F6a)", () => {
  beforeEach(() => {
    useAmountPresetsStore.setState({ customPresets: null, touched: false });
  });

  it("기본 상태는 null(= 기본 네 칸을 쓴다)이고, 해석은 순수 함수가 기본값을 돌려준다", () => {
    expect(useAmountPresetsStore.getState().customPresets).toBeNull();
    expect(resolveAmountPresets(useAmountPresetsStore.getState().customPresets)).toBe(QUICK_AMOUNT_PRESETS_KRW);
  });

  it("저장은 sanitize를 지난다 — 유효한 네 칸은 오름차순으로, 유효하지 않으면 null(기본값)", () => {
    useAmountPresetsStore.getState().setCustomPresets([30000, 500, 100000, 3000]);
    expect(useAmountPresetsStore.getState().customPresets).toEqual([500, 3000, 30000, 100000]);
    expect(useAmountPresetsStore.getState().touched).toBe(true);

    // 중복·0·칸 수 미달은 스토어에 남지 못한다(설정 화면 가드를 우회한 호출도 같은 판정을 지난다).
    useAmountPresetsStore.getState().setCustomPresets([1000, 1000, 5000, 10000]);
    expect(useAmountPresetsStore.getState().customPresets).toBeNull();
  });

  it("null 저장은 기본값 리셋이다", () => {
    useAmountPresetsStore.getState().setCustomPresets([500, 3000, 30000, 100000]);
    useAmountPresetsStore.getState().setCustomPresets(null);
    expect(useAmountPresetsStore.getState().customPresets).toBeNull();
    expect(resolveAmountPresets(useAmountPresetsStore.getState().customPresets)).toBe(QUICK_AMOUNT_PRESETS_KRW);
  });

  it("persist 왕복 — 저장(partialize)→복원(merge)이 네 칸을 그대로 되살리고, 플래그는 저장하지 않는다", () => {
    const options = useAmountPresetsStore.persist.getOptions();
    useAmountPresetsStore.getState().setCustomPresets([500, 3000, 30000, 100000]);
    const saved = options.partialize!({ ...useAmountPresetsStore.getState() });
    expect(saved).toEqual({ customPresets: [500, 3000, 30000, 100000] });

    // 다음 실행(무접촉 상태)에서 저장본이 그대로 이긴다.
    const restored = options.merge!(saved, {
      ...useAmountPresetsStore.getState(),
      customPresets: null,
      touched: false
    }) as { customPresets: number[] | null };
    expect(restored.customPresets).toEqual([500, 3000, 30000, 100000]);
  });

  it("옛/손상 blob은 migrate·merge 어느 경로로 와도 null(기본값)로 떨어진다", () => {
    const options = useAmountPresetsStore.persist.getOptions();
    for (const broken of [
      undefined,
      null,
      "not-an-object",
      { customPresets: "1000,5000" },
      { customPresets: [1000, 5000] },
      { customPresets: [0, 5000, 10000, 50000] },
      { customPresets: [1000, 1000, 5000, 10000] }
    ]) {
      expect(options.migrate!(broken, 1), JSON.stringify(broken)).toEqual({ customPresets: null });
      const merged = options.merge!(broken, { ...useAmountPresetsStore.getState(), touched: false }) as {
        customPresets: number[] | null;
      };
      expect(merged.customPresets, JSON.stringify(broken)).toBeNull();
    }
    // 손상 blob 안에서 쓰레기 항을 걷어낸 결과가 정확히 4칸이면 그 칸들은 살아남는다.
    expect(options.migrate!({ customPresets: [1000, "corrupt", 5000, 10000, 50000] }, 1)).toEqual({
      customPresets: [1000, 5000, 10000, 50000]
    });
  });

  it("하이드레이션이 이 실행의 편집을 되감지 않는다 (records-view.store의 touched 규칙)", () => {
    const merge = useAmountPresetsStore.persist.getOptions().merge!;
    const edited = merge({ customPresets: [1000, 5000, 10000, 50000] }, {
      ...useAmountPresetsStore.getState(),
      customPresets: [500, 3000, 30000, 100000],
      touched: true
    }) as { customPresets: number[] | null };
    expect(edited.customPresets).toEqual([500, 3000, 30000, 100000]);
  });

  it("persist 관례가 저장소의 다른 스토어와 같다(이름·저장소·버전) — 그리고 teardown 목록 밖이다", () => {
    const storeSource = source("src/stores/amount-presets.store.ts");
    expect(storeSource).toContain('name: "wooriai-amount-presets"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    // 기기 단위 취향 — 세션 교체 teardown에 들지 않는다(records-view·notification-preferences·
    // haptics와 같은 범주 · 근거는 스토어 헤더).
    expect(source("src/offline/session-teardown.ts")).not.toContain("amount-presets");
  });
});

describe("라운드 101 W2 F6a 화면 배선 (source verification — 화면은 vitest에서 렌더하지 않는 관례)", () => {
  it("지출 입력: 칩 네 칸이 스토어 값을 순수 해석 함수 하나로만 소비한다", () => {
    const src = source("app/expenses/new.tsx");
    expect(src).toContain('import { useAmountPresetsStore } from "../../src/stores/amount-presets.store";');
    expect(src).toContain("const customAmountPresets = useAmountPresetsStore((state) => state.customPresets);");
    expect(src).toContain("const quickAmountPresets = resolveAmountPresets(customAmountPresets);");
    expect(src).toContain("quickAmountPresets.map((presetKrw) => (");
    // 고정 상수 렌더로 되돌아가지 않는다(상수는 기본값·칸 수의 단일 소스로만 남는다).
    expect(src).not.toContain("QUICK_AMOUNT_PRESETS_KRW.map");
  });

  it("지출 입력: EXP-001 비세션 불변 — 칩 행(스토어 소비 렌더)은 authToken 게이트 안에만 있다", () => {
    const src = source("app/expenses/new.tsx");
    // 슬라이스 두 끝 가드 — 앵커가 사라지면 빈 판정을 하기 전에 여기서 빨개진다.
    const presetRowStart = src.indexOf("quickAmountPresets.map");
    expect(presetRowStart).toBeGreaterThan(-1);
    const before = src.slice(0, presetRowStart);
    expect(before.lastIndexOf("{authToken ? (")).toBeGreaterThan(before.lastIndexOf(") : null}"));
  });

  it("설정 편집 화면: 기존 금액 입력 관례(숫자만·콤마 표기·상한 단일 소스)를 재사용하고 저장이 sanitize를 지난다", () => {
    const src = source("app/settings/amount-presets.tsx");
    expect(src).toContain("amountDigitsOnly(value)");
    expect(src).toContain("formatAmountDigits(presetDigits[index]");
    // 리뷰 M-3(두 시점): 종전 상한은 인자 없는 기본값(서버 int4)이었다 — 이제 문구·판정 둘 다
    // 가산이 실제로 멈추는 QUICK_AMOUNT_MAX_KRW(1억)를 같은 단일 소스 함수에 넘겨 만든다(라벨=효과).
    expect(src).toContain("amountOverLimitMessage(QUICK_AMOUNT_MAX_KRW)");
    expect(src).toContain("isAmountOverLimit(value, QUICK_AMOUNT_MAX_KRW)");
    expect(src).not.toContain("amountOverLimitMessage()");
    expect(src).toContain('"0보다 큰 금액을 입력해 주세요."');
    expect(src).toContain("sanitizeCustomAmountPresets(presetDigits.map(Number))");
    expect(src).toContain("setCustomPresets(sanitized);");
    // 기본값 리셋 버튼 — null 저장 하나로 끝난다(값 복제 없음).
    expect(src).toContain("setCustomPresets(null);");
    expect(src).toContain('label="기본값으로"');
    // 나가는 길 관례(screen-header-back)와 로컬 저장이라는 사실(뮤테이션 0건 — press-guard 밖).
    expect(src).toContain("onBack={() => router.back()}");
    expect(src).not.toContain("useMutation");
  });

  it("설정 목록: '지출 · 예산' 구획에 진입 행이 서고 /settings/amount-presets로 간다", () => {
    const src = source("app/settings/index.tsx");
    // 슬라이스 두 끝 가드 — 지출·예산 구획의 렌더 시작과 다음 구획(알림·잠금) 렌더 시작.
    const start = src.indexOf("{settingsSectionTitles.spending}</Text>");
    const end = src.indexOf("{settingsSectionTitles.alerts}</Text>");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const spendingBlock = src.slice(start, end);
    expect(spendingBlock).toContain('title="빠른 금액 버튼"');
    expect(spendingBlock).toContain('onPress={() => router.push("/settings/amount-presets")}');
  });
});
