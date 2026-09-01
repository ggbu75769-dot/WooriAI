// 라운드 89 트랙 D (#4) — **재개 조건 표기 관례 대장.**
//
// `docs/operations/known-limitations.md`는 6,285줄짜리 판정 문서인데, 오늘 그 문서를 무는 단언은
// **N-4 문턱 한 줄 하나**뿐이다(AC-5의 답). 그 사이에 라운드 86 **AA-3**이 표기 관례를 하나
// 세웠다 — *"재개 조건(사건형|결정형 · 손은 안|밖)"*, 그리고 **결정형이면 그 결정을 내릴 손이
// 어디 있는지를 함께 적는다.** 관례는 두 라운드를 살아남았고, **어떤 계약도 그것을 보지 못한다.**
// 이 파일이 그 관례를 기계가 지키게 한다.
//
// ## ⚠️ 이 그물은 신설이다 — 열넷 밖이고, 서는 날 그 수는 열다섯이 된다
//
// 라운드 89 정찰의 교차 확인 목록이 센 계약 그물은 **열넷**이다(라우트 표면 · 슬라이스 가드 ·
// 오프라인 대장 · 여정 스윕 · 체크표 자기집계 · 구독 대장 · `$transaction` 상한 대장 ·
// 정책/무효화 대장 · 미러 스윕 · DNC 가드 대장 · DNC 범위 대장 · DNC 비밀값 스윕 · 문장 수 계측 ·
// 주석 관용 앵커 대장). **이 대장은 그 열넷 중 하나가 아니라 열다섯째다** — 트랙 D가 여는 것은
// 기존 그물이 아니라 **새 그물**이고, 그래서 *"계약 그물을 둘 이상 함께 여는 트랙은 0건"* 이라는
// 이 라운드의 교차 확인이 이 트랙에도 그대로 참이다
// (`CONTRACT_NETS_BEFORE_THIS_ONE` · `CONTRACT_NET_COUNT_WITH_THIS_ONE`).
//
// ## ⚠️⚠️ 이 트랙은 문서를 한 글자도 고치지 않는다 — 순서가 이 그물의 존재 이유다
//
// 라운드 88이 이 후보를 집지 않은 이유는 순환이었다: **문서를 무는 계약을 문서를 쓰는 손(트랙 F)이
// 세우면, 그것은 계약이 문서를 지키는 것이 아니라 문서가 계약을 맞추는 것이다.** 오늘 그 순환이
// 끊긴다 — **라운드 88 F가 AC절을 먼저 썼고**, 이 트랙은 그 문서를 **읽기만** 하며, F는 이 계약이
// 이미 선 뒤에 AD절을 쓴다(`known-limitations.md:6077`이 적어 둔 재개 조건의 도래).
//
// ⚠️ **그래서 계약의 모양이 그 순서를 지킨다.**
//  · 래칫은 **하한**이다(`NOTATION_RATCHET`) — 형을 밝힌 자리 수·손의 위치를 적은 자리 수가
//    **줄지 않을 것**만 묻는다. F가 AD절을 쓰며 줄을 **더해도** 이 그물은 초록이다.
//  · **상한도 전수 일치도 묻지 않는다.** *"오늘 예순하나"* 를 등호로 물면 F가 조건을 하나 더 적는
//    순간 빨개지고, 그 순간 F는 계약을 맞추려고 문서를 고치게 된다 — 이 대장이 막으려는 바로 그
//    뒤집힘이다. 오늘의 실측은 값으로만 적고(`MEASURED_TODAY`), 계약이 무는 것은 하한뿐이다.
//  · 조항이 **강제되는 자리는 하나**다: **결정형으로 표기하면서 손의 위치를 적지 않는 줄이
//    새로 서는 날**(`decisiveSitesMissingHand`). F가 새 결정형을 적을 때 관례가 그때 강제된다.
//
// ## 바늘 셋 — ⚠️ 두 수를 한 낱말로 적지 않는다
//
// 같은 문서를 어떤 바늘로 보느냐에 따라 수가 갈린다. **갈린다는 사실 자체가 값이므로** 이
// 대장은 바늘을 이름으로 갈라 각각의 수를 따로 든다(`NeedleTally` · `tallyNeedles`).
//
//  · **괄호 바늘**(`paren`) — `재개 조건(…)`의 **괄호 안**에 형이 적힌 자리만 센다. AA-3의 관례가
//    실제로 요구하는 모양이고, **이 대장의 축(ⓒ)이 무는 바늘이다**. 당시 **61** · 라운드 89 리뷰
//    **80** · 라운드 91 D **97** · 오늘(라운드 92 D) **111**.
//  · **줄 바늘**(`line`) — 줄 어디에든 *사건형|결정형* 이라는 낱말이 있으면 센다. 당시 **84** ·
//    라운드 89 리뷰 **107** · 라운드 91 D **129** · 오늘 **149**. ⚠️ **이 수는 표기가 아니라
//    언급까지 센다** — 차이(당시 스물셋 · 오늘 서른여덟)의 대부분은 *"재개 조건에는 사건형과
//    결정형이 있고…"* 같은 **관례를 논하는 산문**이다.
//    그래서 축은 이 바늘을 쓰지 않는다.
//  · **접힘 바늘**(`window`) — 줄 바늘에 **앞뒤 한 줄**을 더해 본다. 표기가 두 줄로 접힌 자리를
//    회수한다. 손의 위치는 당시 줄 바늘 **12**·접힘 바늘 **14**, 라운드 89 리뷰 **19**·**21**,
//    라운드 91 D **26**·**28**, 오늘 줄 바늘 **33**·접힘 바늘 **35**
//    (⚠️ 접힘의 크기 둘은 네 시점 내내 같다).
//
// ⚠️⚠️ **네 시점을 함께 적는 이유**: *당시* 는 트랙 D가 이 대장을 세운 커밋(`1b597c4`)의
// 워킹트리, *라운드 89 리뷰* 는 그 라운드의 HEAD(M-4의 재실측), 그다음이 **라운드 91 트랙 D**,
// *오늘* 은 **라운드 92 트랙 D**다.
// 한 라운드 안에서도 문서가 자라 실측이 전부 낡았고, 라운드가 지날 때마다 또 낡았다.
// 그동안 계약은 내내 초록이었다 — 무는 것이 하한뿐이기 때문이고, 그것이 이 설계의 첫 증거다.
//
// ## ⓒ 축 — 결정형이면 손의 위치를 함께 적었을 것
//
// 괄호 바늘의 결정형 자리는 당시 **열둘** · 라운드 89 리뷰 **열아홉** · 라운드 91 D **스물넷** ·
// 오늘 **서른**이고, 손의 위치를 함께 적은 자리는 **열하나 · 열여덟 · 스물셋 · 스물아홉**이다 —
// **어긋난 하나는 네 시점 내내 같은 하나**다(문서가 자라는 동안 관례를 어긴 자리는 늘지 않았다).
// 그 하나(라운드 86 Z-1의 기록)는 `DECISIVE_HAND_EXEMPTIONS`에 이유·재개 조건과 함께 선다.
//
// ⚠️ **면제는 줄 번호로 신원을 삼지 않는다.** 줄 번호는 F가 위쪽에 한 문단만 더해도 밀리고,
// 밀린 순간 이 계약은 엉뚱한 줄을 면제한다. 그래서 면제 줄은 **그 문장의 조각**(`context`)으로
// 자기를 가리키고, 계약이 그 조각이 문서에 실재하는지를 확인한다.
//
// ⚠️ **그리고 면제의 유령 검사는 *문장이 살아 있는가*까지만 묻고 *오늘도 어긋나 있는가*는 묻지
// 않는다.** 여기에는 판단이 있다: 주석 관용 앵커 대장은 *"면제 줄이 오늘 실제로 걸리지 않으면
// 빨개진다"* 를 골랐지만, 이 대장이 그 형식을 그대로 쓰면 **F가 그 한 줄에 손의 위치를 적어 고치는
// 순간 이 계약이 빨개진다** — 문서를 옳게 고치는 손을 그물이 막는 모양이다. 이 트랙의 금지 조항이
// 정확히 그 뒤집힘을 막으라고 하므로, 여기서는 **F의 손을 막지 않는 쪽**을 골랐다. 그 대신
// 오늘의 어긋남 수를 값으로 적어 두고(`DECISIVE_MISSING_HAND_TODAY`), 그 수가 0이 되는 날 이
// 면제 줄을 지우는 것이 다음 라운드의 일이라고 면제 줄 자신이 적는다.
//
// ## ⓓ 소스 축 — 관례는 문서 밖에도 산다 (⚠️⚠️ 라운드 91 D: 손 하나 → 전수 파생)
//
// 라운드 87 트랙 E가 AA-3의 표기를 **소스로** 처음 가져갔다. 라운드 89·90의 이 축은 그 사실을
// **손으로 적은 한 줄**로 졌다 — `SOURCE_AXIS_FILES = [dead-export-ledger.ts]`. 그 모양은
// *"적어 둔 그 파일이 관례를 지키는가"* 만 묻고 *"관례를 지고 있는 소스가 이것뿐인가"* 는 묻지
// 못한다. **라운드 91 트랙 D가 그 손 목록을 지우고 뿌리를 건다**(`apps/**` · `packages/**`).
//
// ⚠️ **그리고 뿌리를 열자 곧바로 새 자리가 나왔다**: `contract-net-ledger.test.ts` — 라운드 90
// E가 자기 계약에 *"도래한 조건·처분은 다음 라운드 몫"* 이라고 적으며 남긴 표기다. **손 목록이
// 계속 서 있었다면 이 대장은 그 자리를 오늘도 몰랐다** — 그것이 고치려던 병의 실물이다.
//
// ⚠️⚠️ **두 시점 — 그런데 그날의 기록이 하나를 빠뜨렸다(라운드 91 리뷰 H-1).** 트랙 D는 파생
// 결과를 **둘**로 적었지만, **D 커밋 시점에도 이미 셋이었다.** 빠진 하나는 같은 라운드 트랙 C의
// `apps/api/test/harness-catalog-cost.test.ts`이고, **C(`b320ab2`)는 D(`9b65ac0`)보다 세 시간
// 앞서 머지돼 있었다** — 즉 D의 워킹트리에 그 파일이 이미 표기 넷을 지고 서 있었다. D는 뿌리를
// 열어 놓고도 그 결과를 *예상했던 둘*로 적었고, 그래서 **래칫이 실측보다 한 칸 낮은 채로 섰다**
// (셋 중 하나가 표기를 잃어도 조용한 거짓 초록). 같은 라운드의 F는 판정 문서(AF-2)에 **셋**이라고
// 옳게 적었으므로, **오늘 어긋나 있던 것은 사실이 아니라 이 파일의 값 하나**다.
//
// 오늘의 파생 결과는 **셋**이고(좁은 바늘 6+1+4=11 · 넓은 바늘 9+2+4=15), 걷은 파일은 **966**이다
// (⚠️ 걷은 수는 다른 트랙이 파일을 더하는 동안에도 움직인다 — 그래서 계약은 하한만 문다).
//
// ⚠️ **세 파일 다 이 대장은 읽기만 한다** — 그래서 자리별 하한은 여전히 아래쪽만 막는다
// (`SOURCE_AXIS_FLOORS`: `dead-export-ledger.ts` **셋**, 오늘 처음 걸린 자리는 **0**). 대신
// 뿌리를 걷는 축에는 손 목록에 없던 조항이 하나 붙는다 — **표기를 지닌 소스 수의 래칫**
// (`SOURCE_COUNT_RATCHET` = **3**, 리뷰 H-1이 2에서 올렸다): 관례가 지워지는 날 목록에서 줄을
// 지워 조용해질 곳이 없다.
// ⚠️⚠️ **자리별 하한의 예측은 세 번 빗나갔고 방향은 매번 위쪽이었다**(4 → 5 → 6): 관례를 지키는
// 손은 조건을 닫으면서 새 조건을 남긴다. **하한은 그래도 셋 그대로다.**
//
// ## ⓕ 자기 배제 — 대장은 자기를 세지 않는다
//
// 이 파일과 그 계약 파일에는 재개 조건 표기가 **값과 설명으로** 실려 있다(면제 줄의 조건 · 사각의
// 재개 조건). 모집단에 들어오는 순간 이 대장은 자기 자신을 세게 되고, 그러면 다음 사람이 고치는
// 방법은 자기를 면제에 적는 것뿐이다 — 그 순간 면제 목록이 문을 연다(라운드 84 B · 85 E · 88 C가
// 같은 자리에 적은 규율). `LEDGER_SELF_FILES`가 그 배제를 값으로 진다.
//
// ## ⚠️ 사각 — 이 수들은 상한이 아니라 하한이다
//
// AB-5의 규율을 태어날 때부터 진다(`LEDGER_BLIND_SPOTS`). 이 대장이 세는 예순하나는 *"저장소에
// 형을 밝힌 재개 조건이 예순하나뿐이다"* 가 아니라 *"이 모집단·이 바늘 안에서 예순하나가
// 풀렸다"* 는 뜻이다. 밖에 남은 것은 사각마다 오늘 잰 값과 하한을 진다 — 가장 큰 것이
// **라운드 노트(`docs/5차/**`) 377**이고, 그다음이 **형 표기가 아예 없는 산문 조건**
// (당시 119 · 라운드 89 리뷰 145 · 라운드 91 D 165 · 오늘 **184**)이다.
// ⚠️ **라운드 92 트랙 D가 움직인 것은 이 여덟의 *값*뿐이다** — 축도 하한도 열지 않았다
// (이 라운드가 여는 축은 **경과**이고, 그 사각 셋은 `ELAPSED_BLIND_SPOTS`가 따로 진다).
// ⚠️ **라운드 91 D가 소스 축을 넓히며 사각이 여섯에서 여덟이 됐다** — 넓힌 축은 넓힌 만큼 새
// 사각을 진다: **표기의 실재만 셀 뿐 조건의 도래를 묻지 않는다**(`source-notation-existence` —
// D가 7로 적었고 오늘 재니 **11**) · **표기 없는 소스의 산문 조건은 이 뿌리 밖이다**
// (`unmarked-source-prose` — D가 48로 적었고 오늘 **68**).
//
// ## ⓗ 소스 축의 바늘이 셋으로 갈린다 (⚠️⚠️ 라운드 94 트랙 D · 결정형 #19)
//
// 라운드 93 리뷰 **M-3**이 물었다: *"`⚠️`와 `재개` 사이에 강조 표식(`**`)을 허용할지."* 그 물음이
// 선 이유는 `markedSourceNeedle()`이 **`⚠️`와 `재개`가 맞붙어 있을 것**을 요구하는데 저장소의
// 관례는 그 사이에 마크다운 강조 두 글자를 넣는 것이라, **그 꼴이 한 자리도 안 걸리기** 때문이다.
//
// ⚠️⚠️ **오늘의 결정은 *허용/불허*가 아니라 *갈래를 세운다*이다.** 좁은 바늘의 뜻은 한 글자도
// 넓히지 않는다(`markedSourceNeedle()`의 정규식은 **바이트 불변**이고 계약이 그것을 등호로 문다).
// 대신 소스 축이 보는 자리를 **세 갈래로 갈라 각자 센다**(`needleSplitDecision()`):
//
//  · **① 표식형**(`marked`) — `⚠️ 재개 조건(…)` 그대로. 오늘 모집단에서 **11**.
//  · **② 강조 낀 표식형**(`emphasis`) — `⚠️ **재개 조건(…)`. 오늘 모집단에서 **5**.
//  · **③ 필드형**(`field`) — `reopenCondition:`/`resumeCondition:` **데이터 필드의 값** 안.
//    오늘 모집단에서 **42**.
//
// ⚠️ **그리고 넷째가 남는다**(`unneedled` · 오늘 모집단 **8** · 걷은 전수 **9** · 이 트랙의 첫
// 걸음 앞 저장소 전수 **12**) — 주석이 옛 문장을 인용한 자리, 단언이 문자열로 문 자리,
// `statement:` 같은 **다른 필드**의 값. 정찰은
// *"어느 바늘에도 안 걸리는 자리는 0건"* 을 내다봤지만 **오늘 재실측은 0이 아니다**
// (`sourceSplitScoutValues()`). 0을 만들려면 갈래 하나를 *나머지 전부*로 두어야 하고, 그것은
// 갈래가 아니라 자루다 — 그래서 잔여를 **이름과 값으로** 세우고 사각이 진다.
//
// ⚠️⚠️ **정찰의 네 수 가운데 셋이 그대로이고 하나가 갈렸다.** 정찰은 저장소 전수(`apps`·
// `packages`·`scripts`의 `.ts`·`.tsx`·`.mjs`)에서 **88 · 18 · 14 · 56**을 적었고, 오늘 같은
// 모집단에서 다시 세니 **88 · 18 · 14 · 44 + 잔여 12**다 — **필드형 56은 *필드 44 + 잔여 12*를
// 한 낱말로 적은 수였다**(*두 수를 한 낱말로 적지 않는다*의 실물이 또 하나 나왔다).
//
// ## ⚠️ 이 갈림이 고친 병 — `unmarked-source-prose`가 틀린 이름으로 삼키던 자리들
//
// `sourceAxisFilesFrom`은 **`marked.length === 0`인 파일을 통째로 버렸다.** 그래서 관례를 필드로
// 지고 있던 파일 여덟이 모집단 밖에 남았고, 그 파일들의 재개 조건 줄이 사각
// `unmarked-source-prose`(= *표기 없는 소스의 산문 조건*)에 **틀린 이름으로** 흡수됐다.
// 오늘 그 자리를 **세 갈래의 합**으로 판정하게 하니 모집단이 **셋 → 열하나**로 넓어지고
// 그 사각이 **155 → 61**로 줄었다(⚠️ **다섯 시점**: 라운드 91 D **48** · 라운드 92 D **68** ·
// 라운드 93 F 시점 정찰 **129** · 오늘 좁은 바늘 그대로 재면 **155**, 세 갈래 뒤 **61**).
// ⚠️ **줄어든 아흔넷은 사라진 것이 아니라 제 이름을 얻은 것이다.**
//
// ⚠️⚠️ **그런데 넓힌 것은 *모집단*이지 *축*이 아니다.** ⓒ 축(결정형이면 손의 위치를 함께)은
// 오늘도 **표식형에만** 걸린다. ⚠️⚠️ **그리고 그 판단의 근거가 이 트랙이 걷는 동안 낡았다** —
// 정찰 시점에는 강조형에 축을 얹으면 곧바로 한 자리가 빨개졌고(`admin-load-error-copy.test.ts`의
// 결정형 #16 그 줄에 `손은 안|밖`이 없었다), **같은 라운드의 트랙 C가 그 줄에 손의 위치를 적으며**
// 오늘 그 수는 **0**이다. ⚠️ 그래도 축은 넓히지 않는다: 오늘의 0은 *넓혀도 안전하다*는 뜻이지
// *넓혀야 한다*는 뜻이 아니고, 넓힐지는 이 대장이 아니라 라운드의 결정이다. 그 갈림은 축이
// 아니라 **사각(`emphasis-axis-not-opened`)이 두 시점으로 진다.**
//
// ⚠️ **이 라운드가 더한 이름은 전부 `export function`이다 — 새 `export const` 0건.** 라운드 94의
// 모든 트랙에 걸린 금지이고(사문 대장의 절반 문턱에 여유가 없다), 그래서 하한·기록·사각처럼
// *값으로만 사는 것*도 함수로 든다(`sourceNeedleRatchet()` · `sourceNeedleMeasuredToday()` ·
// `sourceNeedleBlindSpots()` · `needleSplitDecision()` · `sourceSplitScoutValues()`).
// ⚠️ 기존 `export const`(라운드 89~92가 세운 것)는 **한 줄도 건드리지 않는다** — 이름을 바꾸면
// 그 라운드들의 기록을 가리키는 문장이 전부 낡는다.
//
// ⚠️ **고르지 않은 길도 값으로 적는다**: M-3의 다른 두 길은 ⓐ 바늘을 넓히는 것(여섯이 들어오고
// 쉰여섯은 그대로 밖이다) ⓑ 소스의 표기 관례를 좁히는 것(손이 일흔 자리를 옮겨 붙인다)이었다.
// 이 트랙은 둘 다 고르지 않았다. ⚠️ 그리고 **뿌리도 넓히지 않았다** — 정찰이 함께 읽은
// `scripts/`는 오늘 넓은 바늘로 **0건**이라(`scriptsRootYieldToday()`) 넓혀도 얻는 자리가 없다.
//
// ## ⓖ 경과 축 — *이 조건이 몇 라운드째 서 있는가* (⚠️⚠️ 라운드 92 트랙 D가 더한 칸)
//
// 이 대장은 자리마다 ⓐ **형**(사건형·결정형)과 ⓑ **손의 위치**를 센다. 그런데 **없는 칸이 하나**
// 있었다 — **경과**다. 라운드 92 정찰이 AF-2의 물음을 값으로 돌려 답했다: 재개 조건 자리
// **333** 가운데 **그 줄 자신이 경과를 적은 것은 셋**이고, ±5줄 창까지 넓혀도 **예순 남짓**이며
// **나머지 이백 몇십은 어디에도 없다.** AF-2가 적은 병이 그 수다 — *"오늘 셋은 두 라운드 · 하나는
// 세 라운드였는데, **그 수를 조건 자신은 적지 않는다 — 사람이 절을 거슬러 읽어야 나온다**."*
// 칸이 없어서 **미도래**와 **오래 미배정**이 문서에서 같은 낯으로 읽힌다(AE-5가 이름 붙인 병의
// 시간 축 판이다). 오늘 그 칸이 값으로 선다.
//
//  · **모집단은 넓히지 않는다** — `collectDocumentSites()`가 이미 파생하는 자리 전수 그대로다.
//    ⚠️ 넓히면 이 트랙이 축 둘을 지게 되고, 그것은 이 저장소가 하지 않는 일이다.
//  · **바늘 둘을 따로 든다**(`ElapsedTally`) — ⓐ **그 줄 자신**(오늘 **3**) · ⓑ **±5줄 창**
//    (오늘 **70**). ⚠️⚠️ **한 낱말로 적지 않는다** — 라운드 91 D가 바늘 셋을 갈라 든 그 형식을
//    그대로 인용한다. 두 수가 같아지는 날은 바늘 하나가 죽은 날이고, 계약이 그 사실을 문다.
//  · **한국어 수사와 아라비아 숫자를 함께 읽는다**(`ELAPSED_NUMERAL_TABLE`) — `스물다섯`도 `11`도
//    같은 자리로 읽힌다. ⚠️ **표를 손으로 적지 않는다**: 열 자리·낱 자리를 곱해 **소스에서
//    파생**한다(라운드 90 E가 `accessibility-checklist-shape.test.ts`에 세운 수사 변환의 모양을
//    인용한다 — ⚠️ 그 파일은 이 라운드에 다른 트랙이 열고 있어 **읽지 않고 모양만** 빌린다).
//  · **래칫은 하한뿐이다**(`ELAPSED_RATCHET`). ⚠️⚠️ **상한도 전수 일치도 묻지 않는다** — F가
//    AG절을 쓰며 조건을 더하면 자리 수가 커지고, 등호로 물면 **F가 계약을 맞추려고 문서를 고치게
//    된다**(AF-5가 값으로 적은 그 비용). 라운드 90 D가 고른 쪽을 오늘도 고른다.
//    ⚠️ 창 바늘의 하한은 **오늘의 70이 아니라 정찰의 61**이다 — 창 바늘은 *줄 사이의 거리*를 재는
//    바늘이라 F가 문단 하나만 끼워 넣어도 경과 표기를 지우지 않은 채 실측이 내려갈 수 있다.
//  · **사각 셋을 함께 진다**(`ELAPSED_BLIND_SPOTS`) — ⚠️ 여덟짜리 `LEDGER_BLIND_SPOTS`에 얹지
//    않고 **자기 목록으로** 선다: 그 여덟은 다른 축들의 사각이고, *한 트랙이 남의 사각 목록을
//    열지 않는다*(이 라운드에 그 목록에서 움직이는 것은 **값뿐**이다).
//
// ⚠️ **재개 조건(사건형): 이 경과 축이 처음으로 빨개지는 날** — 그날 사람이 볼 것은 *"경과를 적은
// 줄이 지워졌는가, 아니면 F가 문단을 끼워 창 밖으로 밀렸는가"* 이고, 뒤쪽이면 고칠 것은 문서가
// 아니라 이 파일의 하한 한 칸이다(⚠️ 낮추려면 이 문단을 열어 왜 낮추는지를 적어야 한다).
//
// ## ⚠️ 전제 재실측 — 정찰의 다섯 수 중 넷이 그대로이고 하나는 바늘이 갈렸다
//
// 정찰(`docs/5차/round89-scout.md`)이 적은 수는 **203 · 61 · 84 · 11 · 14**다. **트랙 D 시점의**
// 워킹트리에서 다시 세니 **203 · 61 · 84 · 11 · 12**이고, 마지막 하나는 **틀린 것이 아니라 바늘이
// 다르다**: 손의 위치가 **다음 줄로 접힌 자리 둘**을 함께 세면 정확히 **14**가 된다(`window` 바늘).
// 그래서 이 대장은 손의 위치를 **두 수로** 든다 — 줄 바늘 12 · 접힘 바늘 14(`SCOUT_NEEDLE_VALUES`).
//
// ## ⓘ 기록 축 — 사각의 값이 스스로 낡지 않는다 (⚠️⚠️ 라운드 95 트랙 C)
//
// 라운드 95 정찰이 이 대장의 사각을 **실제로 돌려** 적힌 값과 맞댔고, **열하나 가운데 일곱의 적힌
// 값이 오늘의 자와 갈려 있었다**(`prose-only` 184↔246 · `folded-notation` 2↔8 · `round-notes`
// 377↔440 · `sibling-documents` 15↔18 · `one-line-two-sites` 21↔28 · `elapsed-truth` 70↔102 ·
// `elapsed-outside-population` 89↔97). ⚠️⚠️ **그리고 그 갈림은 아무 소리도 내지 않았다** — 이
// 대장이 무는 것은 하한뿐이고 갈림을 세는 자가 **0건**이었기 때문이다.
//
// ⚠️ **이것이 AH-3·AI-3이 이름 붙인 병의 세 번째 얼굴이다**: 크기만 적으면 다음 라운드가 그 크기를
// 성격으로 읽고(AH-3), 셀 수 없는 자리에 크기를 두면 상수를 함수로 포장한 것이며(AI-3), **크기가
// 적혀 있는데 그 크기가 오늘의 값이 아니면** 자가 옆에 서 있어도 값은 혼자 낡는다.
//
// ### 고른 길 — 등호가 아니라 파생 (⚠️ 고르지 않은 길도 값으로 적는다)
//
//  · ⓐ **등호** — 사문 대장이 고른 길이다(`expect(tsxExportFunctionCount()).toBe(141)` 꼴 · 여섯
//    자리 · 오늘 재도 **갈림 0**). ⚠️⚠️ **그러나 이 대장에 옮겨 오면 안 된다**: 그 여섯은 저장소의
//    크기라 잘 움직이지 않지만 이 열다섯은 **F가 판정 문서를 정직하게 쓸 때마다 자란다.** 등호는
//    F가 조건을 하나 더 적는 걸음마다 빨개지고, 그때 쉬운 길은 문서를 계약에 맞추는 것이다.
//  · ⓑ **하한만 두고 적힌 값을 지운다** — 그러면 *언제 무엇이 참이었는지*가 사라진다(AE-3 위반).
//  · ⓒ **적힌 값을 두 시점으로 두고 갈림의 크기를 값으로 센다** — 정찰이 규율에 맞다고 본 길이고,
//    ⚠️⚠️ **이 트랙은 그보다 한 칸 더 간다**: 갱신은 다음 라운드에 또 낡으므로 `valueToday`를
//    **자에서 파생**시킨다(`derivedBlindSpots` · 게터). **오늘 갈림이 0인 것은 손이 값을 고쳐서가
//    아니라 값이 더 이상 손의 것이 아니기 때문이다.**
//
// ⚠️ **파생의 꼴은 라운드 94 트랙 B(`apps/mobile/src/screen-header-back.test.ts`)를 인용한다** —
// 그 트랙이 고친 것은 *자*(`measure: () => number`)였고 오늘 고친 것은 **값**이다. 자가 있어도 값이
// 상수면 둘은 따로 낡는다는 것이 이 라운드가 값으로 본 사실이다. 파생이 **불가능한 자리**에는
// 크기 대신 **불가의 증거**를 둔다(`UncountableRecordEvidence` — 같은 트랙의 `uncountable` 관례).
//
// ### 이 축이 새로 보는 것 (열하나가 아니라 **열다섯**)
//
// ⚠️⚠️ **정찰의 전수와 갈린다**: 정찰은 여덟 + 셋 = **열하나**를 세었고 `sourceNeedleBlindSpots()`의
// **넷**을 세지 않았다. 오늘 전수는 **열다섯**이고 그 넷 가운데 `markdown-source-notation`이
// **240↔261로 갈려 있다** — 그래서 정찰의 *일곱*은 오늘 **여덟**이다(⚠️ 두 수를 한 낱말로 적지
// 않는다: 일곱은 *열하나 안의 갈림*, 여덟은 *열다섯 안의 갈림*이다).
// ⚠️⚠️ **그리고 정찰의 재실측 자체도 둘이 갈렸다** — `round-notes` 440↔468 · `elapsed-outside-
// population` 97↔104이고, **갈린 몫은 정확히 정찰 자신의 노트**다(`round95-scout.md`가 자리 28 ·
// 경과 창 7을 지고 있다 · 440+28=468 · 97+7=104). **정찰은 자기가 쓰고 있던 문서를 세지 못했다** —
// 사각 `round-notes`가 라운드 91 정찰에 대해 적어 둔 문장이 네 라운드 뒤 그대로 되풀이됐다.
// ⚠️ **또 하나: 값은 한 라운드 안에서도 낡는다.** 이 트랙이 걷는 동안 같은 라운드의 다른 트랙이
// 자기 파일에 재개 조건을 더해 `quoted-source-conditions`·`unmarked-source-prose`·
// `three-needle-residual`이 **몇 분 만에** 올랐다 — 파생이 아니었다면 이 파일은 태어나는 순간
// 다시 낡았을 것이다.
//
// ⚠️ **하한은 한 칸도 올리지 않았다**(`floor` · `NOTATION_RATCHET` · `ELAPSED_RATCHET` ·
// `sourceNeedleRatchet()` 전부 종전 그대로) — 이 트랙이 더한 래칫은 *적힌 값 ≤ 오늘의 자* 하나이고,
// 그것은 사각의 크기가 아니라 **기록이 오늘보다 크지 않은가**를 묻는다.
// ⚠️ **재개 조건(사건형): 그 래칫이 처음 빨개지는 날** — 그날 사람이 볼 것은 *조건이 정당하게
// 소진돼 수가 줄었는가, 이름이 틀렸던 것인가*이고, 어느 쪽이든 고칠 곳은 하한이 아니라 그 자리의
// `recorded`에 시점 하나를 더하는 것이다.
// ⚠️ **두 시점**: 위 다섯 수는 **정찰과 D의 대조 기록**이라 그대로 둔다(그날의 대조가 이 대장의
// 바늘 셋을 갈라 낸 근거다). 같은 라운드 HEAD의 실측은 **252 · 80 · 107 · 18 · 21**이고, 그 값은
// `MEASURED_TODAY`가 진다 — 두 표가 서로 다른 시점을 말한다는 사실 자체를 값으로 남긴다
// (라운드 89 리뷰 M-4).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ⚠️⚠️ **읽기만 하는 두 대장**(라운드 95 트랙 C) — 이 파일은 그 둘의 바이트를 한 글자도 고치지
// 않는다. ⓔ 본보기(사문 대장의 *갈림 0*)와 대조군(자가 하나도 없는 앵커 대장)을 **산문이 아니라
// 값으로** 들기 위해 그 목록을 **읽어 파생**한다(로직은 복사하지 않는다 — 그 대장들의 자를 여기서
// 다시 짓지 않고, 그 대장들이 이미 지닌 자를 부른다).
import {
  LEDGER_BLIND_SPOTS as DEAD_EXPORT_BLIND_SPOTS,
  apostropheBearingCallsiteFiles,
  tsxExportFunctionCount
} from "./dead-export-ledger";
import { LEDGER_BLIND_SPOTS as ANCHOR_BLIND_SPOTS } from "./comment-tolerant-anchor-ledger";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/**
 * 이 대장 자신의 두 파일 — ⓕ **모집단에 넣지 않는다.**
 *
 * ⚠️⚠️ **라운드 91 트랙 D에서 이 줄이 일을 하기 시작했다.** 라운드 89·90에는 이 배제가
 * *모집단 정의에서 이미 참*이었다(모집단이 판정 문서 하나와 손으로 적은 소스 하나뿐이라 이
 * 파일들이 들어올 길이 없었다) — **우연이었다.** 오늘 소스 축이 `apps/**`·`packages/**`를
 * 걷자 그 우연이 끝났다: 이 두 파일은 `⚠️ 재개 조건(…)` 표기를 실제로 지고 있어서, 배제가
 * 없으면 파생 결과가 **둘이 아니라 넷**이 되고 이 대장은 **자기를 세는 축**이 된다.
 * 배제는 `readSourceAxisEntries`가 **걷는 자리에서** 진다(모집단마다 따로 적지 않는다).
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/resume-condition-ledger.ts",
  "packages/test-utils/src/resume-condition-ledger.test.ts"
] as const;

/**
 * 이 대장이 서기 전의 계약 그물 열넷(라운드 89 정찰의 교차 확인 목록 그대로).
 *
 * ⚠️ 이 대장은 그 열넷 중 하나가 아니라 **열다섯째**다.
 */
