import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DSN-053 P2-D — 리포트 · 더보기("프로필") · 가족 세 화면의 **승인 캡처 정합** 계약.
 *
 * 이 저장소의 react-native 화면은 vitest에서 렌더할 수 없다(네이티브 바인딩 없음). 그래서
 * 다른 화면 계약들과 같은 관례로 소스 그렙을 쓴다 -- src/ui-pixel-lock-flow.test.ts ·
 * src/reports/monthly-insight-flow.test.ts와 같은 방식이다.
 *
 * 여기서 지키는 것은 "무엇이 어떤 순서로, 어떤 치수로 서는가"뿐이다. 각 화면의 기능 계약
 * (드릴다운 · 공유 · 초대 권한 · 오프라인 문구 등)은 이미 자기 테스트가 지고 있고, 이 파일은
 * 그것들을 다시 적지 않는다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("DSN-053 P2-D 리포트(REP-001) 구획 순서와 월 내비", () => {
  const reportSource = () => source("app/(tabs)/reports.tsx");

  /**
   * 승인 캡처의 구획 순서: 세그먼트 → 월 내비 → 총 지출 라인차트 → 카테고리 도넛 →
   * peach 카드(팁 자리 = 세션의 인사이트) → 누적 peach 카드. 세션 확장 구획(마일스톤)은 그 뒤.
   *
   * 비세션 프리뷰 분기가 파일 앞쪽에 먼저 오므로 세션 쪽 좌표는 lastIndexOf로 집는다.
   */
  it("세션 경로가 캡처 6구획 순서대로 서고, 마일스톤 카드는 그 뒤에 온다", () => {
    const src = reportSource();
    const segmented = src.indexOf("<SegmentedControl options={[");
    const periodRow = src.indexOf("style={reportReferencePeriodRowStyle}");
    const lineChart = src.lastIndexOf("<LineChartCard");
    const donut = src.lastIndexOf("<DonutChartCard");
    const insight = src.indexOf("{monthlyInsight ? (");
    const cumulative = src.indexOf(">오늘도 소중한 하루였어요<");
    const milestone = src.indexOf("style={reportMilestoneCardStyle}");

    for (const [name, position] of Object.entries({ segmented, periodRow, lineChart, donut, insight, cumulative, milestone })) {
      expect(position, `${name} 구획을 찾지 못했다`).toBeGreaterThan(-1);
    }
    expect(segmented).toBeLessThan(periodRow);
    expect(periodRow).toBeLessThan(lineChart);
    expect(lineChart).toBeLessThan(donut);
    // 종전에는 인사이트 카드가 라인차트 **앞**에 서서 캡처의 ③④를 밀어냈다.
    expect(donut).toBeLessThan(insight);
    expect(insight).toBeLessThan(cumulative);
    expect(cumulative).toBeLessThan(milestone);
  });

  it("peach 카드 두 장(팁 자리·누적)이 같은 18/800 제목 줄을 쓴다", () => {
    const src = reportSource();
    expect(src).toContain("const reportInsightCardStyle = reportReferenceTipCardStyle;");
    expect(src).toContain("const reportInsightHeadlineStyle = reportReferenceTipTitleStyle;");
    expect(src).toContain(
      [
        "const reportReferenceTipTitleStyle = {",
        "  color: theme.colors.brown,",
        "  fontSize: 18,",
        '  fontWeight: "800",',
        "  lineHeight: 24"
      ].join("\n")
    );
  });

  it("월 내비 화살표가 48dp 타깃 안의 28px chevron이고 라벨은 18/800이다", () => {
    const src = reportSource();
    // 48dp 정사각 버튼.
    expect(src).toContain(
      [
        "const reportReferencePeriodArrowButtonStyle = {",
        '  alignItems: "center",',
        "  height: theme.touchTarget,",
        '  justifyContent: "center",',
        "  width: theme.touchTarget"
      ].join("\n")
    );
    // 28px 아이콘 -- 크기·색은 예전 스타일 토큰에서 그대로 읽는다(A11Y-117 dim 계약 유지).
    expect(src).toContain("fontSize: 28,");
    expect(src).toContain('<AppIcon color={glyph.color} name={direction === "left" ? "chevron-left" : "chevron-right"} size={glyph.fontSize} />');
    expect(src).toContain("reportReferencePeriodArrowDisabledStyle");
    // 기기 폰트에 휘둘리던 텍스트 글리프 화살표는 남지 않았다.
    expect(src).not.toContain(">‹</Text>");
    expect(src).not.toContain(">›</Text>");
    // 줄 자체도 캡처의 48dp 높이다(종전 minHeight 26 + paddingHorizontal 6).
    expect(src).toContain("  minHeight: theme.touchTarget\n} as const;");
    expect(src).toContain(
      [
        "const reportReferencePeriodTextStyle = {",
        "  color: theme.colors.brown,",
        "  fontSize: 18,",
        '  fontWeight: "800",',
        "  lineHeight: 26"
      ].join("\n")
    );
  });

  it("아이콘 계열은 앱 전역과 같은 MaterialCommunityIcons(AppIcon)다 -- 신규 의존성 없음", () => {
    expect(reportSource()).toContain('import { AppIcon } from "../../src/design-system";');
  });
});

