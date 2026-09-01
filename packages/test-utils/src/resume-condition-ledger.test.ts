// 라운드 89 트랙 D (#4) — 재개 조건 표기 관례 대장의 계약. **저장소 그물 열다섯째.**
//
// 여섯을 묻는다:
//  ⓐ **모집단** — 판정 문서의 재개 조건 자리를 **전수로** 세고, **바늘을 값으로** 든다
//     (⚠️ 괄호 안만 보는 바늘과 줄 전체를 보는 바늘 — 세운 날 61·84, 오늘 **111·149** —
//     **두 수를 한 낱말로 적지 않는다**).
//  ⓑ **하한 래칫** — 형을 밝힌 자리 수와 손의 위치를 적은 자리 수가 **줄지 않는다**
//     (⚠️ 상한도 전수 일치도 묻지 않는다 — F가 AD절을 쓰며 줄을 더해도 초록이다).
//  ⓒ **결정형의 조항** — **결정형으로 표기한 자리는 손의 위치를 함께 적었을 것**
//     (⚠️ 이것이 이 계약의 축이다 — AA-3의 관례를 기계가 지킨다).
//  ⓓ **소스 축** — 소스에 사는 재개 조건도 같은 조항을 받는다. ⚠️⚠️ **라운드 91 트랙 D에서 이
//     축의 뿌리가 손 하나에서 전수 파생으로 바뀌었다**(`apps/**`·`packages/**`를 걷는다).
//  ⓔ **사각** — 이 그물이 못 보는 것이 **값과 하한으로** 적혀 있다(오늘 **여덟** — 넓힌 축이 새로
//     진 둘을 포함한다).
//  ⓕ **자기 배제** — 대장 자신의 두 파일은 모집단에 들어오지 않는다.
//  ⓖ **경과 축** — ⚠️⚠️ **라운드 92 트랙 D가 더한 칸.** 자리마다 *몇 라운드째 서 있는가*를
//     **바늘 둘로 따로** 센다(그 줄 자신 **3** · ±5줄 창 **70** — ⚠️ **한 낱말로 적지 않는다**).
//     ⚠️ 모집단은 `collectDocumentSites()` 그대로이고(넓히면 축 둘이 된다), 무는 것은 **하한뿐**이다.
//
// ## ⚠️⚠️ 라운드 92 트랙 D — 없던 칸 하나(경과)가 값으로 선다
//
// 이 대장은 자리마다 형과 손의 위치를 셌지만 **경과 칸이 없었다** — 그래서 *미도래*와 *오래
// 미배정*이 같은 낯으로 읽혔다(AE-5의 병의 시간 축 판). 라운드 92 정찰이 AF-2의 물음에 값으로
// 답했고(자리 **333** 중 그 줄이 경과를 적은 것 **셋**), 그 답이 그대로 이 축이 된다. 아래 계약은
// 교란 둘로 그 축이 실제로 무는지를 보인다: ① **경과를 적은 자리를 지운 픽스처**에서 하한이
// 빨개진다 · ② **F가 AG절을 쓰며 조건을 더하는 픽스처**에서는 초록이다(하한만 물기 때문이다).
//
// ## ⚠️⚠️ 라운드 91 트랙 D — 소스 축이 손 목록을 버린다
//
// 라운드 89·90의 소스 축은 `SOURCE_AXIS_FILES`를 **손으로 적은 한 줄**로 졌다. 그 모양은
// *"적어 둔 그 파일이 관례를 지키는가"* 만 묻고 *"관례를 지고 있는 소스가 이것뿐인가"* 는 묻지
// 못한다 — 그리고 뿌리를 열자 곧바로 **새 자리 둘**이 나왔다(`contract-net-ledger.test.ts`,
// 라운드 90 E가 *"도래한 조건·처분은 다음 라운드 몫"* 이라고 적으며 남긴 표기 ·
// `apps/api/test/harness-catalog-cost.test.ts`, 같은 라운드 트랙 C가 남긴 표기 넷). 아래 계약은
// 그 전수 파생을 **교란 셋으로** 확인한다: ① 표기 소스 하나가 뿌리에서 사라지면 래칫이 빨개진다 ·
// ② 소유자 칸이 비면 빨개진다 · ③ F가 문서에 줄을 더해도 초록이다(하한 설계).
//
// ## ⚠️⚠️ 라운드 91 리뷰 H-1·L-1 — 파생은 옳았고 **그 위에 손으로 얹은 수**가 틀렸다
//
// D는 파생 결과를 **둘**로 적었지만 D 커밋 시점의 워킹트리에서도 이미 **셋**이었다: 트랙 C가
// D보다 세 시간 앞서 머지되며 표기 넷을 지고 있었고, D의 기록이 그것을 세지 못했다. 그래서
// `SOURCE_COUNT_RATCHET`이 **실측보다 한 칸 낮은 채로** 서서 *셋 중 하나가 표기를 잃어도
// 조용한 거짓 초록*이 됐다. 오늘 래칫을 셋으로 올리고(오기의 정정이지 하한 인상이 아니다),
// **기록을 파생 길이에 등호로 묶어**(L-1) 손으로 적은 수가 다시 어긋날 자리를 없앤다.
//
// ⚠️ 재개 조건(사건형): 이 계약이 처음으로 빨개지는 날 — 그날 사람이 볼 것은 *"관례가 지워졌는가,
// 아니면 관례를 지고 있는 소스가 새로 늘었는가"* 이고, 뒤쪽이면 이 파일은 한 글자도 고칠 것이 없다
// (전수 파생이 새 자리를 자동으로 진다). ⚠️ 그리고 **이 문장 자신이 이 대장의 표기 관례를 지고
// 있어서**, 자기 배제가 없으면 이 파일은 자기 축의 모집단에 든다 — 그 배제가 하는 일이 그것이다.
//
// ⚠️⚠️ **이 계약은 문서를 읽기만 한다. 문서 쓰기 0건이 이 트랙의 금지 조항이다** — 계약이 문서를
// 지켜야지 문서가 계약을 맞추면 안 되기 때문이고, 그래서 아래 어느 단언도 *"오늘과 똑같은가"* 를
// 묻지 않는다. 교란(어긋난 줄이 새로 서는 날 · 하한이 깨지는 날 · F가 줄을 더하는 날) 셋을
// **픽스처로 재현해** 이 그물이 실제로 무는지를 계약 안에서 보인다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONTRACT_NETS_BEFORE_THIS_ONE,
  CONTRACT_NET_COUNT_WITH_THIS_ONE,
  DECISIVE_HAND_EXEMPTIONS,
  DECISIVE_MISSING_HAND_TODAY,
  ELAPSED_BLIND_SPOTS,
  ELAPSED_MEASURED_TODAY,
  ELAPSED_NUMERAL_TABLE,
  ELAPSED_RATCHET,
  ELAPSED_SCOUT_VALUES,
  ELAPSED_STANDALONE,
  ELAPSED_TENS,
  ELAPSED_UNITS,
  ELAPSED_WINDOW_RADIUS,
  HAND_PHRASE,
  LEDGER_BLIND_SPOTS,
  LEDGER_DOCUMENT,
  LEDGER_SELF_FILES,
  MEASURED_TODAY,
  NOTATION_RATCHET,
  ROUND_NOTES_ROOT,
  SCOUT_NEEDLE_VALUES,
  SIBLING_DOCUMENTS,
  SOURCE_AXIS_FILES,
  SOURCE_AXIS_MEASURED_TODAY,
  SOURCE_AXIS_ROOTS,
  SOURCE_AXIS_WALKED_FLOOR,
  SOURCE_COUNT_RATCHET,
  allBlindSpots,
  anyParenSourceNeedle,
  blindSpotReadings,
  blindSpotScoutRecheck,
  branchSourceNotations,
  branchedSourceNotationsFrom,
  buildElapsedNumeralTable,
  collectDocumentSites,
  collectElapsedSites,
  collectResumeSites,
  collectSourceNotations,
  collectSourceNotationsFrom,
  countAnyParenSourceNotations,
  countMentions,
  deadExportLedgerEquality,
  decisiveSites,
  decisiveSitesMissingHand,
  derivedBlindSpots,
  documentElapsedSites,
  downwardGoodBlindSpots,
  elapsedMarksIn,
  elapsedNumeral,
  elapsedRatchetViolations,
  emphasisDecisiveMissingHand,
  emphasisMarkedSourceNeedle,
  exemptionFor,
  latestRecord,
  markdownNotationCount,
  markedBearingFiles,
  markedSourceNeedle,
  measurelessLedgerControl,
  needleSplitDecision,
  otherBlindSpotLedgers,
  ownerForSourcePath,
  quotedFieldNotations,
  ratchetViolations,
  readSourceAxisEntries,
  recordedRatchetViolations,
  recordingBlindSpots,
  repoRoot,
  resumeFieldKeyNeedle,
  resumeFieldKeys,
  resumeFieldValueSpans,
  roundNoteFiles,
  scoutNoteSiteCount,
  scriptsRootYieldToday,
  selfNeedleTallies,
  staleProseBlindSpots,
  sourceAxisDefects,
  sourceAxisFilesFrom,
  sourceCountViolation,
  sourceNeedleBlindSpots,
  sourceNeedleMeasuredToday,
  sourceNeedleRatchet,
  sourceNeedleRatchetViolations,
  sourceNeedleTally,
  sourceSplitScoutValues,
  tallyElapsed,
  tallyNeedles,
  tallySourceNeedles,
  typedInners,
  unreadableElapsedNumerals,
  unreadableNumeralsIn
} from "./resume-condition-ledger";

const documentText = readFileSync(join(repoRoot, LEDGER_DOCUMENT.path), "utf8");
const sites = collectDocumentSites();
const tallies = tallyNeedles(sites);

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/** 교란 픽스처 — 문서를 **고치지 않고** 메모리에서만 만든다(문서 쓰기 0건). */
function withExtraLines(...lines: string[]): ReturnType<typeof collectResumeSites> {
  return collectResumeSites(`${documentText}\n${lines.join("\n")}\n`, "<픽스처>");
}

// ---------------------------------------------------------------------------
// 머리말 — 새 그물이 서는 날 그 수는 열다섯이다
// ---------------------------------------------------------------------------

