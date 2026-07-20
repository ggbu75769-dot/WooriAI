import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("MOD_V1 product contract", () => {
  it("keeps the five tabs visible in the required order", () => {
    const layout = source("app/(tabs)/_layout.tsx");
    const positions = ["홈", "기록", "준비템", "리포트", "프로필"].map((label) => layout.indexOf(`title: "${label}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(layout).not.toContain('name="more" options={{ href: null }}');
  });

  it("shows three onboarding stages and preserves the hardened final submit", () => {
    expect(source("src/onboarding/steps.ts")).toContain('title: "아이 정보"');
    expect(source("src/onboarding/steps.ts")).toContain('title: "준비 현황"');
    expect(source("src/onboarding/steps.ts")).toContain('title: "월 예산"');
    expect(source("src/onboarding/steps.ts")).not.toContain("ONB-004");
    expect(source("src/onboarding/ReviewScreen.tsx")).toContain("buildOnboardingCompletionInput");
    expect(source("src/onboarding/ReviewScreen.tsx")).toContain("finalSubmitIdempotencyKey");
  });

  it("uses one shared sync state on every root tab", () => {
    for (const path of [
      "app/(tabs)/index.tsx",
      "app/(tabs)/records.tsx",
      "src/preparation/Release4PreparationScreen.tsx",
      "app/(tabs)/reports.tsx",
      "app/(tabs)/more.tsx"
    ]) {
      expect(source(path), path).toContain("SyncStatusBar");
      expect(source(path), path).toContain("normalizeAppSyncStatus");
    }
  });

  it("renders a responsive preparation grid and saves one of eight labelled states through a bottom sheet", () => {
    const screen = source("src/preparation/Release4PreparationScreen.tsx");
    const primitives = source("src/design-system/components/ModV1Primitives.tsx");
    expect(screen).toContain('width >= 480 ? 4 : 3');
    expect(screen).toContain("<PreparationItemCard");
    expect(screen).toContain("<BottomSheet");
    expect(screen).toContain("<ItemStatusControl");
    expect(screen).toContain("updatePlan.mutate");
    for (const label of ["알아보기", "예정", "주문", "보유", "대여", "선물", "교체", "종료"]) {
      expect(primitives).toContain(`label: "${label}"`);
    }
  });

  it("uses one report source for the chart and accessibility table with maturity gates", () => {
    const report = source("app/(tabs)/reports.tsx");
    expect(report).toContain("<AccessibleDataTable");
    expect(report).toContain("rows={displayRows.map");
    expect(report).toContain("activeRecordCount >= 3");
    expect(report).toContain('displayState === "complete_empty"');
    expect(report).toContain("reportV3.data?.maturity.showTrend");
    expect(report).toContain("disabled={monthOffset >= 0}");
  });

  it("shares expense validation and the honest attribution field across create and edit", () => {
    const create = source("app/expenses/new.tsx");
    const edit = source("app/expenses/[expenseId].tsx");
    for (const screen of [create, edit]) {
      expect(screen).toContain("validateExpenseForm");
      expect(screen).toContain("<ExpenseAttributionField />");
    }
    expect(source("src/expenses/ExpenseAttributionField.tsx")).toContain("현재 저장 계약은 선택한 아이 귀속만 지원해요.");
  });

  it("keeps provider availability, notification rollback, and deletion grace honest", () => {
    const login = source("app/(auth)/login.tsx");
    const notifications = source("app/notification-preferences.tsx");
    const privacy = source("app/settings/privacy.tsx");
    expect(login).toContain("fetchAppConfig");
    expect(login).toContain("Apple로 시작하기. 현재 사용할 수 없어요.");
    expect(notifications).toContain("onMutate");
    expect(notifications).toContain("onError");
    expect(notifications).not.toContain("저장하기");
    expect(privacy).toContain("getCurrentAccountDeletion");
    expect(privacy).toContain("회원 탈퇴 요청 취소");
  });

  it("connects the profile hub to real data and marks unavailable export as unavailable", () => {
    const profile = source("app/(tabs)/more.tsx");
    for (const call of ["getHome", "listChildren", "listHouseholdMembers", "getBudget", "getNotificationPreferences"]) {
      expect(profile).toContain(call);
    }
    expect(profile).toContain('title="지출 내역 내보내기"');
    expect(profile).toContain('subtitle="현재 서버에서 제공하지 않아요"');
    expect(profile).toContain("appManifest.expo.version");
  });
});