describe("DSN-053 P2-D 더보기 = 승인 캡처의 '프로필'(SET-001)", () => {
  const moreSource = () => source("app/(tabs)/more.tsx");

  it("세션 제목은 '프로필'이고, 비세션 캡처 경로의 제목은 그대로다", () => {
    expect(moreSource()).toContain('<Text style={moreTitleStyle}>{authToken ? "프로필" : "더보기"}</Text>');
  });

  it("가구 카드가 로고 원 56(마크 38) · '{닉네임}네' 18/800 · stage pill을 그린다", () => {
    const src = moreSource();
    expect(src).toContain('const moreHouseholdLogoImage = require("../../assets/illustrations/logo_mark.png");');
    expect(src).toContain(
      [
        "const moreHouseholdLogoCircleStyle = {",
        '  alignItems: "center",',
        "  backgroundColor: theme.colors.coral[50],",
        "  borderRadius: 28,",
        "  height: 56,",
        '  justifyContent: "center",',
        "  width: 56"
      ].join("\n")
    );
    expect(src).toContain("const moreHouseholdLogoStyle = { height: 38, width: 38 } as const;");
    expect(src).toContain("<Text style={moreHouseholdNameStyle}>{visibleProfile.nickname}네</Text>");
    expect(src).toContain(
      [
        "const moreHouseholdNameStyle = {",
        "  color: theme.colors.brown,",
        "  fontSize: 18,",
        '  fontWeight: "800",'
      ].join("\n")
    );
    // stage pill은 앱이 이미 쓰는 한 벌(coral[50]/coral[700])이다 -- 새 배지를 만들지 않는다.
    expect(src).toContain("<StageBadge label={visibleProfile.stageLabel} />");
  });

  /**
   * "보호자 N명 · 아이 M명"은 **센 수**만 말한다. c20deeb 원본의 `|| 1` 폴백은 응답 전에
   * 3인 가구에도 "보호자 1명"을 그려 놓고 뒤늦게 바뀌므로 옮기지 않는다(허위 표시 금지).
   */
  it("가구 수 캡션은 두 조회가 답한 뒤에만 그려지고, 폴백으로 수를 지어내지 않는다", () => {
    const src = moreSource();
    expect(src).toContain(
      "activeMemberCount !== null && childCount !== null ? `보호자 ${activeMemberCount}명 · 아이 ${childCount}명` : null"
    );
    expect(src).toContain("{householdCaption ? <Text style={moreHouseholdMetaStyle}>{householdCaption}</Text> : null}");
    expect(src).not.toContain("activeMembers.length || 1");
    // 두 조회 모두 앱이 이미 쓰는 캐시 키를 그대로 읽는다(따뜻한 캐시면 새 요청이 없다).
    expect(src).toContain('queryKey: ["children"]');
    expect(src).toContain('queryKey: ["household-members", householdId]');
  });

  it("세션 메뉴가 구획 4개의 그룹 박스로 나뉘고, 구획 판정은 순수 모듈이 진다", () => {
    const src = moreSource();
    expect(src).toContain("MORE_MENU_SECTIONS.map((section) => {");
    expect(src).toContain("visibleMenuRows.filter((row) => row.section === section.key)");
    // 제목 13/700 + 그룹 박스 radius 22(theme.radii.card).
    expect(src).toContain(
      [
        "const moreSectionTitleStyle = {",
        "  color: theme.colors.gray600,",
        "  fontSize: 13,",
        '  fontWeight: "700",'
      ].join("\n")
    );
    expect(src).toContain(
      [
        "const moreSectionGroupStyle = {",
        "  backgroundColor: theme.colors.white,",
        '  borderColor: "rgba(74, 63, 53, 0.08)",',
        "  borderRadius: theme.radii.card,"
      ].join("\n")
    );
    // 행 minHeight 64 + coral[50] 원 40 안의 coral[700] 아이콘.
    expect(src).toContain("  minHeight: 64,");
    expect(src).toContain(
      [
        "const moreSectionRowIconCircleStyle = {",
        '  alignItems: "center",',
        "  backgroundColor: theme.colors.coral[50],",
        "  borderRadius: 20,",
        "  height: 40,",
        '  justifyContent: "center",',
        "  width: 40"
      ].join("\n")
    );
    expect(src).toContain('<Ionicons accessible={false} name={icon} size={22} color={theme.colors.coral[700]} />');
  });

  /**
   * SET-001 캡처는 비로그인 경로로 찍힌다. 구획 문법은 `grouped` prop 뒤에 있고 기본값이
   * false라, 미리보기는 예전 한 덩어리 박스와 44dp 행 그대로다.
   */
  it("비로그인 미리보기는 한 덩어리 박스에 예전 행 문법 그대로다", () => {
    const src = moreSource();
    expect(src).toContain("  grouped = false,");
    expect(src).toContain("<View style={moreMenuGroupStyle()}>");
    expect(src).toContain("style={grouped ? moreSectionRowStyle : moreMenuRowStyle()}");
    expect(src).toContain("const visibleMenuRows = authToken ? sessionMenuRows : previewMenuRowActions;");
    expect(src).toContain("minHeight: MoreSettingsPixelStyles.rowHeight");
  });
});