export const CONTRACT_NETS_BEFORE_THIS_ONE = [
  "라우트 표면",
  "슬라이스 가드",
  "오프라인 대장",
  "여정 스윕",
  "체크표 자기집계",
  "구독 대장",
  "$transaction 상한 대장",
  "정책/무효화 대장",
  "미러 스윕",
  "DNC 가드 대장",
  "DNC 범위 대장",
  "DNC 비밀값 스윕",
  "문장 수 계측",
  "주석 관용 앵커 대장"
] as const;

/** 이 대장이 서는 날의 수 — **열다섯**. */
export const CONTRACT_NET_COUNT_WITH_THIS_ONE = CONTRACT_NETS_BEFORE_THIS_ONE.length + 1;

// ── 모집단 ────────────────────────────────────────────────────────────────────

export type LedgerDocument = {
  /** 저장소 상대 경로. */
  readonly path: string;
  /** 왜 이 문서인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** 오늘 실측한 자리 수의 하한(유령 방지 — 모집단이 0건이 아님을 값으로 보인다). */
  readonly minSites: number;
};

/**
 * 모집단은 **판정 문서 하나**다.
 *
 * ⚠️ `docs/5차/**`(라운드 노트)는 넣지 않는다 — 라운드별 **작업 기록**이지 판정 문서가 아니고,
 * 넣으면 이 대장의 수가 매 라운드 통째로 흔들려 래칫이 뜻을 잃는다. 그 자리 수는 사각이 값으로
 * 진다(`round-notes`).
 */
export const LEDGER_DOCUMENT: LedgerDocument = {
  path: "docs/operations/known-limitations.md",
  reason:
    "AA-3의 표기 관례가 태어난 문서이고, 재개 조건이 판정과 함께 사는 유일한 판정 문서다. " +
    "짝 문서 둘(runtime-verification-required.md · accessibility-offline-checklist.md)에는 " +
    "오늘 자리가 각각 다섯·열이고(트랙 D 시점에는 하나·셋 · 라운드 89 리뷰 M-4는 다섯·넷) " +
    "그중 형을 괄호로 밝힌 것은 여전히 하나(C-12의 사건형)뿐이며 **이 계약의 축이 무는 " +
    "결정형은 오늘도 0건**이라, 넣으면 축이 아무것도 지키지 못하는 뿌리가 하나 늘어난다.",
  minSites: 180
};

/** 재개 조건이 선 자리인가 — 이 대장이 **자리**를 세는 단위는 **줄**이다. */
export const RESUME_SITE = /재개\s*(?:조건|트리거)/;

/** 형 낱말(사건형 · 결정형). */
export const TYPE_WORD = /사건형|결정형/;

/** 결정형 낱말. */
export const DECISIVE_WORD = /결정형/;

/**
 * 손의 위치 어구.
 *
 * ⚠️ 문서는 *"손은 저장소 안"* 을, 소스는 *"손은 안"* 을 쓴다 — **둘 다 같은 관례**이므로 한
 * 바늘이 둘을 다 본다(관례를 좁게 읽어 소스 쪽을 어긋남으로 세면 이 대장은 첫날부터 거짓 빨강이다).
 */
export const HAND_PHRASE = /손은\s*(?:저장소\s*)?(?:안|밖)/;

/** `재개 조건(…)` 의 괄호 — 전역 플래그를 쓰므로 **부를 때마다 새로 만든다**(`lastIndex` 공유 금지). */
export function parenthesisedTypeNeedle(): RegExp {
  return /재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

export type ResumeSite = {
  /** 저장소 상대 경로. */
  readonly file: string;
  /** 1부터 세는 줄 번호 — **사람이 찾아가는 용도이지 신원이 아니다**(줄은 밀린다). */
  readonly line: number;
  /** 그 줄의 원문. */
  readonly text: string;
  /** 괄호 안에서 형이 밝혀진 표기들(둘 이상일 수 있다). */
  readonly parenthesised: readonly string[];
  /** 괄호 바늘: 형을 괄호로 밝혔는가. */
  readonly parenTyped: boolean;
  /** 괄호 바늘: 그 괄호 안이 **결정형**인가. */
  readonly parenDecisive: boolean;
  /** 괄호 바늘: 그 괄호 안에 손의 위치가 함께 있는가. */
  readonly parenHand: boolean;
  /** 줄 바늘: 줄 어디에든 형 낱말이 있는가. */
  readonly lineTyped: boolean;
  /** 줄 바늘: 줄 어디에든 손의 위치 어구가 있는가(형이 있는 줄에서만 뜻이 있다). */
  readonly lineHand: boolean;
  /** 접힘 바늘: 앞뒤 한 줄까지 보아 손의 위치가 있는가. */
  readonly windowHand: boolean;
  /** 세 갈래 — 전수가 이 셋 중 정확히 하나에 든다(ⓐ). */
  readonly bucket: "paren-typed" | "line-typed-only" | "prose";
};

/** 한 텍스트에서 재개 조건 자리를 **전수로** 걷는다. */
export function collectResumeSites(text: string, file: string): readonly ResumeSite[] {
  const lines = text.split("\n");
  const sites: ResumeSite[] = [];

  lines.forEach((line, index) => {
    if (!RESUME_SITE.test(line)) return;

    const needle = parenthesisedTypeNeedle();
    const parenthesised: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = needle.exec(line)) !== null) {
      if (TYPE_WORD.test(match[1])) parenthesised.push(match[1]);
    }

    const parenTyped = parenthesised.length > 0;
    const parenDecisive = parenthesised.some((inner) => DECISIVE_WORD.test(inner));
    const parenHand = parenthesised.some((inner) => HAND_PHRASE.test(inner));
    const lineTyped = TYPE_WORD.test(line);
    const lineHand = lineTyped && HAND_PHRASE.test(line);
    const window = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n");
    const windowHand = lineTyped && HAND_PHRASE.test(window);

    sites.push({
      file,
      line: index + 1,
      text: line,
      parenthesised,
      parenTyped,
      parenDecisive,
      parenHand,
      lineTyped,
      lineHand,
      windowHand,
      bucket: parenTyped ? "paren-typed" : lineTyped ? "line-typed-only" : "prose"
    });
  });

  return sites;
}

/** 모집단 문서를 읽어 자리를 전수로 걷는다. */
export function collectDocumentSites(baseDir: string = repoRoot): readonly ResumeSite[] {
  const absolute = join(baseDir, LEDGER_DOCUMENT.path);
  return collectResumeSites(readFileSync(absolute, "utf8"), LEDGER_DOCUMENT.path);
}

/** 한 줄에 표기가 둘 이상 있어도 자리는 하나로 센다 — 그 차이를 값으로 들기 위한 수. */
export function countMentions(text: string): number {
  return (text.match(/재개\s*(?:조건|트리거)/g) ?? []).length;
}

// ── 바늘 셋 ───────────────────────────────────────────────────────────────────

export type NeedleTally = {
  /** 형을 밝힌 자리 수. */
  readonly typed: number;
  /** 손의 위치까지 함께 적은 자리 수. */
  readonly hand: number;
};

export type NeedleTallies = {
  /** 괄호 안만 보는 바늘 — **축이 무는 바늘**. */
  readonly paren: NeedleTally;
  /** 줄 전체를 보는 바늘. */
  readonly line: NeedleTally;
  /** 줄 전체 + 앞뒤 한 줄(접힌 표기 회수). */
  readonly window: NeedleTally;
};

/**
 * 바늘 셋의 수를 **각각** 낸다.
 *
 * ⚠️ 이 함수가 돌려주는 것은 **셋으로 갈린 수**다 — 하나로 합친 수를 돌려주는 자리는 이 파일에
 * 없다(*"두 수를 한 낱말로 적지 않는다"*).
 */
export function tallyNeedles(sites: readonly ResumeSite[]): NeedleTallies {
  return {
    paren: {
      typed: sites.filter((site) => site.parenTyped).length,
      hand: sites.filter((site) => site.parenTyped && site.parenHand).length
    },
    line: {
      typed: sites.filter((site) => site.lineTyped).length,
      hand: sites.filter((site) => site.lineHand).length
    },
    window: {
      typed: sites.filter((site) => site.lineTyped).length,
      hand: sites.filter((site) => site.windowHand).length
    }
  };
}

// ── 하한 래칫 ─────────────────────────────────────────────────────────────────

export type NotationRatchet = {
  /** 재개 조건 자리 전수의 하한. */
  readonly sites: number;
  /** 괄호 바늘 — 형 표기 하한. */
  readonly parenTyped: number;
  /** 괄호 바늘 — 손의 위치 하한. */
  readonly parenHand: number;
  /** 줄 바늘 — 형 표기 하한. */
  readonly lineTyped: number;
  /** 줄 바늘 — 손의 위치 하한. */
  readonly lineHand: number;
  /** 접힘 바늘 — 손의 위치 하한. */
  readonly windowHand: number;
};

/**
 * ⚠️⚠️ **전부 하한이다. 상한이 아니고 전수 일치도 아니다.**
 *
 * 이 수들이 묻는 것은 하나뿐이다 — *"형을 밝힌 자리와 손의 위치를 적은 자리가 **줄지 않았는가**"*.
 * F가 AD절을 쓰며 조건을 더하면 실측은 올라가고 이 그물은 그대로 초록이다. 실측이 **내려가는**
 * 날에만 소리가 난다: 관례를 지키던 줄이 지워졌거나, 형 표기 없이 다시 쓰였다는 뜻이다.
 *
 * ⚠️ **이 수를 낮추려면 이 파일을 열어 왜 낮추는지를 적어야 한다.**
 *
 * ⚠️ **두 시점 — 오늘의 실측은 이 하한보다 한참 위다.** 세울 때는 하한과 실측이 같은 수였지만
 * (`203 · 61 · 11 · 84 · 12 · 14`), 같은 라운드의 C·F가 조건을 더하며 실측이 `252 · 80 · 18 ·
 * 107 · 19 · 21`로 올라갔다(`MEASURED_TODAY`). **하한은 일부러 그대로 둔다** — 하한을 실측에
 * 붙여 올리는 것은 *"문서가 여기서 한 줄이라도 줄면 빨강"* 이라는 뜻이고, 그것은 F가 판정을
 * 다듬는 손까지 막는다. 이 그물이 지키려는 것은 **관례가 지워지지 않는 것**이지 문서의 크기가
 * 아니다(라운드 89 리뷰 M-4에서 다시 확인한 판단).
 */
export const NOTATION_RATCHET: NotationRatchet = {
  sites: 203,
  parenTyped: 61,
  parenHand: 11,
  lineTyped: 84,
  lineHand: 12,
  windowHand: 14
};

export type RatchetViolation = {
  readonly name: keyof NotationRatchet;
  readonly floor: number;
  readonly measured: number;
};

/**
 * 하한을 깬 자리들 — **비어 있어야 초록이다.**
 *
 * ⚠️ 이 함수는 *"오늘과 같은가"* 를 묻지 않는다. `measured > floor`는 언제나 통과다 —
 * 그것이 F가 줄을 더해도 이 그물이 초록인 이유이고, 계약이 이 함수만 무는 이유다.
 */
export function ratchetViolations(
  sites: readonly ResumeSite[],
  ratchet: NotationRatchet = NOTATION_RATCHET
): readonly RatchetViolation[] {
  const tallies = tallyNeedles(sites);
  const measured: Record<keyof NotationRatchet, number> = {
    sites: sites.length,
    parenTyped: tallies.paren.typed,
    parenHand: tallies.paren.hand,
    lineTyped: tallies.line.typed,
    lineHand: tallies.line.hand,
    windowHand: tallies.window.hand
  };
  const names = Object.keys(ratchet) as (keyof NotationRatchet)[];
  return names
    .filter((name) => measured[name] < ratchet[name])
    .map((name) => ({ name, floor: ratchet[name], measured: measured[name] }));
}

/**
 * 라운드 89 **HEAD**의 실측 — **기록이지 계약이 아니다.**
 *
 * 계약이 무는 것은 `NOTATION_RATCHET`(하한)뿐이고, 이 표는 *"그때 얼마였나"* 를 남긴다.
 *
 * ⚠️⚠️ **두 시점 — 이 표는 라운드 89 리뷰(M-4)가 재실측해 갱신한 값이다.**
 *  · **당시(트랙 D가 이 대장을 세운 시점 · 커밋 `1b597c4`)**: `203 · 210 · 61 · 11 · 12 · 84 ·
 *    12 · 14 · 119 · 23`. 그 시점의 워킹트리에서 정직하게 잰 수였고, 래칫과 같은 값이었다.
 *  · **오늘(같은 라운드의 HEAD)**: 아래 표. ⚠️ **같은 라운드 안에서 낡았다** — D 뒤에 머지된
 *    트랙 C(사문 대장의 `export const` 축)와 트랙 F(AD절 판정 다섯)가 판정 문서와 소스에 재개
 *    조건을 더 얹었기 때문이다. 문서는 라운드마다 자라고, **한 라운드 안에서도 자란다.**
 *
 * ⚠️⚠️ **세 시점 — 라운드 91 트랙 D가 다시 쟀고 또 낡아 있었다**: `294 · 312 · 97 · 23 · 24 ·
 * 129 · 26 · 28 · 165 · 32`. 라운드 90의 F가 판정 문서에 절을 더하며 자리가 `252 → 294`,
 * 괄호 바늘이 `80 → 97`, 결정형이 `19 → 24`로 또 올랐다. **어긋난 하나는 여전히 하나다**
 * (`DECISIVE_MISSING_HAND_TODAY`) — 문서가 세 라운드를 자라는 동안 관례를 어긴 자리는 늘지
 * 않았다는 뜻이고, 그것이 이 축이 지키는 것의 전부다.
 *
 * ⚠️⚠️ **네 시점 — 라운드 92 트랙 D가 또 쟀고 또 낡아 있었다**: `333 · 354 · 111 · 29 · 30 ·
 * 149 · 33 · 35 · 184 · 38`. 라운드 91의 F가 AF절을, 리뷰가 그 판정을 더하며 자리가
 * `294 → 333`, 괄호 바늘이 `97 → 111`, 결정형이 `24 → 30`으로 또 올랐다. **어긋난 하나는 네
 * 시점 내내 하나다**(`DECISIVE_MISSING_HAND_TODAY`) — 문서가 네 라운드를 자라는 동안 관례를
 * 어긴 자리는 늘지 않았다.
 *
 * ⚠️ **그리고 그 사이에도 계약은 초록이었다 — 하한 설계 덕이다.** 이 대장이 `MEASURED_TODAY`를
 * 등호로 물었다면 D 다음 커밋에서 곧바로 빨개졌을 것이고, 그때 다음 사람이 고르는 쉬운 길은
 * **문서를 계약에 맞추는 것**이다(이 대장이 태어날 때부터 막으려던 그 뒤집힘). 실측이 낡는 것이
 * **정상**이고 그 낡음이 초록을 헐겁게 하지 않는다는 사실이, 하한을 고른 판단의 첫 근거다.
 * 그래서 리뷰는 **하한(`NOTATION_RATCHET`·`floor`)은 한 칸도 올리지 않고** 이 기록만 갱신한다.
 */
export const MEASURED_TODAY = {
  sites: 333,
  mentions: 354,
  parenTyped: 111,
  parenHand: 29,
  parenDecisive: 30,
  lineTyped: 149,
  lineHand: 33,
  windowHand: 35,
  prose: 184,
  lineTypedOnly: 38
} as const;

// ── ⓒ 축: 결정형이면 손의 위치를 함께 ────────────────────────────────────────

export type DecisiveHandExemption = {
  /** 그 자리의 표기 원문(괄호까지). */
  readonly notation: string;
  /**
   * 그 문장의 조각 — **면제의 신원**이다.
   *
   * ⚠️ 줄 번호를 쓰지 않는 이유: F가 위쪽에 문단 하나만 더해도 줄이 밀리고, 밀린 순간 이 면제는
   * 엉뚱한 자리를 가린다.
   */
  readonly context: string;
  /** 왜 오늘 어긋난 채로 서 있는가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
  /** ⚠️ **왜 이 트랙이 고치지 않는가.** */
  readonly whyNotFixedHere: string;
  /** 이 줄이 사라져야 하는 날. */
  readonly reopenCondition: string;
};

/**
 * 오늘 **결정형으로 표기했으면서 손의 위치를 적지 않은** 자리 — 하나뿐이다.
 *
 * 라운드 86 Z-1의 기록이고, **그 라운드의 기록이지 낡은 값이 아니다**(옛 라운드 문단을 고치는
 * 것은 이 저장소가 하지 않는 일이다).
 */
export const DECISIVE_HAND_EXEMPTIONS: readonly DecisiveHandExemption[] = [
  {
    notation: "재개 조건(결정형)",
    context: "근거를 값으로 적는 관례(대장)를 어느 라운드가 세우는",
    reason:
      "라운드 86 Z-1이 '주석의 근거를 값으로 적는 대장'을 기각하며 적은 조건이고, 그 자리는 " +
      "형만 밝히고 손의 위치를 적지 않았다 — AA-3의 관례가 손의 위치까지 요구하게 된 것이 " +
      "바로 그 라운드라, 이 한 줄은 관례가 완성되기 직전의 모양으로 남아 있다.",
    whyNotFixedHere:
      "⚠️⚠️ 이 트랙은 문서를 한 글자도 고치지 않는다. 고치면 '계약이 문서를 지킨다'가 아니라 " +
      "'문서가 계약을 맞춘다'가 되고, 그것이 라운드 88이 이 후보를 집지 않은 이유다. " +
      "고치는 손은 F뿐이다.",
    reopenCondition:
      "재개 조건(사건형): F가 그 줄에 손의 위치를 적는 날 — 그날 이 면제 줄을 지운다. " +
      "⚠️ 지우지 않아도 이 계약은 초록이다(유령 검사가 '문장이 살아 있는가'까지만 묻는다). " +
      "그 느슨함은 문서를 옳게 고치는 손을 그물이 막지 않게 하려는 것이고, 그래서 이 줄을 " +
      "지우는 것은 다음 라운드의 청소이지 계약의 강제가 아니다."
  }
];

/** 괄호 바늘로 본 **결정형** 자리. */
export function decisiveSites(sites: readonly ResumeSite[]): readonly ResumeSite[] {
  return sites.filter((site) => site.parenDecisive);
}

/**
 * ⚠️ **이 계약의 축** — 결정형으로 표기했는데 손의 위치가 없는 자리.
 *
 * 손의 위치는 **접힘 바늘까지 봐 준다**(표기가 두 줄로 접혔다고 어긋남으로 세지 않는다).
 */
export function decisiveSitesMissingHand(sites: readonly ResumeSite[]): readonly ResumeSite[] {
  return decisiveSites(sites).filter((site) => !site.parenHand && !site.windowHand);
}

/** 어떤 면제 줄이 이 자리를 가리키는가(문장 조각으로 맞춘다). */
export function exemptionFor(site: ResumeSite): DecisiveHandExemption | undefined {
  return DECISIVE_HAND_EXEMPTIONS.find((exemption) => site.text.includes(exemption.context));
}

