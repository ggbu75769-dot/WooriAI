/**
 * 기록 탭 달력 **뷰**(격자·칸·음영·범례). 짝이 되는 `./records-calendar.ts`는 달력 **계산**이다
 * — 판정(주 배열·음영 단계·라벨 문구·칸 목적지)은 전부 그쪽 순수 모듈에 있고, 이 파일은 그 답을
 * 그리기만 한다. 이름이 비슷한 두 모듈이므로 새 규칙을 어디에 적을지 헷갈리면 **규칙은 계산 쪽,
 * 스타일 값과 JSX는 이쪽**이다.
 *
 * 라운드 68 트랙 E(#9): `app/(tabs)/records.tsx`(2,001줄)에서 **그대로 옮겨 왔다** — 값·문구·
 * 스타일·구조가 한 글자도 바뀌지 않은 순수 이동이고, 사용자에게 보이는 변화는 0건이다. 화면
 * 파일이 계속 자라 두 트랙이 같은 파일에서 일하게 되는 것을 끊는 것이 목적이었다. 이 화면은
 * 픽셀락 캡처 대상이 아니라(기록 화면은 픽셀락 스타일 모듈 열 개 어디에도 없고, 보정 변환도
 * 갖지 않는다) 옮겨도 캡처 재대조가 필요 없다 — 반대로 `app/(tabs)/reports.tsx`는 REP-001 보정
 * 변환을 지므로 같은 방식으로 나누지 않는다.
 *
 * 이 격자가 왜 SectionList의 ListHeaderComponent 안에서 그려지는지(별도 스크롤 컨테이너를 만들지
 * 않는 이유)는 화면 파일 쪽 "UX-D: 월 캘린더 뷰" 배너에 남아 있다.
 */
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";
import { Card } from "../ui";
import {
  calendarCellAccessibilityLabel,
  calendarLegendText,
  CALENDAR_WEEKDAY_LABELS_KO,
  formatCompactKrw,
  resolveCalendarCellAction,
  type CalendarCell,
  type CalendarMonth
} from "./records-calendar";

/**
 * 음영 팔레트(DNC-017): **새 색을 만들지 않는다**. 0단계(지출 없음)는 카드 배경톤,
 * 1~4단계는 기존 coral 스케일 토큰을 옅은 것부터 그대로 쓴다. rgba로 새 alpha 값을 지어내는
 * 대신 스케일 토큰을 쓰는 이유: 그 다섯 색은 이미 디자인 시스템이 고른 단계라, 팔레트가
 * 바뀌어도 달력만 따로 어긋나지 않는다.
 *
 * 라운드 34 L6 — 1단계를 coral[50]에서 **coral[100]으로 한 칸 올렸다**. beige와 coral[50]은
 * 채널 차이가 거의 없어, "그날 돈을 썼다"와 "안 썼다"가 사실상 같은 색이었다 -- 히트맵의 첫
 * 단계가 안 보이면 달력이 하려던 말("언제 몰아서 썼나")의 절반이 사라진다.
 *
 * DSN-053 P1 재검산(팔레트가 c20deeb 값으로 롤백된 뒤, WCAG 2.1 상대휘도 · 소형 볼드 AA
 * 4.5:1 기준). 단계 색은 그대로 beige → coral[100] → [200] → [300] → [400]이고, 지금 값에서도
 * beige(cream.surfaceAlt)와 coral[100]은 눈에 잡히게 벌어져 있다.
 *
 * 칸 글자는 계속 gray900 한 색으로 다섯 단계를 모두 통과한다 -- 가장 밝은 beige 위 **15.28:1**,
 * 가장 진한 coral[400] 위 **6.50:1**. 단계마다 글자색을 바꾸지 않는 원칙은 그대로다(한 색으로
 * 전 단계를 통과시키는 것이 요점이고, 옅은 칸의 숫자도 그만큼 더 또렷해진다).
 *
 * 주의: 롤백된 팔레트에서 brown과 gray900은 **같은 토큰(text.primary)** 을 가리킨다. 즉 L6이
 * 했던 "brown → gray900" 교체는 지금 값에서는 색이 바뀌지 않는다. 그래도 gray900을 계속 쓰는
 * 이유는 두 이름의 뜻이 다르기 때문이다 -- brown은 본문 색, gray900은 "가장 진한 중립"이고,
 * 팔레트가 다시 갈라지면 히트맵이 따라가야 하는 쪽은 후자다. 두 이름이 다시 다른 값이 되면
 * 위 두 비율부터 재계산할 것.
 */
const calendarIntensityBackgrounds = [
  theme.colors.beige,
  theme.colors.coral[100],
  theme.colors.coral[200],
  theme.colors.coral[300],
  theme.colors.coral[400]
] as const;

/** 위 대비 재검산에 따른 칸 글자색. 다섯 단계 공통이다. */
const calendarCellTextColor = theme.colors.gray900;

