import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildConsentSummaryLines, consentStatusText } from "./consent-summary";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 45 UX-AA(후보 3): 약관 및 개인정보 화면은 부제에 "동의 내역과 삭제 · 탈퇴를 관리해요"라고
 * 적어 두고 동의 내역을 한 줄도 보여주지 않았다. 서버 GET /settings/privacy는 진작부터 consents를
 * 함께 내려주고 있었으므로(onboarding-core.service.ts) 새 요청 없이 그 값을 그린다.
 */
describe("consentStatusText (동의 내역 한 줄)", () => {
  it("동의한 항목은 동의일을 기록 행과 같은 형식으로 말한다", () => {
    expect(consentStatusText({ title: "서비스 이용약관", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" })).toBe(
      "7월 6일 동의"
    );
  });

  it("동의하지 않은 항목은 동의일을 지어내지 않는다", () => {
    expect(consentStatusText({ title: "소식 알림 동의", accepted: false, acceptedAt: null })).toBe("동의 안 함");
    // 서버가 accepted=false에도 시각을 실어 보내는 (있어서는 안 될) 경우까지 "동의"로 말하지 않는다.
    expect(consentStatusText({ title: "소식 알림 동의", accepted: false, acceptedAt: "2026-07-06T05:00:00.000Z" })).toBe(
      "동의 안 함"
    );
  });

  it("시각이 없거나 날짜로 읽히지 않으면 날짜 없이 동의 사실만 말한다", () => {
    for (const acceptedAt of [null, undefined, "", "언젠가", "2026-ab-cd"] as const) {
      expect(consentStatusText({ title: "개인정보 처리 동의", accepted: true, acceptedAt })).toBe("동의함");
    }
  });
});

describe("buildConsentSummaryLines", () => {
  it("서버가 준 순서 그대로 세 줄을 만든다", () => {
    const lines = buildConsentSummaryLines([
      { type: "terms", title: "서비스 이용약관", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" },
      { type: "privacy", title: "개인정보 처리 동의", accepted: true, acceptedAt: "2026-07-06T05:00:00.000Z" },
      { type: "marketing", title: "소식 알림 동의", accepted: false, acceptedAt: null }
    ]);

    expect(lines).toEqual([
      { type: "terms", title: "서비스 이용약관", statusText: "7월 6일 동의" },
      { type: "privacy", title: "개인정보 처리 동의", statusText: "7월 6일 동의" },
      { type: "marketing", title: "소식 알림 동의", statusText: "동의 안 함" }
    ]);
  });

  /**
   * 라운드 65 B(#4·#5): 줄이 자기 종류를 들고 다니는 이유는 둘이다 -- 약관 [보기] 링크를 어느
   * 줄에 붙일지(terms · privacy에만 문서가 있다), 그리고 스위치로 그리는 선택 항목을 줄에서
   * 뺄지. 종류를 말해 주지 않는 구 서버 응답에서는 null이라 링크도 제외도 일어나지 않는다.
   */
  it("종류를 모르는 응답(구 서버)에서는 type이 null이고 줄은 종전 그대로다", () => {
    expect(buildConsentSummaryLines([{ title: "서비스 이용약관", accepted: true, acceptedAt: null }])).toEqual([
      { type: null, title: "서비스 이용약관", statusText: "동의함" }
    ]);
  });

  it("스위치로 그리는 항목은 상태 줄을 따로 만들지 않는다(같은 사실을 두 번 말하지 않는다)", () => {
    const consents = [
      { type: "terms", title: "서비스 이용약관", accepted: true, acceptedAt: null },
      { type: "marketing", title: "소식 알림 동의", accepted: false, acceptedAt: null }
    ];

    expect(buildConsentSummaryLines(consents, { excludeTypes: ["marketing"] }).map((line) => line.title)).toEqual([
      "서비스 이용약관"
    ]);
    // 제외 목록이 비면 종전과 똑같이 전 항목이 줄이 된다.
    expect(buildConsentSummaryLines(consents).map((line) => line.title)).toEqual([
      "서비스 이용약관",
      "소식 알림 동의"
    ]);
  });

  it("응답에 consents가 없거나(구 서버·실패) 이름 없는 항목은 줄을 만들지 않는다 -- 화면은 카드를 생략한다", () => {
    for (const empty of [undefined, null, []] as const) {
      expect(buildConsentSummaryLines(empty)).toEqual([]);
    }
    expect(buildConsentSummaryLines([{ title: "   ", accepted: true, acceptedAt: null }])).toEqual([]);
  });
});

describe("SET-003 동의 내역 카드 wiring (source contract -- 화면은 vitest에서 렌더되지 않는다)", () => {
  const privacySource = source("app/settings/privacy.tsx");

  it("이미 받아 둔 privacy 응답의 consents만 쓰고, 없으면 카드를 그리지 않는다", () => {
    expect(privacySource).toContain("buildConsentSummaryLines(privacy.data?.consents, {");
    // 라운드 65 B(#4): 재동의·스위치도 같은 응답 하나로 판정한다 -- 동의 내역을 위해 새 요청을
    // 만들지 않는다(GET /settings/privacy 하나로 끝난다).
    expect(privacySource).toContain("const consentDefinitions = privacy.data?.consents ?? [];");
    expect(privacySource).toContain("const showConsentCard = consentLines.length > 0 || consentToggles.length > 0;");
    expect(privacySource).toContain("{showConsentCard ? (");
    expect(privacySource).not.toContain("listConsentDefinitions");
  });

  it("계정 삭제 카드가 30일 재가입 제한을 사실대로 한 줄 덧붙인다", () => {
    expect(privacySource).toContain("삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.");
  });

  /**
   * 라운드 65 B(#4ⓑ) — 되돌아올 길과 켤 수 있는 스위치.
   *
   * 종전 이 카드는 "동의 안 함"을 **읽기 전용으로** 보여 주기만 했다: 약관이 개정돼 필수 동의가
   * 뒤집혀도 다시 동의할 컨트롤이 없었고, marketing은 앱이 한 번도 보낸 적이 없어 영원히
   * "동의 안 함"이었다.
   */
  it("필수 동의가 미충족일 때만 재동의 버튼을 그린다(정상 상태의 카드는 종전 그대로다)", () => {
    expect(privacySource).toContain("const pendingRequired = pendingRequiredConsents(consentDefinitions);");
    expect(privacySource).toContain("{pendingRequired.length > 0 ? (");
    expect(privacySource).toContain("필수 항목 다시 동의하기");
    // 재동의는 로그인이 쓰는 그 경로 그대로 -- 버전 리터럴이 화면에 없다.
    expect(privacySource).toContain("mutationFn: () => upsertConsents(authToken!)");
    expect(privacySource).not.toMatch(/version:\s*"\d{4}-\d{2}-\d{2}"/);
  });

  it("선택 동의는 스위치로 켜고 끄되, 없는 기능을 약속하지 않는다", () => {
    expect(privacySource).toContain("const consentToggles = optionalConsents(consentDefinitions);");
    expect(privacySource).toContain("setConsentAccepted(authToken!, input.definition, input.accepted)");
    expect(privacySource).toContain('accessibilityRole="switch"');
    expect(privacySource).toContain(
      "지금은 동의 기록만 저장돼요. 알림 보내기가 준비되면 이 동의를 기준으로 보내드려요."
    );
  });

  /**
   * 라운드 65 B(#5) — 약관 [보기] 링크는 **env가 주입된 빌드에만** 생긴다. 값이 없으면
   * legalDocumentUrls()가 null 둘을 주므로 카드가 종전과 한 글자도 다르지 않다(푸시 토글과 같은
   * "정직한 부재"). 본문을 앱에 복사하지 않는다 -- infra/legal/*.html이 단일 소스다.
   */
  it("문서 URL이 주입된 빌드에서만 [보기] 링크를 그린다", () => {
    expect(privacySource).toContain("const legalUrls = legalDocumentUrls();");
    expect(privacySource).toContain("const legalKind = legalKindForConsentType(line.type);");
    expect(privacySource).toContain("const documentUrl = legalKind ? legalUrls[legalKind] : null;");
    expect(privacySource).toContain("{documentUrl ? (");
    expect(privacySource).toContain('accessibilityRole="link"');
    // 열지 못하면 그 사실을 말한다(아무 일도 일어나지 않는 링크를 남기지 않는다).
    expect(privacySource).toContain("Alert.alert(LEGAL_LINK_FAILED_TITLE, LEGAL_LINK_FAILED_MESSAGE);");
  });

  /**
   * SET-004의 파괴 플로우 카드 3종은 이번 라운드에서 손대지 않는다.
   *
   * 라운드 66 F 정정: 이 줄은 "SET-004(픽셀락)"이라고 적고 있었는데 **그 잠금은 없다** —
   * 캡처 라우트 아홉(app/pixel-lock.tsx) 중 설정 계열은 SET-001뿐이다. 지키려는 계약("카드
   * 렌더 불변")은 실재하고, 그것을 실제로 붙들고 있는 것이 바로 아래 단언이다.
   */
  it("파괴 플로우 카드 3종은 그대로다", () => {
    expect(privacySource).toContain('<View testID="screen-SET-004"');
    for (const label of ["아이 프로필 삭제", "가구 탈퇴", "계정 삭제"]) {
      expect(privacySource).toContain(label);
    }
  });
});