/** 오늘의 어긋남 수 — 값으로 적어 둔다(0이 되는 날 면제 줄을 지운다). */
export const DECISIVE_MISSING_HAND_TODAY = 1;

// ── ⓓ 소스 축 — ⚠️⚠️ 손 하나가 아니라 뿌리에서 전수 파생(라운드 91 트랙 D) ────

/**
 * 소스 축의 **뿌리** — ⚠️⚠️ **파일 목록이 아니다.**
 *
 * 라운드 89·90의 이 축은 `SOURCE_AXIS_FILES`를 **손으로 적은 한 줄**이었다
 * (`dead-export-ledger.ts` 하나). 그 모양의 병은 계약이 *"그 파일이 관례를 지키는가"* 만
 * 묻고 *"관례를 지고 있는 소스가 이것뿐인가"* 는 묻지 못한다는 것이다 — 새 파일이 표기를
 * 지기 시작해도 이 대장은 그 사실을 **모른다**(AB-4가 적은 *"목록에 이름이 있다는 사실이
 * 그 자리는 세어졌다로 읽힌다"* 의 소스판). 오늘 그 손 목록을 지우고 **뿌리를 걷는다.**
 */
export const SOURCE_AXIS_ROOTS = ["apps", "packages"] as const;

/**
 * 걷지 않는 디렉터리 — **산출물·의존성은 소스가 아니라 사본이다.**
 *
 * 계약 그물 대장(`contract-net-ledger.test.ts`)이 같은 뿌리를 걸으며 쓴 대역 그대로다
 * (두 그물이 같은 저장소를 다른 바늘로 보되 **대역은 같게** 둔다).
 */
export const SOURCE_AXIS_SKIPPED_DIRECTORIES: readonly string[] = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "generated",
  ".next",
  ".expo",
  ".turbo",
  ".git",
  "android",
  "ios"
];

/**
 * **읽지 않는** 확장자 — 이진·산출물.
 *
 * ⚠️ 소스 확장자를 **허용 목록**으로 적지 않는다: 허용 목록은 그 자체로 또 하나의 손 목록이라
 * `.kt`·`.java`·`.sql`처럼 나중에 붙는 소스를 조용히 밖에 둔다. 여기서는 *읽을 수 없는 것*만
 * 이름으로 덜어 내고, 나머지는 전부 읽는다.
 */
export const SOURCE_AXIS_BINARY_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".pack",
  ".jar",
  ".class",
  ".bin",
  ".keystore",
  ".jks",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".map",
  ".tsbuildinfo",
  ".log",
  ".lock"
];

/** 읽지 않는 크기 — 이 위는 소스가 아니라 자료다(오늘 걸린 파일 0건). */
export const SOURCE_AXIS_MAX_BYTES = 1_048_576;

export type SourceAxisEntry = {
  /** 저장소 상대 경로. */
  readonly path: string;
  /** 파일 원문. */
  readonly text: string;
};

/**
 * 뿌리를 걸어 **읽을 수 있는 소스 전수**를 낸다 — ⓕ **대장 자신의 두 파일은 여기서 빠진다.**
 *
 * ⚠️ 자기 배제가 이 자리에 있는 이유: 배제를 *모집단 정의*가 아니라 *걷기*가 지면, 모집단이
 * 넓어져도 배제가 함께 넓어진다. 라운드 89의 배제는 *"모집단이 문서 하나와 손으로 적은 소스
 * 하나라 자기 파일이 들어올 길이 없다"* 는 **우연**이었고, 오늘 뿌리를 열자 그 우연이 끝났다 —
 * 이 대장의 두 파일은 `⚠️ 재개 조건(…)` 표기를 실제로 지고 있어서, 배제가 없으면 이 축은
 * **자기를 세는 축**이 된다.
 */
export function readSourceAxisEntries(baseDir: string = repoRoot): readonly SourceAxisEntry[] {
  const entries: SourceAxisEntry[] = [];
  const selfFiles = LEDGER_SELF_FILES as readonly string[];

  const walk = (relative: string): void => {
    let listing;
    try {
      listing = readdirSync(join(baseDir, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of listing) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SOURCE_AXIS_SKIPPED_DIRECTORIES.includes(entry.name)) continue;
        walk(next);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (SOURCE_AXIS_BINARY_EXTENSIONS.some((extension) => lower.endsWith(extension))) continue;
      if (selfFiles.includes(next)) continue; // ⓕ 자기 배제
      const absolute = join(baseDir, next);
      try {
        if (statSync(absolute).size > SOURCE_AXIS_MAX_BYTES) continue;
        entries.push({ path: next, text: readFileSync(absolute, "utf8") });
      } catch {
        continue;
      }
    }
  };

  for (const root of SOURCE_AXIS_ROOTS) {
    if (!existsSync(join(baseDir, root))) continue;
    walk(root);
  }
  return entries;
}

/**
 * 소스에서 **오늘 그 파일이 지고 있는** 표기만 세는 바늘.
 *
 * ⚠️ `⚠️` 표식을 함께 무는 이유: 같은 파일이 **과거의 조건을 인용**하기도 하는데
 * (*"라운드 87의 문장은 … 재개 조건(사건형): … 이었고"*), 인용은 오늘의 약속이 아니다.
 * 저장소의 관례상 살아 있는 값 앞에는 `⚠️`가 선다 — 그 표식을 신원으로 쓴다.
 * 인용까지 세는 넓은 바늘의 수는 사각이 값으로 진다(`quoted-source-conditions`).
 */
export function markedSourceNeedle(): RegExp {
  return /⚠️\s*재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

/** 인용까지 포함해 괄호 안에 형을 밝힌 표기 전부(넓은 바늘). */
export function anyParenSourceNeedle(): RegExp {
  return /재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

/**
 * ⚠️⚠️ **② 강조 낀 표식형의 바늘**(라운드 94 트랙 D · 결정형 #19).
 *
 * `⚠️`와 `재개` 사이에 마크다운 강조(`*`·`**`)가 낀 꼴 — `⚠️ **재개 조건(…)`. **별표를 적어도
 * 하나 요구하므로** 이 바늘과 `markedSourceNeedle()`은 같은 자리를 두 번 세지 않는다(계약이 그
 * 배타를 값으로 문다). ⚠️ 전역 플래그를 쓰므로 **부를 때마다 새로 만든다**(다른 바늘과 같은 관례).
 */
export function emphasisMarkedSourceNeedle(): RegExp {
  return /⚠️\s*\*+\s*재개\s*(?:조건|트리거)\s*[（(]([^）)]*)[）)]/g;
}

/**
 * ③ 필드형이 사는 **데이터 필드의 이름** 둘.
 *
 * ⚠️ 이 둘이 *오늘의 약속*이라는 판단은 **관례이지 문법이 아니다** — 인용을 이 필드에 담는 날
 * 이 바늘이 틀린다. 오늘 그런 자리가 0건임을 사각 `field-needle-is-convention`이 값으로 진다.
 */
export function resumeFieldKeys(): readonly string[] {
  return ["reopenCondition", "resumeCondition"];
}

/**
 * 필드 이름 바늘 — ⚠️ **이름을 두 번 적지 않는다.**
 *
 * 정규식에 이름을 손으로 다시 적으면 그 순간 **손 목록이 둘**이 되고, 셋째 이름이 붙는 날 한쪽만
 * 늘어난다(AB-4가 적은 그 병의 작은 판). 그래서 위의 이름 목록에서 **파생**한다.
 * ⚠️ 전역 플래그이므로 부를 때마다 새로 만든다(이 파일의 다른 바늘과 같은 관례).
 */
export function resumeFieldKeyNeedle(): RegExp {
  return new RegExp(`(?:${resumeFieldKeys().join("|")})\\s*:`, "g");
}

/**
 * ③ 필드형의 **값 구간**을 낸다 — `reopenCondition:` 뒤에 이어지는 문자열 리터럴 사슬.
 *
 * ⚠️ 줄로 세지 않는 이유: 이 저장소의 재개 조건 값은 거의 전부 `"…" +\n  "…"` 로 여러 줄에 걸쳐
 * 이어 붙여져 있고(오늘 필드형 마흔둘 가운데 대부분이 그 꼴이다), 줄 바늘로 보면 **여는 줄만**
 * 걸린다. 그래서 문자열 사슬이 끝나는 자리까지를 한 구간으로 든다.
 */
export function resumeFieldValueSpans(text: string): readonly (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  const key = resumeFieldKeyNeedle();
  let match: RegExpExecArray | null;
  while ((match = key.exec(text)) !== null) {
    let index = match.index + match[0].length;
    const start = index;
    let consumed = false;
    for (;;) {
      while (index < text.length && /\s/.test(text[index])) index += 1;
      const quote = text[index];
      if (quote !== '"' && quote !== "'" && quote !== "`") break;
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") {
          index += 2;
          continue;
        }
        if (text[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      consumed = true;
      let after = index;
      while (after < text.length && /\s/.test(text[after])) after += 1;
      if (text[after] === "+") {
        index = after + 1;
        continue;
      }
      break;
    }
    if (consumed) spans.push([start, index] as const);
  }
  return spans;
}

/** 한 텍스트에서 바늘에 걸린 **형이 밝혀진** 괄호 안 내용들. */
export function typedInners(text: string, needle: RegExp): readonly string[] {
  const inners: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = needle.exec(text)) !== null) {
    if (TYPE_WORD.test(match[1])) inners.push(match[1]);
  }
  return inners;
}

// ── ⓗ 소스 축의 바늘 셋 — ⚠️⚠️ 갈래를 세우되 좁은 바늘의 뜻은 바꾸지 않는다 (라운드 94 D) ──

/**
 * 한 자리가 드는 갈래 — **넷 가운데 정확히 하나**다(셋이 바늘이고 넷째는 잔여).
 *
 * ⚠️ 잔여(`unneedled`)를 갈래로 세는 이유: 셋 가운데 하나를 *나머지 전부*로 두면 그것은 갈래가
 * 아니라 자루이고, 자루는 다음 라운드에 또 틀린 이름으로 삼킨다(오늘 고친 병이 정확히 그것이다).
 */
export type SourceNeedleBranch = "marked" | "emphasis" | "field" | "unneedled";

export type BranchedSourceNotation = {
  readonly file: string;
  /** 원문에서의 시작 자리 — **사람이 찾아가는 용도이지 신원이 아니다**. */
  readonly index: number;
  /** 1부터 세는 줄 번호. */
  readonly line: number;
  /** 괄호 안 내용. */
  readonly inner: string;
  readonly branch: SourceNeedleBranch;
  readonly decisive: boolean;
  readonly hand: boolean;
};

/**
 * ⚠️⚠️ **전수를 갈래로 가른다** — 넓은 바늘(`anyParenSourceNeedle`)이 낸 자리 **전부**가 넷 중
 * 하나에 들고, 어느 자리도 두 갈래에 들지 않는다(계약이 그 분할을 등호로 문다).
 *
 * 갈래를 정하는 순서에 뜻이 있다: **강조형을 먼저 본다**. 별표를 요구하는 바늘이므로 표식형과
 * 겹칠 수 없지만, 순서를 값으로 박아 두면 *어느 바늘이 이겼는가*가 다음 사람에게 보인다.
 */
export function branchSourceNotations(text: string, file: string): readonly BranchedSourceNotation[] {
  const endsOf = (needle: RegExp): Set<number> => {
    const ends = new Set<number>();
    let match: RegExpExecArray | null;
    while ((match = needle.exec(text)) !== null) {
      if (TYPE_WORD.test(match[1])) ends.add(match.index + match[0].length);
    }
    return ends;
  };
  const markedEnds = endsOf(markedSourceNeedle());
  const emphasisEnds = endsOf(emphasisMarkedSourceNeedle());
  const spans = resumeFieldValueSpans(text);

  const found: BranchedSourceNotation[] = [];
  const wide = anyParenSourceNeedle();
  let match: RegExpExecArray | null;
  while ((match = wide.exec(text)) !== null) {
    const inner = match[1];
    if (!TYPE_WORD.test(inner)) continue;
    const index = match.index;
    const end = index + match[0].length;
    const branch: SourceNeedleBranch = emphasisEnds.has(end)
      ? "emphasis"
      : markedEnds.has(end)
        ? "marked"
        : spans.some(([start, stop]) => index >= start && index < stop)
          ? "field"
          : "unneedled";
    found.push({
      file,
      index,
      line: text.slice(0, index).split("\n").length,
      inner,
      branch,
      decisive: DECISIVE_WORD.test(inner),
      hand: HAND_PHRASE.test(inner)
    });
  }
  return found;
}

export type SourceNeedleTally = {
  /** ① 표식형. */
  readonly marked: number;
  /** ② 강조 낀 표식형. */
  readonly emphasis: number;
  /** ③ 필드형. */
  readonly field: number;
  /** ⚠️ 셋 어디에도 안 드는 잔여 — **사각이 값으로 진다**. */
  readonly unneedled: number;
  /** 세 갈래의 합 — ⚠️ **잔여를 더하지 않는다**(합과 전수를 한 낱말로 적지 않는다). */
  readonly branched: number;
  /** 넓은 바늘의 전수 — `branched + unneedled`와 같아야 한다. */
  readonly anyParen: number;
};

/**
 * 갈래마다의 수를 **각각** 낸다.
 *
 * ⚠️⚠️ **한 낱말로 합친 수를 돌려주는 자리는 없다** — `branched`는 *세 바늘의 합*이고 `anyParen`은
 * *넓은 바늘의 전수*라 서로 다른 것을 말한다(라운드 91 D의 `tallyNeedles`가 든 그 형식 그대로).
 */
export function tallySourceNeedles(
  notations: readonly BranchedSourceNotation[]
): SourceNeedleTally {
  const count = (branch: SourceNeedleBranch): number =>
    notations.filter((notation) => notation.branch === branch).length;
  const marked = count("marked");
  const emphasis = count("emphasis");
  const field = count("field");
  const unneedled = count("unneedled");
  return {
    marked,
    emphasis,
    field,
    unneedled,
    branched: marked + emphasis + field,
    anyParen: notations.length
  };
}

/** 걷어 온 소스 전수를 갈래로 가른다. */
export function branchedSourceNotationsFrom(
  entries: readonly SourceAxisEntry[]
): readonly BranchedSourceNotation[] {
  return entries.flatMap((entry) => branchSourceNotations(entry.text, entry.path));
}

/** 뿌리를 걸어 갈래별 수를 낸다(⚠️ **자기 두 파일은 여기서도 밖이다**). */
export function sourceNeedleTally(baseDir: string = repoRoot): SourceNeedleTally {
  return tallySourceNeedles(branchedSourceNotationsFrom(readSourceAxisEntries(baseDir)));
}

/**
 * ⓕ **저장소의 실물과 이 파일 자신의 픽스처를 가르는 자** — ⚠️ **두 수를 한 낱말로 적지 않는다.**
 *
 * 정찰이 *"강조 낀 표식형 열넷 가운데 여덟이 픽스처"* 라고 적은 그 갈림을 값으로 세운다. 오늘
 * 다시 세면 갈림은 **둘이 아니라 셋**이다 — ⓐ 걷은 실물 **5** ⓑ **이 대장의 소스** 자신이 진 것
 * **1**(`resume-condition-ledger.ts`의 경과 축 재개 조건) ⓒ **계약 픽스처** **8**. 정찰의
 * *"실물 여섯"* 은 ⓐ+ⓑ이고 *"픽스처 여덟"* 은 ⓒ다.
 */
export function selfNeedleTallies(baseDir: string = repoRoot): {
  readonly ledgerSource: SourceNeedleTally;
  readonly contractFixture: SourceNeedleTally;
} {
  const read = (relative: string): SourceNeedleTally => {
    const absolute = join(baseDir, relative);
    if (!existsSync(absolute)) return tallySourceNeedles([]);
    return tallySourceNeedles(branchSourceNotations(readFileSync(absolute, "utf8"), relative));
  };
  return { ledgerSource: read(LEDGER_SELF_FILES[0]), contractFixture: read(LEDGER_SELF_FILES[1]) };
}

export type SourceNeedleRatchet = {
  readonly marked: number;
  readonly emphasis: number;
  readonly field: number;
  /** 세 갈래의 합 — ⚠️ 갈래끼리 자리가 옮겨 다녀도 **전체가 줄지 않는 것**을 따로 문다. */
  readonly branched: number;
};

/**
 * ⚠️⚠️ **넷 다 하한이다. 상한도 전수 일치도 아니다.**
 *
 * 갈래마다 하한을 따로 두는 것이 이 라운드가 얻은 것의 전부다: 합만 물면 **강조형 다섯이 통째로
 * 사라져도 필드형이 다섯 늘면 조용하다**(교란 ②가 그 사실을 값으로 보인다).
 *
 *  · `marked` **7** — 라운드 91 트랙 D가 *기록*으로 적은 그 수다(오늘 실측 11). 그 시점의 기록을
 *    하한으로 쓰면 도래한 조건을 정직하게 소진하는 손이 빨강을 맞지 않는다.
 *  · `emphasis` **3** — 오늘 다섯 가운데 **둘이 어드민 한 파일**(`admin-load-error-copy.test.ts`)에
 *    있고 그 파일은 이 라운드에 **트랙 C가 연다**. 남의 트랙이 자기 조건을 소진하는 걸음에
 *    이 그물이 빨개지면 안 되므로 그 둘만큼 낮춰 든다.
 *  · `field` **25** — 필드형은 사각·면제의 `reopenCondition` 칸이라 **도래하면 지워지는 값**이다.
 *    오늘 마흔둘에서 열일곱 남짓이 한 라운드에 소진될 수 있다고 보고 그만큼 낮춰 든다.
 *  · `branched` **45** — 갈래별 하한의 합(35)보다 위, 오늘의 실측(58)보다 아래.
 *
 * ⚠️ **이 수를 낮추려면 이 문단을 열어 왜 낮추는지를 적어야 한다.**
 */
export function sourceNeedleRatchet(): SourceNeedleRatchet {
  return {
    marked: 7,
    emphasis: 3,
    field: 25,
    branched: 45
  };
}

export type SourceNeedleRatchetViolation = {
  readonly name: keyof SourceNeedleRatchet;
  readonly floor: number;
  readonly measured: number;
};

/** 하한을 깬 갈래들 — **비어 있어야 초록이다**(`measured > floor`는 언제나 통과다). */
export function sourceNeedleRatchetViolations(
  tally: SourceNeedleTally,
  ratchet: SourceNeedleRatchet = sourceNeedleRatchet()
): readonly SourceNeedleRatchetViolation[] {
  const names: (keyof SourceNeedleRatchet)[] = ["marked", "emphasis", "field", "branched"];
  return names
    .filter((name) => tally[name] < ratchet[name])
    .map((name) => ({ name, floor: ratchet[name], measured: tally[name] }));
}

/**
 * ⚠️⚠️ **결정형 #19의 발동 기록 — 두 시점.**
 *
 * **기록이지 계약이 아니다.** 다만 `unchangedNeedle`만은 계약이 **등호로** 문다: 이 라운드가 한
 * 일이 *갈래를 세운 것*이지 *좁은 바늘의 뜻을 넓힌 것*이 아님을, 산문이 아니라 바이트로 보인다.
 */
export function needleSplitDecision() {
  return {
    id: "결정형 #19",
    question: "`⚠️`와 `재개` 사이에 강조 표식(`**`)을 허용할지",
    raisedBy: "라운드 93 리뷰 M-3",
    /** ① 세워진 시점 — 물음만 있고 값이 없었다. */
    before:
      "라운드 93 리뷰 M-3이 세운 시점: *바늘을 넓힐 것인가, 소스의 표기 관례를 좁힐 것인가*라는 " +
      "두 갈래 물음이었고, 그 라운드가 새로 적은 표기형 열일곱이 `unmarked-source-prose`에 " +
      "**틀린 이름으로** 흡수돼 있었다. 어느 쪽도 값으로 재어지지 않았다.",
    /** ② 소진된 시점 — 오늘. */
    after:
      "라운드 94 트랙 D: **셋으로 갈라 각자 센다.** 두 갈래 물음의 어느 쪽도 고르지 않았다 — " +
      "넓히면 여섯이 들어오고 쉰여섯은 그대로 밖이며, 관례를 좁히면 손이 일흔 자리를 옮겨 붙여야 " +
      "한다. 대신 표식형·강조형·필드형을 **이름과 하한을 지닌 갈래 셋**으로 세우고, 잔여는 " +
      "사각이 진다.",
    decision: "셋으로 갈라 각자 센다 — 좁은 바늘의 뜻은 안 바꾸고 갈래를 세운다.",
    /** ⚠️⚠️ **바뀌지 않은 것** — 계약이 이 문자열을 등호로 문다. */
    unchangedNeedle: "⚠️\\s*재개\\s*(?:조건|트리거)\\s*[（(]([^）)]*)[）)]",
    whatDidNotChange:
      "`markedSourceNeedle()`의 정규식은 **한 바이트도 바뀌지 않았다**. 넓어진 것은 바늘이 아니라 " +
      "`sourceAxisFilesFrom`의 **모집단 판정**(marked 하나 → 세 갈래의 합)이고, 축(ⓒ 결정형이면 " +
      "손의 위치)은 오늘도 **표식형에만** 걸린다.",
    /** ⚠️ 고르지 않은 길도 값으로 적는다. */
    roadsNotTaken: [
      "바늘을 넓힌다(⚠️와 재개 사이에 `[\\s*]*`를 허용) — 강조형 여섯이 들어오지만 필드형 쉰여섯은 " +
        "그대로 밖이고, 게다가 오늘 곧바로 ⓒ 축이 빨개진다(강조형 결정형 하나에 손의 위치가 없다).",
      "소스의 표기 관례를 좁힌다(강조를 걷어 낸다) — 손이 일흔 자리를 옮겨 붙여야 하고, 그것은 " +
        "이 대장이 아니라 각 파일 소유 트랙의 일이다.",
      "뿌리를 넓힌다(`scripts/`를 더한다) — 오늘 그 뿌리의 넓은 바늘이 0건이라 얻는 자리가 없다."
    ]
  } as const;
}

/** ⚠️ 넓히지 않은 뿌리의 오늘 수확 — **0건**(넓혀도 얻는 자리가 없다는 사실을 값으로 든다). */
export function scriptsRootYieldToday(): number {
  return 0;
}

/**
 * ⚠️ **전제 재실측 의무의 이행 ③ — 라운드 94 정찰의 네 수를 다시 셌다.**
 *
 * 정찰이 적은 수는 저장소 전수(`apps`·`packages`·`scripts`의 `.ts`·`.tsx`·`.mjs` · **자기 두 파일
 * 포함**)에서 **88 · 18 · 14 · 56**이다. 같은 모집단에서 오늘 다시 세니 **88 · 18 · 14 · 44**이고,
 * ⚠️⚠️ **앞의 셋은 그대로, 마지막 하나가 갈렸다** — 정찰의 56은 *필드형 44 + 잔여 12*를 한 낱말로
 * 적은 수였다. **두 수를 한 낱말로 적지 않는다**는 이 대장의 규율이 정찰의 표에서 다시 났다.
 *
 * ⚠️⚠️ **`remeasured`는 *라운드 시작(정찰 시점)* 트리의 수다 — 이 트랙이 첫 걸음을 떼기 전
 * 워킹트리의 수가 아니다**(라운드 94 리뷰 M-2가 정정한 두 시점).
 *  · **트랙 D 시점의 이 칸이 적은 문장**: *"이 트랙이 첫 걸음을 떼기 전 워킹트리의 수"*.
 *  · **실측**: 아래 88 · 18 · 14 · 44는 **정찰 트리**(`69a7ab8`)의 수이고, D가 실제로 시작한
 *    자리는 **트랙 B의 팁**(`557a454`)이라 그때 이미 **93**(필드형 **49**)이었다 — 같은 라운드의
 *    앞 트랙이 먼저 올렸기 때문이다(**C +4 · B +1** · A와 E는 0). **두 수를 한 낱말로 적지 않는다.**
 * ⚠️ 그 뒤로도 자란다: 이 파일 자신이 갈래 픽스처를 더하며 *저장소 전수*가 커졌고, HEAD(A~F 머지
 * 뒤)에서는 **110 = 25 + 18 + 50 + 17**이다. 그 낡음은 정정하지 않는다: 이 표가 남기는 것은
 * *오늘 몇인가*가 아니라 **정찰과 이 트랙이 같은 모집단을 어떻게 다르게 셌는가**이고, 오늘 값으로
 * 덮으면 그 대조가 사라진다(라운드 89 리뷰 M-4가 `SCOUT_NEEDLE_VALUES`에 세운 판단 그대로).
 * ⚠️ **정찰과 대조하려면 대조의 두 수가 *같은 트리*여야 한다** — 그래서 이 칸은 시작 트리에 서고,
 * 오늘의 수는 위 문장에 **시점을 밝혀** 따로 적는다.
 */
export function sourceSplitScoutValues(): readonly ScoutNeedleValue[] {
  return [
    {
      what: "형을 괄호로 밝힌 소스 표기 전수(넓은 바늘)",
      needle: "any-paren",
      scout: 88,
      remeasured: 88,
      divergence:
        "같다. ⚠️ 이 수는 **자기 두 파일을 포함한** 저장소 전수다 — 이 대장의 모집단(자기 배제 뒤)은 " +
        "**62**이고, 두 수를 한 낱말로 적지 않는다."
    },
    {
      what: "① 표식형(`⚠️` 인접)",
      needle: "marked",
      scout: 18,
      remeasured: 18,
      divergence:
        "같다. ⚠️ 모집단(자기 배제 뒤)에서는 **11**이고 자기 두 파일이 나머지 **7**을 진다."
    },
    {
      what: "② 강조 낀 표식형",
      needle: "emphasis",
      scout: 14,
      remeasured: 14,
      divergence:
        "같다. ⚠️ 그 열넷의 갈림은 **둘이 아니라 셋**이다 — 걷은 실물 **5** · 이 대장의 소스 자신 " +
        "**1** · 계약 픽스처 **8**. 정찰의 *'실물 여섯'* 은 앞의 둘을 더한 수다."
    },
    {
      what: "③ 필드형(`reopenCondition:`/`resumeCondition:` 값)",
      needle: "field",
      scout: 56,
      remeasured: 44,
      divergence:
        "⚠️⚠️ **갈렸다 — 그리고 갈린 것은 저장소가 아니라 바늘이다.** 정찰의 56은 *`⚠️`가 없는 것 " +
        "전부*였고, 그 안에는 필드가 아닌 자리 **열둘**이 함께 있다(주석의 인용 · 단언이 문자열로 " +
        "문 자리 · `statement:` 같은 다른 필드). 필드 이름을 실제로 요구하면 **44**다. " +
        "⚠️ **그래서 정찰이 내다본 *'어느 바늘에도 안 걸리는 자리 0건'* 은 오늘 성립하지 않는다** — " +
        "잔여 열둘은 지우지 않고 **이름과 값과 사각으로** 세운다(`three-needle-residual`). " +
        "⚠️ **두 수를 한 낱말로 적지 않는다**는 이 대장의 규율이 정찰의 표에서 다시 난 자리다."
    }
  ];
}