/**
 * 라운드 34 M1 — 칸 가로 실측을 44dp에 최대한 붙인다.
 *
 * 예전 폭(폭 360dp 기기 기준):
 *   360 − 48(리스트 contentContainer padding = theme.spacing.screen 24 × 2)
 *       − 34(Card 테두리 1 × 2 + 기본 padding theme.spacing.card 16 × 2)
 *       − 24(칸 사이 gap 4 × 6) = 254 ÷ 7 = **36.3dp**.
 * 44dp 최소 터치 타깃에 8dp 가까이 모자랐고, 인접 간격이 4dp뿐이라 hitSlop으로 넓히면 옆
 * 날짜의 영역을 침범한다(잘못된 날짜로 이동하는 편이 좁은 것보다 나쁘다).
 *
 * 지금:
 *   360 − 48 − 18(테두리 1 × 2 + 축소한 카드 padding 8 × 2) − 12(gap 2 × 6) = 282 ÷ 7 = **40.3dp**.
 * 격자에서 44dp를 온전히 얻으려면 7 × 44 + gap = 314dp가 필요해 화면 가로 여백(48dp)을 통째로
 * 없애야 한다 -- 그건 이 화면만 다른 레이아웃을 갖게 되므로 하지 않는다. 대신 **세로로 갚는다**:
 * 칸 높이를 44 → 48dp로 올려 터치 면적을 40.3 × 48 ≈ 1,934dp²로 만들었다(44 × 44 = 1,936dp²와
 * 사실상 같다). 좁아진 축은 가로 한 방향뿐이고, 세로 여유가 위아래 오탭도 함께 줄인다.
 */
const CALENDAR_CARD_PADDING = 8;
const CALENDAR_CELL_GAP = 2;
const CALENDAR_CELL_MIN_HEIGHT = 48;

/**
 * 라운드 34 M2 — 칸 글자의 배율 상한.
 *
 * 축약 표기(formatCompactKrw)의 근거는 "잘린 숫자는 틀린 숫자"(45,0…)인데, 기기 글꼴 배율을
 * 크게 올리면 그 축약마저 칸을 넘쳐 잘렸다 -- 모듈이 지키던 규칙을 화면이 도로 깨고 있었다.
 * 여기서 배율을 1.2배로 물려 **칸 안에서 끝까지 읽히는 숫자**를 보장한다. 앱의 글꼴 최소치를
 * 새로 낮추지 않는다(fontSize는 그대로, 상한만 둔다). 정확한 금액은 어차피 스크린리더 라벨과
 * 그날 목록이 전한다.
 */
const CALENDAR_CELL_MAX_FONT_SCALE = 1.2;

const calendarCardStyle = { padding: CALENDAR_CARD_PADDING } as const;

const calendarWeekRowStyle = {
  flexDirection: "row",
  gap: CALENDAR_CELL_GAP
} as const;

const calendarWeekdayLabelStyle = {
  color: theme.colors.gray600,
  flex: 1,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700",
  textAlign: "center"
} as const;

// 테두리 두께를 오늘/평일 모두 2로 고정하고 **색만** 바꾼다 -- 두께를 바꾸면 오늘 칸만 안쪽
// 크기가 달라져 격자가 한 줄 흔들린다.
const calendarCellStyle = {
  alignItems: "center",
  borderColor: "rgba(74, 63, 53, 0.10)",
  borderRadius: theme.radii.small,
  borderWidth: 2,
  flex: 1,
  gap: 1,
  justifyContent: "center",
  minHeight: CALENDAR_CELL_MIN_HEIGHT,
  paddingVertical: 4
} as const;

const calendarCellTodayBorderStyle = {
  borderColor: theme.colors.mainCoral
} as const;

// 달 밖 빈 칸: 자리만 차지하고 눌리지 않는다(옆 달 날짜를 그려 봐야 이 달 목록에는 그날 기록이
// 없어서 눌러도 아무 일도 일어나지 않는다).
const calendarCellSpacerStyle = {
  flex: 1,
  minHeight: CALENDAR_CELL_MIN_HEIGHT
} as const;

const calendarCellDayStyle = {
  color: calendarCellTextColor,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700"
} as const;

const calendarCellAmountStyle = {
  color: calendarCellTextColor,
  fontSize: 10,
  fontWeight: "800"
} as const;

// L9: 9px는 이 앱에서 가장 작은 글자였다(다음으로 작은 것이 10px). 한 단어("선물")뿐이라
// 칸을 넘치지 않으므로 10px로 올리고, 금액과 **같은 배율 상한**을 함께 물린다.
const calendarCellGiftStyle = {
  color: theme.colors.gray600,
  fontSize: 10,
  fontWeight: "700"
} as const;

const calendarLegendStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight
} as const;

/**
 * 달력 한 칸. 라벨/축약 표기 규칙은 전부 순수 모듈(src/expenses/records-calendar.ts)에 있다.
 *
 * 칸에 보이는 금액은 축약("4.5만")이고 스크린리더 라벨은 정확한 금액("45,000원")이다 --
 * 44pt 칸에 "45,000원"을 넣으면 잘려서 **틀린 숫자**로 읽힌다.
 */
