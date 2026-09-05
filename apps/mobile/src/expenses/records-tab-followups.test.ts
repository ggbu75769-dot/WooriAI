import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 토스 이월 해소 라운드 트랙 T-B — 기록 탭 몫 8건의 **화면 배선 계약**.
 *
 * 직전 토스급 캠페인에서 app/(tabs)/records.tsx가 다른 수리 중이라 이월된 항목들이다. 화면은
 * vitest에서 렌더할 수 없으므로(react-native 네이티브 바인딩 없음) 이 저장소의 관례대로 소스
 * 계약(grep)으로 잠근다 — records-list-virtualization.test.ts와 같은 방식. 순수 판정
 * (제외 건수 · focusSearch 파싱)의 값 계약은 records-list-view.test.ts가 진다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const recordsSource = source("app/(tabs)/records.tsx");

describe("T-B(#1) '선물·환불 N건 제외' 고지", () => {
  it("건수 판정은 순수 모듈에서 오고, 화면에 expenseType 비교가 다시 서지 않는다", () => {
    expect(recordsSource).toContain("countRecordsExcludedFromMonthlyTotal([");
    // 술어 재인라인 금지 — 합산 규칙은 DNC-015 한 곳(countsTowardMonthlyTotal)뿐이다.
    expect(recordsSource).not.toContain('expenseType === "gift"');
    expect(recordsSource).not.toContain('expenseType === "refund"');
  });

  it("모집단은 월 요약 줄과 같은 필터 무관 월 전체다 (서버 행 + 오프라인 대기 행)", () => {
    expect(recordsSource).toContain("...offlinePendingRows.map((row) => ({ expenseType: row.payload.expenseType })),");
    expect(recordsSource).toContain("...monthlyServerExpenses");
    // 필터가 걸린 listData/visibleExpenses를 세지 않는다 — 요약 줄의 합계가 월 전체이므로.
    expect(recordsSource).not.toContain("countRecordsExcludedFromMonthlyTotal(listData");
  });

  it("0건이면 렌더하지 않고, 요약 줄과 같은 게이트(expenses.data)를 쓴다", () => {
    expect(recordsSource).toContain("{expenses.data && giftRefundExcludedCount > 0 ? (");
    expect(recordsSource).toContain('testID="records-total-exclusion-notice"');
    expect(recordsSource).toContain("`선물·환불 ${giftRefundExcludedCount}건은 합계에서 제외했어요`");
  });

  it("자리: 월 요약 줄 바로 아래, 보낼 수 없는 기록 고지보다 위", () => {
    const summaryAt = recordsSource.indexOf('testID="records-month-summary"');
    const noticeAt = recordsSource.indexOf('testID="records-total-exclusion-notice"');
    const unsendableAt = recordsSource.indexOf('testID="records-unsendable-notice"');
    expect(summaryAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeGreaterThan(summaryAt);
    expect(unsendableAt).toBeGreaterThan(noticeAt);
  });
});

describe("T-B(#2) 더보기 검색 착지 — 기록 탭 수신부", () => {
  it("⚠️ 오늘의 값: 보내는 쪽은 아직 없다 — 더보기 검색 버튼은 파라미터 없이 온다", () => {
    // app/(tabs)/more.tsx의 검색 버튼은 router.push("/(tabs)/records") 한 줄이다(이 트랙 소유
    // 밖이라 손대지 않았다). 이 단언은 사실의 기록이다: 보내는 쪽이 focusSearch를 싣기 시작하는
    // 라운드는 이 단언을 그 사실로 갱신하면 된다 — 수신부는 아래 계약대로 이미 서 있다.
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain('router.push(hasSession ? "/(tabs)/records" : "/settings")');
    expect(moreSource).not.toContain("focusSearch");
  });

  it("focusSearch 파라미터를 순수 파서로 읽고, 검색 TextInput ref에 포커스를 준다", () => {
    expect(recordsSource).toContain("resolveRecordsFocusSearchParam(monthParams.focusSearch)");
    // 타입 인자가 `<TextInput>`(공백 없음)인 것도 계약이다 — keyboard-tap-guard.test.ts가
    // `<TextInput␣` 0건을 이 파일에서 전제 재실측으로 물고 있다.
    expect(recordsSource).toContain("const searchInputRef = useRef<TextInput>(null);");
    expect(recordsSource).toContain("ref={searchInputRef}");
    expect(recordsSource).toContain("searchInputRef.current?.focus();");
  });

  it("가드는 회차(값) 단위다 — 재렌더는 포커스를 빼앗지 않고, 새 회차는 다시 포커스한다", () => {
    const effectAt = recordsSource.indexOf("if (!focusSearchParam) return;");
    expect(effectAt).toBeGreaterThan(-1);
    const effect = recordsSource.slice(effectAt, effectAt + 400);
    expect(effect).toContain("if (appliedFocusSearchRef.current === focusSearchParam) return;");
    // 소모 표시가 적용보다 먼저 선다(라운드 57 QA P1-1 달력 착지와 같은 순서).
    expect(effect.indexOf("appliedFocusSearchRef.current = focusSearchParam;")).toBeLessThan(
      effect.indexOf("searchInputRef.current?.focus();")
    );
    // 회차가 deps에 있어야 마운트된 채로도 두 번째 착지가 effect를 깨운다.
    expect(effect).toContain("}, [focusSearchParam]);");
  });
});

describe("T-B(#3) 월 합계 금액 타이포 — 디자인 시스템 amountMedium 소비", () => {
  it("합계 카드 금액이 amountMedium(tabular-nums) 티어로 선다 (새 토큰 생성 없음)", () => {
    expect(recordsSource).toContain("style={[theme.typography.amountMedium, { color: theme.colors.brown }]}");
    // 종전 인라인 24/800은 남아 있지 않다.
    expect(recordsSource).not.toContain('fontSize: 24, fontWeight: "800"');
  });
});

describe("T-B(#4) 상단 요약 줄 스택 — caption(11px)급 → body2 승격 + gap 8", () => {
  const stackTestIds = [
    "records-month-summary",
    "records-total-exclusion-notice",
    "records-unsendable-notice",
    "records-search-scope",
    "records-filter-scope",
    "records-last-month-insight"
  ];

  it("스택의 여섯 줄이 전부 body2 크기다 (caption으로 남은 줄이 없다)", () => {
    for (const testId of stackTestIds) {
      const at = recordsSource.indexOf(`testID="${testId}"`);
      expect(at, testId).toBeGreaterThan(-1);
      const block = recordsSource.slice(at, recordsSource.indexOf(">", at));
      expect(block, `${testId}의 글자 크기`).toContain("fontSize: theme.typography.body2.fontSize");
      expect(block, `${testId}에 남은 caption`).not.toContain("theme.typography.caption.fontSize");
    }
  });

  it("스택 컨테이너의 줄 간격이 8이다", () => {
    expect(recordsSource).toContain("<View style={{ gap: 8 }}>");
    expect(recordsSource).not.toContain("<View style={{ gap: 6 }}>");
  });
});

describe("T-B(#5) 인라인 Pressable press 피드백 — TOSS-T2 홈/더보기와 같은 패턴", () => {
  it("공용 값(카드형 프레스 0.76)을 화면 상수 하나로 두고 인라인 Pressable들이 소비한다", () => {
    expect(recordsSource).toContain("const recordsPressedStyle = { opacity: 0.76 } as const;");
    // 래퍼형(기본 스타일 없음): 서버 행 · 오프라인 행.
    expect((recordsSource.match(/\(\{ pressed \}\) => \(pressed \? recordsPressedStyle : null\)/g) ?? []).length).toBe(2);
    // 합성형(기존 스타일 위에 얹음): 동기화 칩 줄 · 달 화살표 둘 · 달 라벨 트리거.
    expect((recordsSource.match(/pressed && recordsPressedStyle/g) ?? []).length).toBe(4);
  });

  it("⚠️ 예외 한 곳: 아이 전환 트리거는 정적 style 그대로다 (a11y-contract의 인용 원본 한 줄)", () => {
    // a11y-contract.test.ts(달 라벨 트리거 계약)가 이 한 줄을 파일에서 그대로 찾는다 — 감싸는
    // 콜백으로 바꾸면 그 계약이 "발명이 아니라 인용"의 근거를 잃는다.
    expect(recordsSource).toContain(
      'style={{ alignItems: "center", justifyContent: "center", minHeight: theme.touchTarget }}'
    );
  });
});

describe("T-B(#6) 기록 추가 FAB — AppScreen floatingAction 오버레이의 로컬 복제", () => {
  it("FAB는 홈(TOSS-T2)과 같은 목적지·게이트다", () => {
    expect(recordsSource).toContain(
      '<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />'
    );
  });

  it("오버레이는 AppScreen 슬롯(T1)과 같은 문법이다 — box-none · 하단 고정, AppScreen 래핑은 없다", () => {
    // 이 화면은 리스트 자신이 스크롤러라(PERF-102) AppScreen을 쓸 수 없다 — 그 슬롯이 그리는
    // 오버레이 한 줄을 같은 값으로 복제한다(src/ui.tsx floatingAction 참고).
    expect(recordsSource).toContain(
      '<View style={{ bottom: theme.spacing.screen, left: 0, pointerEvents: "box-none", position: "absolute", right: 0 }}>'
    );
    expect(recordsSource).not.toContain("<AppScreen");
    // FAB는 SectionList 뒤(위에 겹쳐) 선다.
    expect(recordsSource.indexOf("<FloatingActionButton")).toBeGreaterThan(recordsSource.indexOf("<SectionList"));
  });

  it("목록 끝 행이 FAB에 가려지지 않게 홈 캔버스와 같은 바닥 여백을 더한다", () => {
    expect(recordsSource).toContain("paddingBottom: theme.spacing.screen + theme.ctaHeight + 8");
  });
});

describe("T-B(#7) eyebrow 중복 제거 — '지출 기록'/'기록' 한 자리만", () => {
  it("헤더는 제목 한 자리다 (eyebrow가 같은 뜻을 한 줄 더 말하지 않는다)", () => {
    expect(recordsSource).toContain('<ScreenHeader title="기록"');
    expect(recordsSource).not.toContain('eyebrow="지출 기록"');
  });
});

describe("T-B(#8) 행 카드 크롬 → flat 리스트 행", () => {
  it("공용 ListRow(Card 크롬)를 더 이상 그리지 않고, 이 화면 로컬 flat 표면으로 그린다", () => {
    // 공용에 flat variant가 없어(새 공용 export 금지) 로컬 컴포넌트다 — 다른 화면의 ListRow와
    // 픽셀락은 그대로다.
    expect(recordsSource).not.toMatch(/<ListRow[\s/>]/);
    expect(recordsSource).toContain("function RecordsFlatRow({");
    const styleAt = recordsSource.indexOf("const recordsFlatRowStyle = {");
    expect(styleAt).toBeGreaterThan(-1);
    const styleBlock = recordsSource.slice(styleAt, recordsSource.indexOf("} as const;", styleAt));
    // 크롬이 없다: 테두리·그림자·카드 배경 없이 행 레이아웃뿐이다.
    expect(styleBlock).not.toContain("borderWidth");
    expect(styleBlock).not.toContain("shadows");
    expect(styleBlock).not.toContain("backgroundColor");
    // 터치 타겟 유지(48 ≥ 44).
    expect(styleBlock).toContain("minHeight: theme.touchTarget");
  });

  it("행 배선(prop 이름·금액 문자열)은 종전 그대로다", () => {
    expect(recordsSource).toContain("value={formatKrw(expense.amountKrw)}");
    expect(recordsSource).toContain("value={formatKrw(row.payload.amountKrw)}");
    expect(recordsSource).toContain("subtitle={offlineRecordRowSubtitle({");
    // 오프라인 행의 탭 목적지(동기화 상태)는 그대로 Pressable이 진다.
    expect(recordsSource).toContain("onPress={pushSyncStatus}");
  });
});