export type SourceAxisFile = {
  readonly path: string;
  /** 왜 이 파일인가 — **빈 문자열일 수 없다.** ⚠️ 손이 아니라 실측에서 파생된다. */
  readonly reason: string;
  /** 그 축이 **누구의 것인가**(이 대장은 **읽기만** 한다) — ⓒ **빈 문자열 금지.** */
  readonly owner: string;
  /** 오늘 실측한 표기 수(① 표식형 · 좁은 바늘) — ⚠️ 손으로 적지 않는다. */
  readonly valueToday: number;
  /** ② 강조 낀 표식형 — ⚠️⚠️ 라운드 94 트랙 D가 더한 칸. */
  readonly emphasisToday: number;
  /** ③ 필드형 — ⚠️⚠️ 라운드 94 트랙 D가 더한 칸. */
  readonly fieldToday: number;
  /** 세 갈래의 합 — **모집단 판정이 무는 수**(예전에는 `valueToday` 하나였다). */
  readonly needleTotalToday: number;
  /** ⚠️ 셋 어디에도 안 드는 잔여 — 사각이 값으로 진다(모집단 판정은 이 수를 보지 않는다). */
  readonly unneedledToday: number;
  /** 오늘 실측한 괄호 전수(넓은 바늘 · 인용 포함). */
  readonly anyParenToday: number;
  /** ⚠️ 하한 — **오늘의 값보다 낮다**(사유는 아래). */
  readonly floor: number;
  /** 하한을 값보다 낮게 잡은 이유. */
  readonly floorReason: string;
};

/**
 * 자리별 **하한**의 역사 — ⚠️ **이 표는 뿌리가 아니다.**
 *
 * 모집단은 뿌리에서 파생되고, 이 표는 *"이미 서 있던 자리의 하한을 낮추지 않는다"* 만 진다.
 * 여기에 이름이 없는 파일은 **오늘 처음 걸린 자리**라 역사가 없고, 그래서 하한이
 * `SOURCE_AXIS_DEFAULT_FLOOR`(0)이다 — 그 자리를 지키는 것은 자리별 하한이 아니라
 * **표기 소스 수의 래칫**(`SOURCE_COUNT_RATCHET`)이다.
 *
 * ⚠️⚠️ **이 수를 내리지 말 것**(라운드 89 D가 셋으로 세운 이유 그대로).
 */
export const SOURCE_AXIS_FLOORS: Readonly<Record<string, number>> = {
  "packages/test-utils/src/dead-export-ledger.ts": 3
};

/** 오늘 처음 걸린 자리의 하한 — 역사가 없으므로 0. */
export const SOURCE_AXIS_DEFAULT_FLOOR = 0;

/** 자리별 하한의 사유(역사) — 표에 없는 자리는 아래 기본 사유를 진다. */
export const SOURCE_AXIS_FLOOR_NOTES: Readonly<Record<string, string>> = {
  "packages/test-utils/src/dead-export-ledger.ts":
    "⚠️⚠️ **네 시점 — 이 칸의 예측이 빗나갔고, 빗나간 방향까지 값으로 적는다.** 라운드 89 D " +
    "시점 표기는 넷이었고 이 칸은 *'그 넷 중 하나(export-const-axis의 결정형 · 손은 안)는 도래한 " +
    "조건이라 트랙 C가 소진하며 지울 수 있으니 하한은 넷이 아니라 셋'* 이라고 적었다 — 즉 " +
    "**4→3을 내다봤다.** 실제로는 **4 → 5 → 6**이다: C는 그 결정형을 소진하면서 사건형 둘을 " +
    "새로 적었고, 라운드 90 리뷰가 사각 하나를 더 열며(`jsx-apostrophe-string-masking`) 또 " +
    "하나를 남겼다. ⚠️ **관례를 지키는 손은 조건을 소진하면서 동시에 새 조건을 남긴다** — 그래서 " +
    "이 수는 줄지 않고 늘었다. 하한은 그래도 **셋 그대로 둔다**: 빗나간 방향은 위쪽이고 하한이 " +
    "막아야 하는 것은 아래쪽(관례가 지워지는 날)이다. 하한을 오늘의 값으로 올리면 다음 라운드가 " +
    "도래한 조건 셋을 정직하게 소진하는 순간 그 옳은 손이 빨강을 맞는다."
};

/**
 * 자리별 **소유자**의 주석 — ⚠️ 이것도 뿌리가 아니다.
 *
 * 표에 이름이 없어도 소유자 칸은 **빈 문자열일 수 없다**(ⓒ). 이름이 없는 자리는 경로에서
 * 파생한 소유를 지고, *"이 대장은 읽기만 한다"* 는 사실만은 어느 자리에나 선다.
 */
export const SOURCE_AXIS_OWNER_NOTES: Readonly<Record<string, string>> = {
  "packages/test-utils/src/dead-export-ledger.ts":
    "사문 대장 — 라운드 87 트랙 E가 AA-3의 표기를 소스로 처음 가져간 파일이고 라운드 89 C가 " +
    "`export const` 축을 얹었다. 이 대장은 읽기만 한다.",
  "packages/test-utils/src/contract-net-ledger.test.ts":
    "계약 그물 대장 — 라운드 90 E의 짝 계약이 이 파일의 목록을 문다. 이 대장은 읽기만 한다.",
  "apps/api/test/harness-catalog-cost.test.ts":
    "하네스 카탈로그 비용 계약 — 라운드 91 트랙 C가 세우며 표기 넷을 남긴 파일이고, 그중 하나가 " +
    "*공유 테스트 DB를 언제 비울지*의 결정형(손은 저장소 안)이다. ⚠️ 이 자리는 D의 기록이 " +
    "빠뜨렸던 셋째다(리뷰 H-1). 이 대장은 읽기만 한다."
};

/** 경로에서 소유를 파생한다 — **어떤 경로에도 빈 문자열을 돌려주지 않는다**(ⓒ). */
export function ownerForSourcePath(path: string): string {
  const note = SOURCE_AXIS_OWNER_NOTES[path];
  if (note) return note;
  const [root, workspace] = path.split("/");
  return (
    `${root}/${workspace ?? "?"}의 손 — 오늘 처음 이 뿌리에 걸린 자리라 이 대장에 이름이 아직 ` +
    "적히지 않았다(적는 것은 다음 라운드의 청소다). 이 대장은 읽기만 한다."
  );
}

/**
 * ⚠️⚠️ **전수 파생의 자리** — 걷어 온 소스에서 표기를 지닌 파일만 남긴다.
 *
 * `ownerFor`를 인자로 받는 이유는 계약이 **소유자 칸이 비는 날**을 픽스처로 재현할 수 있게
 * 하기 위해서다(빈 칸이 실제로 빨개지는지를 산문이 아니라 값으로 보인다).
 *
 * ⚠️⚠️ **두 시점 — 라운드 94 트랙 D가 이 문의 판정을 바꿨다(결정형 #19).**
 *  · **라운드 91~93**: `marked.length === 0`이면 파일을 **통째로** 뺐다. 그래서 관례를
 *    `reopenCondition:` 필드로 지고 있던 파일 여덟이 모집단 밖에 남았고, 그 파일들의 재개 조건
 *    줄이 사각 `unmarked-source-prose`에 **틀린 이름으로** 흡수됐다(라운드 93 리뷰가 그
 *    흡수를 표기형 열일곱으로 발견했다).
 *  · **오늘**: 판정이 **세 갈래의 합**(`needleTotalToday`)이다. 모집단이 **셋 → 열하나**가 되고
 *    그 사각이 **155 → 61**로 줄었다. ⚠️ **좁은 바늘의 뜻은 한 글자도 넓히지 않았다** — 넓어진
 *    것은 *어떤 파일을 보는가*이지 *무엇을 표기로 세는가*가 아니다.
 *  · ⚠️ **잔여(`unneedled`)는 이 판정에 들어오지 않는다**: 인용만 지닌 파일이 모집단이 되면 이
 *    축은 *오늘의 약속*이 아니라 *어제의 기록*을 지키게 된다.
 */
export function sourceAxisFilesFrom(
  entries: readonly SourceAxisEntry[],
  ownerFor: (path: string) => string = ownerForSourcePath
): readonly SourceAxisFile[] {
  const files: SourceAxisFile[] = [];
  for (const entry of entries) {
    const tally = tallySourceNeedles(branchSourceNotations(entry.text, entry.path));
    if (tally.branched === 0) continue;
    const marked = typedInners(entry.text, markedSourceNeedle());
    const anyParen = typedInners(entry.text, anyParenSourceNeedle());
    files.push({
      path: entry.path,
      reason:
        `뿌리 ${SOURCE_AXIS_ROOTS.join(" · ")} 를 걸어 나온 자리다 — ⚠️ 재개 조건 표기를 ` +
        `${tally.branched}건 지고 있어(표식형 ${tally.marked} · 강조형 ${tally.emphasis} · ` +
        `필드형 ${tally.field} · 괄호 전수 ${anyParen.length}건) AA-3의 같은 조항이 그 전부에 ` +
        "걸린다. 문서만 무는 계약은 관례의 절반만 지킨다.",
      owner: ownerFor(entry.path),
      valueToday: marked.length,
      emphasisToday: tally.emphasis,
      fieldToday: tally.field,
      needleTotalToday: tally.branched,
      unneedledToday: tally.unneedled,
      anyParenToday: anyParen.length,
      floor: SOURCE_AXIS_FLOORS[entry.path] ?? SOURCE_AXIS_DEFAULT_FLOOR,
      floorReason:
        SOURCE_AXIS_FLOOR_NOTES[entry.path] ??
        "오늘 처음 뿌리에 걸린 자리라 역사가 없다 — 그래서 자리별 하한은 0이고, 이 파일이 표기를 " +
          "잃는 날 무는 것은 자리별 하한이 아니라 **표기 소스 수의 래칫**이다. ⚠️ 하한을 오늘의 " +
          "값으로 올리면 도래한 조건을 정직하게 소진하는 손이 빨강을 맞는다(라운드 89 D의 판단 그대로)."
    });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

/** 뿌리를 걸어 소스 축을 전수로 낸다. */
export function deriveSourceAxisFiles(baseDir: string = repoRoot): readonly SourceAxisFile[] {
  return sourceAxisFilesFrom(readSourceAxisEntries(baseDir));
}

/**
 * 오늘의 소스 축 — **손으로 적은 목록이 아니라 파생 결과다.**
 *
 * 오늘 걸린 자리는 **셋**이다(`apps/api/test/harness-catalog-cost.test.ts` **4** ·
 * `contract-net-ledger.test.ts` **1** · `dead-export-ledger.ts` **6**).
 *
 * ⚠️ 라운드 90 E가 *"도래한 조건·처분은 다음 라운드 몫"* 이라고 적으며 표기를 남긴 자리와,
 * 같은 라운드 트랙 C가 하네스 비용 계약에 적은 자리 — **손 목록이었다면 이 대장은 그 둘을
 * 오늘도 몰랐다.**
 * ⚠️⚠️ **그리고 셋째는 파생이 아니라 *기록*이 놓쳤다**(리뷰 H-1): 파생 함수는 D 시점에도 셋을
 * 냈는데 그 라운드가 값으로 적은 수가 둘이었다. **전수 파생은 옳게 돌았고, 그 위에 손으로 얹은
 * 수가 틀렸다** — 그래서 이 대장의 교훈은 *뿌리를 걷어라*에서 한 칸 나아가 *걷은 결과를 손으로
 * 다시 적지 마라*가 된다(아래 계약이 `files`를 파생 길이에 묶는 이유).
 */
export const SOURCE_AXIS_FILES: readonly SourceAxisFile[] = deriveSourceAxisFiles();

export type SourceNotation = {
  readonly file: string;
  /** 괄호 안 내용. */
  readonly inner: string;
  readonly decisive: boolean;
  readonly hand: boolean;
};

/** 걷어 온 소스에서 표기를 걷는다(⚠️ 표식이 선 것만). */
export function collectSourceNotationsFrom(
  entries: readonly SourceAxisEntry[]
): readonly SourceNotation[] {
  const found: SourceNotation[] = [];
  for (const entry of entries) {
    for (const inner of typedInners(entry.text, markedSourceNeedle())) {
      found.push({
        file: entry.path,
        inner,
        decisive: DECISIVE_WORD.test(inner),
        hand: HAND_PHRASE.test(inner)
      });
    }
  }
  return found;
}

/** 소스 축의 표기를 걷는다(⚠️ 표식이 선 것만) — 뿌리에서 전수로. */
export function collectSourceNotations(baseDir: string = repoRoot): readonly SourceNotation[] {
  return collectSourceNotationsFrom(readSourceAxisEntries(baseDir));
}

/**
 * 넓은 바늘로 센 수(인용 포함) — 사각의 값을 내는 자.
 *
 * ⚠️ **모집단 안에서만 센다**: 표기를 지니지 않은 소스가 옛 문장을 인용하는 자리까지 세면
 * 이 수는 이 축이 아니라 저장소 전체의 인용 습관을 재게 된다(그 수는 사각 `unmarked-source-prose`).
 */
export function countAnyParenSourceNotations(baseDir: string = repoRoot): number {
  return deriveSourceAxisFiles(baseDir).reduce((sum, file) => sum + file.anyParenToday, 0);
}

// ── ⓓ-② 전수 파생이 실제로 무는 자리 ─────────────────────────────────────────

/**
 * ⚠️ **표기를 지닌 소스 수의 래칫** — 오늘 **셋**, 그리고 **줄지 않는다.**
 *
 * 이것이 손 목록에는 없던 조항이다: 손 목록 시절 이 축은 *"적어 둔 그 파일이 관례를 지키는가"*
 * 만 물었고, 관례가 **지워지는** 날에도 목록에서 그 줄을 지우면 초록이었다. 뿌리를 걷는 오늘은
 * 그 줄을 지울 곳이 없다 — 표기가 사라지면 파생 수가 떨어지고 이 래칫이 먼저 빨개진다.
 *
 * ⚠️⚠️ **두 시점 — 라운드 91 리뷰 H-1이 2를 3으로 올린다. 이것은 하한 인상이 아니라 *오기의
 * 정정*이다.**
 *  · **D 시점(`9b65ac0`)**: 이 값은 **2**였다. 그런데 그 커밋의 워킹트리에서 뿌리를 걸으면 이미
 *    **셋**이 나왔다 — 같은 라운드 트랙 C의 `apps/api/test/harness-catalog-cost.test.ts`가
 *    **세 시간 앞서**(`b320ab2`) 머지되며 표기 넷을 지고 서 있었기 때문이다. D는 뿌리를 열어
 *    놓고도 결과를 손으로 **예상한 둘**로 적었고, 그래서 이 래칫은 **태어날 때부터 실측보다 한
 *    칸 낮았다**: 셋 중 하나가 표기를 통째로 잃어도 `3 >= 2`라 계약이 조용했다(거짓 초록).
 *  · **오늘(리뷰 H-1)**: 실측이 셋이므로 래칫도 **셋**이다. 하한을 실측에 붙이는 것이 이 대장의
 *    규율에 어긋나지 않는가 — 어긋나지 않는다. 이 수가 막는 것은 *조건이 소진되는 것*이 아니라
 *    **관례를 지고 있던 파일이 통째로 사라지는 것**이고(자리별 조건 수의 하한은 여전히
 *    `SOURCE_AXIS_FLOORS`가 따로 진다 · 인상 없음), 파일이 늘면 이 래칫은 그대로 초록이다.
 *  · ⚠️ **그래서 이 수를 다시 내리려면 이 문단을 열어 왜 내리는지를 적어야 한다** — 관례를 지고
 *    있던 소스가 정당하게 사라지는 라운드가 그 자리다.
 */
export const SOURCE_COUNT_RATCHET = 3;

/** 걷은 파일 수의 하한 — 유령 방지(뿌리가 통째로 빈 날 먼저 빨개진다). */
export const SOURCE_AXIS_WALKED_FLOOR = 400;

export type SourceCountViolation = {
  readonly floor: number;
  readonly measured: number;
  readonly files: readonly string[];
};

/** 표기 소스 수가 하한을 깼는가 — **`undefined`여야 초록이다.** */
export function sourceCountViolation(
  files: readonly SourceAxisFile[],
  floor: number = SOURCE_COUNT_RATCHET
): SourceCountViolation | undefined {
  if (files.length >= floor) return undefined;
  return { floor, measured: files.length, files: files.map((file) => file.path) };
}

/**
 * ⚠️⚠️ **① 표식형을 지고 있는 파일만** — 라운드 91 리뷰 **H-1·L-1**이 등호로 묶은 그 부분모집단.
 *
 * 오늘 모집단이 열하나로 넓어졌지만 `SOURCE_COUNT_RATCHET`(**3**)과
 * `SOURCE_AXIS_MEASURED_TODAY.files`가 무는 것은 **여전히 이 셋**이다 — H-1이 세운 장치가 무는
 * 대상을 바꾸지 않고 그대로 두는 쪽을 골랐다(넓어진 모집단은 **따로 하한으로** 든다).
 */
export function markedBearingFiles(
  files: readonly SourceAxisFile[]
): readonly SourceAxisFile[] {
  return files.filter((file) => file.valueToday > 0);
}

export type SourceAxisDefect = {
  readonly path: string;
  readonly field: "owner" | "reason" | "floorReason" | "floor" | "valueToday" | "branchSum";
  readonly detail: string;
};

/**
 * 자리마다 **칸이 실제로 채워졌는가** — ⓒ의 *빈 문자열 금지*를 값으로 무는 자.
 *
 * **비어 있어야 초록이다.**
 */
export function sourceAxisDefects(files: readonly SourceAxisFile[]): readonly SourceAxisDefect[] {
  const defects: SourceAxisDefect[] = [];
  for (const file of files) {
    if (file.owner.trim().length === 0) {
      defects.push({ path: file.path, field: "owner", detail: "소유자 칸이 비었다" });
    }
    if (file.reason.trim().length <= 40) {
      defects.push({ path: file.path, field: "reason", detail: "이 자리가 왜 모집단인지가 없다" });
    }
    if (file.floorReason.trim().length <= 40) {
      defects.push({ path: file.path, field: "floorReason", detail: "하한의 사유가 없다" });
    }
    // ⚠️⚠️ **두 시점**: 라운드 91~93에는 이 둘이 `valueToday`(표식형)를 보았다. 오늘은 **세 갈래의
    //    합**을 본다 — 필드형만 지고 들어온 자리의 표식형은 0이라, 옛 자를 그대로 두면 모집단을
    //    넓힌 그 걸음이 곧바로 여덟 자리를 결함으로 세게 된다(넓힌 축이 자기 자를 함께 넓힌다).
    if (file.floor >= file.needleTotalToday) {
      defects.push({
        path: file.path,
        field: "floor",
        detail: `하한 ${file.floor}이 오늘의 값 ${file.needleTotalToday}보다 낮지 않다`
      });
    }
    if (file.needleTotalToday < 1) {
      defects.push({ path: file.path, field: "valueToday", detail: "표기가 0건인 자리가 모집단에 들었다" });
    }
    if (file.valueToday + file.emphasisToday + file.fieldToday !== file.needleTotalToday) {
      defects.push({
        path: file.path,
        field: "branchSum",
        detail: `갈래 셋의 합(${file.valueToday}+${file.emphasisToday}+${file.fieldToday})이 ` +
          `기록된 합 ${file.needleTotalToday}과 갈렸다`
      });
    }
  }
  return defects;
}

/**
 * 오늘 소스 축의 실측 — **기록이지 계약이 아니다**(계약이 무는 것은 래칫과 자리별 하한뿐).
 *
 * ⚠️⚠️ **두 시점(리뷰 H-1).**
 *  · **D 시점(`9b65ac0`)의 기록**: `walked 966 · files 2 · marked 7 · anyParen 11`.
 *    ⚠️ **그 시점의 실측이 아니라 손으로 예상한 수였다** — 같은 커밋의 워킹트리에서 뿌리를 걸으면
 *    이미 `files 3 · marked 11 · anyParen 15`가 나왔다. 같은 라운드 트랙 C의
 *    `apps/api/test/harness-catalog-cost.test.ts`가 **D보다 먼저 머지돼**(`b320ab2`) 표기 넷을
 *    지고 있었고, D의 기록은 그 파일을 세지 못했다.
 *  · **오늘**: 아래 표. `files`가 셋이고 `marked`는 `6 + 1 + 4`, `anyParen`은 `9 + 2 + 4`다.
 *    ⚠️ 판정 문서의 AF-2는 그날에도 **셋**이라고 옳게 적었으므로, 정정된 것은 사실이 아니라
 *    이 표와 `SOURCE_COUNT_RATCHET`뿐이다.
 *
 * ⚠️ `walked`는 다른 트랙이 파일을 더하는 동안에도 움직인다 — 계약이 무는 것은 하한
 * (`SOURCE_AXIS_WALKED_FLOOR`)뿐이라 그 움직임이 초록을 흔들지 않는다.
 */
export const SOURCE_AXIS_MEASURED_TODAY = {
  /** 걷은 파일 수(자기 두 파일 제외). */
  walked: 966,
  /** 표기를 지닌 소스 수 — **셋**(D의 기록은 둘이었고 그것이 오기였다). */
  files: 3,
  /** 좁은 바늘의 표기 전수(6 + 1 + 4). */
  marked: 11,
  /** 넓은 바늘의 괄호 전수(9 + 2 + 4). */
  anyParen: 15,
  /** 자리별 좁은 바늘 — `dead-export-ledger.ts` **6** · `harness-catalog-cost.test.ts` **4** · `contract-net-ledger.test.ts` **1**. */
  markedTopFile: 6,
  /** 자리별 넓은 바늘 — `dead-export-ledger.ts` **9**. */
  anyParenTopFile: 9
} as const;

/**
 * ⚠️⚠️ **갈래 셋의 오늘 실측 — 기록이지 계약이 아니다**(계약이 무는 것은 `sourceNeedleRatchet()`).
 *
 * ⚠️ **위의 `SOURCE_AXIS_MEASURED_TODAY`를 한 바이트도 고치지 않았다.** 그 표는 *표식형 하나로
 * 모집단을 가르던 시점*의 기록이고, 이 표는 *세 갈래로 가른 뒤*의 기록이다 — **두 시점을 두 표로**
 * 든다(옛 표를 오늘 값으로 덮으면 왜 갈랐는지가 사라진다 · AE-3).
 *
 *  · `files` **11** — 모집단(표식형만이던 시절 **3**). ⚠️ **하한으로만 견준다** — 남의 트랙이
 *    도래한 조건을 소진하면 이 수는 내려간다.
 *  · `markedFiles` **3** — ① 표식형을 지닌 파일. ⚠️ 이쪽은 H-1·L-1의 등호가 그대로 문다.
 *  · 갈래 넷 **11 · 5 · 42 · 9**(세 갈래의 합 **58**) · 걷은 전수의 넓은 바늘 **67**.
 *    ⚠️ 모집단 안에서만 세면 넓은 바늘은 **66**이고 잔여는 **8**이다 — 잔여만 지닌 파일 하나
 *    (`apps/mobile/src/a11y-contract.test.ts`)가 모집단 밖이라 갈래 표에는 들되 모집단 합에는
 *    들지 않는다. **두 수를 한 낱말로 적지 않는다.**
 *  · ⚠️⚠️ **이 수들은 같은 라운드 안에서도 낡는다** — 트랙 A~C가 같은 워킹트리에서 자기 파일에
 *    재개 조건을 더하고 지운다(오늘 `emphasis-axis-not-opened`의 값이 트랙 C의 커밋 하나로
 *    **1에서 0으로** 내려앉는 것을 이 트랙이 실시간으로 봤다). 그래서 계약이 무는 것은
 *    `sourceNeedleRatchet()`(하한)뿐이고 이 표는 **하한 방향으로만** 견준다.
 */
export function sourceNeedleMeasuredToday() {
  return {
    /** 세 갈래의 합으로 판정한 모집단(파일 수). */
    files: 11,
    /** 그중 ① 표식형을 지닌 파일 — H-1의 등호가 무는 부분모집단. */
    markedFiles: 3,
    marked: 11,
    emphasis: 5,
    field: 42,
    unneedled: 9,
    branched: 58,
    anyParen: 67,
    /**
     * ⓕ 자기 두 파일 — ⚠️ 실물과 픽스처를 가르는 수(정찰의 *'열넷 중 여덟이 픽스처'*).
     *
     * ⚠️ **정찰 시점의 수를 그대로 든다**(오늘 이 계약 파일이 갈래 픽스처를 더하며 실측은 그보다
     * 크다) — 계약이 이 둘을 **하한으로만** 견주는 이유가 그것이다.
     */
    selfLedgerSourceEmphasis: 1,
    selfContractFixtureEmphasis: 8,
    /** 저장소 전수(자기 두 파일 포함) — 정찰의 88 · 18 · 14. */
    repoAnyParen: 88,
    repoMarked: 18,
    repoEmphasis: 14
  } as const;
}

// ── ⓔ 사각 ───────────────────────────────────────────────────────────────────

/**
 * ⚠️⚠️ **사각이 지녔던 *적힌 값* 하나 — 두 시점의 왼쪽**(라운드 95 트랙 C가 더한 칸 · AE-3).
 *
 * 라운드 92~94에는 이 수가 `valueToday`에 **손이 적은 상수**로 앉아 있었고, 그래서 자(`measure`)가
 * 옆에 서 있는데도 **적힌 값과 오늘의 자가 갈린 채 아무 소리도 나지 않았다**(하한만 물기 때문이다).
 * 오늘 `valueToday`는 자에서 **파생**되고, 옛 수는 지워지는 대신 이 칸으로 내려와 *언제 무엇이
 * 참이었는지*를 진다.
 */
export type BlindSpotRecord = {
  /** 그 수가 선 시점 — 라운드와 손(**빈 문자열일 수 없다**). */
  readonly at: string;
  /** 그때 손이 적어 둔 수. */
  readonly value: number;
  /** ⚠️ 라운드 95 정찰이 같은 자리를 대어 본 수 — **정찰 모집단 밖이면 없다**(넷이 그렇다). */
  readonly scout95?: number;
  /** 오늘의 자와 갈렸다면 왜/얼마나 — 같으면 *"같다"* 는 사실을 적는다(**빈 문자열 금지**). */
  readonly divergence: string;
};

export type LedgerBlindSpot = {
  readonly id: string;
  /** 무엇이 모집단·바늘 밖인가. */
  readonly what: string;
  /** 왜 밖인가 — **빈 문자열일 수 없다.** */
  readonly why: string;
  /**
   * 오늘 잰 값.
   *
   * ⚠️⚠️ **라운드 95 트랙 C — 이 칸은 더 이상 상수가 아니라 `measure`의 파생이다**(게터).
   * 상수였을 때 이 수는 라운드가 지나며 조용히 낡았다 — **이 트랙의 첫 실측에서 열다섯 중
   * 여덟이 갈려 있었고**(정찰이 센 일곱 + 정찰 모집단 밖의 `markdown-source-notation`),
   * ⚠️ **그 뒤로도 같은 라운드 안에서 셋이 더 갈렸다**(남의 트랙이 자기 파일에 재개 조건을 더했다).
   * 계약은 하한만 물어 그 낡음에 아무 소리도 내지 않았다. 옛 상수는 `recorded`가 진다.
   */
  readonly valueToday: number;
  /** ⚠️ **하한**(상한이 아니다). */
  readonly floor: number;
  /** 오늘 다시 재는 자 — 손으로 적은 수는 다음 라운드에 조용히 낡는다. */
  readonly measure: (baseDir: string) => number;
  /** 이 사각을 배워야 하는 날의 조건. */
  readonly reopenCondition: string;
  /** ⚠️ 옛 *적힌 값*들 — **두 시점의 왼쪽**(지우지 않는다 · 라운드 95 트랙 C). */
  readonly recorded?: readonly BlindSpotRecord[];
};

/**
 * ⚠️⚠️ **자에서 값을 파생시키는 자리**(라운드 95 트랙 C · 결정형 #25의 옆 물음에 대한 이 대장의 답).
 *
 * 라운드 94 트랙 B가 `apps/mobile/src/screen-header-back.test.ts`에서 사각의 자를
 * `measure: () => number` 꼴로 옮긴 그 걸음을 **인용한다**(읽기만 했고 그 파일은 어느 트랙의
 * 것도 아니다). 그 트랙이 고친 것은 *자*였고, 오늘 이 대장이 고치는 것은 **값**이다 — 자가 있어도
 * 값이 상수면 둘은 따로 낡는다.
 *
 * ⚠️ **게으르게 재고 한 번만 잰다**: 모듈을 읽는 값이 아니라 처음 물을 때의 값이고, 한 프로세스
 * 안에서는 같은 수를 돌려준다(교란 픽스처는 목록을 **다시 세워** 새 자를 얻는다).
 * ⚠️ `baseDir`를 인자로 받는 이유는 계약이 픽스처 위에서 같은 파생을 세울 수 있게 하기 위해서다.
 */
export function derivedBlindSpots(
  spots: readonly Omit<LedgerBlindSpot, "valueToday">[],
  baseDir: string = repoRoot
): readonly LedgerBlindSpot[] {
  return spots.map((spot): LedgerBlindSpot => {
    let memo: number | undefined;
    return {
      ...spot,
      get valueToday(): number {
        if (memo === undefined) memo = spot.measure(baseDir);
        return memo;
      }
    };
  });
}

/** 라운드 노트와 짝 문서 — 모집단 밖의 자리를 세는 자. */
function countSitesIn(baseDir: string, relativePath: string): number {
  const absolute = join(baseDir, relativePath);
  if (!existsSync(absolute)) return 0;
  return collectResumeSites(readFileSync(absolute, "utf8"), relativePath).length;
}

/**
 * `docs/5차/**` — 라운드 노트가 사는 자리(이 대장이 **일부러** 세지 않는 것).
 *
 * ⚠️ 파일 목록을 손으로 적지 않는다: 라운드마다 노트가 한 벌씩 늘어나므로 손으로 적은 목록은
 * 다음 라운드에 조용히 낡고, 그러면 *"목록에 이름이 있다는 사실이 그 자리는 세어졌다로
 * 읽힌다"*(AB-4)의 모양이 된다. 뿌리를 적고 **걷는다.**
 */
export const ROUND_NOTES_ROOT = "docs/5차";

/** 라운드 노트 전수(`.md`만 · 하위 디렉터리까지). */
export function roundNoteFiles(baseDir: string = repoRoot): readonly string[] {
  const absoluteRoot = join(baseDir, ROUND_NOTES_ROOT);
  if (!existsSync(absoluteRoot)) return [];
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(baseDir, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".md")) found.push(next);
    }
  };
  walk(ROUND_NOTES_ROOT);
  return found.sort();
}

