import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  shouldCelebrateFirstRecord,
  useFirstRecordCelebrationStore,
  FIRST_RECORD_CELEBRATION_BODY,
  FIRST_RECORD_CELEBRATION_MESSAGE,
  FIRST_RECORD_CELEBRATION_TEST_ID,
  FIRST_RECORD_CELEBRATION_TITLE
} from "./first-record-celebration";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

describe("UX-G shouldCelebrateFirstRecord", () => {
  it("직접 관찰한 0 -> 1 전이에서만 축하한다", () => {
    expect(shouldCelebrateFirstRecord({ previous: false, next: true, alreadyCelebrated: false })).toBe(true);
  });

  it("앱을 켜자마자의 첫 관찰(previous 없음)은 전이가 아니다 -- 이미 기록이 있는 사용자에게 뜨지 않는다", () => {
    expect(shouldCelebrateFirstRecord({ previous: undefined, next: true, alreadyCelebrated: false })).toBe(false);
  });

  it("기록이 계속 있거나 계속 없으면 축하하지 않는다", () => {
    expect(shouldCelebrateFirstRecord({ previous: true, next: true, alreadyCelebrated: false })).toBe(false);
    expect(shouldCelebrateFirstRecord({ previous: false, next: false, alreadyCelebrated: false })).toBe(false);
  });

  it("기록이 사라지는 방향(1 -> 0)에는 축하하지 않는다", () => {
    expect(shouldCelebrateFirstRecord({ previous: true, next: false, alreadyCelebrated: false })).toBe(false);
  });

  it("이번 세션에 이미 축하했으면 다시 축하하지 않는다", () => {
    expect(shouldCelebrateFirstRecord({ previous: false, next: true, alreadyCelebrated: true })).toBe(false);
  });
});

describe("UX-G useFirstRecordCelebrationStore", () => {
  beforeEach(() => {
    useFirstRecordCelebrationStore.getState().reset();
  });

  it("0 -> 1 전이를 관찰하면 그 아이의 배너를 켠다", () => {
    const { observe } = useFirstRecordCelebrationStore.getState();
    observe("child-a", false);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();

    observe("child-a", true);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBe("child-a");
  });

  it("첫 관찰이 \"기록 있음\"이면 배너를 켜지 않는다 (콜드 스타트)", () => {
    useFirstRecordCelebrationStore.getState().observe("child-a", true);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();
  });

  it("닫으면 같은 세션에서 다시 뜨지 않는다", () => {
    const { observe, dismiss } = useFirstRecordCelebrationStore.getState();
    observe("child-a", false);
    observe("child-a", true);
    dismiss();
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();

    // 지출을 지웠다가 다시 남겨도(0 -> 1이 또 일어나도) 축하는 아이당 한 번뿐이다.
    observe("child-a", false);
    observe("child-a", true);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();
  });

  it("아이를 전환해도 다른 아이의 관찰값이 섞이지 않는다", () => {
    const { observe } = useFirstRecordCelebrationStore.getState();
    // 첫째: 이미 기록이 있는 상태로 관찰만 되어 있다.
    observe("child-a", true);
    // 둘째로 전환 -- 기록이 없다.
    observe("child-b", false);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();
    // 다시 첫째로 돌아온다: 첫째는 여전히 "기록 있음"이라 전이가 아니다.
    observe("child-a", true);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBeNull();
    // 둘째가 첫 기록을 남기면 그때 둘째의 배너가 뜬다.
    observe("child-b", true);
    expect(useFirstRecordCelebrationStore.getState().activeChildId).toBe("child-b");
  });

  it("세션 상태다 -- persist하지 않으므로 reset 후 아무것도 남지 않는다", () => {
    const { observe, reset } = useFirstRecordCelebrationStore.getState();
    observe("child-a", false);
    observe("child-a", true);
    reset();

    const state = useFirstRecordCelebrationStore.getState();
    expect(state.activeChildId).toBeNull();
    expect(state.observedHasRecord).toEqual({});
    expect(state.celebratedChildIds).toEqual({});
    expect(state.everHadRecordChildIds).toEqual({});
  });

  it("F3: \"한 번이라도 기록이 있었다\"는 이력이 아이별로 남고, 거짓 관찰에 덮이지 않는다", () => {
    const { observe } = useFirstRecordCelebrationStore.getState();
    observe("child-a", false);
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds["child-a"]).toBeUndefined();

    observe("child-a", true);
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds["child-a"]).toBe(true);

    // 동기화 확정 순간의 한 프레임(대기 행은 사라졌고 서버 목록은 아직 안 왔다).
    observe("child-a", false);
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds["child-a"]).toBe(true);
    // 다른 아이는 그 이력을 물려받지 않는다.
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds["child-b"]).toBeUndefined();
  });

  it("스토어 모듈이 zustand persist를 쓰지 않는다 (디스크 스키마를 만들지 않는다)", () => {
    const source = readFileSync(join(process.cwd(), "src/home/first-record-celebration.ts"), "utf8");
    expect(source).not.toContain("persist(");
    expect(source).not.toContain("createJSONStorage");
  });
});