describe("머리말 — 이 그물은 열넷 중 하나가 아니라 열다섯째다", () => {
  it("그 사실이 값으로 적혀 있다", () => {
    expect(CONTRACT_NETS_BEFORE_THIS_ONE.length).toBe(14);
    expect(CONTRACT_NET_COUNT_WITH_THIS_ONE).toBe(15);
    expect(new Set(CONTRACT_NETS_BEFORE_THIS_ONE).size).toBe(CONTRACT_NETS_BEFORE_THIS_ONE.length);
  });

  it("열넷 목록에 이 대장 자신이 들어 있지 않다 (둘 이상을 함께 여는 트랙이 아니다)", () => {
    for (const net of CONTRACT_NETS_BEFORE_THIS_ONE) {
      expect(net.includes("재개 조건")).toBe(false);
    }
  });

  it("머리말이 그 수를 글자로도 적었다", () => {
    const ledgerSource = readRepo(LEDGER_SELF_FILES[0]);
    expect(ledgerSource.includes("열다섯")).toBe(true);
    expect(ledgerSource.includes("열넷")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ⓐ 모집단 — 전수로 세고, 바늘을 값으로 든다
// ---------------------------------------------------------------------------

describe("ⓐ 모집단 — 재개 조건 자리를 전수로 세고 바늘을 값으로 든다", () => {
  it("모집단 문서가 실재하고 이유가 빈 문자열이 아니다", () => {
    expect(existsSync(join(repoRoot, LEDGER_DOCUMENT.path))).toBe(true);
    expect(LEDGER_DOCUMENT.reason.trim().length).toBeGreaterThan(40);
  });

  it("모집단이 0건이 아니다 (유령 방지 — 하한을 넘는다)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(LEDGER_DOCUMENT.minSites);
  });

  it("전수가 세 갈래 중 정확히 하나에 든다 (합이 전수와 같다)", () => {
    const buckets = {
      parenTyped: sites.filter((site) => site.bucket === "paren-typed").length,
      lineTypedOnly: sites.filter((site) => site.bucket === "line-typed-only").length,
      prose: sites.filter((site) => site.bucket === "prose").length
    };
    expect(buckets.parenTyped + buckets.lineTypedOnly + buckets.prose).toBe(sites.length);
    // 갈래가 서로 배타적인지 — 괄호 표기가 있으면 줄 표기도 반드시 있다.
    for (const site of sites) {
      if (site.parenTyped) expect(site.lineTyped).toBe(true);
      if (site.bucket === "prose") expect(site.lineTyped).toBe(false);
    }
  });

  it("⚠️ 바늘 둘의 수가 갈리고, 그 사실이 값으로 적혀 있다 (두 수를 한 낱말로 적지 않는다)", () => {
    expect(tallies.paren.typed).not.toBe(tallies.line.typed);
    expect(tallies.paren.typed).toBeLessThan(tallies.line.typed);
    // 이름이 갈려 있다 — 합쳐진 수를 드는 자리가 이 대장에 없다.
    expect(Object.keys(tallies).sort()).toEqual(["line", "paren", "window"]);
    expect(MEASURED_TODAY.parenTyped).not.toBe(MEASURED_TODAY.lineTyped);
  });

  it("세 바늘 다 자리를 실제로 낸다 (죽은 바늘이 없다)", () => {
    expect(tallies.paren.typed).toBeGreaterThan(0);
    expect(tallies.paren.hand).toBeGreaterThan(0);
    expect(tallies.line.typed).toBeGreaterThan(tallies.paren.typed);
    expect(tallies.window.hand).toBeGreaterThanOrEqual(tallies.line.hand);
  });

  it("자리 단위는 줄이고, 언급과의 차이가 값으로 있다", () => {
    expect(countMentions(documentText)).toBeGreaterThanOrEqual(sites.length);
    expect(MEASURED_TODAY.mentions).toBeGreaterThan(MEASURED_TODAY.sites);
  });
});

// ---------------------------------------------------------------------------
// ⓑ 하한 래칫 — 줄지 않는다 (⚠️ 상한도 전수 일치도 아니다)
// ---------------------------------------------------------------------------

describe("ⓑ 하한 래칫 — 형 표기 수와 손 위치 수가 줄지 않는다", () => {
  it("오늘의 실측이 하한을 전부 넘는다", () => {
    expect(ratchetViolations(sites)).toEqual([]);
  });

  it("하한은 오늘의 기록보다 높지 않다 (조용히 오른 상한이 아니다)", () => {
    expect(NOTATION_RATCHET.sites).toBeLessThanOrEqual(MEASURED_TODAY.sites);
    expect(NOTATION_RATCHET.parenTyped).toBeLessThanOrEqual(MEASURED_TODAY.parenTyped);
    expect(NOTATION_RATCHET.parenHand).toBeLessThanOrEqual(MEASURED_TODAY.parenHand);
    expect(NOTATION_RATCHET.lineTyped).toBeLessThanOrEqual(MEASURED_TODAY.lineTyped);
    expect(NOTATION_RATCHET.lineHand).toBeLessThanOrEqual(MEASURED_TODAY.lineHand);
    expect(NOTATION_RATCHET.windowHand).toBeLessThanOrEqual(MEASURED_TODAY.windowHand);
  });

  it("⚠️ 교란 ③ — F가 AD절을 쓰며 줄을 **더해도** 초록이다", () => {
    const added = withExtraLines(
      "## AD절 — 라운드 89가 답한 자리 (F가 쓰는 절의 모양을 흉내 낸 픽스처)",
      "- ⚠️ **재개 조건(사건형): 이 계약이 처음으로 빨개지는 날.**",
      "- ⚠️ **재개 조건(결정형 · 손은 저장소 안): 관례를 소급 적용할지 정하는 날.**",
      "- ⚠️ **재개 조건: 형을 밝히지 않은 산문 조건도 더해 본다.**"
    );
    expect(ratchetViolations(added)).toEqual([]);
    expect(added.length).toBeGreaterThan(sites.length);
    // 더한 줄이 어긋남을 새로 만들지 않았다(둘 다 관례를 지킨 표기다).
    expect(decisiveSitesMissingHand(added).length).toBe(decisiveSitesMissingHand(sites).length);
  });

  it("⚠️ 교란 ② — 형 표기가 줄면 래칫이 실제로 문다", () => {
    const degraded = collectResumeSites(documentText.replace(/사건형|결정형/g, "형"), "<픽스처>");
    const violations = ratchetViolations(degraded);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.map((violation) => violation.name)).toContain("parenTyped");
    expect(violations.map((violation) => violation.name)).toContain("parenHand");
  });
});

// ---------------------------------------------------------------------------
// ⓒ 결정형의 조항 — 이 계약의 축
// ---------------------------------------------------------------------------

describe("ⓒ 축 — 결정형으로 표기한 자리는 손의 위치를 함께 적었다", () => {
  it("결정형 자리가 0건이 아니다 (조항이 걸릴 자리가 실제로 있다)", () => {
    expect(decisiveSites(sites).length).toBeGreaterThan(0);
  });

  it("손의 위치를 적지 않은 결정형 자리는 면제 줄이 가리키는 자리뿐이다", () => {
    for (const site of decisiveSitesMissingHand(sites)) {
      const exemption = exemptionFor(site);
      expect(exemption, `${LEDGER_DOCUMENT.path}:${site.line} 에 면제 줄이 없다 — ${site.text.trim()}`).toBeDefined();
    }
  });

  it("어긋남이 오늘의 수보다 늘지 않는다 (줄어드는 것은 언제나 초록)", () => {
    expect(decisiveSitesMissingHand(sites).length).toBeLessThanOrEqual(DECISIVE_MISSING_HAND_TODAY);
  });

  it("면제 줄은 이유·이 트랙이 고치지 않는 이유·재개 조건을 진다", () => {
    expect(DECISIVE_HAND_EXEMPTIONS.length).toBeGreaterThan(0);
    for (const exemption of DECISIVE_HAND_EXEMPTIONS) {
      expect(exemption.reason.trim().length).toBeGreaterThan(40);
      expect(exemption.whyNotFixedHere.trim().length).toBeGreaterThan(40);
      expect(exemption.reopenCondition.trim().length).toBeGreaterThan(20);
      expect(exemption.notation.includes("결정형")).toBe(true);
    }
  });

  it("면제의 신원은 줄 번호가 아니라 문장 조각이고, 그 문장이 문서에 실재한다", () => {
    for (const exemption of DECISIVE_HAND_EXEMPTIONS) {
      expect(/^\d+$/.test(exemption.context)).toBe(false);
      expect(documentText.includes(exemption.context), `면제의 문장 조각이 사라졌다: ${exemption.context}`).toBe(
        true
      );
    }
  });

  it("⚠️ 교란 ① — 손의 위치 없는 결정형 줄이 새로 서면 축이 문다", () => {
    const before = decisiveSitesMissingHand(sites).length;
    const disturbed = withExtraLines("- ⚠️ **재개 조건(결정형): 누군가 관례를 잊고 적은 날 — 교란 픽스처.**");
    const after = decisiveSitesMissingHand(disturbed);
    expect(after.length).toBe(before + 1);
    // 그 새 줄에는 면제가 없다 — 그래서 계약이 빨개진다.
    const uncovered = after.filter((site) => exemptionFor(site) === undefined);
    expect(uncovered.length).toBe(1);
    expect(uncovered[0].text.includes("교란 픽스처")).toBe(true);
  });

  it("⚠️ 접힘은 어긋남이 아니다 — 손의 위치가 다음 줄에 있어도 조항을 지킨 것으로 본다", () => {
    const folded = withExtraLines(
      "- ⚠️⚠️ **재개 조건(결정형)이고**",
      "  **손은 저장소 안이다** — 표기가 두 줄로 접힌 픽스처.",
      ""
    );
    expect(decisiveSitesMissingHand(folded).length).toBe(decisiveSitesMissingHand(sites).length);
  });
});

// ---------------------------------------------------------------------------
// ⓓ 소스 축 — 관례는 문서 밖에도 산다
// ---------------------------------------------------------------------------

describe("ⓓ 소스 축 — 소스에 사는 재개 조건도 같은 조항을 받는다", () => {
  const notations = collectSourceNotations();

  it("소스 축 파일이 실재하고, 이유·소유·하한의 사유가 값으로 있다", () => {
    expect(SOURCE_AXIS_FILES.length).toBeGreaterThan(0);
    for (const file of SOURCE_AXIS_FILES) {
      expect(existsSync(join(repoRoot, file.path)), `${file.path}가 실재한다`).toBe(true);
      expect(file.reason.trim().length).toBeGreaterThan(40);
      expect(file.owner.trim().length).toBeGreaterThan(0);
      expect(file.floorReason.trim().length).toBeGreaterThan(40);
      // ⚠️ 하한은 오늘의 값보다 낮다 — 도래한 조건을 지우는 손을 막지 않는다.
      // ⚠️⚠️ **두 시점**: 라운드 91~93에는 이 자리가 `valueToday`(표식형)를 보았다. 라운드 94 D가
      //    모집단 판정을 **세 갈래의 합**으로 넓히며 이 자도 함께 넓혔다 — 필드형만 지고 들어온
      //    자리의 표식형은 0이라, 옛 자를 그대로 두면 넓힌 걸음이 곧바로 자기를 결함으로 센다.
      expect(file.floor).toBeLessThan(file.needleTotalToday);
    }
  });

  it("표기 수가 하한을 넘는다 (모집단이 살아 있다)", () => {
    const total = SOURCE_AXIS_FILES.reduce((sum, file) => sum + file.floor, 0);
    expect(notations.length).toBeGreaterThanOrEqual(total);
  });

  it("소스의 결정형 표기는 전부 손의 위치를 함께 적었다", () => {
    const missing = notations.filter((notation) => notation.decisive && !notation.hand);
    expect(missing.map((notation) => `${notation.file} :: ${notation.inner}`)).toEqual([]);
    // 결정형이 0건이면 이 단언은 아무것도 지키지 않는다 — 자리가 실재하는지 함께 묻는다.
    expect(notations.filter((notation) => notation.decisive).length).toBeGreaterThan(0);
  });

  it("소스는 '손은 안'을, 문서는 '손은 저장소 안'을 쓴다 — 한 바늘이 둘 다 본다", () => {
    expect(HAND_PHRASE.test("손은 안")).toBe(true);
    expect(HAND_PHRASE.test("손은 저장소 안")).toBe(true);
    expect(HAND_PHRASE.test("손은 저장소 밖")).toBe(true);
    expect(HAND_PHRASE.test("새 손 미러가 서는 날")).toBe(false);
  });

  it("넓은 바늘(인용 포함)이 좁은 바늘보다 크거나 같다", () => {
    expect(countAnyParenSourceNotations()).toBeGreaterThanOrEqual(notations.length);
  });

  it("⚠️ 이 대장은 소스 축 파일을 읽기만 한다 (소유자 칸이 그 사실을 진다)", () => {
    for (const file of SOURCE_AXIS_FILES) {
      expect(file.owner.includes("읽기만")).toBe(true);
      expect(LEDGER_SELF_FILES).not.toContain(file.path);
    }
  });
});

// ---------------------------------------------------------------------------
// ⓓ' 소스 축의 뿌리 — ⚠️⚠️ 손 하나가 아니라 전수 파생 (라운드 91 트랙 D)
// ---------------------------------------------------------------------------

describe("ⓓ' 소스 축 — 뿌리를 걸어 표기를 지닌 소스 전수에서 파생한다", () => {
  const entries = readSourceAxisEntries();
  const derived = sourceAxisFilesFrom(entries);

  it("ⓐ 뿌리를 실제로 걷는다 — 걷은 파일이 0건이 아니고 전부 뿌리 아래다 (유령 방지)", () => {
    expect(SOURCE_AXIS_ROOTS.length).toBe(2);
    expect(entries.length).toBeGreaterThanOrEqual(SOURCE_AXIS_WALKED_FLOOR);
    expect(SOURCE_AXIS_MEASURED_TODAY.walked).toBeGreaterThanOrEqual(SOURCE_AXIS_WALKED_FLOOR);
    for (const entry of entries) {
      expect(
        SOURCE_AXIS_ROOTS.some((root) => entry.path.startsWith(`${root}/`)),
        `${entry.path}가 뿌리 아래다`
      ).toBe(true);
    }
    // 두 뿌리 다 실제로 파일을 냈다 — 한쪽이 통째로 비면 그 사실이 여기서 먼저 보인다.
    for (const root of SOURCE_AXIS_ROOTS) {
      expect(
        entries.filter((entry) => entry.path.startsWith(`${root}/`)).length,
        `${root} 뿌리가 0건이 아니다`
      ).toBeGreaterThan(0);
    }
  });

  it("⚠️⚠️ 모집단이 손 목록이 아니다 — 파일 경로 배열이 아니라 파생 결과다", () => {
    const ledgerSource = readRepo(LEDGER_SELF_FILES[0]);
    expect(ledgerSource).toContain("export const SOURCE_AXIS_FILES: readonly SourceAxisFile[] = deriveSourceAxisFiles();");
    // 손으로 적은 배열 리터럴이 그 자리에 없다(고치려던 병이 정확히 그 모양이다).
    expect(/export const SOURCE_AXIS_FILES[^=\n]*=\s*\[/.test(ledgerSource)).toBe(false);
  });

  it("⚠️ 유령 방지 — 표기를 지닌 소스가 0건이 아니고, 오늘 그 수는 셋 이상이다", () => {
    expect(derived.length).toBeGreaterThan(0);
    expect(derived.length).toBeGreaterThanOrEqual(SOURCE_COUNT_RATCHET);
    expect(sourceCountViolation(derived)).toBeUndefined();
    for (const file of derived) {
      expect(existsSync(join(repoRoot, file.path)), `${file.path}가 실재한다`).toBe(true);
    }
    // ⚠️ 오늘의 파생 결과를 **값으로** 적어 둔다 — 모집단이 아니라 사람이 읽는 근거다.
    //    둘째·셋째 자리는 손 목록 시절 이 대장이 몰랐던 자리다.
    const paths = derived.map((file) => file.path);
    expect(paths).toContain("packages/test-utils/src/dead-export-ledger.ts");
    expect(paths).toContain("packages/test-utils/src/contract-net-ledger.test.ts");
    expect(paths).toContain("apps/api/test/harness-catalog-cost.test.ts");
  });

  it("⚠️⚠️ 기록된 `files`가 **파생 길이를 문다** — 손으로 적은 수가 다시 어긋날 자리가 없다 (리뷰 L-1)", () => {
    // ⚠️⚠️ 두 시점(리뷰 H-1·L-1). 라운드 91 D는 뿌리를 옳게 걸어 놓고 그 **결과를 손으로 다시**
    //    적었고(`files: 2`), 그 손이 같은 라운드 트랙 C의 파일 하나를 세지 못했다 — 그래서
    //    `SOURCE_COUNT_RATCHET`이 실측보다 한 칸 낮은 채로 서서 **셋 중 하나가 표기를 잃어도
    //    조용한 거짓 초록**이 됐다. 오늘 그 자리를 등호로 묶는다: 기록이 파생과 갈리면 빨개진다.
    // ⚠️⚠️ **셋째 시점(라운드 94 트랙 D)** — 모집단이 셋에서 열하나로 넓어졌지만 **이 등호가 무는
    //    대상은 바꾸지 않았다**: H-1이 세운 장치는 *① 표식형을 지닌 파일*을 세는 것이었고, 그
    //    부분모집단은 오늘도 셋이다(`markedBearingFiles`). 넓어진 모집단은 **따로 하한으로** 든다
    //    (`sourceNeedleMeasuredToday().files`) — *남의 장치가 무는 것을 넓히지 않는다.*
    expect(
      SOURCE_AXIS_MEASURED_TODAY.files,
      "기록된 표기 소스 수가 오늘의 파생 결과와 갈렸어요 — 파생 쪽이 사실이고, 이 값을 옮겨 주세요"
    ).toBe(markedBearingFiles(derived).length);
    // ⚠️ 그리고 넓어진 모집단은 등호가 아니라 하한이다 — 남의 트랙이 조건을 소진하면 내려간다.
    expect(sourceNeedleMeasuredToday().files).toBeLessThanOrEqual(derived.length);
    expect(derived.length).toBeGreaterThan(markedBearingFiles(derived).length);
    // 래칫도 그 파생 위에 선다 — 기록과 래칫이 서로 다른 수를 말하지 않는다.
    expect(SOURCE_COUNT_RATCHET).toBe(SOURCE_AXIS_MEASURED_TODAY.files);
    expect(SOURCE_COUNT_RATCHET).toBeLessThanOrEqual(derived.length);
    // ⚠️ **바늘 둘의 기록은 등호가 아니라 하한이다 — 그리고 그 갈림에 이유가 있다.**
    //    `files`는 래칫이 딛는 수라 어긋나면 곧바로 거짓 초록이 되지만(H-1이 그 실물이다),
    //    `marked`·`anyParen`은 **한 파일 안에서 조건이 늘고 주는 수**라 등호로 물면 새 재개
    //    조건을 정직하게 적는 손이 빨강을 맞는다(이 대장이 `NOTATION_RATCHET`에 박아 둔 판단).
    expect(SOURCE_AXIS_MEASURED_TODAY.marked).toBeLessThanOrEqual(
      derived.reduce((sum, file) => sum + file.valueToday, 0)
    );
    expect(SOURCE_AXIS_MEASURED_TODAY.anyParen).toBeLessThanOrEqual(
      derived.reduce((sum, file) => sum + file.anyParenToday, 0)
    );
  });

  it("⚠️ 교란 — 표기 소스 셋 가운데 **어느 하나**를 숨겨도 래칫이 빨개진다 (H-1의 재현)", () => {
    // ⚠️ D의 래칫(2)에서는 이 교란이 셋 중 하나에 대해 **초록**이었다 — 그것이 거짓 초록의 실물이다.
    // ⚠️⚠️ **두 시점**: 라운드 91~93에는 이 교란이 `derived` 전체를 돌았다. 라운드 94 D가 모집단을
    //    넓힌 뒤로는 **표식형을 지닌 부분모집단**(셋)을 돈다 — 넓은 모집단에서 하나를 숨겨도
    //    `3`짜리 래칫은 조용하고, 그 조용함은 이 교란이 무엇을 지키는지를 흐린다.
    const marked = markedBearingFiles(derived);
    expect(marked.length).toBeGreaterThanOrEqual(3);
    for (const hidden of marked) {
      const without = markedBearingFiles(
        sourceAxisFilesFrom(entries.filter((entry) => entry.path !== hidden.path))
      );
      expect(without.length).toBe(marked.length - 1);
      expect(
        sourceCountViolation(without),
        `${hidden.path}를 숨겼는데 초록이면 이 축은 그 자리를 지키지 않는다`
      ).toBeDefined();
      // 그리고 D의 옛 래칫(2)이었다면 같은 교란이 조용히 지나갔다는 사실도 값으로 남긴다.
      expect(sourceCountViolation(without, 2)).toBeUndefined();
    }
  });

  it("ⓑ 자리별 값이 손이 아니라 소스에서 파생된다 (오늘 marked 6 · anyParen 9)", () => {
    for (const file of derived) {
      const text = readRepo(file.path);
      expect(file.valueToday, `${file.path}의 좁은 바늘`).toBe(
        typedInners(text, markedSourceNeedle()).length
      );
      expect(file.anyParenToday, `${file.path}의 넓은 바늘`).toBe(
        typedInners(text, anyParenSourceNeedle()).length
      );
      // ⚠️⚠️ **두 시점**: 예전에는 `valueToday > 0`이 모집단의 조건이었다. 오늘 모집단에 드는
      //    조건은 **세 갈래의 합**이라, 필드형만 지고 들어온 자리의 표식형은 0이다.
      expect(file.needleTotalToday).toBeGreaterThan(0);
      expect(file.valueToday + file.emphasisToday + file.fieldToday).toBe(file.needleTotalToday);
      expect(file.anyParenToday).toBeGreaterThanOrEqual(file.needleTotalToday);
      expect(file.anyParenToday).toBe(file.needleTotalToday + file.unneedledToday);
    }
    // ⚠️ 기록은 하한으로만 견준다(등호로 물면 옳은 손이 빨강을 맞는다 — 이 대장의 첫 판단).
    const top = derived.find((file) => file.path.endsWith("dead-export-ledger.ts"));
    expect(top).toBeDefined();
    expect(SOURCE_AXIS_MEASURED_TODAY.markedTopFile).toBeLessThanOrEqual(top!.valueToday);
    expect(SOURCE_AXIS_MEASURED_TODAY.anyParenTopFile).toBeLessThanOrEqual(top!.anyParenToday);
    expect(SOURCE_AXIS_MEASURED_TODAY.marked).toBeLessThanOrEqual(collectSourceNotations().length);
    expect(SOURCE_AXIS_MEASURED_TODAY.anyParen).toBeLessThanOrEqual(countAnyParenSourceNotations());
  });

  it("ⓒ 소유자 칸이 어느 자리에도 비어 있지 않다 — 이름이 없는 새 경로도 값을 얻는다", () => {
    expect(sourceAxisDefects(derived)).toEqual([]);
    for (const file of derived) {
      expect(file.owner.trim().length, `${file.path}의 소유자`).toBeGreaterThan(0);
      expect(file.owner).toContain("읽기만");
    }
    for (const path of ["apps/mobile/src/아직-없는-자리.ts", "packages/무엇/x.ts", "x"]) {
      expect(ownerForSourcePath(path).trim().length, `${path}의 소유자`).toBeGreaterThan(0);
    }
  });

  it("⚠️ 하한을 오늘의 값으로 올리지 않았다 (자리별 floor < 세 갈래의 합)", () => {
    for (const file of derived) {
      expect(file.floor, `${file.path}의 하한`).toBeLessThan(file.needleTotalToday);
      expect(file.floorReason.trim().length).toBeGreaterThan(40);
    }
    const top = derived.find((file) => file.path.endsWith("dead-export-ledger.ts"));
    expect(top!.floor).toBe(3); // ⚠️ 라운드 89 D가 세운 하한 — 내리지도 올리지도 않는다.
    // ⚠️ 그 자리에서는 옛 자(표식형)도 여전히 하한 위다 — 넓힌 자가 옛 자를 헐겁게 하지 않았다.
    expect(top!.floor).toBeLessThan(top!.valueToday);
  });

  it("⚠️ 교란 ① — 표기를 지닌 소스가 뿌리에서 사라지면 래칫이 빨개진다", () => {
    // 래칫 아래로 내려가도록 필요한 만큼 숨긴다(파생 수가 늘어난 날에도 이 교란은 성립한다).
    const hidden = new Set(derived.slice(0, derived.length - SOURCE_COUNT_RATCHET + 1).map((file) => file.path));
    expect(hidden.size).toBeGreaterThan(0);
    const without = sourceAxisFilesFrom(entries.filter((entry) => !hidden.has(entry.path)));
    expect(without.length).toBe(derived.length - hidden.size);
    const violation = sourceCountViolation(without);
    expect(violation, "숨겼는데도 초록이면 이 축은 아무것도 지키지 않는다").toBeDefined();
    expect(violation!.measured).toBeLessThan(violation!.floor);

    // 파일은 그대로 두고 **관례의 표식만** 지워도 같다 — 관례가 지워지는 날의 모양이 이쪽이다.
    // ⚠️⚠️ **두 시점**: 라운드 91~93에는 `⚠️` 하나만 지우면 그 파일이 모집단에서 빠졌다. 라운드 94
    //    D가 판정을 세 갈래의 합으로 넓힌 뒤로는 **필드 이름까지** 지워야 빠진다 — 그 사실 자체가
    //    이 걸음이 모집단을 얼마나 넓혔는지의 크기다(표식 하나로는 이제 관례가 지워지지 않는다).
    const strip = (text: string): string =>
      text.replace(/⚠️/g, "").replace(/reopenCondition|resumeCondition/g, "옛필드");
    const erased = sourceAxisFilesFrom(
      entries.map((entry) =>
        hidden.has(entry.path) ? { path: entry.path, text: strip(entry.text) } : entry
      )
    );
    expect(sourceCountViolation(erased)).toBeDefined();
    // ⚠️ 그리고 `⚠️`만 지우면 오늘은 **조용하다** — 넓힌 판정이 그만큼을 새로 지고 있다는 뜻이다.
    const onlyMarkErased = sourceAxisFilesFrom(
      entries.map((entry) =>
        hidden.has(entry.path) ? { path: entry.path, text: entry.text.replace(/⚠️/g, "") } : entry
      )
    );
    expect(onlyMarkErased.length).toBeGreaterThan(erased.length);
  });

  it("⚠️ 교란 ② — 소유자 칸이 비면 계약이 문다", () => {
    const defects = sourceAxisDefects(sourceAxisFilesFrom(entries, () => ""));
    expect(defects.length).toBeGreaterThan(0);
    expect(defects.map((defect) => defect.field)).toContain("owner");
    // 그리고 공백만 채운 칸도 빈 칸이다.
    expect(sourceAxisDefects(sourceAxisFilesFrom(entries, () => "   ")).length).toBeGreaterThan(0);
  });

  it("⚠️ 교란 ③ — 소스에 표기가 **늘어도** 초록이다 (하한만 문다)", () => {
    const added = sourceAxisFilesFrom([
      ...entries,
      {
        path: "apps/mobile/src/픽스처-새-자리.ts",
        text: "// ⚠️ 재개 조건(결정형 · 손은 저장소 안): 새 자리가 관례를 지고 서는 날.\n"
      }
    ]);
    expect(added.length).toBe(derived.length + 1);
    expect(sourceCountViolation(added)).toBeUndefined();
    expect(sourceAxisDefects(added)).toEqual([]);
    // 이름이 표에 없는 자리라도 소유자·하한 사유가 채워진다(손을 기다리지 않는다).
    const fresh = added.find((file) => file.path.includes("픽스처-새-자리"));
    expect(fresh!.owner.trim().length).toBeGreaterThan(0);
    expect(fresh!.floor).toBe(0);
  });

  it("ⓕ 자기 배제가 실제로 일을 한다 — 자기 두 파일은 표기를 지녔는데도 뿌리 밖이다", () => {
    const walked = new Set(entries.map((entry) => entry.path));
    for (const self of LEDGER_SELF_FILES) {
      expect(walked.has(self), `${self}가 뿌리 밖이다`).toBe(false);
      expect(
        typedInners(readRepo(self), markedSourceNeedle()).length,
        `${self}에 표기가 살아 있다`
      ).toBeGreaterThan(0);
    }
    // ⚠️ 배제를 풀면 파생 수가 는다 — 그 차이가 이 줄이 하는 일의 크기다.
    const withSelf = sourceAxisFilesFrom([
      ...entries,
      ...LEDGER_SELF_FILES.map((path) => ({ path, text: readRepo(path) }))
    ]);
    expect(withSelf.length).toBe(derived.length + LEDGER_SELF_FILES.length);
  });
});

// ---------------------------------------------------------------------------
// ⓗ 소스 축의 바늘이 셋으로 갈린다 — ⚠️⚠️ 라운드 94 트랙 D · 결정형 #19
// ---------------------------------------------------------------------------
//
// 라운드 93 리뷰 M-3이 물은 것은 *"`⚠️`와 `재개` 사이에 강조 표식을 허용할지"* 였고, 오늘의 답은
// **허용/불허가 아니라 갈래 셋**이다. 아래 계약은 그 답이 값으로 서 있는지를 여섯으로 묻는다:
// ① 좁은 바늘의 뜻이 **바이트로** 그대로인가 · ② 세 갈래가 전수를 **남김없이·겹침 없이** 가르는가 ·
// ③ 갈래마다 하한이 **따로** 서는가 · ④ 픽스처 셋이 각각 제 갈래로 가는가 ·
// ⑤ 강조형을 표식형으로 바꾸면 **어느 하한이 무는가** · ⑥ 모집단을 넓힌 걸음이 **문서 축을 한
// 자리도 움직이지 않는가**.

/** 갈래마다 하나씩 — ⚠️ 저장소를 고치지 않고 **메모리에서만** 만든다(소유 밖 0바이트). */
const BRANCH_FIXTURES = [
  {
    branch: "marked" as const,
    path: "apps/mobile/src/픽스처-표식형.ts",
    text: "// ⚠️ 재개 조건(결정형 · 손은 저장소 안): 표식형 픽스처가 서는 날.\n"
  },
  {
    branch: "emphasis" as const,
    path: "apps/mobile/src/픽스처-강조형.ts",
    text: "// ⚠️ **재개 조건(결정형 · 손은 저장소 안): 강조형 픽스처가 서는 날.**\n"
  },
  {
    branch: "field" as const,
    path: "apps/mobile/src/픽스처-필드형.ts",
    text: 'const 자리 = { reopenCondition: "재개 조건(사건형): 필드형 픽스처가 서는 날." };\n'
  },
  {
    branch: "unneedled" as const,
    path: "apps/mobile/src/픽스처-잔여.ts",
    text: "// 옛 문장을 그대로 옮겨 적는다 — 재개 조건(사건형): 잔여 픽스처.\n"
  }
];

describe("ⓗ 소스 축의 바늘이 셋으로 갈린다 (결정형 #19 · 라운드 93 리뷰 M-3의 소진)", () => {
  const entries = readSourceAxisEntries();
  const notations = branchedSourceNotationsFrom(entries);
  const tally = tallySourceNeedles(notations);
  const derived = sourceAxisFilesFrom(entries);

  it("⚠️⚠️ ① 좁은 바늘의 뜻은 **한 바이트도** 바뀌지 않았다 (갈래를 세웠지 넓히지 않았다)", () => {
    // ⚠️ 이 등호가 이 라운드의 결정을 산문이 아니라 **바이트로** 진다: 넓힌 것은 모집단 판정이고
    //    바늘이 아니다. 다음 사람이 이 정규식을 넓히려면 이 줄과 `needleSplitDecision()`을
    //    함께 열어야 한다.
    expect(markedSourceNeedle().source).toBe(needleSplitDecision().unchangedNeedle);
    expect(markedSourceNeedle().flags).toBe("g");
    // 강조가 낀 꼴은 좁은 바늘에 **오늘도 안 걸린다** — 그것이 M-3이 발견한 그 사실이다.
    expect(markedSourceNeedle().test("⚠️ **재개 조건(사건형): 그날.**")).toBe(false);
    expect(markedSourceNeedle().test("⚠️ 재개 조건(사건형): 그날.")).toBe(true);
    // 그리고 강조형 바늘은 **별표를 요구하므로** 표식형을 가로채지 않는다.
    expect(emphasisMarkedSourceNeedle().test("⚠️ 재개 조건(사건형): 그날.")).toBe(false);
    expect(emphasisMarkedSourceNeedle().test("⚠️ **재개 조건(사건형): 그날.**")).toBe(true);
    expect(emphasisMarkedSourceNeedle().test("⚠️⚠️ **재개 조건(사건형): 그날.**")).toBe(true);
  });

  it("⚠️⚠️ ② 세 갈래가 전수를 **남김없이·겹침 없이** 가른다 (합이 넘으면 두 번 세고 있다)", () => {
    // ⓐ 남김없이 — 넓은 바늘의 전수가 네 갈래의 합과 같다.
    expect(tally.branched + tally.unneedled).toBe(tally.anyParen);
    expect(tally.anyParen).toBe(
      entries.reduce((sum, entry) => sum + typedInners(entry.text, anyParenSourceNeedle()).length, 0)
    );
    // ⓑ 겹침 없이 — 같은 자리가 두 갈래에 들지 않는다(자리의 신원은 파일+시작 위치다).
    const identities = notations.map((notation) => `${notation.file}:${notation.index}`);
    expect(new Set(identities).size).toBe(identities.length);
    // ⓒ ⚠️ 정찰이 요구한 부등호 — 셋의 합이 저장소 전수(넓은 바늘 88) 이하다.
    expect(tally.branched).toBeLessThanOrEqual(sourceNeedleMeasuredToday().repoAnyParen);
    expect(tally.branched).toBeLessThanOrEqual(tally.anyParen);
    // ⓓ 세 갈래 다 죽지 않았다 — 하나라도 0이면 그 갈래는 이름만 있는 것이다.
    expect(tally.marked).toBeGreaterThan(0);
    expect(tally.emphasis).toBeGreaterThan(0);
    expect(tally.field).toBeGreaterThan(0);
    // ⓔ ⚠️ **한 낱말로 적지 않는다** — 이름이 갈려 있고 합친 수를 드는 자리가 없다.
    expect(Object.keys(tally).sort()).toEqual([
      "anyParen",
      "branched",
      "emphasis",
      "field",
      "marked",
      "unneedled"
    ]);
  });

  it("⚠️ ③ 갈래마다 하한이 **따로** 서고, 오늘의 실측이 넷 다 넘는다", () => {
    expect(sourceNeedleRatchetViolations(tally)).toEqual([]);
    expect(Object.keys(sourceNeedleRatchet()).sort()).toEqual([
      "branched",
      "emphasis",
      "field",
      "marked"
    ]);
    expect(sourceNeedleRatchet().marked).toBeLessThanOrEqual(tally.marked);
    expect(sourceNeedleRatchet().emphasis).toBeLessThanOrEqual(tally.emphasis);
    expect(sourceNeedleRatchet().field).toBeLessThanOrEqual(tally.field);
    expect(sourceNeedleRatchet().branched).toBeLessThanOrEqual(tally.branched);
    // ⚠️ 하한을 오늘의 값에 붙이지 않았다 — 도래한 조건을 소진하는 손이 빨강을 맞지 않게.
    expect(sourceNeedleRatchet().branched).toBeLessThan(tally.branched);
    // ⚠️ 합의 하한은 갈래별 하한의 합보다 **위**다(합만 물면 갈래 하나가 통째로 죽어도 조용하다).
    expect(
      sourceNeedleRatchet().marked + sourceNeedleRatchet().emphasis + sourceNeedleRatchet().field
    ).toBeLessThan(sourceNeedleRatchet().branched);
    // 기록은 하한 방향으로만 견준다 — 남의 트랙이 조건을 소진하면 실측이 내려간다.
    expect(sourceNeedleMeasuredToday().marked).toBeGreaterThanOrEqual(sourceNeedleRatchet().marked);
    expect(sourceNeedleMeasuredToday().branched).toBe(
      sourceNeedleMeasuredToday().marked +
        sourceNeedleMeasuredToday().emphasis +
        sourceNeedleMeasuredToday().field
    );
  });

  it("⚠️ ④ 픽스처 넷이 각각 제 갈래로 간다 (갈래마다 실물 하나씩)", () => {
    for (const fixture of BRANCH_FIXTURES) {
      const found = branchSourceNotations(fixture.text, fixture.path);
      expect(found.length, `${fixture.path}의 자리 수`).toBe(1);
      expect(found[0].branch, `${fixture.path}의 갈래`).toBe(fixture.branch);
    }
    // ⚠️ 그리고 모집단 판정이 셋에는 문을 열고 잔여에는 열지 않는다.
    for (const fixture of BRANCH_FIXTURES) {
      const population = sourceAxisFilesFrom([{ path: fixture.path, text: fixture.text }]);
      expect(population.length, `${fixture.path}가 모집단에 드는가`).toBe(
        fixture.branch === "unneedled" ? 0 : 1
      );
    }
    // 필드 이름 둘 다 실제로 값을 낸다(한쪽만 살아 있으면 그 절반은 죽은 바늘이다).
    expect([...resumeFieldKeys()].sort()).toEqual(["reopenCondition", "resumeCondition"]);
    // ⚠️ 이름 바늘은 전역 플래그다 — 부를 때마다 새로 만드는 이 파일의 관례를 함께 문다.
    expect(resumeFieldKeyNeedle().flags).toBe("g");
    expect(resumeFieldKeyNeedle().lastIndex).toBe(0);
    // ⚠️⚠️ 그리고 그 바늘은 **이름 목록에서 파생된다** — 손 목록이 둘이 되지 않는다.
    for (const key of resumeFieldKeys()) expect(resumeFieldKeyNeedle().source).toContain(key);
    expect(resumeFieldKeyNeedle().source).toBe(`(?:${resumeFieldKeys().join("|")})\\s*:`);
    for (const key of resumeFieldKeys()) {
      const text = `const x = { ${key}: "재개 조건(사건형): 두 이름 다 살아 있다." };\n`;
      expect(branchSourceNotations(text, "<픽스처>")[0].branch, key).toBe("field");
    }
    // ⚠️ 필드 값이 **여러 줄로 이어 붙여져도** 한 구간으로 본다(이 저장소의 실제 꼴이 이쪽이다).
    const folded =
      'const x = {\n  reopenCondition:\n    "앞줄 " +\n    "재개 조건(결정형 · 손은 저장소 안): 접힌 필드."\n};\n';
    expect(branchSourceNotations(folded, "<픽스처>")[0].branch).toBe("field");
    expect(resumeFieldValueSpans(folded).length).toBe(1);
    // 그리고 필드 **밖**의 같은 문장은 필드형이 아니다 — 자리가 신원이라는 사실의 부정 단언.
    expect(branchSourceNotations('const x = "재개 조건(사건형): 밖.";\n', "<픽스처>")[0].branch).toBe(
      "unneedled"
    );
  });

  it("⚠️⚠️ ⑤ 교란 — 강조형을 표식형으로 바꾸면 **두 갈래가 함께 움직이고, 합은 꿈쩍도 않는다**", () => {
    const flip = (text: string): string => text.replace(/⚠️(\s*)\*+(\s*)재개/g, "⚠️$1재개");

    // ⓐ 픽스처 하나로 — 갈래 둘이 정확히 한 칸씩 움직인다.
    const one = BRANCH_FIXTURES.find((fixture) => fixture.branch === "emphasis")!;
    const before = tallySourceNeedles(branchSourceNotations(one.text, one.path));
    const after = tallySourceNeedles(branchSourceNotations(flip(one.text), one.path));
    expect(before.emphasis).toBe(1);
    expect(after.emphasis).toBe(0);
    expect(after.marked).toBe(before.marked + 1);
    expect(after.branched).toBe(before.branched); // ⚠️ 합은 움직이지 않는다

    // ⓑ 저장소 전수로 — **어느 하한이 무는가**가 이 교란의 답이다.
    const flipped = tallySourceNeedles(
      branchedSourceNotationsFrom(entries.map((entry) => ({ path: entry.path, text: flip(entry.text) })))
    );
    expect(flipped.emphasis).toBe(0);
    expect(flipped.marked).toBe(tally.marked + tally.emphasis);
    expect(flipped.branched).toBe(tally.branched);
    const violations = sourceNeedleRatchetViolations(flipped);
    // ⚠️⚠️ **갈래별 하한이 문다.** 합의 하한은 꿈쩍도 하지 않는다 — 갈래를 가른 이유가 이것이다.
    expect(violations.map((violation) => violation.name)).toEqual(["emphasis"]);
    expect(violations[0].measured).toBeLessThan(violations[0].floor);
    expect(sourceNeedleRatchetViolations(flipped).map((violation) => violation.name)).not.toContain(
      "branched"
    );
    // ⚠️ 그리고 뒤집으면 그 자리들이 ⓒ 축(결정형이면 손의 위치)의 모집단으로 **들어온다** —
    //    바늘을 넓히는 길이 왜 이 라운드의 길이 아니었는지가 여기서 값으로 보인다.
    const flippedMarked = collectSourceNotationsFrom(
      entries.map((entry) => ({ path: entry.path, text: flip(entry.text) }))
    );
    expect(flippedMarked.length).toBe(tally.marked + tally.emphasis);
    expect(flippedMarked.filter((notation) => notation.decisive && !notation.hand).length).toBe(
      emphasisDecisiveMissingHand().length
    );

    // ⓒ **복구** — 교란은 메모리에서만 있었다. 다시 걸으면 같은 수가 나온다(바이트 불변).
    expect(tallySourceNeedles(branchedSourceNotationsFrom(readSourceAxisEntries()))).toEqual(tally);
  });

  it("⚠️⚠️ ⑥ 모집단은 넓어졌고 **문서 축은 한 자리도 움직이지 않았다**", () => {
    // ⓐ 넓어졌다 — 옛 판정(표식형 하나)과 오늘 판정(세 갈래의 합)을 같은 걸음에서 견준다.
    const oldPopulation = new Set(
      entries
        .filter((entry) => typedInners(entry.text, markedSourceNeedle()).length > 0)
        .map((entry) => entry.path)
    );
    const newPopulation = new Set(derived.map((file) => file.path));
    expect(newPopulation.size).toBeGreaterThan(oldPopulation.size);
    for (const path of oldPopulation) expect(newPopulation.has(path)).toBe(true);
    // 새 갈래가 데려온 자리가 실제로 있다(표식형이 0인데 모집단에 든 파일).
    expect(derived.filter((file) => file.valueToday === 0).length).toBeGreaterThan(0);

    // ⓑ ⚠️ **틀린 이름으로 삼키던 자리가 제 이름을 얻었다** — 두 판정으로 같은 사각을 잰다.
    const proseIn = (population: Set<string>): number =>
      entries
        .filter((entry) => !population.has(entry.path))
        .reduce(
          (sum, entry) => sum + entry.text.split("\n").filter((line) => /재개\s*(?:조건|트리거)/.test(line)).length,
          0
        );
    expect(proseIn(newPopulation)).toBeLessThan(proseIn(oldPopulation));
    const prose = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "unmarked-source-prose")!;
    expect(prose.measure(repoRoot)).toBe(proseIn(newPopulation));
    // 그 사각의 `what`이 **두 시점**을 값으로 적었다(옛 수를 지우지 않았다 · AE-3).
    for (const timepoint of ["마흔여덟", "예순여덟", "129", "155", "61"]) {
      expect(prose.what, `${timepoint} 시점이 적혀 있다`).toContain(timepoint);
    }

    // ⓒ ⚠️⚠️ **문서 축은 이 걸음을 모른다** — 산문이 아니라 구조로 보인다.
    expect(tallyNeedles(collectDocumentSites())).toEqual(
      tallyNeedles(collectResumeSites(documentText, LEDGER_DOCUMENT.path))
    );
    expect(collectDocumentSites().length).toBe(sites.length);
    expect(ratchetViolations(sites)).toEqual([]);
    const ledgerSource = readRepo(LEDGER_SELF_FILES[0]);
    const documentBody = /export function collectDocumentSites[\s\S]*?\n}/.exec(ledgerSource)?.[0] ?? "";
    expect(documentBody.length).toBeGreaterThan(0);
    for (const forbidden of ["sourceAxis", "branch", "Needle("]) {
      expect(documentBody, `문서 축의 파생이 소스 축을 부르지 않는다: ${forbidden}`).not.toContain(
        forbidden
      );
    }
  });

  it("ⓕ ⚠️ 저장소의 **실물**과 이 파일 자신의 **픽스처**를 가르는 자가 값으로 선다", () => {
    const self = selfNeedleTallies();
    // ⚠️ 정찰의 *'열넷 중 여덟이 픽스처'* 는 오늘 **셋으로** 갈린다 — 걷은 실물 · 대장의 소스 · 픽스처.
    expect(sourceNeedleMeasuredToday().selfContractFixtureEmphasis).toBeLessThanOrEqual(
      self.contractFixture.emphasis
    );
    expect(sourceNeedleMeasuredToday().selfLedgerSourceEmphasis).toBeLessThanOrEqual(
      self.ledgerSource.emphasis
    );
    expect(self.contractFixture.emphasis).toBeGreaterThan(0);
    expect(self.ledgerSource.emphasis).toBeGreaterThan(0);
    // ⚠️ **두 수를 한 낱말로 적지 않는다** — 걷은 실물과 자기 파일의 수가 따로 선다.
    expect(tally.emphasis).not.toBe(self.contractFixture.emphasis + self.ledgerSource.emphasis);
    // 저장소 전수(정찰의 열넷)는 그 셋의 합 **이하**다 — 자기 배제가 그 사이의 차이다.
    expect(
      tally.emphasis + self.contractFixture.emphasis + self.ledgerSource.emphasis
    ).toBeGreaterThanOrEqual(sourceNeedleMeasuredToday().repoEmphasis);
    // ⓕ 자기 배제는 오늘도 일을 한다 — 자기 두 파일은 갈래를 지고 있는데 모집단 밖이다.
    for (const path of LEDGER_SELF_FILES) {
      expect(derived.map((file) => file.path)).not.toContain(path);
    }
  });

  it("⚠️ 이 라운드가 더한 이름은 전부 `export function`이다 (새 `export const` 0건)", () => {
    // 라운드 94의 모든 트랙에 걸린 금지 — 사문 대장의 절반 문턱에 여유가 없다.
    const ledgerSource = readRepo(LEDGER_SELF_FILES[0]);
    for (const name of [
      "sourceNeedleRatchet",
      "needleSplitDecision",
      "sourceSplitScoutValues",
      "sourceNeedleMeasuredToday",
      "sourceNeedleBlindSpots",
      "resumeFieldKeys",
      "scriptsRootYieldToday",
      "emphasisMarkedSourceNeedle",
      "resumeFieldValueSpans",
      "branchSourceNotations",
      "markedBearingFiles"
    ]) {
      expect(ledgerSource, `${name}가 함수다`).toContain(`export function ${name}(`);
      expect(ledgerSource, `${name}가 새 export const가 아니다`).not.toContain(
        `export const ${name}`
      );
    }
  });

  it("⚠️ 뿌리를 넓히지 않았다 — 고르지 않은 길도 값으로 적는다 (`scripts/` 수확 0건)", () => {
    expect(SOURCE_AXIS_ROOTS.length).toBe(2);
    expect(scriptsRootYieldToday()).toBe(0);
    expect(needleSplitDecision().roadsNotTaken.length).toBe(3);
    for (const road of needleSplitDecision().roadsNotTaken) {
      expect(road.trim().length).toBeGreaterThan(40);
    }
  });

  it("⚠️⚠️ 결정형 #19의 발동이 **두 시점으로** 적혀 있다 (물음이 선 날 · 소진된 날)", () => {
    expect(needleSplitDecision().id).toContain("19");
    expect(needleSplitDecision().raisedBy).toContain("M-3");
    expect(needleSplitDecision().question.trim().length).toBeGreaterThan(10);
    expect(needleSplitDecision().before.trim().length).toBeGreaterThan(40);
    expect(needleSplitDecision().after.trim().length).toBeGreaterThan(40);
    expect(needleSplitDecision().before).not.toBe(needleSplitDecision().after);
    // ⚠️ 결정의 내용이 *허용/불허*가 아니라 **갈래를 세운다**임을 값으로 못 박는다.
    expect(needleSplitDecision().decision).toContain("갈래");
    expect(needleSplitDecision().whatDidNotChange).toContain("바이트도 바뀌지 않았다");
  });

  it("⚠️ 전제 재실측 ③ — 정찰의 88·18·14·56 가운데 **셋은 그대로, 넷째가 갈렸다**", () => {
    expect(sourceSplitScoutValues().length).toBe(4);
    expect(sourceSplitScoutValues().map((entry) => entry.scout)).toEqual([88, 18, 14, 56]);
    const needles = sourceSplitScoutValues().map((entry) => entry.needle);
    expect(new Set(needles).size).toBe(needles.length);
    for (const entry of sourceSplitScoutValues()) {
      expect(entry.what.trim().length).toBeGreaterThan(5);
      expect(entry.divergence.trim().length, `${entry.what}의 갈린 이유`).toBeGreaterThan(10);
      expect(entry.remeasured).toBeGreaterThan(0);
    }
    const [wide, marked, emphasis, field] = sourceSplitScoutValues();
    expect(wide.remeasured).toBe(wide.scout);
    expect(marked.remeasured).toBe(marked.scout);
    expect(emphasis.remeasured).toBe(emphasis.scout);
    // ⚠️⚠️ 넷째만 갈렸다 — 정찰의 56은 *필드 44 + 잔여 12*를 한 낱말로 적은 수였다.
    expect(field.remeasured).not.toBe(field.scout);
    expect(field.remeasured).toBeLessThan(field.scout);
    expect(field.divergence).toContain("두 수를 한 낱말로");
    // 갈린 수 둘의 합이 정찰의 수와 아귀가 맞는다(44 + 12 = 56).
    expect(field.remeasured + (field.scout - field.remeasured)).toBe(field.scout);
  });
});

describe("ⓗ' 바늘 셋이 새로 지는 사각 넷 — 남의 사각 목록을 열지 않는다", () => {
  it("넷이 실재하고 요구된 넷이 이름으로 있다", () => {
    expect(sourceNeedleBlindSpots().length).toBeGreaterThanOrEqual(4);
    const ids = sourceNeedleBlindSpots().map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("three-needle-residual"); // ⓐ 셋 어디에도 안 드는 잔여
    expect(ids).toContain("field-needle-is-convention"); // ⓑ 필드형은 관례이지 문법이 아니다
    expect(ids).toContain("emphasis-axis-not-opened"); // ⓒ 모집단은 넓히고 축은 넓히지 않았다
    expect(ids).toContain("markdown-source-notation"); // ⓓ `.md`의 표기는 문서 축의 것이다
  });

  it("⚠️⚠️ 남의 사각 여덟을 열지 않았다 — 이름이 겹치지 않고 그 목록의 길이도 그대로다", () => {
    const theirs = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    expect(theirs.length).toBe(8);
    for (const spot of sourceNeedleBlindSpots()) expect(theirs).not.toContain(spot.id);
    for (const spot of ELAPSED_BLIND_SPOTS) {
      expect(sourceNeedleBlindSpots().map((own) => own.id)).not.toContain(spot.id);
    }
  });

  it("사각마다 무엇·왜·재개 조건이 빈 문자열이 아니고, 오늘 다시 재도 하한을 넘는다", () => {
    for (const spot of sourceNeedleBlindSpots()) {
      expect(spot.what.trim().length, `${spot.id}의 what`).toBeGreaterThan(20);
      expect(spot.why.trim().length, `${spot.id}의 why`).toBeGreaterThan(40);
      expect(spot.reopenCondition.trim().length, `${spot.id}의 재개 조건`).toBeGreaterThan(20);
      expect(spot.floor, `${spot.id}의 하한`).toBeLessThanOrEqual(spot.valueToday);
      expect(spot.measure(repoRoot), `${spot.id}를 오늘 다시 잰 수`).toBeGreaterThanOrEqual(spot.floor);
    }
  });

  it("⚠️ 사각의 재개 조건 자신이 이 대장의 관례를 지킨다 (자기 적용)", () => {
    for (const spot of sourceNeedleBlindSpots()) {
      expect(spot.reopenCondition).toContain("재개 조건(");
      const inner = /재개 조건\(([^)]*)\)/.exec(spot.reopenCondition)?.[1] ?? "";
      expect(/사건형|결정형/.test(inner), `형을 괄호로 밝혔다: ${spot.id}`).toBe(true);
      if (inner.includes("결정형")) {
        expect(HAND_PHRASE.test(inner), `결정형이면 손의 위치를 함께 적었다: ${spot.id}`).toBe(true);
      }
    }
  });

  it("⚠️⚠️ 넷의 자가 실제로 저마다 다른 것을 잰다 (죽은 자가 없다)", () => {
    const spotOf = (id: string) => sourceNeedleBlindSpots().find((spot) => spot.id === id)!;
    // ⓐ 잔여는 0이 아니다 — 정찰이 내다본 0건이 오늘 성립하지 않는다는 사실 자체가 값이다.
    expect(spotOf("three-needle-residual").measure(repoRoot)).toBe(sourceNeedleTally().unneedled);
    expect(spotOf("three-needle-residual").measure(repoRoot)).toBeGreaterThan(0);
    // ⓑ ⚠️ **부정 단언** — 인용을 필드에 담은 자리는 오늘 0건이다(이 바늘이 아직 틀리지 않았다).
    expect(quotedFieldNotations().map((notation) => `${notation.file}:${notation.line}`)).toEqual([]);
    expect(spotOf("field-needle-is-convention").measure(repoRoot)).toBe(0);
    // ⓒ 축을 넓히지 않은 값 — 오늘의 수가 얼마든 **자가 살아 있다**는 것이 여기서 보인다.
    expect(spotOf("emphasis-axis-not-opened").measure(repoRoot)).toBe(
      emphasisDecisiveMissingHand().length
    );
    // ⓓ `.md`는 이 뿌리 밖이고 그 크기가 0이 아니다.
    expect(spotOf("markdown-source-notation").measure(repoRoot)).toBe(markdownNotationCount());
    expect(markdownNotationCount()).toBeGreaterThan(0);
    // ⚠️ 그리고 그 자리는 이 소스 축의 모집단에 **한 자리도** 들지 않았다(두 번 세지 않는다).
    for (const file of SOURCE_AXIS_FILES) expect(file.path.endsWith(".md")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ⓔ 사각 — 값과 하한으로 적혀 있다
// ---------------------------------------------------------------------------

describe("ⓔ 사각 — 이 그물이 못 보는 것이 값과 하한으로 적혀 있다", () => {
  it("최소 셋이고, 요구된 셋이 실제로 있다", () => {
    expect(LEDGER_BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
    const ids = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("prose-only"); // 산문으로만 적힌 조건
    expect(ids).toContain("folded-notation"); // 두 줄로 접힌 조건
    expect(ids).toContain("round-notes"); // docs/5차/**
    expect(ids).toContain("sibling-documents"); // 짝 문서 둘
  });

  it("⚠️ 넓힌 축이 새 사각 둘을 함께 진다 (라운드 91 D — 넓힌 만큼 사각도 넓어진다)", () => {
    const ids = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    expect(LEDGER_BLIND_SPOTS.length).toBeGreaterThanOrEqual(8);
    // ⓐ 표기의 **실재**만 센다 — 그 조건이 오늘 참인가는 묻지 않는다.
    expect(ids).toContain("source-notation-existence");
    // ⓑ 표기를 지니지 않은 소스의 산문 조건은 이 뿌리 밖이다.
    expect(ids).toContain("unmarked-source-prose");
    const existence = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "source-notation-existence");
    expect(existence!.measure(repoRoot)).toBe(collectSourceNotations().length);
    const prose = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "unmarked-source-prose");
    expect(prose!.measure(repoRoot)).toBeGreaterThanOrEqual(prose!.floor);
    // ⚠️ 그 둘도 재개 조건을 자기 축과 함께 진다(아래 자기 적용 단언이 형·손까지 문다).
    for (const spot of [existence!, prose!]) {
      expect(spot.reopenCondition).toContain("재개 조건(");
    }
  });

  it("사각마다 무엇·왜·재개 조건이 빈 문자열이 아니다", () => {
    for (const spot of LEDGER_BLIND_SPOTS) {
      expect(spot.what.trim().length, `${spot.id}의 what`).toBeGreaterThan(20);
      expect(spot.why.trim().length, `${spot.id}의 why`).toBeGreaterThan(40);
      expect(spot.reopenCondition.trim().length, `${spot.id}의 재개 조건`).toBeGreaterThan(20);
    }
  });

  it("⚠️ 사각의 수는 상한이 아니라 하한이다 — 오늘 다시 재도 하한을 넘는다", () => {
    for (const spot of LEDGER_BLIND_SPOTS) {
      expect(spot.floor, `${spot.id}의 하한은 오늘의 값보다 높지 않다`).toBeLessThanOrEqual(spot.valueToday);
      expect(spot.measure(repoRoot), `${spot.id}를 오늘 다시 잰 수`).toBeGreaterThanOrEqual(spot.floor);
    }
  });

  it("가장 큰 사각은 산문 조건이고, 그 수는 모집단 안에서 나온다", () => {
    const prose = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "prose-only");
    expect(prose).toBeDefined();
    expect(prose!.measure(repoRoot)).toBe(sites.length - tallies.line.typed);
  });

  it("`docs/5차/**`는 모집단이 아니라 사각이다 (걷어서 세고, 손으로 적지 않는다)", () => {
    const notes = roundNoteFiles();
    expect(notes.length).toBeGreaterThan(3);
    for (const note of notes) expect(note.startsWith(`${ROUND_NOTES_ROOT}/`)).toBe(true);
    expect(notes).not.toContain(LEDGER_DOCUMENT.path);
  });

  it("짝 문서 둘은 축이 걸릴 자리(결정형)가 0건이라 모집단에 들지 않았다 (그 사실을 다시 잰다)", () => {
    let typed = 0;
    let decisive = 0;
    for (const path of SIBLING_DOCUMENTS) {
      expect(existsSync(join(repoRoot, path)), `${path}가 실재한다`).toBe(true);
      const siblingSites = collectResumeSites(readRepo(path), path);
      typed += tallyNeedles(siblingSites).paren.typed;
      decisive += decisiveSites(siblingSites).length;
    }
    // ⚠️ 결정형이 0건이라 축이 지킬 것이 없다 — 그것이 모집단에 넣지 않은 이유다.
    expect(decisive).toBe(0);
    // 형 표기 자체는 하나 있고(사건형), 그 수는 모집단 문서와 견줄 크기가 아니다.
    expect(typed).toBeLessThan(NOTATION_RATCHET.parenTyped);
  });

  it("⚠️ 사각의 재개 조건 자신이 이 대장의 관례를 지킨다 (자기 적용)", () => {
    const conditions = [
      ...LEDGER_BLIND_SPOTS.map((spot) => spot.reopenCondition),
      ...DECISIVE_HAND_EXEMPTIONS.map((exemption) => exemption.reopenCondition),
      ...SOURCE_AXIS_FILES.map((file) => file.floorReason)
    ];
    for (const condition of conditions) {
      if (!condition.includes("재개 조건(")) continue;
      const inner = /재개 조건\(([^)]*)\)/.exec(condition)?.[1] ?? "";
      expect(/사건형|결정형/.test(inner), `형을 괄호로 밝혔다: ${condition}`).toBe(true);
      if (inner.includes("결정형")) {
        expect(HAND_PHRASE.test(inner), `결정형이면 손의 위치를 함께 적었다: ${condition}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ⓕ 자기 배제 — 대장은 자기를 세지 않는다
// ---------------------------------------------------------------------------

describe("ⓕ 자기 배제 — 대장 자신의 두 파일은 모집단 밖이다", () => {
  it("두 파일이 실재한다", () => {
    expect(LEDGER_SELF_FILES.length).toBe(2);
    for (const path of LEDGER_SELF_FILES) {
      expect(existsSync(join(repoRoot, path)), `${path}가 실재한다`).toBe(true);
    }
  });

  it("모집단(문서 · 소스 축 · 라운드 노트) 어디에도 자기 파일이 없다", () => {
    const population = [
      LEDGER_DOCUMENT.path,
      ...SOURCE_AXIS_FILES.map((file) => file.path),
      ...SIBLING_DOCUMENTS,
      ...roundNoteFiles()
    ];
    for (const path of LEDGER_SELF_FILES) {
      expect(population).not.toContain(path);
    }
  });

  it("⚠️ 배제가 하는 일이 있다 — 자기 파일에 표기가 실제로 살고 있다", () => {
    let notations = 0;
    for (const path of LEDGER_SELF_FILES) {
      notations += tallyNeedles(collectResumeSites(readRepo(path), path)).paren.typed;
    }
    expect(notations).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ⓔ' 유령 방지 ② — 소스 축을 넓힌 뒤에도 문서 축이 함께 세어진다
// ---------------------------------------------------------------------------

describe("⚠️ 유령 방지 ② — 넓힌 뒤에도 문서 축의 넷이 함께 세어진다 (333 · 111 · 30 · 1)", () => {
  const decisive = decisiveSites(sites).length;
  const missing = decisiveSitesMissingHand(sites).length;

  it("네 수가 오늘도 실제로 세어지고, 하한을 넘는다", () => {
    expect(sites.length).toBeGreaterThanOrEqual(NOTATION_RATCHET.sites);
    expect(tallies.paren.typed).toBeGreaterThanOrEqual(NOTATION_RATCHET.parenTyped);
    expect(decisive).toBeGreaterThan(0);
    expect(missing).toBeLessThanOrEqual(DECISIVE_MISSING_HAND_TODAY);
    expect(ratchetViolations(sites)).toEqual([]);
  });

  it("기록된 넷이 서로 아귀가 맞는다 (자리 = 괄호 + 줄만 + 산문)", () => {
    expect(MEASURED_TODAY.parenTyped + MEASURED_TODAY.lineTypedOnly + MEASURED_TODAY.prose).toBe(
      MEASURED_TODAY.sites
    );
    expect(MEASURED_TODAY.parenTyped).toBeLessThanOrEqual(MEASURED_TODAY.lineTyped);
    expect(MEASURED_TODAY.lineHand).toBeLessThanOrEqual(MEASURED_TODAY.windowHand);
    expect(MEASURED_TODAY.parenHand).toBeLessThanOrEqual(MEASURED_TODAY.parenDecisive);
    expect(MEASURED_TODAY.parenDecisive - MEASURED_TODAY.parenHand).toBe(DECISIVE_MISSING_HAND_TODAY);
  });

  it("⚠️ 접점 — 하한을 오늘의 값으로 올리지 않았다 (F가 절을 더해도, 다듬어도 초록)", () => {
    expect(NOTATION_RATCHET.sites).toBeLessThan(MEASURED_TODAY.sites);
    expect(NOTATION_RATCHET.parenTyped).toBeLessThan(MEASURED_TODAY.parenTyped);
    expect(NOTATION_RATCHET.parenHand).toBeLessThan(MEASURED_TODAY.parenHand);
    expect(NOTATION_RATCHET.lineTyped).toBeLessThan(MEASURED_TODAY.lineTyped);
    expect(NOTATION_RATCHET.lineHand).toBeLessThan(MEASURED_TODAY.lineHand);
    expect(NOTATION_RATCHET.windowHand).toBeLessThan(MEASURED_TODAY.windowHand);
  });

  it("⚠️ 교란 ③ — F가 문서 축에 절을 더해도 넷이 다 초록이다", () => {
    const added = withExtraLines(
      "## AF절 — 라운드 91이 답한 자리 (F가 쓰는 절의 모양을 흉내 낸 픽스처)",
      "- ⚠️ **재개 조건(사건형): 소스 축의 파생 수가 셋이 되는 날.**",
      "- ⚠️ **재개 조건(결정형 · 손은 저장소 안): 관례를 소급 적용할지 정하는 날.**",
      "- ⚠️ **재개 조건: 형을 밝히지 않은 산문 조건도 함께 더해 본다.**"
    );
    expect(ratchetViolations(added)).toEqual([]);
    expect(added.length).toBeGreaterThan(sites.length);
    expect(tallyNeedles(added).paren.typed).toBeGreaterThan(tallies.paren.typed);
    expect(decisiveSitesMissingHand(added).length).toBe(missing);
    // 그리고 문서가 자라도 소스 축은 흔들리지 않는다(두 축이 서로의 수를 빌리지 않는다).
    expect(sourceCountViolation(SOURCE_AXIS_FILES)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ⓖ 경과 축 — *몇 라운드째 서 있는가* (⚠️⚠️ 라운드 92 트랙 D가 더한 칸)
// ---------------------------------------------------------------------------

describe("ⓖ 경과 축 — 자리마다 몇 라운드째 서 있는지를 바늘 둘로 따로 센다", () => {
  const elapsed = documentElapsedSites();
  const tally = tallyElapsed(elapsed);

  it("ⓐ 모집단을 넓히지 않았다 — `collectDocumentSites()`가 파생한 자리 그대로다", () => {
    // ⚠️ 이 축이 세는 자리는 문서 축의 자리와 **같은 전수**다(넓히면 이 트랙이 축 둘을 진다).
    expect(elapsed.length).toBe(sites.length);
    expect(elapsed.map((entry) => entry.site.line)).toEqual(sites.map((site) => site.line));
    for (const entry of elapsed) expect(entry.site.file).toBe(LEDGER_DOCUMENT.path);
    // 같은 원문·같은 자리를 손으로 넣어도 같은 수가 나온다(모집단이 이 축의 것이 아니라는 증거).
    expect(tallyElapsed(collectElapsedSites(documentText, sites))).toEqual(tally);
  });

  it("ⓔ 유령 방지 — 모집단이 0건이 아니고, **바늘 둘이 서로 다른 수를 낸다**", () => {
    expect(sites.length).toBeGreaterThanOrEqual(LEDGER_DOCUMENT.minSites);
    expect(tally.ownLine).toBeGreaterThan(0);
    expect(tally.window).toBeGreaterThan(0);
    // ⚠️⚠️ 두 수가 같아지면 바늘 하나가 죽은 것이다 — 그 사실을 단언으로 못 박는다.
    expect(tally.ownLine).not.toBe(tally.window);
    expect(tally.ownLine).toBeLessThan(tally.window);
    expect(tally.window + tally.neither).toBe(elapsed.length);
  });

  it("ⓑ 두 수를 **한 낱말로 적지 않는다** — 이름이 갈려 있고 합친 수를 드는 자리가 없다", () => {
    // 라운드 91 D의 `tallyNeedles`가 바늘 셋을 갈라 든 그 형식을 그대로 인용한다.
    expect(Object.keys(tally).sort()).toEqual(["neither", "ownLine", "window"]);
    expect(ELAPSED_MEASURED_TODAY.ownLine).not.toBe(ELAPSED_MEASURED_TODAY.window);
    expect(Object.keys(ELAPSED_RATCHET).sort()).toEqual(["ownLine", "window"]);
    // 기록은 하한 방향으로만 견준다(등호로 물면 조건을 더하는 손이 빨강을 맞는다).
    expect(ELAPSED_MEASURED_TODAY.ownLine).toBeLessThanOrEqual(tally.ownLine);
    expect(ELAPSED_MEASURED_TODAY.window).toBeLessThanOrEqual(tally.window);
  });

  it("ⓒ 한국어 수사와 아라비아 숫자를 함께 읽고, 그 표는 **소스에서 파생된다**", () => {
    // ⚠️ 손으로 적은 표가 아니라 열 자리 × 낱 자리의 곱이다.
    expect(ELAPSED_NUMERAL_TABLE).toEqual(buildElapsedNumeralTable());
    expect(Object.keys(ELAPSED_NUMERAL_TABLE).length).toBe(
      Object.keys(ELAPSED_STANDALONE).length +
        Object.keys(ELAPSED_TENS).length * Object.keys(ELAPSED_UNITS).length
    );
    expect(elapsedNumeral("스물다섯")).toBe(25);
    expect(elapsedNumeral("서른한")).toBe(31); // 손 목록이었다면 빠졌을 자리
    expect(elapsedNumeral("스무")).toBe(20); // 홀로 설 때의 꼴
    expect(elapsedNumeral("14")).toBe(14);
    expect(elapsedNumeral("아무개")).toBeUndefined(); // 모르는 낱말을 0으로 읽지 않는다
    expect(elapsedMarksIn("C-3이 스물다섯 라운드째 서 있다")[0]).toEqual({
      numeral: "스물다섯",
      rounds: 25,
      unit: "째"
    });
    expect(elapsedMarksIn("링크 축이 11 라운드 연속 그대로다")[0].rounds).toBe(11);
    // ⚠️ 두 꼴 다 **오늘 실제로 읽히고 있다**(한쪽이 0건이면 그 절반은 죽은 바늘이다).
    const korean = elapsed.filter((entry) =>
      entry.inWindow.some((mark) => !/^\d+$/.test(mark.numeral))
    ).length;
    const arabic = elapsed.filter((entry) =>
      entry.inWindow.some((mark) => /^\d+$/.test(mark.numeral))
    ).length;
    expect(korean).toBeGreaterThan(0);
    expect(arabic).toBeGreaterThan(0);
    expect(ELAPSED_MEASURED_TODAY.koreanNumeralSites).toBeLessThanOrEqual(korean);
    expect(ELAPSED_MEASURED_TODAY.arabicNumeralSites).toBeLessThanOrEqual(arabic);
    // ⚠️⚠️ **읽지 못한 수사는 경과로 세지 않는다**(라운드 92 리뷰 M-2 · 종전에는 세었다).
    //  · 종전 이 자리의 단언은 `unreadableNumerals >= 0` 이라는 **항진명제**였고, 그래서 그 칸이
    //    **0**이라고 적은 거짓이 조용했다(이 문서에는 *"이백 **몇**십 라운드"* 가 있다).
    //  · 오늘은 그 목록을 **낱말로 등호로** 문다 — 값이 갈리면 이 줄이 곧바로 빨개진다.
    const unreadable = unreadableElapsedNumerals(elapsed);
    expect(unreadable, "읽지 못한 수사 전수").toEqual([...ELAPSED_MEASURED_TODAY.unreadableNumeralWords]);
    expect(ELAPSED_MEASURED_TODAY.unreadableNumerals, "그 수와 낱말 수가 아귀가 맞는다").toBe(
      ELAPSED_MEASURED_TODAY.unreadableNumeralWords.length
    );
    expect(unreadable.length, "0이 아니다 — 이 사각은 유령이 아니다").toBeGreaterThan(0);
    // ⚠️ 그리고 그 낱말은 마크에 **없다** — 세지 않는다는 사실을 부정 단언으로 못 박는다.
    for (const word of unreadable) {
      expect(
        elapsed.some((entry) => entry.inWindow.some((mark) => mark.numeral === word)),
        `${word}가 경과 마크로 세어졌다`
      ).toBe(false);
    }
    // 픽스처 — 읽지 못한 수사 하나짜리 창은 경과 0건이고, 그 낱말은 따로 남는다.
    expect(elapsedMarksIn("이백 몇십 자리가 자기가 몇 라운드째 서 있는지를 적지 않는다"), "읽지 못한 수사는 마크가 아니다").toEqual([]);
    expect(unreadableNumeralsIn("이백 몇십 자리가 자기가 몇 라운드째 서 있는지를 적지 않는다"), "그러나 사라지지도 않는다").toEqual(["몇"]);
  });

  it("ⓓ 래칫은 **하한뿐**이다 — 오늘의 실측이 둘 다 하한을 넘는다", () => {
    expect(elapsedRatchetViolations(tally)).toEqual([]);
    expect(ELAPSED_RATCHET.ownLine).toBeLessThanOrEqual(tally.ownLine);
    expect(ELAPSED_RATCHET.window).toBeLessThanOrEqual(tally.window);
    // ⚠️⚠️ 창 바늘의 하한은 오늘의 실측이 아니라 **정찰의 61**이다(문단이 끼어들어도 초록이도록).
    expect(ELAPSED_RATCHET.window).toBeLessThan(ELAPSED_MEASURED_TODAY.window);
    expect(ELAPSED_RATCHET.window).toBe(61);
  });

  it("⚠️ 교란 ① — **경과를 적은 자리를 지운 픽스처**에서 하한이 빨개진다", () => {
    // 문서를 고치지 않는다 — 메모리에서 경과 표기를 산문으로 바꿔 적는다(문서 쓰기 0건).
    const erasedText = documentText.replace(/(?:[가-힣]+|\d+)\s*라운드\s*(?:연속|째|만에)/g, "오래");
    const erased = collectElapsedSites(erasedText, collectResumeSites(erasedText, "<픽스처>"));
    const erasedTally = tallyElapsed(erased);
    expect(erasedTally.ownLine).toBeLessThan(tally.ownLine);
    expect(erasedTally.window).toBeLessThan(tally.window);
    const violations = elapsedRatchetViolations(erasedTally);
    expect(violations.map((violation) => violation.name).sort()).toEqual(["ownLine", "window"]);
    for (const violation of violations) expect(violation.measured).toBeLessThan(violation.floor);
    // ⚠️ 그리고 그 자리들이 사라진 것이 아니라 **산문으로 바뀐 것**이다 — 사각 ⓐ가 그 몫을 진다.
    expect(erased.length).toBe(elapsed.length);
  });

  it("⚠️ 교란 ② — **F가 AG절을 쓰며 조건을 더해도** 초록이다 (하한만 물기 때문이다)", () => {
    const addedText = `${documentText}\n${[
      "## AG절 — 라운드 92가 답한 자리 (F가 쓰는 절의 모양을 흉내 낸 픽스처)",
      "- ⚠️ **재개 조건(사건형): 경과 축이 처음으로 빨개지는 날.**",
      "- ⚠️ **재개 조건(결정형 · 손은 저장소 안): 도래를 값으로 가를지 정하는 날.**",
      "- ⚠️ **재개 조건: 경과를 적지 않은 산문 조건도 더해 본다.**",
      "- ⚠️ **재개 조건: 또 하나 — 이 줄도 경과를 적지 않는다.**"
    ].join("\n")}\n`;
    const added = collectElapsedSites(addedText, collectResumeSites(addedText, "<픽스처>"));
    const addedTally = tallyElapsed(added);
    // 자리는 늘고, 경과를 적은 자리는 줄지 않는다 — 그래서 초록이다.
    expect(added.length).toBeGreaterThan(elapsed.length);
    expect(addedTally.ownLine).toBeGreaterThanOrEqual(tally.ownLine);
    expect(addedTally.window).toBeGreaterThanOrEqual(tally.window);
    expect(addedTally.neither).toBeGreaterThan(tally.neither);
    expect(elapsedRatchetViolations(addedTally)).toEqual([]);
    // ⚠️⚠️ **비율로 물었다면 여기서 빨개졌다** — 경과를 적지 않은 자리가 넷 늘었기 때문이다.
    expect(addedTally.window / added.length).toBeLessThan(tally.window / elapsed.length);
  });

  it("⚠️ 창의 폭은 바늘의 일부다 — 값으로 박혀 있고, 좁히면 수가 갈린다", () => {
    expect(ELAPSED_WINDOW_RADIUS).toBe(5);
    const narrow = tallyElapsed(collectElapsedSites(documentText, sites, 3));
    const wide = tallyElapsed(collectElapsedSites(documentText, sites, 7));
    expect(narrow.window).toBeLessThan(tally.window);
    expect(wide.window).toBeGreaterThan(tally.window);
    // ⚠️ 그 줄 자신의 수는 창을 넓혀도 움직이지 않는다(두 바늘이 서로 다른 것을 재는 증거).
    expect(narrow.ownLine).toBe(tally.ownLine);
    expect(wide.ownLine).toBe(tally.ownLine);
  });
});

describe("ⓖ' 경과 축의 사각 셋 — 값과 하한으로 서고, 남의 사각 목록을 열지 않는다", () => {
  it("셋이 실재하고 요구된 셋이 이름으로 있다", () => {
    expect(ELAPSED_BLIND_SPOTS.length).toBeGreaterThanOrEqual(3);
    const ids = ELAPSED_BLIND_SPOTS.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("prose-elapsed"); // ⓐ 산문으로 오래됨을 말하는 자리는 밖이다
    expect(ids).toContain("elapsed-truth"); // ⓑ 적혀 있다는 것과 오늘 참이라는 것은 다르다
    expect(ids).toContain("elapsed-outside-population"); // ⓒ 짝 문서·라운드 노트는 밖이다
  });

  it("사각마다 무엇·왜·재개 조건이 빈 문자열이 아니고, 오늘 다시 재도 하한을 넘는다", () => {
    for (const spot of ELAPSED_BLIND_SPOTS) {
      expect(spot.what.trim().length, `${spot.id}의 what`).toBeGreaterThan(20);
      expect(spot.why.trim().length, `${spot.id}의 why`).toBeGreaterThan(40);
      expect(spot.reopenCondition.trim().length, `${spot.id}의 재개 조건`).toBeGreaterThan(20);
      expect(spot.floor, `${spot.id}의 하한`).toBeLessThanOrEqual(spot.valueToday);
      expect(spot.measure(repoRoot), `${spot.id}를 오늘 다시 잰 수`).toBeGreaterThanOrEqual(spot.floor);
    }
  });

  it("⚠️⚠️ 사각 ⓑ가 *적힘 ≠ 오늘 참*을 값으로 적고, **결정형 열다섯의 관례를 세우지 않는다**", () => {
    const truth = ELAPSED_BLIND_SPOTS.find((spot) => spot.id === "elapsed-truth");
    expect(truth).toBeDefined();
    expect(truth!.why).toContain("열다섯");
    expect(truth!.why).toContain("이 트랙은 그 관례를 세우지 않는다");
    // 그 사각의 크기는 창 바늘이 센 수 그대로다 — 그 전부가 *오늘도 맞는가*를 묻지 않은 채 세어진다.
    expect(truth!.measure(repoRoot)).toBe(tallyElapsed(documentElapsedSites()).window);
    // ⓒ 짝 문서·라운드 노트의 경과는 이 모집단 밖이고, 그 수가 0이 아니다(사각이 실재한다).
    const outside = ELAPSED_BLIND_SPOTS.find((spot) => spot.id === "elapsed-outside-population");
    expect(outside!.measure(repoRoot)).toBeGreaterThan(0);
    // ⓐ 산문으로만 오래됨을 말하는 자리도 0건이 아니다 — 이 바늘이 못 보는 것이 실제로 있다.
    const prose = ELAPSED_BLIND_SPOTS.find((spot) => spot.id === "prose-elapsed");
    expect(prose!.measure(repoRoot)).toBeGreaterThan(0);
  });

  it("⚠️ 사각의 재개 조건 자신이 이 대장의 관례를 지킨다 (자기 적용 · AD-5)", () => {
    for (const spot of ELAPSED_BLIND_SPOTS) {
      expect(spot.reopenCondition).toContain("재개 조건(");
      const inner = /재개 조건\(([^)]*)\)/.exec(spot.reopenCondition)?.[1] ?? "";
      expect(/사건형|결정형/.test(inner), `형을 괄호로 밝혔다: ${spot.id}`).toBe(true);
      if (inner.includes("결정형")) {
        expect(HAND_PHRASE.test(inner), `결정형이면 손의 위치를 함께 적었다: ${spot.id}`).toBe(true);
      }
    }
  });

  it("⚠️⚠️ 남의 사각 여덟을 열지 않았다 — 이름이 겹치지 않고 그 목록의 길이도 그대로다", () => {
    const theirs = LEDGER_BLIND_SPOTS.map((spot) => spot.id);
    expect(theirs.length).toBe(8);
    for (const spot of ELAPSED_BLIND_SPOTS) expect(theirs).not.toContain(spot.id);
  });
});

// ---------------------------------------------------------------------------
// 전제 재실측 ② — 라운드 92 정찰의 네 수(333 · 3 · 61 · 272)
// ---------------------------------------------------------------------------

describe("전제 재실측 ② — 정찰의 333·3·61·272를 다시 센다", () => {
  const tally = tallyElapsed(documentElapsedSites());

  it("네 수가 전부 값으로 적혀 있고, 갈린 이유가 빈 문자열이 아니다", () => {
    expect(ELAPSED_SCOUT_VALUES.length).toBe(4);
    expect(ELAPSED_SCOUT_VALUES.map((entry) => entry.scout)).toEqual([333, 3, 61, 272]);
    for (const entry of ELAPSED_SCOUT_VALUES) {
      expect(entry.what.trim().length).toBeGreaterThan(5);
      expect(entry.divergence.trim().length, `${entry.what}의 갈린 이유`).toBeGreaterThan(10);
      expect(entry.remeasured).toBeGreaterThan(0);
    }
  });

  it("⚠️ 앞의 둘은 그대로이고 뒤의 둘은 **바늘이 갈렸다** — 갈림이 오늘의 실측과 아귀가 맞는다", () => {
    const [siteCount, ownLine, window, neither] = ELAPSED_SCOUT_VALUES;
    // ⚠️⚠️ **두 시점 — 라운드 92 트랙 F가 이 네 줄을 등호에서 하한으로 옮겼다.**
    //  · **트랙 D 커밋 시점**: `333 · 3 · 70 · 263`이 그대로 살아 있고, 아래 `remeasured` 값은
    //    한 바이트도 바뀌지 않았다(그 라운드의 기록이다).
    //  · **같은 라운드의 F 뒤**: 판정 문서에 AG절이 서며 자리가 `383 · 4 · 83 · 300`이 됐다.
    // ⚠️ 이 네 줄이 **등호**였을 때 그 걸음에 곧바로 빨개졌다 — 라운드 92 정찰이 이 트랙에
    // *"F가 AG절을 쓰며 조건을 더하면 자리 수가 커지는데 **하한 설계 덕에 초록으로 남는다**"* 라고
    // 적었고, `floor`와 `MEASURED_TODAY`는 실제로 하한이었지만 **이 재실측 블록만 등호였다.**
    // ⚠️⚠️ AF-5가 이름 붙인 *등호의 비용*이 이 자리에서 되풀이됐고, 고른 처방은 라운드 90 트랙 D의
    // 그것과 같다: **기록은 등호로 지키고 살아 있는 실측은 하한으로 문다.**
    expect(sites.length).toBeGreaterThanOrEqual(siteCount.remeasured); // 오늘 383 ≥ 기록 333
    expect(siteCount.remeasured).toBe(siteCount.scout);
    expect(tally.ownLine).toBeGreaterThanOrEqual(ownLine.remeasured); // 오늘 4 ≥ 기록 3
    expect(ownLine.remeasured).toBe(ownLine.scout);
    expect(tally.window).toBeGreaterThanOrEqual(window.remeasured); // 오늘 83 ≥ 기록 70
    expect(window.remeasured).not.toBe(window.scout);
    expect(tally.neither).toBeGreaterThanOrEqual(neither.remeasured); // 오늘 300 ≥ 기록 263
    expect(neither.remeasured).toBe(siteCount.remeasured - window.remeasured);
    expect(neither.scout).toBe(siteCount.scout - window.scout);
  });

  it("⚠️⚠️ 갈린 61을 버리지 않고 **하한으로** 든다 (라운드 89 D가 정찰의 14를 셋째 바늘로 든 그 판단)", () => {
    const window = ELAPSED_SCOUT_VALUES[2];
    expect(ELAPSED_RATCHET.window).toBe(window.scout);
    expect(ELAPSED_RATCHET.window).toBeLessThan(window.remeasured);
    expect(window.divergence).toContain("하한");
    expect(elapsedRatchetViolations(tally)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 전제 재실측 — 정찰의 다섯 수를 다시 셌다
// ---------------------------------------------------------------------------

describe("전제 재실측 — 정찰의 203·61·84·11·14를 다시 센다", () => {
  it("다섯 수가 전부 값으로 적혀 있고, 갈린 이유가 빈 문자열이 아니다", () => {
    expect(SCOUT_NEEDLE_VALUES.length).toBe(5);
    for (const entry of SCOUT_NEEDLE_VALUES) {
      expect(entry.what.trim().length).toBeGreaterThan(5);
      expect(entry.divergence.trim().length, `${entry.what}의 갈린 이유`).toBeGreaterThan(10);
      expect(entry.remeasured).toBeGreaterThan(0);
    }
    expect(SCOUT_NEEDLE_VALUES.map((entry) => entry.scout)).toEqual([203, 61, 84, 11, 14]);
  });

  it("재실측값이 이 대장의 기록·하한과 어긋나지 않는다 (두 시점 — 당시 ≤ 오늘)", () => {
    // ⚠️⚠️ **두 시점**(라운드 89 리뷰 M-4). 당시 이 줄은 두 표를 **등호**로 묶었다 —
    // 트랙 D 시점에는 `SCOUT_NEEDLE_VALUES.remeasured`와 `MEASURED_TODAY`가 같은 수였기
    // 때문이다. 그러나 두 표는 **다른 것을 기록한다**: 앞의 것은 *정찰 ↔ D의 대조*(그날 바늘
    // 셋이 갈린 근거)이고, 뒤의 것은 *오늘 HEAD의 실측*이다. 같은 라운드의 C·F가 조건을
    // 더하자 두 시점이 갈렸고, 등호는 **오늘의 실측을 갱신하는 정직한 손을 막는 모양**이 됐다.
    // 그래서 묻는 것을 바꾼다 — *"같은가"* 가 아니라 *"당시의 기록이 오늘보다 크지 않은가"*.
    // ⚠️ 이 방향이 이 대장이 처음부터 고른 그 방향이다(하한만 문다).
    const [site, parenTyped, lineTyped, parenHand, windowHand] = SCOUT_NEEDLE_VALUES;
    expect(site.remeasured, "자리 전수").toBeLessThanOrEqual(MEASURED_TODAY.sites);
    expect(parenTyped.remeasured, "괄호 바늘 · 형").toBeLessThanOrEqual(MEASURED_TODAY.parenTyped);
    expect(lineTyped.remeasured, "줄 바늘 · 형").toBeLessThanOrEqual(MEASURED_TODAY.lineTyped);
    expect(parenHand.remeasured, "괄호 바늘 · 손").toBeLessThanOrEqual(MEASURED_TODAY.parenHand);
    expect(windowHand.remeasured, "접힘 바늘 · 손").toBeLessThanOrEqual(MEASURED_TODAY.windowHand);
    // ⚠️ 그리고 오늘의 실측이 그 기록 아래로 내려가지 않았다(래칫과 같은 방향의 확인).
    expect(ratchetViolations(sites, NOTATION_RATCHET)).toEqual([]);
  });

  it("⚠️ 손의 위치는 한 수가 아니라 두 수다 — 당시 줄 12·접힘 14, 오늘 줄 33·접힘 35", () => {
    expect(MEASURED_TODAY.lineHand).not.toBe(MEASURED_TODAY.windowHand);
    expect(tallies.window.hand).toBeGreaterThan(tallies.line.hand);
    const folded = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "folded-notation");
    expect(folded).toBeDefined();
    expect(folded!.measure(repoRoot)).toBe(tallies.window.hand - tallies.line.hand);
  });
});

// ---------------------------------------------------------------------------
// ⓘ 기록 축 — *적힌 값*과 *오늘의 자*가 갈리는 것을 세는 자 (라운드 95 트랙 C)
//
// ⚠️⚠️ **이 트랙이 여는 축은 하나다** — *사각이 자기 값을 어떻게 기록하는가*이지 그 값을 내는
// 자가 아니다. 소스 축·문서 축·경과 축의 **바늘은 한 글자도 바뀌지 않았고**, 사각 열다섯의
// 이름·서술·재개 조건도 그대로다. 바뀐 것은 **값이 사는 꼴**(상수 → 자에서 파생)과 **옛 값의
// 자리**(→ `recorded`) 둘뿐이다.
//
// ⚠️ **등호를 세우지 않는다**: 이 수들은 F가 판정 문서를 정직하게 쓸 때마다 자라므로 아래 어느
// 단언도 *"오늘 몇인가"* 를 등호로 묻지 않는다. 무는 것은 **적힌 값 ≤ 오늘의 자**(오르는 쪽) ·
// **하한 ≤ 오늘의 자** · **값이 파생인가**(구조) 셋이다.
// ---------------------------------------------------------------------------

describe("ⓘ 기록 축 — 사각의 적힌 값과 오늘의 자가 갈리는 것을 센다", () => {
  // ⚠️ 자 열다섯을 도는 값이라 **한 번만 잰다**(같은 걸음 안에서 다시 재면 남의 트랙 커밋이
  //    그 사이에 값을 옮겨 놓는다 — 이 라운드에 실제로 일어난 일이다).
  const census = allBlindSpots();
  const readings = blindSpotReadings(repoRoot, census);
  const divergences = readings.filter((reading) => reading.hasRecord && !reading.same);
  const ledgerSource = readRepo(LEDGER_SELF_FILES[0]);

  it("ⓐ 모집단 — 사각 전수를 **자기 소스의 세 목록에서** 파생한다 (손 목록 0건)", () => {
    expect(census.length).toBe(
      LEDGER_BLIND_SPOTS.length + sourceNeedleBlindSpots().length + ELAPSED_BLIND_SPOTS.length
    );
    expect(census.length).toBeGreaterThanOrEqual(11); // 전제 하한 — 정찰이 센 열하나
    const ids = census.map((entry) => entry.spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    // ⚠️ **손 목록 금지** — 전수를 내는 함수의 몸에 아이디가 한 글자도 박혀 있지 않다.
    const body = /export function allBlindSpots\(\)[\s\S]*?\n}/.exec(ledgerSource)?.[0] ?? "";
    expect(body.length).toBeGreaterThan(0);
    for (const id of ids) expect(body, `${id}가 손으로 적혀 있지 않다`).not.toContain(`"${id}"`);
    for (const list of ["LEDGER_BLIND_SPOTS", "sourceNeedleBlindSpots()", "ELAPSED_BLIND_SPOTS"]) {
      expect(body, `${list}에서 파생한다`).toContain(list);
    }
  });

  it("ⓐ' ⚠️⚠️ 정찰의 **열하나**와 갈렸다 — 세지 않은 넷의 이름을 값으로 든다", () => {
    // 정찰(round95-scout.md)은 `여덟 + 셋 = 열하나`로 세었고 `sourceNeedleBlindSpots()`의 넷이 빠졌다.
    const scoutCounted = LEDGER_BLIND_SPOTS.length + ELAPSED_BLIND_SPOTS.length;
    expect(scoutCounted).toBe(11);
    expect(census.length).toBeGreaterThan(scoutCounted);
    const missed = sourceNeedleBlindSpots().map((spot) => spot.id);
    expect(missed.length).toBe(4);
    // ⚠️ 그 넷 가운데 하나가 오늘 갈려 있다 — 그래서 정찰의 *일곱*은 이 자의 **여덟**이 된다.
    expect(missed).toContain("markdown-source-notation");
    const markdown = readings.find((reading) => reading.id === "markdown-source-notation");
    expect(markdown?.same, "정찰이 세지 않은 넷째 갈림").toBe(false);
    // ⚠️ **두 수를 한 낱말로 적지 않는다** — 이 대장이 그 갈림을 문장으로도 지고 있다.
    expect(ledgerSource).toContain("열하나 안의 갈림");
  });

  it("ⓑ 판정 셋 — 자가 있는가 · 적힌 값이 있는가 · 오늘 같은가", () => {
    for (const reading of readings) {
      expect(reading.hasMeasure, `${reading.id}: 자가 있다`).toBe(true);
      expect(reading.hasRecord, `${reading.id}: 적힌 값이 있다`).toBe(true);
      expect(reading.recordedAt.trim().length, `${reading.id}: 그 값이 선 시점`).toBeGreaterThan(3);
      expect(typeof reading.recorded, `${reading.id}: 적힌 값은 수다`).toBe("number");
    }
    // 전제 하한 — 자를 지닌 자리 열하나 이상(오늘은 전수가 다 자를 지닌다).
    expect(readings.filter((reading) => reading.hasMeasure).length).toBeGreaterThanOrEqual(11);
    // ⚠️ 판정이 전수를 **정확히 둘로** 가른다(어느 자리도 두 갈래에 들지 않는다).
    expect(readings.filter((reading) => reading.same).length + divergences.length).toBe(
      readings.length
    );
    // ⚠️⚠️ 갈린 자리가 0건이 아니다 — 이 트랙이 오기 전 이 대장이 실제로 앓던 그 병이다.
    //    (*같은 자리*가 0건이 아니라는 사실은 아래 교란 ①의 온전한 픽스처가 값으로 보인다 —
    //     실물 쪽 *같음*은 남의 트랙 커밋 하나로 갈릴 수 있어 계약이 그것에 기대지 않는다.)
    expect(divergences.length).toBeGreaterThan(0);
    expect(divergences.length).toBeLessThanOrEqual(readings.length);
  });

  it("ⓒ 갈림의 크기 — 자리마다 적힌 값·오늘의 자·차이가 서고, ⚠️⚠️ **음수는 0건이다**", () => {
    for (const reading of divergences) {
      expect(reading.recorded, `${reading.id}: 적힌 값`).toBeDefined();
      expect(reading.delta, `${reading.id}: 차이`).toBeDefined();
      expect(reading.today, `${reading.id}: 오늘의 자`).not.toBe(reading.recorded);
    }
    // ⚠️⚠️ **부정 단언** — 이 사각들은 자라는 쪽이고, 줄어드는 날은 이름이 틀렸던 날이다.
    expect(readings.filter((reading) => (reading.delta ?? 0) < 0).map((reading) => reading.id)).toEqual(
      []
    );
    // 정찰이 이름으로 든 일곱이 오늘도 갈려 있다(재확인 — 값은 자가 내므로 등호로 묻지 않는다).
    for (const id of [
      "prose-only",
      "folded-notation",
      "round-notes",
      "sibling-documents",
      "one-line-two-sites",
      "elapsed-truth",
      "elapsed-outside-population"
    ]) {
      const reading = readings.find((entry) => entry.id === id);
      expect(reading, `${id}가 전수에 있다`).toBeDefined();
      expect(reading!.today, `${id}: 적힌 값보다 오늘이 크다`).toBeGreaterThan(reading!.recorded as number);
    }
    // 갈림의 크기가 **문장으로도** 남아 있다(왜 갈렸는지가 빈 문자열이 아니다).
    for (const { spot } of census) {
      const record = latestRecord(spot);
      expect(record?.divergence.trim().length, `${spot.id}: 갈린 까닭`).toBeGreaterThan(10);
    }
  });

  it("ⓓ 오르는 쪽 래칫 — 적힌 값 ≤ 오늘의 자 · ⚠️ **하한은 한 칸도 올리지 않았다**", () => {
    expect(recordedRatchetViolations(repoRoot, census)).toEqual([]);
    for (const { spot } of census) {
      expect(spot.floor, `${spot.id}: 하한 ≤ 오늘의 값`).toBeLessThanOrEqual(spot.valueToday);
    }
    // ⚠️ 종전 하한이 그대로다 — 이 트랙이 더한 것은 기록의 래칫이지 사각의 하한이 아니다.
    expect(ELAPSED_RATCHET).toEqual({ ownLine: 3, window: 61 });
    expect(NOTATION_RATCHET.parenTyped).toBe(61);
    expect(sourceNeedleRatchet()).toEqual({ marked: 7, emphasis: 3, field: 25, branched: 45 });
    expect(ratchetViolations(sites)).toEqual([]);
    expect(sourceNeedleRatchetViolations(sourceNeedleTally())).toEqual([]);
  });

  it("⚠️⚠️ 값이 **파생이다** — 상수를 감싼 값이 0건임을 구조와 소스 둘로 문다", () => {
    for (const reading of readings) {
      expect(reading.derived, `${reading.id}: valueToday가 게터다`).toBe(true);
    }
    for (const { spot } of census) {
      // 자가 오늘 실제로 불려 그 수를 낸다(유령 자 금지 — 값과 자가 같은 수를 낸다).
      expect(spot.valueToday, `${spot.id}`).toBe(spot.measure(repoRoot));
    }
    // ⚠️ **부정 단언** — 사각 목록에 손으로 박은 `valueToday: <수>`가 한 자리도 없다.
    expect(/valueToday:\s*\d/.test(ledgerSource), "손이 적은 값이 남아 있다").toBe(false);
    // 세 목록이 전부 파생을 거쳐 선다.
    for (const built of ["LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = derivedBlindSpots("]) {
      expect(ledgerSource).toContain(built);
    }
  });

  it("ⓔ 본보기 — 사문 대장은 같은 자리를 **등호로** 물어 갈림 0이고, 이 대장은 그 길을 고르지 않는다", () => {
    const example = deadExportLedgerEquality();
    expect(example.spots).toBeGreaterThanOrEqual(8);
    expect(example.measured).toBeGreaterThanOrEqual(6);
    // ⚠️ 그 대장의 계약이 자리마다 `toBe(<적힌 값>)`으로 못 박고 있다 — 그것이 갈림 0의 까닭이다.
    expect(example.equalityPinned).toBe(example.measured);
    // 오늘 이 자가 실제로 대어 본 둘 — 갈림 0(나머지 넷은 그 대장의 계약이 문다).
    expect(example.checked.length).toBe(2);
    for (const row of example.checked) expect(row.today, `${row.id}`).toBe(row.recorded);
    expect(example.divergence).toBe(0);
    // ⚠️⚠️ **고르지 않은 길도 값이다** — 왜 여기서 등호를 세우지 않는지가 문장으로 서 있다.
    expect(example.whyNotHere).toContain("자라는 수");
    expect(example.whyNotHere).toContain("문서를 계약에 맞추는 것");
    // ⚠️ 로직을 복사하지 않았다 — 그 대장의 자를 여기서 다시 짓지 않고 **읽어** 부른다.
    expect(ledgerSource).toContain('from "./dead-export-ledger"');
    expect(ledgerSource).not.toContain("export function tsxExportFunctionCount");
  });

  it("⚠️ 정찰 실측의 재확인 — 아홉은 갈리지 않고, 갈린 자리의 몫은 **정찰 자신의 노트**다", () => {
    const rows = blindSpotScoutRecheck(repoRoot);
    expect(rows.length).toBe(11); // 정찰이 대어 본 열하나
    // ⚠️ 이 트랙의 첫 실측에서는 아홉이 갈리지 않았다(**둘만 갈렸다**). ⚠️⚠️ **그 수를 등호로 묻지
    //    않는 이유는 같은 라운드의 다른 트랙이 소스에 재개 조건을 더하면 소스를 걷는 자리가 곧바로
    //    움직이기 때문이다** — 이 트랙이 걷는 동안 실제로 셋이 그렇게 움직였다. 계약은 하한만 문다.
    expect(rows.filter((row) => row.same).length).toBeGreaterThanOrEqual(5);
    const noteSites = scoutNoteSiteCount();
    expect(noteSites, "정찰 노트가 재개 조건을 지고 있다").toBeGreaterThan(0);
    // ⚠️⚠️ `docs/5차/**`를 걷는 자 둘이 정찰과 갈렸고, 정찰의 수는 오늘보다 작다(자기 노트만큼).
    const notes = rows.find((row) => row.id === "round-notes");
    expect(notes?.same).toBe(false);
    expect(notes!.today - notes!.scout).toBeLessThanOrEqual(noteSites);
    const outside = rows.find((row) => row.id === "elapsed-outside-population");
    expect(outside!.today).toBeGreaterThan(outside!.scout);
    // 그 지문이 값으로 적혀 있다(다음 라운드가 다시 발견하지 않게).
    expect(ledgerSource).toContain("정찰은 자기가 쓰고 있던 문서를 세지 못했다");
    expect(roundNoteFiles()).toContain(`${ROUND_NOTES_ROOT}/round95-scout.md`);
  });

  it("ⓕ 두 시점 — 옛 적힌 값이 **지워지지 않았다**", () => {
    for (const { spot } of census) {
      const recorded = spot.recorded ?? [];
      expect(recorded.length, `${spot.id}: 기록이 있다`).toBeGreaterThan(0);
      for (const record of recorded) {
        expect(record.at.trim().length, `${spot.id}: 시점`).toBeGreaterThan(3);
        expect(Number.isFinite(record.value), `${spot.id}: 수`).toBe(true);
      }
    }
    // ⚠️ 시점이 둘인 자리도 있다(라운드 94 정찰 1 → 트랙 D 0) — 옛 값을 덮지 않는다.
    const emphasis = census.find((entry) => entry.spot.id === "emphasis-axis-not-opened");
    expect(emphasis!.spot.recorded!.length).toBeGreaterThan(1);
    // 그리고 이름·서술·재개 조건은 한 자리도 지워지지 않았다.
    for (const { spot } of census) {
      expect(spot.what.trim().length, `${spot.id}의 what`).toBeGreaterThan(20);
      expect(spot.reopenCondition).toContain("재개 조건(");
    }
  });

  it("ⓖ 이 축의 사각 다섯 — 자와 **불가의 증거**가 함께 서지 않는다", () => {
    const spots = recordingBlindSpots();
    expect(spots.length).toBeGreaterThanOrEqual(4);
    const ids = spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("measureless-ledgers-outside"); // ⓐ 자가 없는 대장은 밖이다
    expect(ids).toContain("which-side-is-right"); // ⓑ 갈렸다까지만 본다
    expect(ids).toContain("stale-prose-not-value"); // ⓒ 값은 고쳤지만 산문은 낡는다(AH-3)
    expect(ids).toContain("only-this-ledger"); // ⓓ 이 대장 하나만 본다
    // ⚠️ 남의 사각 목록의 **길이**를 움직이지 않았다.
    expect(LEDGER_BLIND_SPOTS.length).toBe(8);
    expect(sourceNeedleBlindSpots().length).toBe(4);
    expect(ELAPSED_BLIND_SPOTS.length).toBe(3);
    for (const spot of spots) {
      expect(spot.what.trim().length, `${spot.id}의 what`).toBeGreaterThan(20);
      expect(spot.why.trim().length, `${spot.id}의 why`).toBeGreaterThan(40);
      // ⚠️⚠️ 배타 — 자가 있으면 증거가 없고, 증거가 있으면 자도 하한도 없다(`() => 0` 금지).
      const hasGauge = spot.measure !== undefined;
      expect(hasGauge, `${spot.id}: 자와 증거가 함께 서지 않는다`).not.toBe(
        spot.uncountable !== undefined
      );
      if (hasGauge) {
        expect(typeof spot.floor, `${spot.id}: 자가 있으면 하한도 있다`).toBe("number");
        expect(spot.measure!(repoRoot), `${spot.id}를 오늘 다시 잰 수`).toBeGreaterThanOrEqual(
          spot.floor as number
        );
      } else {
        expect(spot.floor, `${spot.id}: 자가 없으면 하한도 없다`).toBeUndefined();
        expect(spot.uncountable!.wantedToCount.trim().length).toBeGreaterThan(20);
        expect(spot.uncountable!.missingFromSource.trim().length).toBeGreaterThan(20);
        expect(spot.uncountable!.zeroMeans, "0의 뜻").toContain("셀 수 없다");
      }
      // 자기 적용 — 재개 조건이 이 대장의 표기 관례를 지킨다(형 · 결정형이면 손의 위치).
      expect(spot.reopenCondition).toContain("재개 조건(");
      const inner = /재개 조건\(([^)]*)\)/.exec(spot.reopenCondition)?.[1] ?? "";
      expect(/사건형|결정형/.test(inner), `형을 괄호로 밝혔다: ${spot.id}`).toBe(true);
      if (inner.includes("결정형")) {
        expect(HAND_PHRASE.test(inner), `손의 위치를 함께 적었다: ${spot.id}`).toBe(true);
      }
    }
  });

  it("ⓖ' 대조군 — **자가 하나도 없는 대장**의 사각 일곱은 이 자 밖이다 (갈림을 물을 수 없다)", () => {
    const control = measurelessLedgerControl();
    expect(existsSync(join(repoRoot, control.path))).toBe(true);
    expect(control.spots).toBeGreaterThanOrEqual(7);
    // ⚠️⚠️ 전제 하한 — 그 대장의 `measure`는 **0건**이다(그래서 *갈렸는가*가 성립하지 않는다).
    expect(control.measures).toBe(0);
    // 저장소 밖으로 넓히지 않았다는 사실도 값이다.
    const others = otherBlindSpotLedgers();
    expect(others.length).toBeGreaterThanOrEqual(2);
    for (const path of LEDGER_SELF_FILES) expect(others).not.toContain(path);
    expect(others).toContain(control.path);
    // AH-3의 병 — 산문은 아직 옛 수를 지고 있고, 그 수가 0건이 아니다(사각이 실재한다).
    expect(staleProseBlindSpots().length).toBeGreaterThanOrEqual(0);
    // 아래쪽이 좋은 방향인 자리 넷 — 오르는 쪽 래칫이 막을 수 있는 손의 크기.
    expect(downwardGoodBlindSpots().length).toBeGreaterThanOrEqual(1);
    for (const id of downwardGoodBlindSpots()) {
      expect(census.map((entry) => entry.spot.id), `${id}는 전수 안의 자리다`).toContain(id);
    }
  });

  // ── 교란 — 픽스처로 재현한다(저장소를 한 바이트도 고치지 않는다) ──────────────
  //
  // ⚠️ 픽스처의 자는 **이 대장의 실제 바늘**(`collectResumeSites`)로 세고, 문서는 메모리에만 있다.

  const FIXTURE_LINES = [
    "## 픽스처 절 — 이 문자열은 저장소의 어느 파일도 아니다",
    "⚠️ 재개 조건(사건형): 픽스처의 조건 하나 — 그 날이 오는 날.",
    "⚠️ 재개 조건(결정형 · 손은 저장소 안): 픽스처의 조건 둘.",
    "수도 조건도 없는 산문 한 줄."
  ];

  /** 픽스처 사각 하나를 **파생 자**로 세운다(적힌 값은 온전할 때의 둘). */
  const fixtureCensus = (lines: readonly string[]) =>
    derivedBlindSpots([
      {
        id: "fixture-resume-sites",
        what:
          "픽스처 문서의 재개 조건 자리 — 교란용이고 저장소의 파일을 한 바이트도 읽지 않는다.",
        why:
          "이 자리는 실물이 아니라 **자가 실제로 무는지를 보이는 픽스처**다. 실물로 교란하면 " +
          "문서를 고치게 되고, 그것이 이 대장이 태어날 때부터 막으려던 뒤집힘이다.",
        floor: 1,
        measure: () => collectResumeSites(lines.join("\n"), "<픽스처>").length,
        recorded: [
          {
            at: "픽스처가 선 시점",
            value: 2,
            divergence: "같다 — 픽스처가 온전할 때 자가 내는 수다."
          }
        ],
        reopenCondition: "⚠️ 재개 조건(사건형): 이 픽스처가 실물의 자를 대신하려 드는 날."
      }
    ]).map((spot) => ({ list: "ledger" as const, spot }));

  it("⚠️⚠️ 교란 ① — 파생 자의 **소스 조건을 틀면** 값이 따라 내려가고 래칫이 빨개진다", () => {
    // ⓐ 온전한 픽스처 — 자가 둘을 내고, 적힌 값과 갈리지 않는다.
    const intact = fixtureCensus(FIXTURE_LINES);
    expect(intact[0].spot.valueToday).toBe(2);
    expect(recordedRatchetViolations(repoRoot, intact)).toEqual([]);

    // ⓑ 교란 — 재개 조건 한 줄을 지운다(소스 조건을 틀었다).
    const perturbed = fixtureCensus(FIXTURE_LINES.filter((line) => !line.includes("조건 둘")));
    // ⚠️⚠️ **값이 상수였다면 여기서 아무 소리도 나지 않는다** — 오늘은 값이 자에서 파생되므로
    //    적힌 둘이 아니라 오늘의 하나를 든다.
    expect(perturbed[0].spot.valueToday).toBe(1);
    const violations = recordedRatchetViolations(repoRoot, perturbed);
    expect(violations.length).toBe(1);
    expect(violations[0]).toMatchObject({ id: "fixture-resume-sites", recorded: 2, today: 1, delta: -1 });
    // 그리고 판정 ⓒ가 그 자리를 **갈렸다**로 든다.
    const reading = blindSpotReadings(repoRoot, perturbed)[0];
    expect(reading.same).toBe(false);
    expect(reading.derived).toBe(true);

    // ⓒ ⚠️ 실물은 한 바이트도 움직이지 않았다 — 교란은 메모리에서만 있었다.
    expect(recordedRatchetViolations(repoRoot, census)).toEqual([]);
  });

  it("⚠️ 교란 ② — 조건이 **늘어나는** 걸음에는 초록이다 (하한 설계 · F의 손을 막지 않는다)", () => {
    const grown = fixtureCensus([
      ...FIXTURE_LINES,
      "⚠️ 재개 조건(사건형): F가 다음 절에 적은 조건 셋."
    ]);
    expect(grown[0].spot.valueToday).toBe(3);
    expect(recordedRatchetViolations(repoRoot, grown)).toEqual([]);
    const reading = blindSpotReadings(repoRoot, grown)[0];
    expect(reading.delta).toBe(1);
    expect(reading.same).toBe(false); // 갈렸지만 **오르는 쪽**이라 빨강이 아니다
  });
});