/** 짝 문서 둘 — 같은 계열의 판정/확인 문서이지만 형 표기가 오늘 0건이다. */
export const SIBLING_DOCUMENTS = [
  "docs/qa/runtime-verification-required.md",
  "docs/qa/accessibility-offline-checklist.md"
] as const;

/**
 * ⚠️⚠️ **이 대장의 수는 상한이 아니라 하한이다**(AB-5의 규율을 태어날 때부터).
 *
 * 예순하나는 *"저장소에 형을 밝힌 재개 조건이 예순하나뿐이다"* 가 아니라 *"이 모집단·이 바늘
 * 안에서 예순하나가 풀렸다"* 는 뜻이다. 밖은 아래 **여덟**으로 갈리고 하나하나가 오늘의 값과
 * 하한을 진다 — 앞의 여섯은 문서 축의 사각이고, 뒤의 둘은 **라운드 91 D가 소스 축을 넓히며
 * 새로 진 사각**이다.
 */
export const LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = derivedBlindSpots([
  {
    id: "prose-only",
    what:
      "형 표기가 아예 없는 재개 조건 — *'⚠️ 재개 조건: 그 관계 필드가 생기는 날'* 처럼 산문으로만 " +
      "적힌 자리. **이 대장이 못 보는 것 중 가장 크다.**",
    why:
      "산문에는 문법이 없어 '이것이 사건형인가 결정형인가'를 기계가 가를 수 없다. 가르려면 " +
      "문장의 뜻을 읽어야 하고, 그것은 이 그물의 일이 아니라 사람의 일이다 — 그리고 그 사람은 " +
      "F다(이 트랙은 문서를 고치지 않는다).",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 184,
        scout95: 246,
        divergence:
          "⚠️⚠️ **갈렸다 — +62.** 라운드 95 정찰이 `184↔246`으로 적은 그 자리이고, 오늘 이 트랙이 " +
          "같은 자로 다시 재니 **246**이라 정찰과 갈리지 않는다(재확인). 갈린 까닭은 저장소가 아니라 " +
          "**시점**이다 — 라운드 93·94의 F가 판정 문서에 절을 더하는 동안 이 수는 올랐고, 값이 " +
          "상수라 아무 소리도 나지 않았다. 오늘부터 이 칸은 자에서 파생된다."
      }
    ],
    floor: 60,
    measure: (baseDir) => collectDocumentSites(baseDir).filter((site) => site.bucket === "prose").length,
    reopenCondition:
      "재개 조건(결정형 · 손은 저장소 안): 관례를 소급해 적용할지를 F가 정하는 날 — " +
      "그날 이 수가 줄기 시작하고, 이 대장의 하한이 그 방향을 값으로 보여 준다. " +
      "⚠️ 네 시점: 트랙 D 시점 119 · 라운드 89 리뷰 145 · 라운드 91 D 재실측 165 · " +
      "라운드 92 D 재실측 **184** — **가장 큰 사각은 라운드가 지나며 줄지 않고 늘고 있다.**"
  },
  {
    id: "folded-notation",
    what:
      "표기가 **두 줄로 접힌** 자리 — 손의 위치가 다음 줄로 넘어간 자리 둘, 그리고 여는 괄호가 " +
      "줄을 넘어가는 자리 하나(*'라운드 87의 재개 조건(\"그 스윕을 / 다시 돌리는 날\")'*).",
    why:
      "줄 바늘은 한 줄 안만 본다. 접힘 바늘(앞뒤 한 줄)이 오늘 그 둘을 회수하지만, 세 줄 넘게 " +
      "접힌 표기는 여전히 밖이다. ⚠️ **정찰의 14와 이 대장의 12가 갈린 자리가 정확히 이 둘이다** " +
      "— 갈림이 사각의 크기를 재 준 셈이다.",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 2,
        scout95: 8,
        divergence:
          "⚠️ **갈렸다 — +6**(정찰 `2↔8` · 오늘 다시 재도 **8**이라 정찰과 갈리지 않는다). " +
          "⚠️⚠️ **이 자리는 아래쪽이 좋은 방향이다** — 접힘이 풀리면 이 수는 줄고, 그날 고칠 것은 " +
          "하한이 아니라 이 기록의 시점 하나다(그 사실을 사각 `recorded-ratchet-blocks-good-hand`가 진다)."
      }
    ],
    floor: 0,
    measure: (baseDir) => {
      const tallies = tallyNeedles(collectDocumentSites(baseDir));
      return tallies.window.hand - tallies.line.hand;
    },
    reopenCondition:
      "재개 조건(사건형): 표기가 세 줄 이상으로 접힌 자리가 생기는 날 — 그날 이 바늘의 창을 " +
      "넓히거나, 문단을 단위로 세는 법을 배워야 한다. ⚠️ 이 수가 0으로 내려가는 것은 " +
      "**좋은 방향**이라(접힘이 풀렸다는 뜻) 하한을 0으로 둔다."
  },
  {
    id: "round-notes",
    what:
      "`docs/5차/**` 라운드 노트의 재개 조건 자리 전수 — 라운드 91 D 시점에 노트 쉰 벌이 319를 " +
      "지고 있었고, ⚠️ **라운드 92 D 재실측은 노트 쉰한 벌에 377**이다(늘린 것은 라운드 92 정찰 " +
      "노트 자신이다 — 이 사각은 라운드마다 한 벌씩 자란다). " +
      "⚠️ 라운드 91 정찰이 적은 265와 갈리는데, 그 갈림의 자리는 **정찰 노트 자신**이다" +
      "(`round91-scout.md` 54 · 265 + 54 = 319): 정찰은 자기가 쓰고 있던 문서를 세지 못했다.",
    why:
      "⚠️ 라운드별 **작업 기록**이지 판정 문서가 아니다. 모집단에 넣으면 이 대장의 수가 매 라운드 " +
      "통째로 흔들리고(라운드마다 노트가 한 벌씩 늘어난다) 래칫이 뜻을 잃는다 — 넓히는 대신 " +
      "값으로 적는다.",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 377,
        scout95: 440,
        divergence:
          "⚠️⚠️ **두 번 갈렸다.** ① 적힌 값 **377 ↔ 오늘 468 (+91)** — 라운드가 셋 지나는 동안 노트가 " +
          "세 벌 늘었다. ② ⚠️⚠️ **정찰의 440과도 갈린다(+28)** — 그리고 그 **28은 정찰 자신의 노트**다" +
          "(`docs/5차/round95-scout.md`가 오늘 자리 **28**을 지고 있다 · 440 + 28 = 468). " +
          "**정찰은 자기가 쓰고 있던 문서를 세지 못했다** — 이 사각의 `what`이 라운드 91 정찰에 대해 " +
          "이미 적어 둔 그 문장(`265 + 54 = 319`)이 네 라운드 뒤 같은 꼴로 되풀이됐다. " +
          "⚠️ **두 수를 한 낱말로 적지 않는다**: 정찰의 440과 오늘의 468은 서로 다른 시점의 수다."
      }
    ],
    floor: 100,
    measure: (baseDir) =>
      roundNoteFiles(baseDir).reduce((sum, path) => sum + countSitesIn(baseDir, path), 0),
    reopenCondition:
      "재개 조건(결정형 · 손은 저장소 안): 라운드 노트가 판정 문서로 승격되는 관례가 서는 날 — " +
      "오늘 그런 관례는 없고, 노트는 라운드가 끝나면 읽히지 않는다."
  },
  {
    id: "sibling-documents",
    what:
      "짝 문서 둘(`runtime-verification-required.md` 다섯 · `accessibility-offline-checklist.md` 열)의 " +
      "재개 조건 자리 **열다섯** — 그중 형을 괄호로 밝힌 것은 **하나뿐**(C-12의 사건형)이고 " +
      "⚠️ **이 계약의 축이 무는 결정형은 오늘도 0건**이다. " +
      "⚠️ 네 시점: 트랙 D 시점 하나·셋(합 넷) · 라운드 89 리뷰 다섯·넷(합 아홉) · 라운드 91 D " +
      "다섯·여섯(합 열하나) · 라운드 92 D 다섯·열(합 **열다섯**) — **자리는 네 배 가까이 늘었는데 " +
      "괄호로 형을 밝힌 것은 여전히 하나이고 결정형은 여전히 0건**이라, 이 사각을 모집단에 넣지 " +
      "않기로 한 판단은 오늘도 같다.",
    why:
      "자리가 넷이고 결정형이 0건이라, 모집단에 넣어도 축은 아무것도 지키지 못하면서 하한만 " +
      "0인 뿌리가 하나 늘어난다(주석 관용 앵커 대장이 `ZERO_YIELD_ROOTS`에 적은 그 규율). " +
      "⚠️ **그리고 이 라운드에 그 둘을 여는 트랙이 있다**(E가 접근성 표를 읽는다) — " +
      "한 문서에 축 둘을 얹지 않는다.",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 15,
        scout95: 18,
        divergence:
          "⚠️ **갈렸다 — +3**(정찰 `15↔18` · 오늘 다시 재도 **18**: `runtime-verification-required.md` " +
          "**여섯** · `accessibility-offline-checklist.md` **열둘**). ⚠️ 자리는 늘었지만 " +
          "**괄호로 형을 밝힌 것도 결정형도** 이 사각의 `what`이 적어 둔 그대로라, 모집단에 넣지 " +
          "않기로 한 판단은 오늘도 갈리지 않는다."
      }
    ],
    floor: 1,
    measure: (baseDir) => SIBLING_DOCUMENTS.reduce((sum, path) => sum + countSitesIn(baseDir, path), 0),
    reopenCondition:
      "재개 조건(사건형): 짝 문서 중 하나에 **결정형** 표기가 처음 서는 날 — 그날 그 문서는 " +
      "`LEDGER_DOCUMENT` 옆에 서고 자기 하한을 얻는다."
  },
  {
    id: "quoted-source-conditions",
    what:
      "소스 축에서 **인용된 과거 조건** — 두 파일이 옛 문장을 인용하며 적어 둔 표기 넷" +
      "(⚠️ 표식이 없다).",
    why:
      "인용은 오늘의 약속이 아니라 어제의 기록이다. 인용까지 조항으로 물면 '옛 문장을 인용하려면 " +
      "그 문장을 고쳐 적어야 한다'가 되고, 그것은 기록을 지우는 일이다. ⚠️ 대신 넓은 바늘의 수를 " +
      "값으로 든다(오늘 좁은 바늘 **열하나** · 넓은 바늘 **열다섯** — 네 시점: 트랙 D 넷·여섯 · " +
      "라운드 90 다섯·일곱 · 라운드 91 D의 *기록* 일곱·열하나 · ⚠️ **라운드 91 리뷰 H-1의 실측 " +
      "열하나·열다섯**(D가 셋째 파일을 세지 못했다). ⚠️ 인용 넷의 자리는 그대로다 — " +
      "`dead-export-ledger.ts` 셋 · `contract-net-ledger.test.ts` 하나이고, 셋째 파일은 인용 0건이다). " +
      "⚠️⚠️ **다섯째 시점(라운드 94 트랙 D) — 이 수가 넷에서 쉰다섯으로 뛰었고, 뛴 것은 저장소가 " +
      "아니라 모집단이다.** 이 자는 *넓은 바늘 − 표식형*을 재는데, 오늘 모집단이 셋에서 열하나로 " +
      "넓어지며 그 차이에 **강조형 5 · 필드형 42 · 잔여 8**이 함께 들어왔다. ⚠️ **그래서 오늘 이 수는 " +
      "*'인용의 크기'* 가 아니다** — 인용만 따로 세는 자는 `three-needle-residual`이고, 이 줄은 " +
      "*좁은 바늘 하나만 보던 시절의 자를 그대로 둔 채 그 자가 오늘 무엇을 재는지를 값으로 " +
      "적는다*(자를 바꾸면 네 시점의 기록이 서로 다른 것을 말하게 된다).",
    recorded: [
      {
        at: "라운드 94 트랙 D(다섯째 시점)",
        value: 55,
        scout95: 55,
        divergence:
          "**이 트랙의 첫 실측에서 같았다 — 55 ↔ 55**(정찰의 *일치 넷* 가운데 하나). " +
          "⚠️⚠️ **그런데 이 트랙이 걷는 동안 그 같음이 깨졌다** — 같은 라운드의 다른 트랙이 자기 " +
          "파일에 재개 조건 표기를 더하자 몇 분 만에 올랐고, **오늘의 수는 이제 자가 낸다**(그래서 " +
          "여기에 그 수를 다시 적지 않는다). *한 라운드 안에서도 낡는다*는 이 대장의 문장이 이 " +
          "트랙 자신의 실측에서 실물로 났고, 그것이 값을 파생으로 옮긴 이유다. " +
          "⚠️⚠️ 그리고 **같음이 옳음은 아니다** — 이 자는 라운드 94 D " +
          "뒤로 *인용의 크기*가 아니라 *넓은 바늘 − 표식형*을 재고 있고, 그 사실은 `what`이 값으로 " +
          "진다(이 자가 못 보는 것은 `three-needle-residual`의 몫이다)."
      }
    ],
    floor: 0,
    measure: (baseDir) => countAnyParenSourceNotations(baseDir) - collectSourceNotations(baseDir).length,
    reopenCondition:
      "재개 조건(사건형): 인용과 약속을 `⚠️` 말고 다른 것으로 가르는 관례가 서는 날 — " +
      "오늘의 신원은 그 표식 하나뿐이고, 그 사실이 이 사각의 크기다."
  },
  {
    id: "one-line-two-sites",
    what: "한 줄에 재개 조건이 둘 이상 적힌 자리 — 줄 바늘이 그것을 **하나로** 센다.",
    why:
      "이 대장의 자리 단위는 **줄**이다(문장 단위로 가르려면 문장 경계를 알아야 하고, 마크다운 " +
      "강조·인용이 섞인 줄에서 그것은 다른 그물의 일이다). 오늘 언급 354와 자리 333의 차이가 " +
      "그 수이고, 판정이 갈리는 자리는 0건이다(둘 다 형 표기가 없거나 같은 형이다). " +
      "⚠️ 네 시점: 트랙 D 언급 210 · 자리 203 · 차이 일곱 → 라운드 89 리뷰 264 · 252 · 열둘 → " +
      "라운드 91 D 312 · 294 · 열여덟 → 라운드 92 D **354 · 333 · 스물하나**.",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 21,
        scout95: 28,
        divergence:
          "⚠️ **갈렸다 — +7**(정찰 `21↔28` · 오늘 다시 재도 **28**). 언급과 자리가 함께 자랐고 " +
          "차이만 커졌다 — ⚠️ **판정이 갈리는 자리는 여전히 0건**이라(둘 다 형 표기가 없거나 같은 형) " +
          "이 사각의 재개 조건은 오늘도 도래하지 않았다."
      }
    ],
    floor: 0,
    measure: (baseDir) => {
      const absolute = join(baseDir, LEDGER_DOCUMENT.path);
      return countMentions(readFileSync(absolute, "utf8")) - collectDocumentSites(baseDir).length;
    },
    reopenCondition:
      "재개 조건(사건형): 한 줄 안에서 두 조건의 **형이 갈리는** 자리가 생기는 날 — " +
      "그날 이 대장은 자리를 문장으로 세는 법을 배워야 한다."
  },
  // ── ⚠️ 아래 둘은 **라운드 91 트랙 D가 소스 축을 넓히며 새로 생긴 사각**이다.
  //    넓힌 축은 넓힌 만큼 새 사각을 지고, 그 사각도 값과 하한으로 선다(AB-5).
  {
    id: "source-notation-existence",
    what:
      "이 축이 세는 것은 **표기의 실재**뿐이다 — 오늘 소스에 선 표기 **열하나**가 *그 조건이 오늘 " +
      "참인가* 는 **묻지 않은 채** 세어진다. 도래한 조건도, 아직 먼 조건도 이 축에서는 같은 한 건이다. " +
      "⚠️ 두 시점: 트랙 D의 기록은 **일곱**이었고 그것은 셋째 파일을 세지 못한 수였다(리뷰 H-1).",
    why:
      "*'그 조건이 오늘 참인가'* 를 기계가 가르려면 조건의 뜻을 읽어야 한다 — *'그 관계 필드가 " +
      "생기는 날'* 이 오늘인지 아닌지는 문장이 아니라 저장소의 상태가 답하고, 그 답은 조건마다 " +
      "다른 그물에 있다. 이 축이 그것까지 물면 표기 하나가 늘 때마다 새 그물이 하나 필요해진다. " +
      "⚠️ 그래서 이 대장은 **관례가 지켜지는가**만 묻고, 도래 여부는 조건을 적은 손이 진다.",
    recorded: [
      {
        at: "라운드 91 리뷰 H-1",
        value: 11,
        scout95: 11,
        divergence:
          "**같다 — 11 ↔ 11.** ⚠️ 네 라운드를 건너 같은 수다: 표식형을 지닌 세 파일이 조건을 " +
          "소진하지도 새로 적지도 않았다는 뜻이고, **같음이 곧 조용함은 아니라는 것**이 이 줄의 값이다" +
          "(라운드 94 D가 모집단을 셋에서 열하나로 넓히는 동안에도 이 좁은 바늘의 수는 움직이지 않았다)."
      }
    ],
    floor: 2,
    measure: (baseDir) => collectSourceNotations(baseDir).length,
    reopenCondition:
      "⚠️ 재개 조건(결정형 · 손은 저장소 안): 조건의 **도래**를 값으로 가르는 관례가 서는 날 — " +
      "그날 이 축은 표기마다 *오늘 참인가* 를 함께 물 수 있고, 그 관례를 세우는 것은 이 대장이 " +
      "아니라 라운드의 결정이다(그 결정을 내릴 손은 저장소 안에 있다)."
  },
  {
    id: "unmarked-source-prose",
    what:
      "**표기를 지니지 않은 소스의 산문 조건** — 뿌리를 걸어 읽은 소스 가운데 `재개 조건`을 " +
      "말하되 괄호로 형을 밝히지 않은 자리(오늘 파일 **스물**이 자리 **예순여덟**을 지고 있다). " +
      "⚠️ 이 뿌리는 그 자리를 **세지 않고 지나간다** — 문서 축의 `prose-only`와 같은 사각의 소스판이다. " +
      "⚠️⚠️ 두 시점: 트랙 D의 기록은 파일 열여덟·자리 **마흔여덟**이었다(리뷰 H-1 재실측 시점에 " +
      "**예순여덟**). 이 수는 계약이 아니라 기록이고 **하한만 물린다** — 사각을 값으로 적는 손이 " +
      "관례를 말하는 산문을 늘릴 때마다 함께 오르기 때문이다. " +
      "⚠️⚠️ **다섯째 시점(라운드 94 트랙 D) — 이 사각은 자기 이름이 아닌 것을 삼키고 있었다.** " +
      "모집단 판정이 *표식형 하나*였을 때 이 자는 `reopenCondition:` 필드로 관례를 지고 있던 파일 " +
      "여덟을 *표기 없는 소스*로 세었다(라운드 93 리뷰가 그 흡수를 표기형 열일곱으로 발견했고, " +
      "라운드 94 정찰이 F 시점에 **129**로 다시 쟀다). 오늘 판정을 **세 갈래의 합**으로 바꾸니 " +
      "**다섯 시점 48 → 68 → 129(정찰) → 155(오늘 옛 판정으로 다시 잰 수) → 61(오늘 새 판정)** " +
      "이고, ⚠️ **줄어든 아흔넷은 사라진 것이 아니라 제 이름을 얻은 것이다** — 그 자리는 이제 " +
      "필드형으로 세어진다. 파일 수도 **스물여덟 → 스물**로 줄었다.",
    why:
      "형이 없는 산문에는 문법이 없어 사건형·결정형을 기계가 가를 수 없고(문서 축이 같은 이유로 " +
      "165를 밖에 둔다), 소스에서는 그 자리 대부분이 *조건을 적은 것*이 아니라 *관례를 말한 것*이다. " +
      "⚠️ 그리고 이 뿌리에는 대역도 있다: 산출물·의존성 디렉터리와 이진 확장자, 1MB 위의 파일은 " +
      "걷지 않는다(`SOURCE_AXIS_SKIPPED_DIRECTORIES` · `SOURCE_AXIS_BINARY_EXTENSIONS` · " +
      "`SOURCE_AXIS_MAX_BYTES`) — 그 대역의 이름이 값으로 서 있다는 사실이 이 사각의 크기다.",
    recorded: [
      {
        at: "라운드 94 트랙 D(다섯째 시점 · 새 판정)",
        value: 61,
        scout95: 61,
        divergence:
          "**이 트랙의 첫 실측에서 같았다 — 61 ↔ 61**(정찰과도 같다). ⚠️ 그 뒤 같은 라운드의 다른 " +
          "트랙이 자기 파일에 산문 조건을 더하며 올랐고, 오늘의 수는 자가 낸다. " +
          "⚠️⚠️ **그리고 이 자리의 *줄어듦*은 위 갈림들과 다른 갈래다**: 라운드 " +
          "94 D의 `129 → 61`은 수가 낡은 것이 아니라 **이름이 틀렸던 것이 고쳐진 것**이다(그 아흔넷은 " +
          "사라지지 않고 필드형이라는 제 이름을 얻었다). ⚠️ **두 갈래를 한 낱말로 적지 않는다** — " +
          "*값이 낡아 갈린 것*과 *이름이 틀려 줄어든 것*은 이 기록 축에서 서로 다른 사건이다."
      }
    ],
    floor: 10,
    measure: (baseDir) => {
      const entries = readSourceAxisEntries(baseDir);
      const population = new Set(sourceAxisFilesFrom(entries).map((file) => file.path));
      return entries
        .filter((entry) => !population.has(entry.path))
        .reduce(
          (sum, entry) => sum + entry.text.split("\n").filter((line) => RESUME_SITE.test(line)).length,
          0
        );
    },
    reopenCondition:
      "⚠️ 재개 조건(사건형): 소스의 산문 조건이 표기 관례를 지고 다시 쓰이기 시작하는 날 — " +
      "그날 이 예순여덟이 줄고 소스 축의 파생 수가 오르며, 두 수가 함께 움직인다는 사실이 " +
      "이 사각이 닫히고 있다는 신호다. " +
      "⚠️⚠️ **두 시점 — 그 두 수가 오늘 함께 움직였는데, 움직인 까닭이 이 조건이 내다본 것과 " +
      "다르다**(라운드 94 트랙 D). 이 줄은 *소스가 다시 쓰이는 날*을 기다렸지만 오늘 소스는 한 " +
      "바이트도 바뀌지 않았고, 바뀐 것은 **모집단을 가르는 판정**이다(155 → 61 · 파생 3 → 11). " +
      "⚠️ 그래서 이 조건은 **소진되지 않았다**: 남은 쉰일곱은 여전히 형을 밝히지 않은 산문이고, " +
      "그것이 다시 쓰이는 날이 이 줄이 지워지는 날이다."
  }
]);