describe("UX-G 축하 배너 문구·배선", () => {
  it("라운드 35 F4: 문구가 특정 화면 요소를 지목하지 않는다 (선물·지난달 첫 기록에도 참이다)", () => {
    expect(FIRST_RECORD_CELEBRATION_TITLE).toBe("첫 기록이에요!");
    // 예전 문구는 "이제 이번 달 총액이 여기 쌓여요."로 히어로 카드를 지목했다. 첫 기록이 선물
    // (DNC-015: 월 사용액에서 제외)이거나 지난달 날짜면 히어로는 0원 그대로라 거짓 지목이 된다.
    expect(FIRST_RECORD_CELEBRATION_BODY).toBe("기록 탭에서 언제든 다시 볼 수 있어요.");
    expect(FIRST_RECORD_CELEBRATION_BODY).not.toContain("이번 달");
    expect(FIRST_RECORD_CELEBRATION_BODY).not.toContain("총액");
    expect(FIRST_RECORD_CELEBRATION_BODY).not.toContain("여기");
    expect(FIRST_RECORD_CELEBRATION_MESSAGE).toBe(
      `${FIRST_RECORD_CELEBRATION_TITLE} ${FIRST_RECORD_CELEBRATION_BODY}`
    );
  });

  it("홈이 0 -> 1 전이를 관찰해 배너를 켠다", () => {
    expect(homeSource).toContain('from "../../src/home/first-record-celebration"');
    expect(homeSource).toContain("observeFirstRecord(childId, hasAnyExpenseRecord)");
    expect(homeSource).toContain(
      "const showFirstRecordCelebration = hasSession && Boolean(childId) && celebrationChildId === childId;"
    );
  });

  it("배너는 히어로 카드 바로 아래, 예산 경고 배너보다 앞에 온다", () => {
    const heroIndex = homeSource.indexOf("<HeroSummaryCard");
    const celebrationIndex = homeSource.indexOf(`testID={FIRST_RECORD_CELEBRATION_TEST_ID}`);
    const warningIndex = homeSource.indexOf('testID="home-budget-warning-banner"');

    expect(heroIndex).toBeGreaterThan(-1);
    expect(celebrationIndex).toBeGreaterThan(heroIndex);
    expect(celebrationIndex).toBeLessThan(warningIndex);
  });

  it("배너가 소리로도 알려지고 장식 글리프는 접근성 트리에서 감춰진다", () => {
    expect(homeSource).toContain("accessibilityLabel={FIRST_RECORD_CELEBRATION_MESSAGE}");
    expect(homeSource).toContain("<Text accessible={false} style={homeFirstRecordCelebrationStyle.icon}>");
    expect(FIRST_RECORD_CELEBRATION_TEST_ID).toBe("home-first-record-celebration");
  });
});