describe("DSN-053 P2-D 가족(FAM-001) 아바타 행과 대기 초대 흡수", () => {
  const familySource = () => source("app/family/index.tsx");

  it("아바타 스택 옆 `+`가 48dp다", () => {
    const src = familySource();
    expect(src).toContain(
      [
        "const familyPlusButtonStyle = {",
        '  alignItems: "center",',
        "  backgroundColor: theme.colors.white,",
        '  borderColor: "rgba(74, 63, 53, 0.10)",',
        "  borderRadius: theme.touchTarget / 2,",
        "  borderWidth: 1,",
        "  height: theme.touchTarget,"
      ].join("\n")
    );
    // 아바타 스택 자체(36 · -8 겹침)는 공용 컴포넌트가 진다.
    expect(source("src/ui.tsx")).toContain("            height: 36,");
    expect(source("src/ui.tsx")).toContain("            marginLeft: index === 0 ? 0 : -8,");
  });

  it("대기 초대가 '멤버 관리' 목록 안의 pending 행으로 흡수된다(별도 구획 없음)", () => {
    const src = familySource();
    // 구획 제목은 둘뿐이다: 초대하기 · 멤버 관리.
    expect(src.match(/<Text style=\{familySectionTitleStyle\}>/g) ?? []).toHaveLength(2);
    expect(src).toContain("<Text style={familySectionTitleStyle}>초대하기</Text>");
    expect(src).toContain("<Text style={familySectionTitleStyle}>멤버 관리</Text>");
    expect(src).not.toContain("<Text style={familySectionTitleStyle}>대기 중인 초대</Text>");

    // pending 행은 멤버 목록(familyMemberGroupStyle) **안**에 있다.
    const groupStart = src.indexOf("<View style={familyMemberGroupStyle}>");
    const groupEnd = src.indexOf("</View>\n\n        {/*", groupStart);
    const memberGroup = src.slice(groupStart, groupEnd);
    expect(groupStart).toBeGreaterThan(-1);
    expect(memberGroup).toContain("{canManageMembers ? (");
    expect(memberGroup).toContain("style={familyPendingInviteRowStyle}");
    // 멤버 행과 같은 문법: 아바타 · 이름 · 상태 pill · 파괴적 액션.
    expect(memberGroup).toContain("<FamilyAvatarGroup names={[roleLabel]} />");
    expect(memberGroup).toContain('<StatusBadge label="수락 대기" tone="neutral" />');
    expect(memberGroup).toContain("confirmCancelInvite(invite.id, roleLabel)");
  });

  it("흡수 후에도 로딩 스켈레톤 · 조용한 실패 안내 · 링크 회수 불가 안내가 남는다", () => {
    const src = familySource();
    expect(src).toContain("<SkeletonRow />");
    expect(src).toContain('accessibilityLabel="대기 중인 초대 다시 불러오기"');
    expect(src).toContain("대기 중인 초대를 불러오지 못했어요. 눌러서 다시 시도해 주세요.");
    expect(src).toContain("보낸 링크는 보안을 위해 다시 볼 수 없어요.");
    // 안내는 대기 초대가 실제로 있을 때만, 그리고 소유자에게만 붙는다.
    expect(src).toContain("{canManageMembers && (pendingInvites.data?.invites.length ?? 0) > 0 ? (");
  });

  it("멤버 행 radius 16 · '가족 초대하기' 높이 52는 캡처 그대로다", () => {
    const src = familySource();
    expect(src).toContain(
      [
        "const familyMemberRowStyle = {",
        '  alignItems: "center",',
        "  backgroundColor: theme.colors.white,",
        '  borderColor: "rgba(74, 63, 53, 0.08)",',
        "  borderRadius: 16,"
      ].join("\n")
    );
    expect(src).toContain("  height: 52,\n  justifyContent: \"center\"\n} as const;");
    // 역할 pill 문구는 memberLabels 한 곳에서만 온다(화면이 표를 다시 적지 않는다).
    expect(src).toContain("memberBadge(member.role, member.status)");
    expect(src).toContain("memberRoleLabel(invite.role)");
  });
});

describe("DSN-053 P2-D 가져오기 미리보기 색이 토큰 참조다", () => {
  it("excelPreviewRows의 5색이 presentation.preview* 토큰을 부른다(렌더 값 불변)", () => {
    const importSource = source("app/import/index.tsx");
    const rowsBlock = importSource.slice(
      importSource.indexOf("const excelPreviewRows = ["),
      importSource.indexOf("] as const satisfies", importSource.indexOf("const excelPreviewRows = ["))
    );

    for (const token of ["previewCoral", "previewYellow", "previewGreen", "previewPeach", "previewNeutral"]) {
      expect(rowsBlock, token).toContain(`tone: theme.colors.presentation.${token}`);
    }
    // 이름이 빠지면 그 자리는 다시 리터럴로 돌아간다(design-foundation.test.ts의 같은 요지).
    expect(rowsBlock).not.toMatch(/tone: "#[0-9A-Fa-f]{6}"/);
  });
});