// ── ⓗ' 바늘 셋의 사각 넷 (라운드 94 트랙 D) ──────────────────────────────────

/** `docs/**` 아래의 마크다운 전수 — ⚠️ 이 소스 축이 걷지 않는 뿌리다. */
const MARKDOWN_ROOT = "docs";

/** `docs/**\/*.md`에서 넓은 바늘에 걸린 표기 수 — 사각 ⓓ의 자. */
export function markdownNotationCount(baseDir: string = repoRoot): number {
  const absoluteRoot = join(baseDir, MARKDOWN_ROOT);
  if (!existsSync(absoluteRoot)) return 0;
  let total = 0;
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(baseDir, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".md")) {
        total += typedInners(readFileSync(join(baseDir, next), "utf8"), anyParenSourceNeedle()).length;
      }
    }
  };
  walk(MARKDOWN_ROOT);
  return total;
}

/** 인용 표식 — 이 저장소가 *어제의 문장*을 감쌀 때 쓰는 꼴(`*'…'*` · 겹따옴표). */
const QUOTATION_MARKS = /\*'|'\*|“|”/;

/** 필드형 자리 가운데 **인용 표식이 함께 선** 자리 — 사각 ⓑ의 자(오늘 0건). */
export function quotedFieldNotations(
  baseDir: string = repoRoot
): readonly BranchedSourceNotation[] {
  const found: BranchedSourceNotation[] = [];
  for (const entry of readSourceAxisEntries(baseDir)) {
    const lines = entry.text.split("\n");
    for (const notation of branchSourceNotations(entry.text, entry.path)) {
      if (notation.branch !== "field") continue;
      if (QUOTATION_MARKS.test(lines[notation.line - 1] ?? "")) found.push(notation);
    }
  }
  return found;
}

/** 강조형 가운데 **결정형인데 손의 위치가 없는** 자리 — 사각 ⓔ의 자(오늘 하나). */
export function emphasisDecisiveMissingHand(
  baseDir: string = repoRoot
): readonly BranchedSourceNotation[] {
  return branchedSourceNotationsFrom(readSourceAxisEntries(baseDir)).filter(
    (notation) => notation.branch === "emphasis" && notation.decisive && !notation.hand
  );
}

/**
 * ⚠️ **바늘 셋이 새로 지는 사각 넷** — 값과 하한으로 선다(AB-5의 규율).
 *
 * ⚠️⚠️ **여덟짜리 `LEDGER_BLIND_SPOTS`에 얹지 않는다.** 라운드 92 트랙 D가 경과 축의 사각 셋을
 * 자기 목록으로 세운 그 형식을 그대로 인용한다 — *한 트랙이 남의 사각 목록의 길이를 움직이지
 * 않는다*(그 여덟에서 오늘 움직인 것은 **두 자리의 값과 두 시점 문장**뿐이다).
 */
export function sourceNeedleBlindSpots(): readonly LedgerBlindSpot[] {
  return derivedBlindSpots([
    {
      id: "three-needle-residual",
      what:
        "**세 갈래 어디에도 안 드는 잔여** — 넓은 바늘에는 걸리는데 표식형도 강조형도 필드형도 " +
        "아닌 자리. 오늘 걷은 소스에서 **아홉**이고, ⚠️ **이 트랙이 첫 걸음을 떼기 전 저장소 " +
        "전수로는 열둘**이었다(자기 두 파일의 셋을 더한 수 — 그 뒤 이 파일 자신이 갈래 픽스처를 " +
        "더하며 자기 쪽 수가 늘었고, 그 늚이 모집단에 새지 않는 것이 ⓕ 자기 배제가 하는 일이다). " +
        "갈래는 셋이다: ⓐ **주석이 옛 문장을 인용한 자리**(`dead-export-ledger.ts` 둘 · " +
        "`accessibility-checklist-shape.test.ts` 하나) ⓑ **단언이 문자열로 문 자리** " +
        "(`contract-net-ledger.test.ts` · `korean-particle-guard.test.ts` · " +
        "`accessibility-checklist-shape.test.ts`) ⓒ **`statement:`처럼 다른 이름의 필드**에 담긴 자리 " +
        "(`accessibility-checklist-shape.test.ts` · `dead-export-ledger.ts` · `a11y-contract.test.ts`). " +
        "⚠️⚠️ **두 시점**: 라운드 94 정찰은 이 수를 **0으로 내다봤다**(*'어느 바늘에도 안 걸리는데 " +
        "괄호로 형을 밝힌 자리 0건'*). 오늘 재실측은 0이 아니고, 그 갈림이 정찰의 *필드형 56*이 " +
        "**필드 44 + 잔여 12**를 한 낱말로 적은 수였다는 사실에서 온다.",
      why:
        "0으로 만드는 길은 하나뿐이다 — 갈래 하나를 *나머지 전부*로 두는 것. 그러면 그것은 갈래가 " +
        "아니라 **자루**이고, 자루는 다음 라운드에 또 틀린 이름으로 삼킨다(오늘 고친 병이 정확히 " +
        "그 모양이었다: `unmarked-source-prose`가 필드형 여든하나를 *표기 없는 산문*으로 세었다). " +
        "⚠️ 그래서 잔여를 **0으로 만들지 않고 이름으로 세운다** — 인용은 오늘의 약속이 아니라 " +
        "어제의 기록이고, 그것을 모집단에 넣으면 이 축이 어제를 지키게 된다.",
      recorded: [
        {
          at: "라운드 94 트랙 D",
          value: 9,
          divergence:
            "**이 트랙의 첫 실측에서 같았다 — 9 ↔ 9**(그 뒤 남의 트랙 커밋으로 올랐고 오늘의 수는 " +
            "자가 낸다). ⚠️⚠️ **정찰의 모집단 밖이다** — 라운드 95 정찰은 이 대장의 사각을 " +
            "*여덟 + 셋 = 열하나*로 세어 `sourceNeedleBlindSpots()`의 넷을 세지 않았다. 오늘 " +
            "전수는 **열다섯**이고, **두 수를 한 낱말로 적지 않는다.** ⚠️ 이 자리도 아래쪽이 " +
            "좋은 방향이라 줄어드는 날 고칠 것은 하한이 아니라 이 기록의 시점이다."
        }
      ],
      floor: 0,
      measure: (baseDir) => sourceNeedleTally(baseDir).unneedled,
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 인용과 약속을 가르는 표식이 `⚠️` 말고 하나 더 서는 " +
        "날 — 그날 이 잔여의 절반(ⓐ·ⓑ)이 이름을 얻는다. ⚠️ 이 수가 0으로 내려가는 것은 " +
        "**좋은 방향**이라 하한을 0으로 둔다."
    },
    {
      id: "field-needle-is-convention",
      what:
        "**필드형이 *오늘의 약속*이라는 판단은 관례이지 문법이 아니다** — `reopenCondition:` 값에 " +
        "어제의 문장을 인용해 담는 날 이 바늘이 틀린다. 오늘 그런 자리는 **0건**이다(필드형 " +
        "마흔둘 가운데 인용 표식이 함께 선 자리가 없다).",
      why:
        "필드의 값은 *그 객체가 오늘 지고 있는 약속*이라고 이 저장소가 읽어 온 것이지, 그렇게 " +
        "쓰라고 정한 문법이 있는 것이 아니다. ⚠️ 표식형은 `⚠️`라는 **글자**를 신원으로 삼지만 " +
        "필드형은 **자리**를 신원으로 삼는다 — 자리는 관례가 바뀌면 뜻이 바뀐다. 그래서 이 자는 " +
        "*오늘 그 관례가 아직 참인가*를 값으로 재고, 0이 아니게 되는 날 이 바늘이 좁혀져야 한다.",
      recorded: [
        {
          at: "라운드 94 트랙 D",
          value: 0,
          divergence:
            "**같다 — 0 ↔ 0.** ⚠️ 정찰 모집단 밖이다(위와 같은 넷 중 하나). ⚠️⚠️ **0이 같다는 " +
            "것과 0이 옳다는 것은 다르다** — 이 0은 *걷어서 낸 0*(자가 오늘 실제로 돌아 0을 낸다)이고, " +
            "그 갈래를 이름으로 적는 일은 이 라운드에 **트랙 B가 어드민에서** 여는 축이다."
        }
      ],
      floor: 0,
      measure: (baseDir) => quotedFieldNotations(baseDir).length,
      reopenCondition:
        "⚠️ 재개 조건(사건형): 필드 값 안에 인용 표식을 지닌 재개 조건이 처음 서는 날 — 그날 " +
        "필드형 바늘은 *필드에 있는가*가 아니라 *인용이 아닌가*를 함께 물어야 한다."
    },
    {
      id: "emphasis-axis-not-opened",
      what:
        "⚠️⚠️ **강조형에는 ⓒ 축(결정형이면 손의 위치를 함께)을 얹지 않았다** — 모집단은 넓히고 " +
        "축은 넓히지 않았다는 사실이 이 사각의 이름이다. " +
        "⚠️⚠️ **두 시점 — 그리고 그 사이가 한 라운드도 아니다.** " +
        "· **라운드 94 정찰 시점**: 이 수는 **하나**였다. " +
        "`apps/admin/src/admin-load-error-copy.test.ts`의 " +
        "`재개 조건(결정형 · 축: 이 파일의 *다른* 손 목록)`이 손의 위치를 적지 않아서, 축을 " +
        "강조형까지 넓혔다면 **그 한 자리가 곧바로 빨개졌을 것**이다. " +
        "· **오늘(이 트랙의 실측)**: **0**이다 — 같은 라운드의 **트랙 C가 그 줄에 " +
        "`손은 저장소 안`을 적으며** 결정형 #16을 소진했다. ⚠️ **한 라운드 안에서 값이 낡았고, " +
        "낡힌 손은 남의 트랙이다**(라운드 91 H-1이 같은 자리에서 배운 것의 되풀이). " +
        "⚠️ **그래도 사각은 사라지지 않는다**: 오늘 0인 것은 *축을 넓혀도 안전하다*는 뜻이지 " +
        "*축이 넓어졌다*는 뜻이 아니고, 넓힐지는 이 대장이 아니라 라운드의 결정이다.",
      why:
        "그 파일은 이 라운드에 **트랙 C의 것**이고(결정형 #16을 소진한다), *한 트랙이 남의 파일을 " +
        "빨갛게 만들지 않는다*. ⚠️ 그리고 축을 넓히는 것은 바늘을 넓히는 것과 같은 결정이라 " +
        "**결정형 #19가 오늘 고르지 않은 길**이다 — 고르지 않은 길도 값으로 적는다. " +
        "⚠️ 그리고 오늘 이 수가 0이라는 사실이 축을 넓혀도 좋다는 허락은 아니다 — 강조형은 남의 " +
        "트랙이 매 라운드 새로 적는 꼴이라, 오늘의 0은 **다음 커밋에 하나가 될 수 있는 0**이다.",
      recorded: [
        {
          at: "라운드 94 정찰 시점",
          value: 1,
          divergence:
            "⚠️⚠️ **이 자리는 한 라운드 안에서 낡았고, 그 낡음이 이미 값으로 적혀 있었다** — 정찰 " +
            "시점 **1**에서 트랙 C의 커밋 하나로 **0**이 됐다(`what`의 두 시점). 오늘 다시 재도 " +
            "**0**이라 라운드 94의 기록과 갈리지 않는다."
        },
        {
          at: "라운드 94 트랙 D",
          value: 0,
          divergence:
            "**같다 — 0 ↔ 0.** ⚠️ 정찰 모집단 밖이다. ⚠️ 아래쪽이 좋은 방향인 자리이고, **다음 " +
            "커밋에 하나가 될 수 있는 0**이라 이 기록은 *오늘 0이다*까지만 말한다."
        }
      ],
      floor: 0,
      measure: (baseDir) => emphasisDecisiveMissingHand(baseDir).length,
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 강조형 결정형 가운데 손의 위치가 빠진 자리가 " +
        "0이 되는 날 — 그날 ⓒ 축을 강조형까지 넓힐지가 라운드의 결정으로 선다. " +
        "⚠️ 이 수가 0으로 내려가는 것은 **좋은 방향**이라 하한을 0으로 둔다."
    },
    {
      id: "markdown-source-notation",
      what:
        "**`.md`의 소스 표기는 이 축 밖이다** — `docs/**` 아래 마크다운(오늘 **203벌**)이 넓은 " +
        "바늘로 **이백마흔** 자리를 지고 있는데(표기를 지닌 파일 **열하나**), 이 소스 축은 " +
        "`apps`·`packages` 뿌리만 걷는다. " +
        "⚠️ 그 자리는 문서 축(`LEDGER_DOCUMENT`)과 사각 둘(`round-notes` · `sibling-documents`)이 " +
        "나눠 지므로 **여기서 다시 세면 같은 자리를 두 번 세게 된다** — 그래서 값으로만 든다.",
      why:
        "이 축이 `.md`까지 걸으면 문서 축과 모집단이 겹치고, 겹친 자리는 두 축의 래칫에 **동시에** " +
        "걸린다 — 한쪽이 정직하게 줄 때 다른 쪽이 빨개지는 모양이다. ⚠️ *한 트랙이 한 그물에 축 " +
        "둘을 얹지 않는다*는 규율은 모집단에도 그대로 적용된다: **같은 자리를 두 자가 세지 않는다.** " +
        "⚠️ **두 시점 — 이 자를 처음 세운 손이 곧바로 틀렸다**: 소스 축의 걷기가 지닌 1MB 상한 " +
        "(`SOURCE_AXIS_MAX_BYTES`)을 이 자에도 그대로 씌워 재면 **여든아홉**이 나오는데, 그 상한이 " +
        "덜어 내는 것이 하필 판정 문서 자신(1.2MB)이라 **가장 큰 자리가 통째로 빠진다**. 이 자는 " +
        "그 상한을 쓰지 않으므로 **이백마흔**이다 — ⚠️ *같은 뿌리를 다른 대역으로 보면 다른 수가 " +
        "난다*는 사실이 이 사각의 크기에 함께 실려 있다.",
      recorded: [
        {
          at: "라운드 94 트랙 D",
          value: 240,
          divergence:
            "⚠️⚠️ **갈렸다 — +21(240 ↔ 오늘 261). 그리고 이 자리가 정찰이 세지 않은 여덟째다.** " +
            "라운드 95 정찰은 갈린 자리를 **일곱**으로 적었는데 그 모집단이 열하나였고, " +
            "`sourceNeedleBlindSpots()`의 넷을 함께 세면 오늘 갈린 자리는 **여덟**이다. " +
            "⚠️ **두 수를 한 낱말로 적지 않는다** — 일곱은 *열하나 안의 갈림*이고 여덟은 " +
            "*열다섯 안의 갈림*이다. 늘어난 스물하나는 `docs/**`가 자란 몫이고(라운드 95 정찰 노트 " +
            "자신을 포함한다), 이 자는 그 뿌리를 **값으로만** 든다."
        }
      ],
      floor: 10,
      measure: (baseDir) => markdownNotationCount(baseDir),
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 문서 축과 소스 축의 모집단을 하나로 합칠지 정하는 " +
        "날 — 오늘 그 둘은 일부러 갈려 있고, 갈림의 크기가 이 이백마흔이다."
    }
  ]);
}

// ── ⓖ 경과 축 — *몇 라운드째 서 있는가* (라운드 92 트랙 D) ────────────────────

/*
 * ⚠️⚠️ **정찰이 이 축에 지운 금지와, 그 금지가 갈렸던 자리 — 두 시점으로 적어 둔다**
 * (라운드 92 리뷰 M-1 · **기록이지 계약이 아니다**).
 *
 * **① 트랙 D 커밋 시점 — 금지는 이랬다.** 라운드 92 정찰이 트랙 사이의 의무를 적으며
 * *"F가 AG절을 쓰며 재개 조건을 더하면 D의 자리 수와 사각이 커지는데 **하한 설계 덕에 초록으로
 * 남는다** (⚠️ D는 `floor`도 `MEASURED_TODAY`도 오늘 값으로 올리지 않는다 — 올리면 F가 그 걸음에
 * 빨개진다)"* 라고 못 박았다. D는 그 금지를 `ELAPSED_RATCHET`(3 · 61)과 사각의 `floor`에서
 * **지켰다.**
 *
 * **② 같은 라운드의 F 뒤 — 금지가 지켜지지 않은 자리가 하나 있었다.** `floor`도 `MEASURED_TODAY`도
 * 아닌 **전제 재실측 블록**(`ELAPSED_SCOUT_VALUES`를 오늘 값과 견주는 네 줄)이 **등호**로 적혀
 * 있었고, F가 AG절을 쓰자 자리 수가 `333·3·70·263` → `383·4·83·300`으로 커지며 **그 네 줄이 곧바로
 * 빨개졌다.** F는 그 네 줄을 하한(`≥`)으로 옮기며 **기록값(`remeasured` 333·3·70·263)은 한 바이트도
 * 건드리지 않았다** — 리뷰 M-1이 그 사실을 다시 확인했고(이 파일은 D 커밋 이후 F가 한 글자도 고치지
 * 않았다), 그것이 옳은 처방이다. **AF-5가 이름 붙인 *등호의 비용*이 같은 라운드 안에서 되풀이된
 * 셈이고, 그 사실은 판정 문서 AG절에 이미 값으로 있다**(`docs/operations/known-limitations.md`
 * AG-4·AG-5 — ⚠️ **수와 판정은 여기 옮겨 적지 않는다**).
 *
 * **③ 오늘(리뷰 M-2) — 그래서 이 파일이 무엇을 올리고 무엇을 올리지 않는가.** 리뷰가 바늘 하나를
 * 고쳤으므로(`몇`을 경과로 세지 않는다) `ELAPSED_MEASURED_TODAY`는 **오늘의 실측으로 갱신했다** —
 * 그것은 *기록*이라 낡으면 거짓이 되기 때문이다. ⚠️ **`ELAPSED_RATCHET`(3 · 61)과 사각의 `floor`는
 * 오늘도 올리지 않는다** — 계약이 무는 것은 그 둘뿐이고, 그 둘이 하한으로 남아 있는 한 다음 F의
 * 걸음은 이 축을 빨갛게 만들지 못한다. ⚠️ 기록 쪽(`MEASURED_TODAY`)은 `≤`로만 물리므로 **문서가
 * 자라는 방향에는 조용하고, 문서가 줄어드는 라운드에만 같은 손이 이 기록을 함께 내린다.**
 */

/** 창 바늘의 반지름 — **±5줄**(정찰이 쓴 창 그대로). */
export const ELAPSED_WINDOW_RADIUS = 5;

/** 낱 자리 수사(관형사형) — `한 라운드`·`세 라운드`. */
export const ELAPSED_UNITS: Readonly<Record<string, number>> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9
};

/** 열 자리 수사 — 낱 자리와 **곱해서** 표를 만든다(`스물` + `다섯` = 25). */
export const ELAPSED_TENS: Readonly<Record<string, number>> = { 열: 10, 스물: 20, 서른: 30 };

/** 홀로 설 때의 꼴 — ⚠️ `스무 라운드`는 `스물`이 아니다. */
export const ELAPSED_STANDALONE: Readonly<Record<string, number>> = {
  ...ELAPSED_UNITS,
  열: 10,
  스무: 20,
  서른: 30
};

/**
 * ⚠️ **표를 손으로 적지 않는다** — 열 자리 × 낱 자리를 **소스에서 파생**한다.
 *
 * 손으로 적으면 `스물한`은 있고 `서른한`은 없는 표가 조용히 서고, 그 순간 이 축은 *"관례를 지킨
 * 자리"* 가 아니라 *"내가 적어 둔 수사를 쓴 자리"* 를 세게 된다(AB-4가 적은 손 목록의 병).
 * 라운드 90 E가 `accessibility-checklist-shape.test.ts`에 세운 수사 변환의 모양을 인용한다.
 */
export function buildElapsedNumeralTable(): Readonly<Record<string, number>> {
  const table: Record<string, number> = { ...ELAPSED_STANDALONE };
  for (const [tens, base] of Object.entries(ELAPSED_TENS)) {
    for (const [unit, value] of Object.entries(ELAPSED_UNITS)) {
      table[`${tens}${unit}`] = base + value;
    }
  }
  return table;
}

/** 파생된 수사 표 — `스물다섯` → 25. */
export const ELAPSED_NUMERAL_TABLE: Readonly<Record<string, number>> = buildElapsedNumeralTable();

/**
 * 수사 하나를 수로 읽는다 — **한국어 수사와 아라비아 숫자 둘 다.**
 *
 * ⚠️ 읽지 못하면 `undefined`다(0이 아니다). 모르는 낱말을 0으로 읽으면 *"경과가 0라운드"* 라는
 * 거짓이 값으로 서고, 그 거짓은 조용하다.
 */
export function elapsedNumeral(word: string): number | undefined {
  if (/^\d+$/.test(word)) return Number(word);
  return ELAPSED_NUMERAL_TABLE[word];
}

/**
 * 경과 바늘 — `N 라운드 (연속|째|만에)`.
 *
 * ⚠️ 전역 플래그를 쓰므로 **부를 때마다 새로 만든다**(`lastIndex` 공유 금지 — 이 대장의 다른
 * 바늘들과 같은 관례).
 */
export function elapsedNeedle(): RegExp {
  return /(?:([가-힣]+)|(\d+))\s*라운드\s*(연속|째|만에)/g;
}

/** 산문으로 오래됨을 말하는 자리의 바늘 — ⚠️ **이 축이 세는 바늘이 아니라 사각을 재는 자다.** */
export const ELAPSED_PROSE_NEEDLE = /오래|오랫동안|한동안|줄곧|내내/;

export type ElapsedMark = {
  /** 원문 낱말(`스물다섯` · `11`). */
  readonly numeral: string;
  /** 읽은 수 — ⚠️ **언제나 수다**(읽지 못한 수사는 아래 규율대로 이 목록에 들어오지 않는다). */
  readonly rounds: number;
  /** 어떤 꼴인가. */
  readonly unit: string;
};

/**
 * 한 텍스트에서 **읽어 낸** 경과 표기를 전수로 걷는다.
 *
 * ⚠️⚠️ **두 시점 — 라운드 92 리뷰 M-2가 이 함수의 모집단을 좁혔다.**
 *  · **트랙 D 커밋 시점**: 바늘에 걸린 자리를 **전부** 마크로 실었고, 읽지 못한 수사는
 *    `rounds: undefined`로 함께 실렸다. 그래서 `tallyElapsed`가 *"경과를 적은 자리"* 를 셀 때
 *    **읽지도 못한 수사까지 경과로 세었다** — 이 문서의 *"이백 **몇**십 라운드"* 의 `몇`이 그것이다.
 *    그 한 낱말 때문에 창 바늘이 오늘 실측에서 **넷을 더** 세고 있었다(83 vs 79).
 *  · **오늘**: 읽어 낸 것만 마크가 된다. 읽지 못한 수사는 `unreadableNumeralsIn`이 **따로** 들고,
 *    `ElapsedSite.unreadableInWindow`로 남아 값으로만 보고된다(계약은 그 값을 등호로 문다).
 * ⚠️ 방향은 그대로다 — *모르는 낱말을 0으로 읽지 않는다*는 규율(`elapsedNumeral`)의 자연스러운
 * 다음 걸음이고, **모르는 낱말을 경과로도 세지 않는다**가 오늘 더해진 절반이다.
 */
export function elapsedMarksIn(text: string): readonly ElapsedMark[] {
  const needle = elapsedNeedle();
  const marks: ElapsedMark[] = [];
  let match: RegExpExecArray | null;
  while ((match = needle.exec(text)) !== null) {
    const numeral = match[1] ?? match[2];
    const rounds = elapsedNumeral(numeral);
    if (rounds === undefined) continue;
    marks.push({ numeral, rounds, unit: match[3] });
  }
  return marks;
}

/** 바늘에는 걸렸으나 **수로 읽지 못한** 수사 — ⚠️ `elapsedMarksIn`이 버린 바로 그 낱말들이다. */
export function unreadableNumeralsIn(text: string): readonly string[] {
  const needle = elapsedNeedle();
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = needle.exec(text)) !== null) {
    const numeral = match[1] ?? match[2];
    if (elapsedNumeral(numeral) === undefined) found.push(numeral);
  }
  return found;
}

export type ElapsedSite = {
  /** 모집단의 자리 그대로 — ⚠️ **이 축은 자리를 새로 만들지 않는다.** */
  readonly site: ResumeSite;
  /** 바늘 ⓐ — **그 줄 자신**의 경과 표기. */
  readonly onLine: readonly ElapsedMark[];
  /** 바늘 ⓑ — **±5줄 창**의 경과 표기(그 줄 자신을 포함한다). */
  readonly inWindow: readonly ElapsedMark[];
  /** ⚠️ 창 안에서 **읽지 못한 수사** — 리뷰 M-2가 tally에서 뺀 그 자리들(값으로만 든다). */
  readonly unreadableInWindow: readonly string[];
  /** 산문으로 오래됨을 말하는 창인가 — 사각 ⓐ가 무는 값. */
  readonly proseWindow: boolean;
};