const CalendarDayCell = memo(function CalendarDayCell({
  cell,
  filterLabel,
  onSelectDate,
  onRecordForDate
}: {
  cell: CalendarCell;
  filterLabel: string | null;
  onSelectDate: (date: string) => void;
  /** 라운드 63 C(#8): 기록이 없는(그리고 미래가 아닌) 날 칸의 목적지 — 그날로 기록하기. */
  onRecordForDate: (date: string) => void;
}) {
  const date = cell.date;
  if (date === null) return <View style={calendarCellSpacerStyle} />;
  // 칸 안쪽(날짜 + 금액/선물)은 누를 수 있든 없든 완전히 같다 -- 비대화형이라고 정보를 지우지
  // 않는다(그날 지출이 없었다는 것도 히트맵이 말해야 할 사실이다).
  const cellContent = (
    <>
      <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} style={calendarCellDayStyle}>
        {cell.day}
      </Text>
      {cell.totalKrw > 0 ? (
        <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} numberOfLines={1} style={calendarCellAmountStyle}>
          {formatCompactKrw(cell.totalKrw)}
        </Text>
      ) : cell.hasGiftOnly ? (
        // 선물·환불만 있던 날. "0원"을 찍으면 아무것도 안 한 날처럼 보이는데 그날엔 기록이 있다
        // (UX-B 날짜 헤더가 소계를 감추는 것과 같은 판단).
        <Text maxFontSizeMultiplier={CALENDAR_CELL_MAX_FONT_SCALE} style={calendarCellGiftStyle}>
          선물
        </Text>
      ) : null}
    </>
  );
  const cellStyle = [
    calendarCellStyle,
    { backgroundColor: calendarIntensityBackgrounds[cell.intensity] },
    cell.isToday ? calendarCellTodayBorderStyle : null
  ];
  const accessibilityLabel = calendarCellAccessibilityLabel(cell, { filterLabel }) ?? undefined;

  // 라운드 34 L4 / 라운드 63 C(#8): 이 칸을 누르면 무엇이 일어나는지는 순수 모듈이 정한다
  // (resolveCalendarCellAction -- 기록 있는 날은 그날 기록으로, 기록 없는 지난 날은 그날로
  // 기록하기, 달 밖·미래는 null). 화면은 그 답을 목적지 둘로 옮기기만 한다.
  const action = resolveCalendarCellAction(cell);
  // 비대화형 칸을 disabled Pressable 대신 아예 View로 그리는 이유(L4 그대로): disabled 버튼도
  // 스크린리더에는 "버튼, 비활성"으로 읽혀 "왜 못 누르지"라는 질문을 남긴다. 라벨은 그대로
  // 읽어 주고, 이제 그 라벨이 이유("아직 오지 않은 날이라…")까지 말한다.
  if (action === null) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={cellStyle}>
        {cellContent}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => (action === "record-new" ? onRecordForDate(date) : onSelectDate(date))}
      style={cellStyle}
    >
      {cellContent}
    </Pressable>
  );
});

/** 요일 헤더 + 주 격자 + 범례. 주 배열은 순수 모듈이 만들어 둔 것을 그대로 그린다. */
export const RecordsCalendarGrid = memo(function RecordsCalendarGrid({
  month,
  filterLabel,
  onSelectDate,
  onRecordForDate
}: {
  month: CalendarMonth;
  /** L5: 필터가 걸렸을 때의 스코프 이름(F8 스코프 줄과 같은 문자열). 없으면 null. */
  filterLabel: string | null;
  onSelectDate: (date: string) => void;
  onRecordForDate: (date: string) => void;
}) {
  return (
    // M1: 카드 내부 패딩을 줄여 칸 폭을 벌었다(위 CALENDAR_CARD_PADDING 계산 참고).
    <Card style={calendarCardStyle}>
      <View style={{ gap: 4 }}>
        {/* 요일 머리글은 스크린리더에는 소음이다 -- 각 칸 라벨이 이미 "8월 27일"이라는 완전한
            날짜를 읽어준다. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={calendarWeekRowStyle}>
          {CALENDAR_WEEKDAY_LABELS_KO.map((label) => (
            <Text key={label} style={calendarWeekdayLabelStyle}>
              {label}
            </Text>
          ))}
        </View>
        {month.weeks.map((week, weekIndex) => (
          <View key={`${month.yearMonth}-week-${weekIndex}`} style={calendarWeekRowStyle}>
            {week.map((cell) => (
              <CalendarDayCell
                key={cell.key}
                cell={cell}
                filterLabel={filterLabel}
                onSelectDate={onSelectDate}
                onRecordForDate={onRecordForDate}
              />
            ))}
          </View>
        ))}
        {/* L5: 필터가 걸리면 범례가 "무엇의 히트맵인지"까지 말한다(칸 라벨 접두와 같은 사실). */}
        <Text style={calendarLegendStyle}>{calendarLegendText(filterLabel)}</Text>
      </View>
    </Card>
  );
});
