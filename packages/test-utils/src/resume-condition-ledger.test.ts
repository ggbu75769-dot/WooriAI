// 라운드 89 트랙 D (#4) — 재개 조건 표기 관례 대장의 계약. **저장소 그물 열다섯째.**
//
// 여섯을 묻는다:
//  ⓐ **모집단** — 판정 문서의 재개 조건 자리를 **전수로** 세고, **바늘을 값으로** 든다
//     (⚠️ 괄호 안만 보는 바늘과 줄 전체를 보는 바늘 — 세운 날 61·84, 오늘 **97·129** —
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
  anyParenSourceNeedle,
  collectDocumentSites,
  collectResumeSites,
  collectSourceNotations,
  countAnyParenSourceNotations,
  countMentions,
  decisiveSites,
  decisiveSitesMissingHand,
  exemptionFor,
  markedSourceNeedle,
  ownerForSourcePath,
  ratchetViolations,
  readSourceAxisEntries,
  repoRoot,
  roundNoteFiles,
  sourceAxisDefects,
  sourceAxisFilesFrom,
  sourceCountViolation,
  tallyNeedles,
  typedInners
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
      expect(file.floor).toBeLessThan(file.valueToday);
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
    expect(
      SOURCE_AXIS_MEASURED_TODAY.files,
      "기록된 표기 소스 수가 오늘의 파생 결과와 갈렸어요 — 파생 쪽이 사실이고, 이 값을 옮겨 주세요"
    ).toBe(derived.length);
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
    expect(derived.length).toBeGreaterThanOrEqual(3);
    for (const hidden of derived) {
      const without = sourceAxisFilesFrom(entries.filter((entry) => entry.path !== hidden.path));
      expect(without.length).toBe(derived.length - 1);
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
      expect(file.valueToday).toBeGreaterThan(0);
      expect(file.anyParenToday).toBeGreaterThanOrEqual(file.valueToday);
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

  it("⚠️ 하한을 오늘의 값으로 올리지 않았다 (자리별 floor < valueToday)", () => {
    for (const file of derived) {
      expect(file.floor, `${file.path}의 하한`).toBeLessThan(file.valueToday);
      expect(file.floorReason.trim().length).toBeGreaterThan(40);
    }
    const top = derived.find((file) => file.path.endsWith("dead-export-ledger.ts"));
    expect(top!.floor).toBe(3); // ⚠️ 라운드 89 D가 세운 하한 — 내리지도 올리지도 않는다.
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

    // 파일은 그대로 두고 **표식만** 지워도 같다 — 관례가 지워지는 날의 모양이 이쪽이다.
    const erased = sourceAxisFilesFrom(
      entries.map((entry) =>
        hidden.has(entry.path) ? { path: entry.path, text: entry.text.replace(/⚠️/g, "") } : entry
      )
    );
    expect(sourceCountViolation(erased)).toBeDefined();
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

describe("⚠️ 유령 방지 ② — 넓힌 뒤에도 문서 축의 넷이 함께 세어진다 (294 · 97 · 24 · 1)", () => {
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

  it("⚠️ 손의 위치는 한 수가 아니라 두 수다 — 당시 줄 12·접힘 14, 오늘 줄 19·접힘 21", () => {
    expect(MEASURED_TODAY.lineHand).not.toBe(MEASURED_TODAY.windowHand);
    expect(tallies.window.hand).toBeGreaterThan(tallies.line.hand);
    const folded = LEDGER_BLIND_SPOTS.find((spot) => spot.id === "folded-notation");
    expect(folded).toBeDefined();
    expect(folded!.measure(repoRoot)).toBe(tallies.window.hand - tallies.line.hand);
  });
});