/**
 * ⚠️⚠️ **모집단은 넓히지 않는다** — `sites`는 `collectDocumentSites()`가 이미 파생한 자리 전수이고,
 * 이 함수는 그 자리마다 **경과 칸 하나**를 채울 뿐이다.
 *
 * `text`는 그 자리가 나온 바로 그 문서의 원문이어야 한다(줄 번호로 창을 뜬다).
 */
export function collectElapsedSites(
  text: string,
  sites: readonly ResumeSite[],
  radius: number = ELAPSED_WINDOW_RADIUS
): readonly ElapsedSite[] {
  const lines = text.split("\n");
  return sites.map((site) => {
    const index = site.line - 1;
    const window = lines.slice(Math.max(0, index - radius), index + radius + 1).join("\n");
    return {
      site,
      onLine: elapsedMarksIn(lines[index] ?? site.text),
      inWindow: elapsedMarksIn(window),
      unreadableInWindow: unreadableNumeralsIn(window),
      proseWindow: ELAPSED_PROSE_NEEDLE.test(window)
    };
  });
}

export type ElapsedTally = {
  /** 바늘 ⓐ — 그 줄 자신이 경과를 적은 자리 수. */
  readonly ownLine: number;
  /** 바늘 ⓑ — ±5줄 창 안에 경과가 있는 자리 수. */
  readonly window: number;
  /** 어디에도 경과가 없는 자리 수 — AF-2가 지목한 그 수. */
  readonly neither: number;
};

/**
 * 두 바늘의 수를 **각각** 낸다.
 *
 * ⚠️⚠️ **한 낱말로 합친 수를 돌려주는 자리는 이 파일에 없다**(라운드 91 D의 `tallyNeedles`가
 * 바늘 셋을 갈라 든 그 형식 그대로다). 두 수가 같아지면 바늘 하나가 죽은 것이고, 계약이 그
 * 사실을 단언으로 문다.
 */
export function tallyElapsed(elapsed: readonly ElapsedSite[]): ElapsedTally {
  const ownLine = elapsed.filter((entry) => entry.onLine.length > 0).length;
  const window = elapsed.filter((entry) => entry.inWindow.length > 0).length;
  return { ownLine, window, neither: elapsed.length - window };
}

/** 모집단 문서의 경과 자리 — ⓐ 모집단은 `collectDocumentSites()` 그대로다. */
export function documentElapsedSites(baseDir: string = repoRoot): readonly ElapsedSite[] {
  const text = readFileSync(join(baseDir, LEDGER_DOCUMENT.path), "utf8");
  return collectElapsedSites(text, collectDocumentSites(baseDir));
}

/**
 * 읽지 못한 수사 — ⚠️ **값으로만 든다**(세는 것은 표기의 실재이지 수사의 정확함이 아니다).
 *
 * ⚠️ 리뷰 M-2 뒤로 이 목록의 원천은 `inWindow`가 아니라 `unreadableInWindow`다 — 읽지 못한 수사는
 * 애초에 마크가 되지 않으므로, 여기서 보이지 않으면 **그 자리는 아무 데서도 보이지 않는다.**
 */
export function unreadableElapsedNumerals(elapsed: readonly ElapsedSite[]): readonly string[] {
  const found = new Set<string>();
  for (const entry of elapsed) {
    for (const numeral of entry.unreadableInWindow) found.add(numeral);
  }
  return [...found].sort();
}

export type ElapsedRatchet = {
  /** 그 줄 자신이 경과를 적은 자리 수의 **하한**. */
  readonly ownLine: number;
  /** ±5줄 창까지 넓혔을 때의 **하한**. */
  readonly window: number;
};

/**
 * ⚠️⚠️ **전부 하한이다. 상한도 전수 일치도 아니다.**
 *
 * 무는 것은 하나뿐이다 — *"경과를 적은 자리가 **줄지 않았는가**"*. F가 AG절을 쓰며 조건을 더하면
 * 자리 수가 커지고 이 축은 그대로 초록이다. 등호로 물면 그 순간 **F가 계약을 맞추려고 문서를
 * 고치게 되고**(AF-5가 값으로 적은 비용), 그것이 이 대장이 태어날 때부터 막으려던 뒤집힘이다.
 *
 *  · `ownLine` **3** — 트랙 D 시점의 실측과 같은 수다(오늘은 4다). 줄 자신의 표기는 문단이 밀려도
 *    움직이지 않으므로, 이 수가 내려가는 것은 **경과를 적은 줄이 지워졌다**는 뜻 하나뿐이다.
 *  · `window` **61** — ⚠️ **오늘의 실측(79)이 아니라 정찰이 적은 61이다.** 창 바늘은 *줄 사이의
 *    거리*를 재는 바늘이라, F가 사이에 문단 하나만 끼워 넣어도 경과 표기를 지우지 않은 채 실측이
 *    내려간다. 하한을 실측에 붙이면 **문서를 옳게 늘리는 손이 빨강을 맞는다.**
 *
 * ⚠️⚠️ **정찰의 61은 어떤 창 폭으로도 재현되지 않는다 — 라운드 92 리뷰 L-4의 실측을 기록으로 남긴다.**
 * `ELAPSED_SCOUT_VALUES`의 갈림 문장은 *"폭 셋 56 · 폭 넷 65 · 폭 다섯 70이고 정찰의 61은 그 사이에
 * 든다"* 라고만 적었는데, **폭을 전수로 훑어도 61은 어디에도 서지 않는다**:
 *  · **트랙 D 커밋 시점의 문서**(자리 333) — 리뷰 L-4의 실측 `r=1…7`: **21·33·56·65·70·87·97**.
 *  · **오늘의 문서**(자리 383 · F의 AG절 뒤)에서 **그때의 바늘로** 다시 재면 `r=1…7`:
 *    **25·40·64·75·83·101·115**. 61은 이번에도 없다.
 *  · **오늘의 문서 + M-2가 고친 바늘**로는 `r=1…7`: **23·37·61·71·79·96·110** — `r=3`에 61이
 *    서지만, ⚠️ **그것은 오늘 문서의 우연한 크기이지 정찰의 61이 그 창이었다는 증거가 아니다**
 *    (정찰이 잰 문서에서는 같은 폭이 56이었다). **61의 출처는 오늘도 모른다.**
 * ⚠️ **그래도 하한을 61로 유지하는 판단은 안전하다** — 이 계약의 창(±5)에서 오늘 실측은 79이고,
 * 61은 그 아래 어느 폭에서도 통과하는 넉넉한 바닥이다. 출처를 모르는 수를 **하한으로만** 쓰는 것이
 * 정확히 그 모름을 안전하게 두는 방법이다(등호로 물었다면 이 모름이 곧 빨강이었다).
 *
 * ⚠️ **이 수를 낮추려면 이 파일을 열어 왜 낮추는지를 적어야 한다.**
 */
export const ELAPSED_RATCHET: ElapsedRatchet = { ownLine: 3, window: 61 };

export type ElapsedRatchetViolation = {
  readonly name: keyof ElapsedRatchet;
  readonly floor: number;
  readonly measured: number;
};

/** 하한을 깬 자리들 — **비어 있어야 초록이다**(`measured > floor`는 언제나 통과다). */
export function elapsedRatchetViolations(
  tally: ElapsedTally,
  ratchet: ElapsedRatchet = ELAPSED_RATCHET
): readonly ElapsedRatchetViolation[] {
  const names: (keyof ElapsedRatchet)[] = ["ownLine", "window"];
  return names
    .filter((name) => tally[name] < ratchet[name])
    .map((name) => ({ name, floor: ratchet[name], measured: tally[name] }));
}

/**
 * 오늘의 경과 실측 — **기록이지 계약이 아니다**(계약이 무는 것은 `ELAPSED_RATCHET`뿐).
 *
 * ⚠️ **두 수를 한 낱말로 적지 않는다** — `ownLine`과 `window`는 끝까지 갈려 선다.
 */
export const ELAPSED_MEASURED_TODAY = {
  /** 모집단 자리 전수 — 라운드 91 D의 294 → 트랙 D 시점 333 → 오늘(F의 AG절 뒤) 383. */
  sites: 383,
  /** 바늘 ⓐ — 그 줄 자신. */
  ownLine: 4,
  /** 바늘 ⓑ — ±5줄 창. */
  window: 79,
  /** 어디에도 경과가 없는 자리 — AF-2의 그 수(이 대장의 바늘로는 304다). */
  neither: 304,
  /** 창 바늘이 읽은 자리 가운데 **한국어 수사**로 적힌 것. */
  koreanNumeralSites: 78,
  /** 창 바늘이 읽은 자리 가운데 **아라비아 숫자**로 적힌 것 — ⚠️ 두 꼴 다 실제로 읽힌다. */
  arabicNumeralSites: 2,
  /**
   * ⚠️⚠️ **읽지 못한 수사 — 오늘 하나다(`몇`).**
   *
   * **두 시점**: 트랙 D는 이 칸에 **0**을 적었고 *"오늘 0건"* 이라고 문장으로도 말했는데,
   * **그것이 거짓이었다** — 이 문서의 *"이백 **몇**십 라운드"* 가 바늘에 걸려 있었고, 그때의
   * `elapsedMarksIn`은 그것을 `rounds: undefined` 마크로 실어 **경과로 세기까지 했다**.
   * 0이 거짓이었다는 사실이 조용했던 이유는 계약이 이 값을 **항진명제**(`≥ 0`)로만 물었기
   * 때문이다(라운드 92 리뷰 M-2). 오늘 그 자리는 등호로 문다.
   */
  unreadableNumerals: 1,
  /** ⚠️ 그 수사들 자신 — 값을 **낱말로** 적어 둔다(수만 적으면 무엇이 안 읽혔는지 사라진다). */
  unreadableNumeralWords: ["몇"]
} as const;

/**
 * ⚠️ 경과 축의 **사각 셋** — 값과 하한으로 선다(AB-5의 규율).
 *
 * ⚠️⚠️ **여덟짜리 `LEDGER_BLIND_SPOTS`에 얹지 않는다.** 그 여덟은 문서 축·소스 축의 사각이고,
 * 이 라운드에 그 목록에서 움직이는 것은 **값뿐**이다 — *한 트랙이 남의 사각 목록을 열지 않는다.*
 */
export const ELAPSED_BLIND_SPOTS: readonly LedgerBlindSpot[] = derivedBlindSpots([
  {
    id: "prose-elapsed",
    what:
      "**산문으로 오래됨을 말하는 자리** — *'오래 서 있었다'* · *'한동안'* 처럼 수 없이 말한 창. " +
      "오늘 창 **열둘**이 그렇게 적혀 있고, 이 바늘은 그 열둘을 **경과 0건으로** 지나간다. " +
      "⚠️ **두 시점**: 트랙 D 시점의 이 수는 여덟이었다 — 문서가 자란 몫과, 라운드 92 리뷰 M-2가 " +
      "읽지 못한 수사(`몇`)를 경과에서 뺀 몫이 함께 올렸다(그 셋은 *수사가 함께 선 창*으로 " +
      "세어지다가 오늘 산문만 남은 창으로 옮겨 왔다).",
    why:
      "산문에는 수가 없어 *몇 라운드인가*를 기계가 낼 수 없다 — 문서 축의 `prose-only`가 형을 " +
      "가르지 못하는 것과 **같은 사각의 시간 축 판**이다. 세려면 절을 거슬러 읽어야 하고 그것이 " +
      "AF-2가 지목한 바로 그 노동이라, 이 축은 *산문을 수로 바꾸는 일*이 아니라 *수가 적힌 자리를 " +
      "세는 일*만 한다.",
    recorded: [
      {
        at: "라운드 92 리뷰 M-2",
        value: 12,
        scout95: 12,
        divergence:
          "**같다 — 12 ↔ 12.** ⚠️ 정찰의 *일치 넷* 가운데 하나이고 오늘도 갈리지 않는다. " +
          "⚠️ 아래쪽이 좋은 방향인 자리다(산문이 수사를 함께 적기 시작하면 줄어든다)."
      }
    ],
    floor: 0,
    measure: (baseDir) =>
      documentElapsedSites(baseDir).filter((entry) => entry.proseWindow && entry.inWindow.length === 0)
        .length,
    reopenCondition:
      "⚠️ 재개 조건(사건형): 산문으로 오래됨을 말한 자리가 수사를 함께 적기 시작하는 날 — " +
      "그날 이 여덟이 줄고 창 바늘의 수가 오르며, 두 수가 함께 움직인다는 사실이 이 사각이 " +
      "닫히고 있다는 신호다. ⚠️ 이 수가 0으로 내려가는 것은 **좋은 방향**이라 하한을 0으로 둔다."
  },
  {
    id: "elapsed-truth",
    what:
      "**경과가 적혀 있다는 것과 그 수가 오늘 참이라는 것은 다르다** — 창 바늘이 센 일흔은 " +
      "*그 수가 오늘도 맞는가* 를 **묻지 않은 채** 세어진다. 라운드 87에 *'세 라운드 연속'* 이라고 " +
      "적힌 줄은 오늘 여덟 라운드째일 수 있고, 이 축에서 둘은 같은 한 건이다.",
    why:
      "⚠️⚠️ **뒤쪽을 물으려면 *조건의 도래*를 값으로 가르는 관례가 먼저 서야 한다** — 라운드 92 " +
      "정찰의 결정형 열다섯이 정확히 그 자리이고, 그 결정형은 **집지 않는다**로 남았다(관례를 " +
      "정하는 일이지 계약이 낼 답이 아니다). ⚠️ **이 트랙은 그 관례를 세우지 않는다**: 경과는 " +
      "*얼마나 서 있었나*이고 도래는 *참이 됐나*라서 **두 수를 한 낱말로 적지 않는다**. 이 축이 " +
      "그것까지 물면 표기 하나가 늘 때마다 새 그물이 하나 필요해진다(소스 축의 " +
      "`source-notation-existence`가 같은 자리에 적은 판단 그대로다).",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 70,
        scout95: 102,
        divergence:
          "⚠️⚠️ **갈렸다 — +32**(정찰 `70↔102` · 오늘 다시 재도 **102**). ⚠️ **하한은 그대로 61이다** — " +
          "창 바늘은 *줄 사이의 거리*를 재는 바늘이라 F가 문단 하나만 끼워 넣어도 표기를 지우지 않은 " +
          "채 실측이 내려간다. 갈림이 커졌다는 사실은 값으로 적고, **하한은 한 칸도 올리지 않는다**."
      }
    ],
    floor: 61,
    measure: (baseDir) => tallyElapsed(documentElapsedSites(baseDir)).window,
    reopenCondition:
      "⚠️ 재개 조건(결정형 · 손은 저장소 안): 조건의 **도래**를 값으로 가르는 관례가 서는 날 — " +
      "그날 이 축은 표기마다 *그 수가 오늘도 맞는가* 를 함께 물 수 있다. 그 관례를 세우는 것은 " +
      "이 대장이 아니라 라운드의 결정이고, 그 결정을 내릴 손은 저장소 안에 있다."
  },
  {
    id: "elapsed-outside-population",
    what:
      "**짝 문서와 라운드 노트의 경과** — 창 바늘을 그 밖에 돌리면 오늘 여든아홉 자리가 나오는데 " +
      "(`docs/qa/**` 여덟 · `docs/5차/**` 여든하나) **이 축은 그 전부가 밖이다.**",
    why:
      "모집단을 넓히면 이 트랙이 축 둘을 지게 된다 — 그리고 그 자리 수는 이미 다른 사각 둘이 " +
      "값으로 지고 있다(`sibling-documents` · `round-notes`). ⚠️ 라운드 노트는 라운드마다 한 벌씩 " +
      "늘어 모집단에 넣으면 이 축의 수가 매 라운드 통째로 흔들리고 래칫이 뜻을 잃는다 — 문서 축이 " +
      "같은 이유로 그 뿌리를 밖에 둔 판단 그대로다.",
    recorded: [
      {
        at: "라운드 92 트랙 D",
        value: 89,
        scout95: 97,
        divergence:
          "⚠️⚠️ **두 번 갈렸다 — 그리고 두 번째가 `round-notes`와 같은 지문을 지녔다.** " +
          "① 적힌 값 **89 ↔ 오늘 104 (+15)**. ② **정찰의 97과도 갈린다(+7)** — 그 **7은 정찰 자신의 " +
          "노트**가 지고 있는 경과 창의 수다(`round95-scout.md`의 창 바늘 **7** · 97 + 7 = 104). " +
          "⚠️ 이 뿌리를 함께 걷는 사각 둘이 **같은 라운드에 같은 까닭으로** 정찰과 갈렸다는 사실 " +
          "자체가 값이다 — 정찰이 자기가 쓰고 있던 문서를 세지 못하는 것은 바늘의 문제가 아니라 " +
          "**시점의 문제**다."
      }
    ],
    floor: 10,
    measure: (baseDir) => {
      const outside = [...SIBLING_DOCUMENTS, ...roundNoteFiles(baseDir)];
      return outside.reduce((sum, path) => {
        const absolute = join(baseDir, path);
        if (!existsSync(absolute)) return sum;
        const text = readFileSync(absolute, "utf8");
        const elapsed = collectElapsedSites(text, collectResumeSites(text, path));
        return sum + tallyElapsed(elapsed).window;
      }, 0);
    },
    reopenCondition:
      "⚠️ 재개 조건(사건형): 짝 문서 하나가 `LEDGER_DOCUMENT` 옆에 서는 날 — 그 문서가 모집단이 " +
      "되는 날 이 축도 그 자리의 경과를 함께 세고, 그때 이 사각의 크기가 그만큼 줄어든다."
  }
]);

/**
 * ⚠️ **전제 재실측 의무의 이행 ② — 라운드 92 정찰의 네 수를 다시 셌다.**
 *
 * 정찰이 적은 수는 **333 · 3 · 61 · 272**다. 오늘 이 대장의 바늘로 다시 세니
 * **333 · 3 · 70 · 263**이고, **앞의 둘은 그대로 · 뒤의 둘은 갈렸다.**
 *
 * ⚠️⚠️ **갈린 것은 문서가 아니라 바늘이다.** 자리 전수가 정찰과 **똑같이 333**이므로 그 사이에
 * 문서는 한 줄도 자라지 않았다 — 그러니 창 바늘의 61과 70의 차이는 *언제 쟀는가*가 아니라
 * *무엇을 창으로 보았는가*에서 온다. 이 대장의 창(±5줄 · `\s*`로 줄바꿈을 넘는 수사)으로는
 * 폭 셋이 56 · 폭 넷이 65 · 폭 다섯이 **70**이라, 정찰의 61은 **폭 넷 언저리의 창**이다.
 * ⚠️ **그래서 61을 버리지 않고 하한으로 든다** — 정찰이 *"셋과 61은 둘 다 하한이다"* 라고 적었고,
 * 좁은 창의 수를 하한으로 쓰면 이 축은 창 폭의 판단이 갈리는 날에도 옳은 손을 막지 않는다.
 * (라운드 89 D가 정찰의 14를 *틀린 수*가 아니라 **셋째 바늘**로 든 그 판단의 같은 모양이다.)
 */
export const ELAPSED_SCOUT_VALUES: readonly ScoutNeedleValue[] = [
  {
    what: "재개 조건이 선 자리(줄) 전수",
    needle: "site",
    scout: 333,
    remeasured: 333,
    divergence:
      "같다. ⚠️ 라운드 91 D 커밋 시점의 294에서 자란 수이고, 늘린 것은 AF절 자신과 라운드 91 " +
      "리뷰다 — 문서는 라운드마다 자라고 한 라운드 안에서도 자란다."
  },
  {
    what: "그 줄 자신이 경과를 적은 자리",
    needle: "line",
    scout: 3,
    remeasured: 3,
    divergence:
      "같다. ⚠️ 333분의 3이 AF-2가 적은 그 문장의 수다 — *'그 수를 조건 자신은 적지 않는다 — " +
      "사람이 절을 거슬러 읽어야 나온다.'*"
  },
  {
    what: "±5줄 창까지 넓혔을 때 경과가 있는 자리",
    needle: "window",
    scout: 61,
    remeasured: 70,
    divergence:
      "⚠️⚠️ **갈렸다 — 그리고 갈린 것은 문서가 아니라 바늘이다.** 자리 전수가 정찰과 똑같이 " +
      "333이라 그 사이 문서는 자라지 않았다. 이 대장의 창으로는 폭 셋 56 · 폭 넷 65 · 폭 다섯 " +
      "**70**이고, 정찰의 61은 그 사이에 든다. **61을 버리지 않고 하한으로 든다**(정찰이 " +
      "*'셋과 61은 둘 다 하한이다'* 라고 적었다) — 좁은 쪽을 하한으로 쓰면 창 폭의 판단이 " +
      "갈리는 날에도 이 축이 옳은 손을 막지 않는다."
  },
  {
    what: "어디에도 경과가 없는 자리",
    needle: "window",
    scout: 272,
    remeasured: 263,
    divergence:
      "⚠️ 갈렸다 — 앞 줄의 갈림이 그대로 옮겨 온 수다(333 − 70 = 263 · 정찰은 333 − 61 = 272). " +
      "⚠️⚠️ **두 수 중 무엇을 쓰든 AF-2의 답은 바뀌지 않는다**: 이백 몇십 자리가 자기가 몇 " +
      "라운드째 서 있는지를 어디에도 적지 않는다. 이 축은 그 수를 **계약으로 물지 않고 값으로만** " +
      "든다(줄면 좋은 방향이고, 늘어도 F가 조건을 더한 것일 수 있다 — 어느 쪽도 빨강이 아니다)."
  }
];

// ── 전제 재실측 ───────────────────────────────────────────────────────────────

export type ScoutNeedleValue = {
  /** 무엇을 센 수인가. */
  readonly what: string;
  /**
   * 어떤 바늘인가.
   *
   * ⚠️ 뒤의 넷은 **라운드 94 트랙 D가 더한 갈래**다(결정형 #19) — 앞의 넷을 지우지 않고 더한다:
   * 같은 표 형식을 다른 라운드가 인용할 수 있게 두는 것이 이 저장소의 관례다.
   */
  readonly needle: "paren" | "line" | "window" | "site" | "any-paren" | "marked" | "emphasis" | "field";
  /** 정찰(`docs/5차/round89-scout.md`)이 적은 수. */
  readonly scout: number;
  /** 트랙 D가 2026-08-31 워킹트리에서 다시 잰 수. */
  readonly remeasured: number;
  /** 갈렸다면 왜 갈렸는가 — 같으면 빈 문자열이 아니라 *"같다"* 는 사실을 적는다. */
  readonly divergence: string;
};

/**
 * ⚠️ **전제 재실측 의무의 이행.** 정찰의 다섯 수를 다시 셌다.
 *
 * 넷은 그대로이고 하나는 **바늘이 갈렸다** — 정찰의 14가 틀린 것이 아니라, 손의 위치가 다음
 * 줄로 접힌 자리 둘을 함께 세는 바늘이었다. 그래서 이 대장은 그 수를 **버리지 않고 셋째 바늘로**
 * 든다(`window`). ⚠️ 두 수를 한 낱말로 적지 않는 규율이 여기에도 그대로 적용된다.
 *
 * ⚠️⚠️ **이 표는 *정찰 ↔ 트랙 D* 의 대조 기록이지 오늘의 실측이 아니다**(라운드 89 리뷰 M-4).
 * `remeasured`는 커밋 `1b597c4` 시점의 값이고 **일부러 그대로 둔다** — 두 바늘이 갈린 자리를
 * 보여 준 것이 그날의 대조이고, 그 대조를 오늘 값으로 덮으면 이 대장이 왜 바늘을 셋으로 갈랐는지가
 * 사라진다. 같은 라운드 HEAD의 실측은 `MEASURED_TODAY`가 진다(`252 · 80 · 107 · 18 · 21`).
 */
export const SCOUT_NEEDLE_VALUES: readonly ScoutNeedleValue[] = [
  {
    what: "재개 조건이 선 자리(줄) 전수",
    needle: "site",
    scout: 203,
    remeasured: 203,
    divergence:
      "같다. ⚠️ 다만 **언급**은 210이다(한 줄에 둘 이상인 자리 일곱) — 자리를 줄로 세는 이 " +
      "대장의 단위가 그 차이를 만들고, 그 수는 사각 `one-line-two-sites`가 값으로 진다."
  },
  {
    what: "형을 **괄호 안**에 밝힌 자리",
    needle: "paren",
    scout: 61,
    remeasured: 61,
    divergence:
      "같다. 이 바늘이 AA-3의 관례가 실제로 요구하는 모양이고, 이 계약의 축이 무는 바늘이다."
  },
  {
    what: "형 낱말이 **줄 어디에든** 있는 자리",
    needle: "line",
    scout: 84,
    remeasured: 84,
    divergence:
      "같다. ⚠️ 다만 이 수는 표기가 아니라 **언급까지** 센다 — 괄호 바늘과의 차이 스물셋은 " +
      "거의 전부 *'재개 조건에는 사건형과 결정형이 있고…'* 처럼 관례를 논하는 산문이고, " +
      "그래서 축은 이 바늘을 쓰지 않는다. **61과 84를 한 낱말로 적지 않는 이유가 이것이다.**"
  },
  {
    what: "손의 위치까지 **괄호 안**에 적은 자리",
    needle: "paren",
    scout: 11,
    remeasured: 11,
    divergence:
      "같다. ⚠️ 이 열하나가 축의 분자이고 분모는 결정형 열둘이다 — 어긋난 하나는 " +
      "`DECISIVE_HAND_EXEMPTIONS`가 이유·재개 조건과 함께 진다."
  },
  {
    what: "손의 위치까지 적은 자리(줄 바늘 · 접힘 바늘)",
    needle: "window",
    scout: 14,
    remeasured: 14,
    divergence:
      "⚠️ **한 줄만 보는 바늘로는 12이고, 앞뒤 한 줄까지 보는 바늘로는 14다.** 정찰의 14가 " +
      "틀린 것이 아니라 **접힌 표기 둘을 함께 센 값**이다(그 둘은 '…재개 조건이 결정형이고 / " +
      "손은 저장소 안이다' 처럼 손의 위치가 다음 줄에 있다). 그래서 이 대장은 12를 버리지 않고 " +
      "**두 수를 각각** 든다 — 줄 바늘 12 · 접힘 바늘 14. 접힘의 크기는 사각 " +
      "`folded-notation`이 값으로 진다."
  }
];

// ── ⓘ 기록 축 — *적힌 값*과 *오늘의 자*가 갈리는 것을 세는 자 (라운드 95 트랙 C) ──

/**
 * 사각이 사는 목록의 이름 — ⚠️ **손 목록이 아니라 이 파일의 세 목록 자신이다.**
 */
export type BlindSpotList = "ledger" | "source-needle" | "elapsed";

export type BlindSpotCensusEntry = {
  readonly list: BlindSpotList;
  readonly spot: LedgerBlindSpot;
};

/**
 * ⓐ **이 대장의 사각 전수** — ⚠️ **자기 소스에서 파생한다**(손으로 적은 아이디 목록 0건).
 *
 * ⚠️⚠️ **정찰과 갈렸고, 갈렸다는 사실 자체가 값이다**(AI-1의 일반형): 라운드 95 정찰은 이 대장의
 * 사각을 *`LEDGER_BLIND_SPOTS` 여덟 + `ELAPSED_BLIND_SPOTS` 셋 = **열하나***로 세었는데,
 * `sourceNeedleBlindSpots()`의 **넷**(라운드 94 트랙 D가 자기 목록으로 세운 것)이 그 셈에서 빠졌다.
 * 오늘 전수는 **열다섯**이고, **두 수를 한 낱말로 적지 않는다** — 갈린 자리도 그래서 갈린다
 * (정찰의 *일곱*은 열하나 안의 갈림이고, 이 자의 여덟은 열다섯 안의 갈림이다).
 */
export function allBlindSpots(): readonly BlindSpotCensusEntry[] {
  const label =
    (list: BlindSpotList) =>
    (spot: LedgerBlindSpot): BlindSpotCensusEntry => ({ list, spot });
  return [
    ...LEDGER_BLIND_SPOTS.map(label("ledger")),
    ...sourceNeedleBlindSpots().map(label("source-needle")),
    ...ELAPSED_BLIND_SPOTS.map(label("elapsed"))
  ];
}

/** 마지막 시점의 기록 — ⚠️ **존재 가드**(기록이 없으면 `undefined`이지 0이 아니다). */
export function latestRecord(spot: LedgerBlindSpot): BlindSpotRecord | undefined {
  const recorded = spot.recorded ?? [];
  return recorded.length === 0 ? undefined : recorded[recorded.length - 1];
}

export type BlindSpotReading = {
  readonly id: string;
  readonly list: BlindSpotList;
  /** 판정 ⓐ — **자가 있는가**(오늘 열다섯 다 있다). */
  readonly hasMeasure: boolean;
  /** 판정 ⓑ — **적힌 값이 있는가**(두 시점의 왼쪽). */
  readonly hasRecord: boolean;
  /** 그 적힌 값이 선 시점 — 기록이 없으면 빈 문자열. */
  readonly recordedAt: string;
  /** 적힌 값 — 기록이 없으면 0이 아니라 `undefined`. */
  readonly recorded?: number;
  /** 오늘의 자가 낸 수. */
  readonly today: number;
  /** ⚠️ `valueToday`가 **파생**인가(게터인가) — 상수를 감싼 값이 0건임을 구조로 보인다. */
  readonly derived: boolean;
  /** 판정 ⓒ — 오늘의 자 − 적힌 값(기록이 없으면 `undefined`). */
  readonly delta?: number;
  /** 적힌 값과 오늘의 자가 **같은가**. */
  readonly same: boolean;
};

/**
 * ⓑ·ⓒ **자리마다 판정 셋을 값으로 낸다** — 자가 있는가 · 적힌 값이 있는가 · 그 둘이 오늘 같은가.
 *
 * ⚠️ `today`는 자를 **그 자리에서 다시 불러** 낸다(기록을 다시 읽지 않는다). `valueToday`가 오늘
 * 같은 수를 돌려주는 것은 그 값이 같은 자에서 파생되기 때문이고, 그 사실을 `derived`가 진다.
 */
export function blindSpotReadings(
  baseDir: string = repoRoot,
  census: readonly BlindSpotCensusEntry[] = allBlindSpots()
): readonly BlindSpotReading[] {
  return census.map(({ list, spot }): BlindSpotReading => {
    const record = latestRecord(spot);
    const today = spot.measure(baseDir);
    const descriptor = Object.getOwnPropertyDescriptor(spot, "valueToday");
    return {
      id: spot.id,
      list,
      hasMeasure: typeof spot.measure === "function",
      hasRecord: record !== undefined,
      recordedAt: record?.at ?? "",
      recorded: record?.value,
      today,
      derived: descriptor?.get !== undefined,
      delta: record === undefined ? undefined : today - record.value,
      same: record !== undefined && record.value === today
    };
  });
}

/**
 * ⚠️⚠️ **갈린 자리** — *적힌 값 ≠ 오늘의 자*.
 *
 * ⚠️ 이 수는 **값으로만** 적는다(하한도 상한도 아니다) — 줄어야 좋은 수이고, 오늘 여덟에서 0으로
 * 내려가는 길이 바로 이 트랙이 한 일(값을 자에서 파생시키는 것)이다.
 */
export function blindSpotDivergences(
  baseDir: string = repoRoot,
  census: readonly BlindSpotCensusEntry[] = allBlindSpots()
): readonly BlindSpotReading[] {
  return blindSpotReadings(baseDir, census).filter((reading) => reading.hasRecord && !reading.same);
}

export type RecordedRatchetViolation = {
  readonly id: string;
  readonly at: string;
  readonly recorded: number;
  readonly today: number;
  readonly delta: number;
};

/**
 * ⓓ **오르는 쪽 래칫** — *적힌 값 ≤ 오늘의 자*를 모든 자리에서 묻는다. **비어 있어야 초록이다.**
 *
 * ⚠️⚠️ **이것은 하한 인상이 아니다.** `floor`는 한 칸도 올리지 않았다(라운드 92·94의 수 그대로).
 * 이 자가 묻는 것은 *사각이 얼마나 큰가*가 아니라 **기록이 오늘보다 크지 않은가**이고, 그 방향은
 * 이 사각들이 자라는 방향이다 — 줄어드는 날은 대개 *이름이 틀렸던 날*이다(라운드 94 D의
 * `unmarked-source-prose` 129 → 61이 그 실물이고, 그 줄어듦은 옳았다).
 * ⚠️ **그날의 고침은 하한을 내리는 것이 아니라 기록에 시점을 하나 더하는 것이다** — 그 비용이
 * 한 줄이라는 사실이 이 래칫을 안전하게 만든다. 아래 사각
 * `recorded-ratchet-blocks-good-hand`가 *아래쪽이 좋은 방향인 자리*의 수를 값으로 진다.
 */
export function recordedRatchetViolations(
  baseDir: string = repoRoot,
  census: readonly BlindSpotCensusEntry[] = allBlindSpots()
): readonly RecordedRatchetViolation[] {
  return blindSpotReadings(baseDir, census)
    .filter((reading) => reading.recorded !== undefined && (reading.delta ?? 0) < 0)
    .map((reading) => ({
      id: reading.id,
      at: reading.recordedAt,
      recorded: reading.recorded as number,
      today: reading.today,
      delta: reading.delta as number
    }));
}

export type ScoutRecheckRow = {
  readonly id: string;
  /** 라운드 95 정찰이 대어 본 수. */
  readonly scout: number;
  /** 오늘 같은 자로 다시 잰 수. */
  readonly today: number;
  readonly same: boolean;
};

/**
 * ⚠️ **정찰 실측의 재확인**(전제 재실측 의무 · AI-1의 일반형).
 *
 * 라운드 95 정찰이 사각마다 대어 본 수를 오늘 같은 자로 다시 잰다. ⚠️⚠️ **열하나 가운데 아홉은
 * 갈리지 않고 둘이 갈린다**(`round-notes` 440 ↔ 468 · `elapsed-outside-population` 97 ↔ 104) —
 * 그리고 **그 둘의 지문은 같다**: 둘 다 `docs/5차/**`를 걷는 자이고, 갈린 몫은 정확히
 * **정찰 자신의 노트**(`round95-scout.md`)가 지고 있는 수다. 정찰은 자기가 쓰고 있던 문서를
 * 세지 못했다(사각 `round-notes`가 라운드 91 정찰에 대해 이미 적어 둔 그 문장의 되풀이).
 */
export function blindSpotScoutRecheck(baseDir: string = repoRoot): readonly ScoutRecheckRow[] {
  const rows: ScoutRecheckRow[] = [];
  for (const { spot } of allBlindSpots()) {
    for (const record of spot.recorded ?? []) {
      if (record.scout95 === undefined) continue;
      const today = spot.measure(baseDir);
      rows.push({ id: spot.id, scout: record.scout95, today, same: record.scout95 === today });
    }
  }
  return rows;
}

/** 정찰 노트 자신이 지고 있는 재개 조건 자리 — ⚠️ 위 갈림 둘의 지문을 값으로 든다. */
export function scoutNoteSiteCount(baseDir: string = repoRoot): number {
  return countSitesIn(baseDir, `${ROUND_NOTES_ROOT}/round95-scout.md`);
}

/**
 * ⓔ **본보기의 인용 — 사문 대장은 같은 자리를 *등호로* 물어 갈림이 0이다.**
 *
 * ⚠️ **로직을 복사하지 않는다**: 그 대장의 자를 여기서 다시 짓지 않고 **그 목록과 그 계약의 소스를
 * 읽어** 파생한다. 오늘 실제로 대어 보는 것은 **값싼 둘**(`tsx-components` · 
 * `jsx-apostrophe-string-masking`)이고, 나머지 넷은 그 대장의 계약이 이미 등호로 물고 있어서
 * (`toBe(<적힌 값>)`) 이 자가 다시 돌릴 필요가 없다 — ⚠️ 여섯을 다 돌리면 이 계약 하나가 30초를
 * 넘게 쓴다(오늘 실측). **한 계약이 남의 그물을 대신 돌리지 않는다.**
 */
export function deadExportLedgerEquality(baseDir: string = repoRoot): {
  readonly spots: number;
  readonly measured: number;
  readonly equalityPinned: number;
  readonly checked: readonly { readonly id: string; readonly recorded: number; readonly today: number }[];
  readonly divergence: number;
  readonly whyNotHere: string;
} {
  const contractPath = "packages/test-utils/src/dead-export-ledger.test.ts";
  const absolute = join(baseDir, contractPath);
  const contract = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  const measured = DEAD_EXPORT_BLIND_SPOTS.filter((spot) => spot.measure !== undefined);
  const equalityPinned = measured.filter((spot) => contract.includes(`toBe(${spot.value})`)).length;
  const valueOf = (id: string): number =>
    DEAD_EXPORT_BLIND_SPOTS.find((spot) => spot.id === id)?.value ?? -1;
  const checked = [
    { id: "tsx-components", recorded: valueOf("tsx-components"), today: tsxExportFunctionCount(baseDir) },
    {
      id: "jsx-apostrophe-string-masking",
      recorded: valueOf("jsx-apostrophe-string-masking"),
      today: apostropheBearingCallsiteFiles(baseDir).length
    }
  ];
  return {
    spots: DEAD_EXPORT_BLIND_SPOTS.length,
    measured: measured.length,
    equalityPinned,
    checked,
    divergence: checked.filter((row) => row.recorded !== row.today).length,
    whyNotHere:
      "⚠️⚠️ **이 대장은 그 등호를 옮겨 오지 않는다 — 고르지 않은 길도 값이다.** 사문 대장의 여섯은 " +
      "*저장소의 크기*를 재는 수라 라운드가 지나도 잘 움직이지 않지만, 이 대장의 열다섯은 " +
      "**F가 판정 문서를 정직하게 쓸 때마다 자라는 수**다(`prose-only` 184 → 246 · `round-notes` " +
      "377 → 468 · `elapsed-truth` 70 → 102). 등호를 세우면 F가 조건을 하나 더 적는 걸음마다 " +
      "빨개지고, 그때 다음 사람이 고르는 쉬운 길은 **문서를 계약에 맞추는 것**이다 — 이 대장이 " +
      "태어날 때부터 막으려던 그 뒤집힘이다. 그래서 여기서 고른 길은 셋째다: **값을 자에서 " +
      "파생시키고, 옛 값은 두 시점으로 남기고, 갈림의 크기를 값으로 센다.**"
  };
}

/**
 * ⚠️ **대조군 — 자가 하나도 없는 대장**(`comment-tolerant-anchor-ledger.ts`).
 *
 * 그 대장의 사각 **일곱**은 `measuredLowerBound`라는 **손이 적은 수**만 지고 `measure`가 **0건**이라,
 * *적힌 값과 오늘의 자가 갈렸는가*라는 이 자의 물음이 **성립하지 않는다**. 그 사실을 사각
 * `measureless-ledgers-outside`가 값으로 진다.
 */
export function measurelessLedgerControl(baseDir: string = repoRoot): {
  readonly path: string;
  readonly spots: number;
  readonly measures: number;
} {
  const path = "packages/test-utils/src/comment-tolerant-anchor-ledger.ts";
  const absolute = join(baseDir, path);
  const source = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  return {
    path,
    spots: ANCHOR_BLIND_SPOTS.length,
    measures: (source.match(/\bmeasure\s*:/g) ?? []).length
  };
}

/** 이 대장 **밖**에서 사각 목록을 지고 있는 파일 — ⚠️ 걷어서 낸다(손 목록 금지). */
export function otherBlindSpotLedgers(baseDir: string = repoRoot): readonly string[] {
  const directory = "packages/test-utils/src";
  const absolute = join(baseDir, directory);
  if (!existsSync(absolute)) return [];
  const selfFiles = LEDGER_SELF_FILES as readonly string[];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => `${directory}/${entry.name}`)
    .filter((path) => !selfFiles.includes(path))
    .filter((path) => readFileSync(join(baseDir, path), "utf8").includes("BLIND_SPOT"))
    .sort();
}

/**
 * ⚠️ **산문이 옛 수를 지고 있는 자리** — 값은 파생으로 고쳤지만 *문장*은 그대로다.
 *
 * 자리마다 `what`·`why`가 **적힌 값을 숫자로** 담고 있으면서 그 적힌 값이 오늘의 자와 갈리면
 * 그 문장은 오늘 거짓이다. ⚠️ **오차 방향은 조용한 쪽**(거짓 초록): 한글 수사로 적힌 수
 * (*'오늘 창 열둘'*)는 이 자가 보지 못한다.
 */
export function staleProseBlindSpots(baseDir: string = repoRoot): readonly string[] {
  const stale: string[] = [];
  for (const { spot } of allBlindSpots()) {
    const record = latestRecord(spot);
    if (record === undefined) continue;
    const today = spot.measure(baseDir);
    if (today === record.value) continue;
    const prose = `${spot.what} ${spot.why}`;
    if (new RegExp(`(^|[^0-9])${record.value}([^0-9]|$)`).test(prose)) stale.push(spot.id);
  }
  return stale;
}

/** ⚠️ *아래쪽이 좋은 방향*이라고 자기 문장이 적어 둔 자리 — 오르는 쪽 래칫이 막을 수 있는 손. */
export function downwardGoodBlindSpots(): readonly string[] {
  return allBlindSpots()
    .filter(({ spot }) => /좋은 방향/.test(`${spot.what} ${spot.why} ${spot.reopenCondition}`))
    .map(({ spot }) => spot.id);
}

/**
 * ⚠️⚠️ **자를 둘 수 없는 자리의 증거** — 라운드 94 트랙 B가
 * `apps/mobile/src/screen-header-back.test.ts`에 세운 `UncountableEvidence`의 꼴을 **인용한다**
 * (그 파일은 읽기만 했고 바이트를 한 글자도 만지지 않았다 · 복사가 아니라 같은 사실을 각자 파생).
 * 크기 대신 *무엇을 세려 했는가*·*왜 소스에 없는가*·*0의 뜻*을 진다.
 */
export type UncountableRecordEvidence = {
  readonly wantedToCount: string;
  readonly missingFromSource: string;
  readonly zeroMeans: string;
};

/**
 * 이 기록 축이 새로 지는 사각.
 *
 * ⚠️ **자와 증거는 함께 서지 않는다** — 자가 있는 자리는 `uncountable`을 지지 않고, 자를 둘 수 없는
 * 자리는 `measure`·`floor`를 **아예 두지 않는다**(`() => 0`은 상수를 함수로 포장한 것이라 병이
 * 그대로다 · 라운드 94 트랙 B의 판단 그대로).
 */
export type RecordingBlindSpot = {
  readonly id: string;
  readonly what: string;
  readonly why: string;
  readonly measure?: (baseDir: string) => number;
  readonly floor?: number;
  readonly uncountable?: UncountableRecordEvidence;
  readonly reopenCondition: string;
};

/**
 * ⚠️ **이 축이 지는 사각 다섯** — 값과 하한으로 선다(AB-5의 규율).
 *
 * ⚠️⚠️ **남의 사각 목록에 얹지 않는다**: `LEDGER_BLIND_SPOTS` 여덟 · `sourceNeedleBlindSpots()` 넷 ·
 * `ELAPSED_BLIND_SPOTS` 셋의 **길이는 오늘 한 칸도 움직이지 않았고**, 그 열다섯에서 이 트랙이
 * 바꾼 것은 **값이 사는 꼴**(상수 → 파생)과 **옛 값의 자리**(→ `recorded`)뿐이다.
 */
export function recordingBlindSpots(): readonly RecordingBlindSpot[] {
  return [
    {
      id: "measureless-ledgers-outside",
      what:
        "⚠️⚠️ **자가 없는 대장은 이 자 밖이다** — `comment-tolerant-anchor-ledger.ts`의 사각 " +
        "**일곱**은 `measure`가 **0건**이라(손이 적은 `measuredLowerBound`만 진다) *적힌 값과 " +
        "오늘의 자가 갈렸는가*라는 물음 자체가 **성립하지 않는다.** 라운드 95 정찰이 그 대장 칸에 " +
        "*'잴 수 없다'* 고 적은 그 자리이고, 이 자는 그 일곱을 **갈림 0이 아니라 모집단 밖**으로 든다.",
      why:
        "갈림을 세려면 두 수가 있어야 한다 — 적힌 값 하나와 오늘의 자 하나. 자가 없으면 두 번째 수가 " +
        "없고, 없는 수를 0으로 읽으면 *갈리지 않았다*는 거짓이 조용히 선다(`elapsedNumeral`이 " +
        "모르는 낱말을 0으로 읽지 않는 그 규율의 사각 판이다). ⚠️ 그 일곱에 자를 붙이는 것은 남의 " +
        "파일을 여는 일이고, **한 트랙이 남의 대장을 열지 않는다.**",
      measure: (baseDir) => {
        const control = measurelessLedgerControl(baseDir);
        return control.spots - control.measures;
      },
      floor: 1,
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 앵커 대장의 사각에 자를 붙일지를 그 파일을 소유한 " +
        "트랙이 정하는 날 — 그날 그 일곱이 이 자의 모집단으로 들어오고, 첫 모집단은 오늘의 일곱이다."
    },
    {
      id: "which-side-is-right",
      what:
        "⚠️⚠️ **이 자는 *갈렸다*까지만 보고 *어느 쪽이 옳은가*를 묻지 않는다** — 오늘 갈린 여덟 " +
        "자리에서 틀린 것이 *적힌 값*인지 *오늘의 자*인지를 이 그물은 한 자리도 판정하지 않는다.",
      why:
        "옳음은 **문장의 뜻**이지 소스의 바이트가 아니다 — `round-notes`의 468이 옳은 이유는 노트가 " +
        "석 벌 늘었기 때문이고, 그 사실은 이 대장이 아니라 사람이 안다. ⚠️ 그리고 그 판정을 자로 " +
        "만들려면 *사각의 이름이 오늘도 같은 것을 가리키는가*를 먼저 물어야 하는데, 그것은 다음 " +
        "줄(`stale-prose-not-value`)이 이름 붙인 더 큰 병이다.",
      uncountable: {
        wantedToCount:
          "갈린 여덟 가운데 **적힌 값이 틀렸던 자리의 수**와 **오늘의 자가 틀린 자리의 수** — 그 둘이 " +
          "있어야 *갈림이 낡음인가 병인가*를 값으로 말할 수 있다.",
        missingFromSource:
          "소스에는 두 수와 두 시점만 있고 **어느 쪽이 옳은지를 가르는 바이트가 없다.** 옳음을 " +
          "세려면 사각의 이름이 가리키는 대상이 그 사이에 바뀌지 않았음을 알아야 하는데, 그 앎은 " +
          "라운드 노트와 판정 문서의 **문장**에 있지 이 대장의 모집단에 없다 — 걷기의 문제가 아니라 " +
          "**모집단의 문제**다(라운드 94 트랙 B가 같은 자리에서 쓴 말이다).",
        zeroMeans:
          "⚠️⚠️ **여기서 판정 0건은 *다 옳다*가 아니라 *셀 수 없다*는 뜻이다.** 이 자가 오늘 낸 " +
          "여덟은 *여덟이 틀렸다*가 아니라 **여덟이 갈렸다**이고, 그 갈림의 절반 이상은 문서가 " +
          "정직하게 자란 몫이다(F가 절을 더할 때마다 오르는 수들이다)."
      },
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 사각의 이름이 가리키는 대상이 바뀌었는지를 값으로 " +
        "가르는 관례가 서는 날 — 그날 이 자는 *갈렸다* 옆에 *어느 쪽이 옳은가*를 함께 물 수 있다."
    },
    {
      id: "stale-prose-not-value",
      what:
        "⚠️⚠️ **값은 파생으로 고쳤지만 *산문*은 아직 옛 수를 지고 있다**(AH-3이 이름 붙인 병의 " +
        "세 번째 얼굴). 사각의 `what`·`why`가 *'노트 쉰한 벌에 377'* 처럼 옛 실측을 문장으로 " +
        "담고 있고, `valueToday`가 파생이 된 오늘도 **그 문장은 여전히 손이 적은 수**다. " +
        "⚠️ 이 자는 그 가운데 **오늘의 자와 갈린 수를 담은 자리만** 센다.",
      why:
        "문장을 자로 만들려면 문장의 어느 수가 *오늘의 값*이고 어느 수가 *그 라운드의 기록*인지를 " +
        "갈라야 하는데, 이 대장의 관례는 옛 수를 **일부러** 문장에 남기는 것이다(두 시점 · AE-3) — " +
        "그래서 *낡은 산문*과 *기록으로 남긴 산문*이 같은 낯으로 읽힌다. ⚠️ **오차 방향은 조용한 " +
        "쪽이다**: 한글 수사로 적힌 수(*'오늘 창 열둘'*)는 이 자가 보지 못한다.",
      measure: (baseDir) => staleProseBlindSpots(baseDir).length,
      floor: 0,
      reopenCondition:
        "⚠️ 재개 조건(사건형): 사각의 문장이 *오늘의 값*을 숫자로 적지 않고 자에게 미루기 시작하는 " +
        "날 — 그날 이 수가 0으로 내려가고, 그것이 이 병이 닫히는 신호다. ⚠️ 0으로 내려가는 것이 " +
        "**좋은 방향**이라 하한을 0으로 둔다."
    },
    {
      id: "only-this-ledger",
      what:
        "⚠️ **이 자는 이 대장 하나만 본다** — 저장소에서 사각 목록을 지고 있는 다른 파일 **여섯**은 " +
        "밖이다(사문 대장 · 앵커 대장 · 계약 그물 대장 · 접근성 체크표 · 그 짝 계약 둘). " +
        "그 여섯 가운데 자를 지닌 것은 사문 대장뿐이고, 나머지의 적힌 값이 오늘의 자와 갈렸는지는 " +
        "**아무도 세지 않는다.**",
      why:
        "저장소의 모든 대장으로 넓히면 이 트랙의 축이 *한 파일*이 아니라 **저장소 전체**가 된다 — " +
        "라운드 95의 배정 규율(AI-2의 답)이 정확히 그것을 막는다. ⚠️ 그리고 그 여섯은 여섯 트랙의 " +
        "소유라 남의 파일을 여는 일이기도 하다.",
      measure: (baseDir) => otherBlindSpotLedgers(baseDir).length,
      floor: 2,
      reopenCondition:
        "⚠️ 재개 조건(결정형 · 손은 저장소 안): 사각의 값을 자에서 파생시키는 것이 저장소 관례로 " +
        "서는 날(결정형 #25의 옆 물음) — 그날 첫 모집단은 오늘의 여섯이다."
    },
    {
      id: "recorded-ratchet-blocks-good-hand",
      what:
        "⚠️⚠️ **오르는 쪽 래칫이 옳은 손을 막을 수 있는 자리 넷** — `folded-notation` · " +
        "`three-needle-residual` · `emphasis-axis-not-opened` · `prose-elapsed`는 자기 문장에 " +
        "*이 수가 0으로 내려가는 것은 **좋은 방향***이라고 적어 두었다. 그 자리가 정당하게 줄면 " +
        "`recordedRatchetViolations`가 빨개진다.",
      why:
        "⚠️ **그래도 래칫을 끄지 않는 이유는 그날의 고침이 한 줄이기 때문이다** — 하한을 내리는 것이 " +
        "아니라 `recorded`에 **시점 하나를 더하는 것**이고, 그것이 이 대장이 지키려는 바로 그 일" +
        "(*언제 무엇이 참이었는지를 남기는 것*)이다. ⚠️ 반대로 래칫을 끄면 값이 조용히 낡던 그 " +
        "자리로 돌아간다 — 오늘 여덟이 갈려 있었는데 아무 소리도 나지 않았던 것이 그 증거다.",
      measure: () => downwardGoodBlindSpots().length,
      floor: 1,
      reopenCondition:
        "⚠️ 재개 조건(사건형): 그 넷 가운데 하나가 실제로 줄어 이 래칫이 처음 빨개지는 날 — 그날 " +
        "사람이 볼 것은 *조건이 소진된 것인가, 이름이 틀렸던 것인가*이고, 어느 쪽이든 고칠 곳은 " +
        "하한이 아니라 그 자리의 기록이다."
    }
  ];
}
