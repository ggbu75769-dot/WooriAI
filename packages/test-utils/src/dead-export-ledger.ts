// 라운드 87 트랙 E (GAP-087 #5) — **호출부 0건인 export**의 사문 대장.
//
// 라운드 86 트랙 A가 `itemListBadgeLabel` 하나를 걷어 내면서 그 옆에 같은 모양이 더 있는지 묻지
// 않았다. 정찰이 세어 보니 **열일곱**이고, **열일곱 다 테스트 참조가 있다** — 즉 전부 *"계약만
// 초록인데 아무도 부르지 않는다"* 이다. 그리고 **이유가 소스에 적힌 것은 둘뿐**이다.
//
// ⚠️⚠️ **오늘 대장에 서는 것은 열여섯이다** — 정찰의 열일곱 중 `hasAnyAuditLogFilter` 하나를
// **같은 라운드의 트랙 A가 되살렸다**(`apps/admin/src/lib/audit-log-rows.ts`가 감사 로그 빈 표의
// 두 문장을 가르며 그 술어를 부른다). 이 대장은 **정찰의 수가 아니라 최종 실측**을 싣는다 —
// 정찰의 열일곱을 그대로 못 박았으면 이 계약은 태어나자마자 유령 행 하나를 들고 빨간 채로 살았고,
// 그때 사람이 하는 일은 수를 고치는 것뿐이라 계약이 아무것도 지키지 못한다. ⚠️ 그리고 이 한 건이
// 이 대장의 존재 이유를 그대로 보여 준다: **호출부 0건인 판정은 결함이 아니라 아직 배선되지 않은
// 답이고, 그 목록이 값으로 서 있으면 옆 트랙이 그중 하나를 집어 든다.**
//
// ⚠️ **이 라운드가 하는 일은 지우는 것이 아니라 세는 자리를 세우는 것이다.** 제품 소스는 0건
// 고쳤다(열여섯 중 하나도 지우거나 주석을 달지 않았다 — 지우는 판단은 이 자리가 선 다음이고,
// 그 판단은 항목마다 다르다: `isNamedImportFailure`처럼 소스가 *"지우지 않는다"* 고 못 박은 것도,
// `updateContentRevisionDraft`처럼 계약의 문장이 거짓에 가까워진 것도 같은 목록에 있다).
//
// ## ⚠️ 결정 ① — 무엇을 **호출부**로 볼 것인가 (`CALLSITE_DEFINITION`)
//
// 호출부는 **제품 소스**다: `apps/mobile/app/**`·`apps/mobile/src/**`·`apps/admin/app/**`·
// `apps/admin/src/**`의 비테스트 `.ts`/`.tsx` 전수이고, **선언한 자기 파일까지 포함한다.**
// 그 전수 어디에도 이름이 (선언 줄 자신을 빼고) 한 번도 나오지 않으면 호출부 0건이다.
//
// ⚠️ 자기 파일을 호출부에 **넣는** 이유: 같은 파일 안에서만 쓰이는 함수는 사문이 아니라 그냥
// 잘못 export된 함수다(판정이 다르고, 고치는 손도 다르다). ⚠️ 테스트를 호출부에서 **빼는**
// 이유: 이 대장이 세는 것이 정확히 *"테스트만 부른다"* 이기 때문이다 — 테스트를 호출부로 세면
// 이 대장의 모집단은 첫날부터 0건이 된다.
//
// ## ⚠️ 결정 ② — 무엇을 **모집단**으로 볼 것인가 (`POPULATION_DEFINITION`)
//
// 모집단은 **`export function` 선언 + `export const` 선언**이다: 모바일 `apps/mobile/src/**/*.ts`
// (테스트 · `local-backend` · `local-fixtures` 제외)와 어드민 `apps/admin/src/lib/**/*.ts`(테스트 제외).
//
// ⚠️ **라운드 89 트랙 C가 `export const` 축을 모집단으로 들였다** — 라운드 87·88이 그 축을 밖에
// 둔 이유(*"넣으면 계약 전용 데이터 모듈이 첫날부터 면제부가 된다"*)는 사라지지 않았고, 대신
// **그 면제가 손 목록이 아니라 파생 판정이 됐다**(아래 결정 ③). 그 두 라운드가 사각 칸에 적어 둔
// 재개 조건 *"계약 전용 데이터 모듈을 **뿌리에서** 가르는 판정이 서는 날 — 그날 이 축이 모집단으로
// 들어온다"* 가 오늘 발동했다.
//
// ⚠️ **먼저 모집단, 그다음 바늘.** 뿌리는 계약이 **실재와 산출을 함께 확인한다** — 손으로 배열한
// 목록은 뿌리가 아니고, 빈 모집단 위에서는 *"사문이 스물둘을 넘지 않는다"* 가 언제나 참이다.
//
// ## ⚠️⚠️ 결정 ③ — 무엇을 **계약 전용 데이터**로 볼 것인가 (`CONTRACT_ONLY_AXES`) · 라운드 89 트랙 C
//
// 라운드 88까지 이 판정은 `CONTRACT_ONLY_DATA_MODULES` **손 목록**이었다: 경로 다섯과 이유 다섯을
// 사람이 적고, 계약은 *"그 다섯이 실재하는가"* 만 물었다. 그것이 AB-4가 이름 붙인 착시의 모양이다 —
// **적은 사람이 옳았는지는 아무도 묻지 않는다.** 실제로 그 손 목록의 이유 한 줄은 오늘 거짓이었다
// (`offline/messages.ts`의 이유가 *"여기 남은 사문 셋은 문장 자체가 아니라 무엇을 세는지 말하는
// 값"* 이라고 적었는데, 그 셋 중 `SYNC_STATUS_RETRY_ALL_LABEL`은 **사용자에게 그려지는 라벨**이다).
//
// 그래서 오늘의 판정은 **모듈 자신의 소스에서 파생**하고, 근거를 값으로 들고 다닌다. 축은 둘이고
// **둘 중 하나라도 서면 면제**다(`contractOnlyDataProof`):
//
//  ⓐ **번들 밖**(`bundle-excluded` · 모듈 축) — **제품 소스 어느 파일도 이 모듈을 import하지
//    않는다**(정적 `from` · 동적 `import(…)` · `require(…)` 전수 · 주석은 마스킹). 그러면서
//    **계약 파일은 import한다.** 즉 이 모듈은 앱 번들에 실리지 않고 계약만 읽는다 —
//    `offline-aware-screens.ts` 머리말이 *"화면 코드가 import하지 않는다(계약 전용 데이터라 앱
//    번들에 실리지 않는다)"* 고 적어 둔 그 사실을, **그 문장을 믿지 않고 import 그래프로** 확인한다.
//    ⚠️ 이 축이 손 목록과 다른 점이 정확히 여기다: 머리말에 같은 문장을 복사해 붙여도 화면이 그
//    모듈을 import하는 순간 면제가 사라진다. **표식이 아니라 사실이 판정한다.**
//
//  ⓑ **자리 표**(`locator-table` · 선언 축) — 이 상수의 **최상위 원소 전수**가 **제품 소스의 한
//    자리를 가리킨다**: 실재하는 소스 파일 경로(`app/(tabs)/reports.tsx`) · 실재하는 라우트
//    (`/settings/privacy`) · 제품 소스가 `export`로 선언한 식별자(`createExpenseOffline`).
//    그런 값은 *제품이 쓰는 값*이 아니라 **계약이 제품을 재려고 드는 자**다. ⚠️ 원소 하나라도
//    풀리지 않으면 표가 아니다 — 그래서 도메인 코드 목록(`ANALYTICS_CATEGORY_CODES`)이나 걸음
//    이름(`IMPORT_FAILURE_KINDS`)은 이 축으로 면제되지 않는다(그 문자열들은 제품 소스의 자리를
//    가리키지 않는다). ⚠️ 근거(`evidence`)는 **풀린 자리 전수**이고, 계약이 그 자리들이 오늘도
//    실재하는지 다시 본다 — 유령 근거는 면제가 아니다.
//
// ⚠️ **면제는 지우는 판단이 아니다.** 면제된 자리는 대장에 줄을 갖지 않지만 사문 전수
// (`findDeadExports`)에는 그대로 남고, 그 수·모듈 수·중복이 ⓓ에서 함께 대조된다. 면제되지 않은
// 자리는 **이유가 소스에 있거나 대장에 줄이 있어야 한다** — 그 규율은 `export function` 축과 같다.
//
// ## ⚠️ 열여섯이 갈리는 셋 (`DeadExportReasonKind`)
//
//  ⓐ **이름이 자기를 고백하는 것**(`reset*` · `*ForTests` · `__*`) — 이름이 이미 이유다.
//  ⓑ **이유가 소스에 적힌 것** — `⚠ **테스트 전용 export**(라운드 71 리뷰 S-8) … **지우지 않는다**`
//     관례. ⚠️ **이 대장은 그 이유가 실제로 그 파일에 있는지 소스로 확인한다**(`sourceReasonProof`).
//  ⓒ **이유가 대장에만 있는 것** — 소스에 아무 말이 없어서 **여기에 적는다**. ⚠️ 그 이유는 빈
//     문자열일 수 없고, *"왜 화면이 부르지 않는가"* 를 말해야 한다(*"안 쓴다"* 는 이유가 아니다).
//
// ## ⚠️ 라운드 88 트랙 D — 갈래가 **5 / 2 / 9**에서 **5 / 11 / 0**이 됐다
//
// 라운드 87이 남긴 것은 *"이유가 대장에만 있는 아홉"* 이었고, 그 아홉은 **대장을 읽어야만** 왜
// 화면이 부르지 않는지 알 수 있었다. 라운드 88 트랙 D가 그 아홉의 이유를 **소스 주석으로 옮겼다**
// (제품 소스에 더한 것은 **주석 한 덩이씩 아홉**뿐 — 코드·문자열·export 값은 바이트 그대로다).
// 그래서 오늘 `reason-in-ledger`는 **0건**이고, 그 갈래가 사라진 것이 아니라 **비어 있는 것**이다:
// 새 사문이 소스에도 이름에도 아무 말 없이 생기면 그 항목은 다시 이 갈래로 떨어진다.
//
// ⚠️⚠️ **그 이동에는 순서가 있었고, 순서가 계약의 전부였다.** 이유 주석은 *"화면이 왜
// `supportLinkUrl`을 부르지 않는가"* 를 적으므로 **그 export의 이름을 부를 수밖에 없다.** 옛 그물은
// 주석을 마스킹하지 않았으므로 **이유를 적는 순간 그 항목이 사문 목록에서 조용히 사라졌다** —
// 아홉이 래칫 아래로 빠지고 계약은 아무것도 지키지 못한 채 초록이 된다. 그래서 트랙 D는
// **먼저 `findProductReferences`에 마스킹을 가르치고, 그다음 주석을 적었다.** 오늘의 실측이 그
// 순서를 값으로 증명한다: **마스킹판 16 · 마스킹 없는 옛 그물 7**(사라졌을 아홉이 정확히 그 차다).
//
// ⚠️ **실측이 정찰(round87-scout #5 ⓐ)과 갈린 자리 셋** — 값으로 남긴다:
//  · **명단이 열일곱이 아니라 열여섯이다**(위 머리말 — 트랙 A가 `hasAnyAuditLogFilter`를 되살렸다).
//    ⚠️ 나머지 열여섯의 **이름과 자리는 정찰과 정확히 같다** — 트랙 E가 정찰의 목록을 옮겨 적은 것이
//    아니라 같은 조건으로 **다시 세어서** 같은 답이 나왔다(모집단·호출부를 코드로 걷는다).
//  · **이름이 고백하는 것은 여섯이 아니라 다섯이다.** 정찰은 여섯으로 적었지만 `reset*`·`*ForTests`
//    모양은 다섯뿐이고(`__resetAnalyticsClientForTests`·`resetImportBulkRuns`·`resetLocalDevicesForTests`·
//    `resetPushRegistrationForTests`·`resetAppQueryClientRegistryForTests`), 그래서 라운드 87의 갈래는
//    **5 / 2 / 9**였다(정찰의 셈은 6 / 2 / 9였고 그 아홉에는 되살아난 하나가 들어 있었다).
//    ⚠️ **라운드 88 트랙 D 이후의 갈래는 5 / 11 / 0이다**(위 문단 — 다섯은 그대로다).
//  · **어드민 모집단의 수가 정찰과 다르다.** 정찰은 `apps/admin/src/lib/**`를 확장자 구별 없이 세어
//    146을 얻었는데 그중 둘이 `admin-token-context.tsx`의 컴포넌트 export다(둘 다 화면이 부른다).
//    이 대장은 `.tsx`를 모집단 밖에 두므로 그날의 같은 자리가 144였고, 라운드 87이 다시 재니 147이었다
//    (트랙 A가 `audit-log-rows.ts`를 세우며 셋을 더했다). ⚠️ **사문 수는 그 셋과 무관하게 움직였다** —
//    새 파일이 사문을 만든 것이 아니라 **있던 사문 하나를 불렀다.** ⚠️ **라운드 88 트랙 D가 다시 재니
//    148이다**(모집단 전체로는 1018) — 같은 라운드의 트랙 A가 어드민 `src/lib`에 계속 더하는 중이라
//    **이 수는 라운드가 끝나기 전에는 굳지 않는다.** 그래서 계약이 무는 것은 이 수가 아니라 하한이다.
//
// ## ⚠️ 라운드 89 트랙 C — 모집단이 **1019 → 1671**, 대장이 **16 → 22**가 됐다
//
// ⚠️⚠️ **늘어난 여섯은 새 부채가 아니라 세는 자리가 늘어난 것이다**(라운드 88 트랙 D가 세운 형식).
// 오늘 실측: `export const` **652 중 24**가 호출부 0건이고, 그중 **18**이 결정 ③의 파생 판정으로
// 면제되며, **남은 여섯**이 대장에 줄을 얻는다. `export function` 축의 열여섯은 **한 줄도 움직이지
// 않았다** — 지운 export 0건 · 되살린 export 0건이고, 제품 소스에 더한 것은 **주석 두 덩이**뿐이다
// (`analytics/events.ts` · `offline/sqlite-offline-store.ts` — 코드·문자열·export 값 바이트 불변).
//
// ⚠️ **정찰(round89-scout #3)의 전제와 갈린 자리 하나** — 값으로 남긴다:
//  · 정찰은 면제가 **17 → 19**가 되고 *"사람이 판단할 자리는 다섯"* 이라고 적었다. 오늘 파생
//    판정의 실측은 **면제 18 · 판단할 자리 여섯**이다. 갈린 이유는 `offline/messages.ts`의
//    `SYNC_STATUS_RETRY_ALL_LABEL`이다: 정찰은 손 목록의 이유("이 모듈에 남은 사문 셋은 계약이
//    읽는 값")를 **그대로 믿고** 셋을 다 면제 쪽으로 셌지만, 파생 판정은 그 상수가 제품의 자리를
//    하나도 가리키지 않는다는 사실을 보고 면제를 **주지 않는다.** ⚠️ 그리고 그 판정이 옳다 —
//    그 라벨은 `전체 재시도`라는 **사용자 문장**이고, 화면(`app/sync-status.tsx`)은 라운드 58 #4
//    이후 더 좁은 라벨(*"지출 3건 재시도"*)로 갈아탔다. **손 목록이 가리고 있던 자리가 정확히
//    하나 있었고, 파생 판정의 첫 산출이 그 하나를 꺼냈다.**
//
// ⚠️ **그래서 셋째 갈래(`reason-in-ledger`)가 다시 산다.** 라운드 88 뒤 그 갈래는 0건이었고
// 계약은 *"사라진 것이 아니라 비어 있다"* 고 적어 두었다. 오늘 그 갈래에 둘이 선다 —
// `SYNC_STATUS_RETRY_ALL_LABEL`(그 파일은 이 트랙의 소유가 아니라 **읽기만** 한다)과
// `FAILED_ROW_LOCAL_ID_PARAM`(⚠️ **테스트조차 부르지 않는다** — 아래 ⓒ 참고).
//
// ## ⚠️⚠️ 라운드 90 트랙 C — 그물이 **문자열 리터럴 축**을 배웠다 (사문 **40 → 44** · 대장 **+0**)
//
// 라운드 89 트랙 C는 사각 `string-literal-references`의 재개 조건을 **발동시킨 채로 넘겼다**:
// *"재개 조건(사건형): *참조가 전부 문자열뿐인 export*가 0을 넘는 날 — 그날 이 그물은 문자열도
// 마스킹해야 한다"* 였고, 축을 넓히니 그 수가 0에서 **넷**이 됐다. 라운드 89는 *"한 트랙이 한
// 그물에 축 둘을 얹지 않는다"* 는 규율 때문에 그 문을 열지 않고 **값만 정확히 적어** 넘겼다.
// 오늘 트랙 C가 그 문 하나만 연다(⚠️ JSX 판정 `tsx-components`는 오늘도 무접촉이다 — 같은 규율).
//
// ⚠️ **계약 ⓑ 전후 대조 — 두 수를 한 낱말로 적지 않는다**(라운드 88 D의 형식):
//  · **마스킹 전**(주석만 지우던 라운드 88·89의 그물) — 사문 **40**(함수 16 · 상수 24).
//  · **마스킹 후**(오늘의 그물) — 사문 **44**(함수 **16** · 상수 **28**).
//  ⚠️ **함수 축 열여섯은 한 자리도 움직이지 않았다** — 늘어난 넷은 전부 `export const` 축이다.
//
// ⚠️ **계약 ⓒ 넷의 처분 — 라운드 89 C의 예상은 0이었고, 실측도 0이다.** 그 넷
// (`shared-cache-policy.ts`의 `CHILDREN_WRITE_APIS` · `CHILDREN_WRITE_LEDGER` ·
// `SHARED_KEY_COVERAGE` · `EXPENSE_WRITE_LEDGER`)은 전부 결정 ③ 축 ⓑ(**자리 표**)로 떨어졌다:
// **대장의 줄은 22 → 22로 0이 늘었고**, 면제가 **18 → 22**, 그중 자리 표 축이 **11 → 15**로
// 늘었다. ⚠️ **모듈 수는 6 그대로다** — `shared-cache-policy.ts`는 넷이 들어오기 전에도 이미
// 다른 상수로 면제 쪽에 서 있던 모듈이라 새 모듈이 생기지 않았다(예상과 실측이 갈리지 않은
// 자리도 값으로 적는다 — 갈리지 않았다는 사실 자체가 다음 라운드의 근거다).
//
// ⚠️⚠️ **템플릿 `${…}` 갈래는 지우지 않는다.** 문자열 마스킹이 템플릿을 통째로 지우면
// `` `${searchResultCountAnnouncement(count)} 건` `` 같은 **살아 있는 호출부가 사라져 사문이
// 거짓으로 는다** — 이 대장이 지금껏 낸 적 없는 방향의 오차(거짓 빨강)다. 그 갈래는 오늘 저장소에
// 그 모양이 있느냐와 무관하게 **합성 소스로** 증명한다(계약 ⓐ · `dead-export-ledger.test.ts`의
// ⓘ 절). 마스킹의 형식 본보기는 `comment-tolerant-anchor-ledger.ts`의 스캐너다(읽기만 했다).
//
// ⚠️ **래칫은 22 그대로다.** 세는 자리가 넷 늘었는데 값이 그대로인 이유는 그 넷을 파생 판정이
// 면제했기 때문이고, 그 사실은 `RATCHET_HISTORY`의 라운드 90 줄이 값으로 진다 — **래칫을 내리는
// 유일한 옳은 길은 항목이 실제로 걷히거나 호출부를 얻는 것**이라는 문장은 오늘도 그대로다.
//
// ⚠️ **제품 소스 0건 변경**(주석 포함). 라운드 88 D는 아홉 파일에, 89 C는 두 파일에 주석을
// 더했지만 오늘 트랙 C가 연 것은 **판정 축 하나**뿐이다.
//
// ## ⚠️ 이 그물이 무는 것의 한계 — **이름의 텍스트**이지 **해석된 참조**가 아니다
//
//  · 이름으로 훑으므로 **흔한 이름을 가르지 못한다**(AA-4가 이름 붙인 그 사각). 속성 접근
//    (`api.listItems`)이나 객체 키(`listItems:`)도 한 번의 텍스트 일치이고, 이 그물은 그것을 호출과
//    구별하지 못한다 — 그 방향의 오차는 **사문을 놓치는 쪽**이다(거짓 초록이지 거짓 빨강이 아니다).
//  · 동적 접근(`registry["legalDocumentUrl"]`)·배럴 재export도 텍스트 한 번으로 보인다.
//  · ⚠️⚠️ **문자열 리터럴은 라운드 90부터 마스킹한다** — 그래서 *"이름이 문자열 안에 있기만 해도
//    호출부 1건"* 이라는 거짓 초록은 닫혔고(사각 `string-literal-references`는
//    `CLOSED_BLIND_SPOTS`로 옮겼다), **대신 반대 방향의 사각이 열렸다**: 이름에 오직 문자열로만
//    닿는 자리(`registry["legalDocumentUrl"]` 꼴의 동적 접근·문자열 열쇠)는 이제 참조로 세지
//    않으므로 **살아 있는 export가 사문으로 세어질 수 있다(거짓 빨강)**. 오늘 실피해는 0건이고,
//    그 표면의 하한 55는 사각 `string-keyed-dynamic-access`가 진다.
//    ⚠️ **템플릿 `${…}` 안은 지우지 않는다** — 그 안은 진짜 코드이고, 지우면 살아 있는 호출부가
//    사라진다(합성 소스로 증명한다).
//    ⚠️ **주석은 라운드 88부터 마스킹한다**(라운드 87 리뷰 L-1이 연 자리 · 사각
//    `comment-and-string-references`가 그 재측정을 진다 — 오늘 마스킹판 40 · 옛 그물 20).
//  · `.tsx`의 컴포넌트 export와 `apps/api/**`·`packages/**`는 오늘 모집단 밖이다.
//  이 한계를 값으로 적어 두는 이유는 다음 사람이 이 파일을 *"사문이 스물둘뿐이라는 증명"* 으로
//  읽지 않게 하기 위해서다 — 이것은 **스물셋 번째가 생길 때 소리가 나는 자리**다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/** 이 실측이 선 날 — 아래 수들이 언제의 값인지 말한다. */
export const MEASURED_ON = "2026-08-31";

/**
 * 이 대장 자신의 두 파일 — 계약 ⓕ가 읽는다.
 *
 * ⚠️ **대장은 자기를 모집단에 넣지 않는다.** 이 파일들은 사문 이름 열여섯을 **값으로** 싣고 있어서,
 * 모집단에 들어오는 순간 자기 자신이 자기 항목의 호출부가 된다(그리고 열여섯이 전부 조용히
 * 사라진다). 오늘은 경로상 이미 모집단 밖이지만(`packages/**`), 그 사실에 기대지 않고 값으로
 * 못 박는다 — 뿌리가 넓어지는 날 이 배제가 먼저 서 있어야 한다.
 */
export const LEDGER_SELF_FILES = [
  "packages/test-utils/src/dead-export-ledger.ts",
  "packages/test-utils/src/dead-export-ledger.test.ts"
] as const;

/** ⚠️ 결정 ① — 값으로 적힌 호출부의 정의(계약 ⓐ가 이 문장이 비어 있지 않은지 센다). */
export const CALLSITE_DEFINITION =
  "호출부는 **제품 소스**다 — apps/mobile/app/** · apps/mobile/src/** · apps/admin/app/** · apps/admin/src/** 의 " +
  "비테스트 .ts/.tsx 전수이고, **선언한 자기 파일까지 포함한다**. 그 전수 어디에도 이름이 (선언 줄 자신을 빼고) " +
  "한 번도 나오지 않으면 호출부 0건이다. 테스트 파일은 호출부가 아니다 — 이 대장이 세는 것이 정확히 " +
  "'테스트만 부른다'이기 때문이고, 테스트를 호출부로 세면 이 대장의 모집단은 첫날부터 0건이 된다. " +
  "⚠️ 그리고 '나온다'는 **마스킹한 소스에서** 나온다는 뜻이다: 주석은 라운드 88부터, **문자열 리터럴의 " +
  "글자는 라운드 90부터** 지우고 센다(주석·문자열이 이름을 말하는 것은 호출이 아니다). " +
  "⚠️⚠️ 다만 템플릿 리터럴의 `${…}` 안은 **진짜 코드라 지우지 않는다** — 지우면 살아 있는 호출부가 " +
  "사라져 사문이 거짓으로 늘어난다.";

/** ⚠️ 결정 ② — 값으로 적힌 모집단의 정의. */
export const POPULATION_DEFINITION =
  "모집단은 **`export function` 선언과 `export const` 선언**이다 — 모바일 apps/mobile/src/**/*.ts" +
  "(테스트·local-backend·local-fixtures 제외)와 어드민 apps/admin/src/lib/**/*.ts(테스트 제외). " +
  "⚠️ 라운드 89 트랙 C가 `export const` 축을 들였다: 그 축을 밖에 두던 이유(계약 전용 데이터 모듈이 첫날부터 " +
  "면제부가 된다)는 사라지지 않았고, 대신 그 면제가 손 목록이 아니라 **모듈 자신의 소스에서 파생하는 판정**이 됐다" +
  "(결정 ③ · CONTRACT_ONLY_AXES). .tsx의 컴포넌트 export와 apps/api/** · packages/** 는 오늘도 모집단 밖이고, " +
  "그 셋 다 사각으로 적힌다.";

/** ⚠️ 결정 ③ — 값으로 적힌 계약 전용 데이터 판정의 정의(축 둘의 이름과 왜 손 목록이 아닌가). */
export const CONTRACT_ONLY_DEFINITION =
  "계약 전용 데이터 판정은 **모듈 자신의 소스에서 파생한다** — 손으로 적은 경로 목록이 아니다(그것이 AB-4가 " +
  "이름 붙인 착시의 모양이고, 실제로 그 손 목록의 이유 한 줄이 오늘 거짓이었다). 축은 둘이고 둘 중 하나라도 서면 " +
  "면제다. ⓐ **번들 밖**(bundle-excluded): 제품 소스 어느 파일도 이 모듈을 import하지 않고(정적 from · 동적 " +
  "import(…) · require(…) 전수 · 주석 마스킹) 계약 파일은 import한다. ⓑ **자리 표**(locator-table): 이 상수의 " +
  "최상위 원소 전수가 제품 소스의 한 자리를 가리킨다(실재하는 소스 경로 · 실재하는 라우트 · 제품 소스가 export로 " +
  "선언한 식별자). ⚠️ 두 축 다 **표식을 복사해서는 얻을 수 없다** — 판정하는 것은 import 그래프와 실재하는 자리다.";

// ── 걷기 ──────────────────────────────────────────────────────────────────────

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".expo",
  ".turbo",
  "android",
  "ios"
]);

/** `node_modules`·빌드 산출물·점 디렉터리를 뺀 재귀 걷기(다른 스윕들과 같은 관례). */
function walkFiles(absoluteDir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const absolute = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...walkFiles(absolute, extensions));
      continue;
    }
    if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(absolute);
  }
  return found;
}

function toRepoPath(absolutePath: string, baseDir: string): string {
  return relative(baseDir, absolutePath).split(sep).join("/");
}

/** 저장소 상대 경로를 읽는다. */
export function readRepoFile(relativePath: string, baseDir: string = repoRoot): string {
  return readFileSync(join(baseDir, relativePath), "utf8");
}

/** 테스트 파일인가 — 호출부에서도 모집단에서도 빠지는 유일한 갈래다. */
export function isTestFile(relativePath: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(relativePath) || relativePath.includes("/__tests__/");
}

/**
 * 한 뿌리 경로 아래의 파일 전수(테스트 제외 · 제외 조각 제외 · **대장 자신 제외**).
 *
 * 경로가 없으면 빈 배열이 아니라 **예외**다 — 없는 뿌리 위에서 조용히 초록인 것이 이 부류
 * 스윕의 가장 흔한 죽는 방식이다(계약 ⓑ가 실재를 따로 또 확인한다).
 */
export function filesUnder(
  relativePath: string,
  extensions: readonly string[],
  excludeSegments: readonly string[] = [],
  baseDir: string = repoRoot
): string[] {
  const absolute = join(baseDir, relativePath);
  const stats = statSync(absolute);
  const paths = stats.isDirectory() ? walkFiles(absolute, extensions) : [absolute];
  return paths
    .map((file) => toRepoPath(file, baseDir))
    .filter((file) => !isTestFile(file))
    .filter((file) => !excludeSegments.some((segment) => file.includes(segment)))
    .filter((file) => !(LEDGER_SELF_FILES as readonly string[]).includes(file))
    .sort();
}

// ── 모집단 뿌리 ───────────────────────────────────────────────────────────────

export type PopulationRootId = "mobile-src" | "admin-src-lib";

/** 모집단의 두 축 — 라운드 89 트랙 C가 `const`를 들이면서 항목마다 값으로 적힌다. */
export type ExportKind = "function" | "const";

export type PopulationRoot = {
  readonly id: PopulationRootId;
  readonly path: string;
  readonly extensions: readonly string[];
  readonly excludeSegments: readonly string[];
  /** 이 뿌리가 내놓아야 하는 파일 수의 **하한**(유령 방지 — 오늘 실측의 아래에 둔다). */
  readonly minFiles: number;
  /** 이 뿌리가 내놓아야 하는 `export function` 수의 **하한**. */
  readonly minExports: number;
  /** 이 뿌리가 내놓아야 하는 `export const` 수의 **하한**(라운드 89 트랙 C — 축 둘이 다 하한을 진다). */
  readonly minConstExports: number;
  /** 오늘 실측(문서용 — 판정은 하한이 한다). */
  readonly measuredFiles: number;
  readonly measuredExports: number;
  readonly measuredConstExports: number;
  /** 왜 이 뿌리인가 — **빈 문자열일 수 없다.** */
  readonly reason: string;
};

/**
 * 순수 판정 모듈이 사는 두 자리.
 *
 * ⚠️ 하한을 실측보다 **낮게** 두는 이유: 이 대장은 A~D 트랙과 나란히 사는 파일이고, 화면 하나가
 * 모듈 하나를 흡수하면 파일 수가 준다. 하한이 무는 것은 *"뿌리가 통째로 비었다"* 이지 *"한 파일이
 * 줄었다"* 가 아니다 — 후자를 물면 이 계약은 남의 라운드에서 빨개지는 소음이 된다.
 */
export const POPULATION_ROOTS: readonly PopulationRoot[] = [
  {
    id: "mobile-src",
    path: "apps/mobile/src",
    extensions: [".ts"],
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 180,
    minExports: 700,
    minConstExports: 450,
    measuredFiles: 221,
    measuredExports: 871,
    measuredConstExports: 591,
    reason:
      "모바일의 순수 판정(문구·파생값·술어)이 사는 자리다 — 화면(`app/**`)은 이 모듈들을 부르기만 하고, " +
      "그래서 '아무도 부르지 않는 판정'이 생길 수 있는 유일한 층이 여기다. " +
      "⚠️ `local-backend`·`local-fixtures`를 빼는 이유는 그 둘이 **개발 전용 대역**이라 화면 호출부가 " +
      "없는 것이 정상이기 때문이다(빼지 않으면 첫날부터 면제 줄이 붙는다)."
  },
  {
    id: "admin-src-lib",
    path: "apps/admin/src/lib",
    extensions: [".ts"],
    excludeSegments: [],
    minFiles: 15,
    minExports: 110,
    minConstExports: 40,
    measuredFiles: 22,
    measuredExports: 148,
    measuredConstExports: 61,
    reason:
      "어드민에서 같은 층에 해당하는 자리다(`src/lib` = API 클라이언트와 뷰 파생). " +
      "⚠️ `src/components`·`app/**`은 모집단이 아니다 — 컴포넌트 export는 JSX로 쓰이고 이 그물의 " +
      "이름 훑기가 그 사용을 다르게 읽는다(그 사실은 사각 `tsx-components`로 적는다). " +
      "⚠️ 같은 이유로 `src/lib`의 단 하나뿐인 `.tsx`(admin-token-context.tsx)도 밖이다 — " +
      "정찰이 146으로 센 것과 이 대장이 그날 144로 센 것의 차이가 정확히 그 둘이고, 둘 다 화면이 부른다."
  }
];

// ── 호출부 뿌리 ───────────────────────────────────────────────────────────────

export type CallsiteRoot = {
  readonly path: string;
  readonly excludeSegments: readonly string[];
  readonly minFiles: number;
  readonly measuredFiles: number;
  readonly reason: string;
};

/**
 * 호출부 전수가 사는 네 자리.
 *
 * ⚠️ 모집단 뿌리 둘이 여기 **다시** 들어 있다 — 결정 ①이 *"자기 파일까지 포함"* 이기 때문이다.
 * 같은 파일 안에서만 쓰이는 함수는 사문이 아니라 잘못 export된 함수이고, 그 둘은 고치는 손이 다르다.
 */
export const CALLSITE_ROOTS: readonly CallsiteRoot[] = [
  {
    path: "apps/mobile/app",
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 25,
    measuredFiles: 38,
    reason: "모바일 화면 전수(expo-router). 판정 모듈을 부르는 쪽의 절반이다."
  },
  {
    path: "apps/mobile/src",
    excludeSegments: ["local-backend", "local-fixtures"],
    minFiles: 180,
    measuredFiles: 241,
    reason:
      "모듈이 모듈을 부르는 자리 + 자기 파일. ⚠️ 모집단 뿌리와 같은 경로를 호출부로도 두는 것이 " +
      "결정 ①의 '자기 파일까지 포함'이다."
  },
  {
    path: "apps/admin/app",
    excludeSegments: [],
    minFiles: 10,
    measuredFiles: 15,
    reason: "어드민 화면 전수(next app router)."
  },
  {
    path: "apps/admin/src",
    excludeSegments: [],
    minFiles: 15,
    measuredFiles: 25,
    reason: "어드민 컴포넌트·lib 전수 + 자기 파일."
  }
];

/** 호출부 파일 전수 — 이 대장의 모든 판정이 이 집합 위에서 난다. */
export function collectCallsiteFiles(baseDir: string = repoRoot): string[] {
  const files = new Set<string>();
  for (const root of CALLSITE_ROOTS) {
    for (const file of filesUnder(root.path, [".ts", ".tsx"], root.excludeSegments, baseDir)) {
      files.add(file);
    }
  }
  return [...files].sort();
}

// ── 모집단 걷기 ───────────────────────────────────────────────────────────────

export type ExportedFunction = {
  /** 사문 대장의 열쇠 — `파일:이름`. 줄 번호는 열쇠에 넣지 않는다(줄은 라운드마다 밀린다). */
  readonly id: string;
  readonly root: PopulationRootId;
  readonly file: string;
  readonly line: number;
  readonly name: string;
  /** 모집단의 어느 축인가(라운드 89 트랙 C). */
  readonly kind: ExportKind;
};

/**
 * `export function NAME(` / `export async function NAME<` — **줄 머리에서만** 읽는다.
 *
 * 들여쓰인 `export`는 이 저장소에 0건이고(중첩 export는 문법이 아니다), 줄 머리로 못 박으면
 * 문자열·주석 안의 같은 텍스트가 선언으로 읽히지 않는다.
 */
const EXPORT_FUNCTION_DECLARATION = /^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[(<]/;

/** `export const NAME =` / `export const NAME:` — 라운드 89 트랙 C가 모집단으로 들인 둘째 축. */
const EXPORT_CONST_DECLARATION = /^export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/;

function collectDeclarations(
  root: PopulationRoot,
  pattern: RegExp,
  kind: ExportKind,
  baseDir: string
): ExportedFunction[] {
  const found: ExportedFunction[] = [];
  for (const file of filesUnder(root.path, root.extensions, root.excludeSegments, baseDir)) {
    readRepoFile(file, baseDir)
      .split("\n")
      .forEach((line, index) => {
        const match = pattern.exec(line);
        if (!match) return;
        found.push({ id: `${file}:${match[1]}`, root: root.id, file, line: index + 1, name: match[1], kind });
      });
  }
  return found;
}

/** 모집단의 첫째 축 — `export function` 선언(결정 ②). */
export function collectExportedFunctions(baseDir: string = repoRoot): ExportedFunction[] {
  return POPULATION_ROOTS.flatMap((root) =>
    collectDeclarations(root, EXPORT_FUNCTION_DECLARATION, "function", baseDir)
  );
}

/** 모집단의 둘째 축 — `export const` 선언(라운드 89 트랙 C가 들였다). */
export function collectExportedConstants(baseDir: string = repoRoot): ExportedFunction[] {
  return POPULATION_ROOTS.flatMap((root) =>
    collectDeclarations(root, EXPORT_CONST_DECLARATION, "const", baseDir)
  );
}

/**
 * **모집단 전수 — 축 둘을 합친 것**(결정 ②).
 *
 * ⚠️ 이 함수가 라운드 89 트랙 C의 본체다. 축을 합치기 전에는 *"사문이 열여섯을 넘지 않는다"* 가
 * `export const` 652를 **한 자리도 보지 않은 채** 참이었다.
 */
export function collectPopulation(baseDir: string = repoRoot): ExportedFunction[] {
  return [...collectExportedFunctions(baseDir), ...collectExportedConstants(baseDir)];
}

// ── 호출부 세기 ───────────────────────────────────────────────────────────────

/** 낱말 경계로 끊은 이름(부분 일치가 호출로 읽히지 않게 한다). */
function identifierPattern(name: string): RegExp {
  return new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`, "g");
}

// ── 마스킹 (라운드 88 트랙 D → **라운드 90 트랙 C**) ──────────────────────────
//
// ⚠️ **이 자리가 라운드 87이 사각으로 적어 둔 바로 그 재개 조건이다.** 그때의 문장은
// *"재개 조건(사건형): 이 재측정이 0을 넘는 날 — 그날 이 그물은 마스킹을 배워야 한다"* 였고,
// 라운드 88 트랙 D가 **아홉의 이유를 소스 주석으로 옮기면서** 그날이 왔다: 이유 주석은 그
// export의 이름을 부를 수밖에 없고(*"왜 화면이 이 이름을 부르지 않는가"* 를 적는 주석이다),
// 마스킹이 없으면 **이유를 적은 순간 그 항목이 대장에서 조용히 사라진다**.
//
// ⚠️⚠️ **라운드 90 트랙 C: 이제 문자열 리터럴도 마스킹한다**(그물 기준). 라운드 88·89의 이 자리는
// *"문자열은 오늘도 마스킹하지 않는다"* 였고, 라운드 89가 그 사각의 재개 조건을 **발동시킨 채로**
// 넘겼다(*참조가 전부 문자열뿐인 export*가 0에서 넷이 됐다). 오늘 그 축이 그물로 들어온다.
//
// ⚠️⚠️ **그러나 템플릿 리터럴의 `${…}` 안은 지우지 않는다 — 그 안은 진짜 코드다.**
// `` `${searchResultCountAnnouncement(n)} 건` `` 을 통째로 지우면 **살아 있는 호출부가 사라지고
// 사문이 거짓으로 는다**(거짓 빨강 — 이 대장이 지금껏 낸 적 없는 방향의 오차다). 그래서
// `skipTemplateLiteral`은 **문자열 조각의 글자만** 지우고 `${…}`를 만나면 `scanCodeRegion`으로
// 되돌아간다. ⚠️ 그 갈래는 오늘 저장소에 우연히 있느냐와 무관하게 **합성 소스로** 증명한다
// (계약 ⓐ) — 저장소가 그 모양을 잃는 날에도 계약은 그것을 물고 있어야 하기 때문이다.
//
// ⚠️ **전후 대조는 값으로 남는다**(계약 ⓑ · 라운드 88 D가 주석 마스킹에 대해 세운 그 형식):
// 마스킹 **전**(주석만 지우던 라운드 88·89의 그물)은 **40**, **후**(오늘의 그물)는 **44**다.
// 두 수를 한 낱말로 적지 않는다 — 아래 `findDeadExportsBeforeStringMasking`과 `findDeadExports`가
// 각각 그 한 수씩을 지고, 계약이 둘을 나란히 잰다.

type MaskState = {
  readonly source: string;
  readonly out: string[];
  readonly maskStrings: boolean;
};

/** 줄바꿈만 남기고 공백으로 지운다 — **길이와 줄 번호가 보존된다**(참조 자리 계산이 그대로다). */
function blankRange(state: MaskState, from: number, to: number): void {
  for (let index = from; index < to; index += 1) {
    if (state.out[index] !== "\n") state.out[index] = " ";
  }
}

/** 이 문자 뒤의 `/`는 나눗셈이 아니라 정규식 리터럴의 시작이다. */
const REGEX_PREFIX_CHARACTERS = new Set("(,=:[!&|?{};*%+-~^<>".split(""));
const REGEX_PREFIX_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await"
]);

/**
 * `/`가 정규식 리터럴을 여는가 — 여는 자리를 놓치면 정규식 **안의** `//`가 주석으로 읽히고,
 * 그러면 마스킹이 **진짜 코드를 지운다**(거짓 빨강). 이 판정이 이 스캐너에서 가장 비싼 한 줄이다.
 */
function startsRegexLiteral(source: string, slashIndex: number): boolean {
  let index = slashIndex - 1;
  while (index >= 0 && /\s/.test(source[index])) index -= 1;
  if (index < 0) return true;
  const previous = source[index];
  if (REGEX_PREFIX_CHARACTERS.has(previous)) return true;
  if (!/[\w$]/.test(previous)) return false;
  const wordEnd = index + 1;
  let wordStart = index;
  while (wordStart >= 0 && /[\w$]/.test(source[wordStart])) wordStart -= 1;
  return REGEX_PREFIX_KEYWORDS.has(source.slice(wordStart + 1, wordEnd));
}

/** 정규식 리터럴의 끝(닫는 `/` 다음 자리). 줄을 넘으면 정규식이 아니다 — 나눗셈으로 읽는다. */
function skipRegexLiteral(source: string, slashIndex: number): number | null {
  let index = slashIndex + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") return null;
    if (character === "[") inCharacterClass = true;
    else if (character === "]") inCharacterClass = false;
    else if (character === "/" && !inCharacterClass) return index + 1;
    index += 1;
  }
  return null;
}

/**
 * 따옴표 문자열의 끝. **줄을 넘으면 문자열이 아니다**(JS 문법) — 그때는 아무것도 마스킹하지 않고
 * 한 글자만 넘어간다. ⚠️ 이 한 줄 가두기가 이 스캐너의 안전장치다: 오해가 나도 손상이 **그 줄**에
 * 갇힌다.
 *
 * ⚠️⚠️ **오차의 방향은 오늘 뒤집혔다 — 옛 주석은 낡았다**(라운드 90 리뷰 M-3).
 *
 *  · **라운드 88·89(`maskStrings === false`)**: 이 자는 주석만 지웠고 문자열의 글자는 그대로
 *    남겼다. 그래서 따옴표를 잘못 읽어도 최악이 *"주석을 덜 지운다"* 였고, 그 방향은 옛 그물과
 *    같은 **거짓 초록**(사문을 놓친다)이었다.
 *  · **라운드 90 트랙 C부터(`maskStrings === true`)**: 이 자가 **글자를 지우는 자**가 됐다.
 *    여는 따옴표를 잘못 잡으면 그 줄 안의 **진짜 코드가 공백이 되고**, 지워진 곳에 살아 있는
 *    호출부가 있었다면 그 export가 **사문으로 세어진다** — 방향이 **거짓 빨강**이다.
 *
 * ⚠️ **실증 사례(합성 소스로 재현되고, 저장소에는 오늘 0건이다)**: JSX 텍스트의 어포스트로피는
 * 코드가 아니라 글자인데 이 자는 그것을 여는 따옴표로 읽는다. 한 줄에 **짝으로** 서면 그 사이가
 * 통째로 지워진다 —
 *
 * ```
 * <Text>Don't stop {renderFooter()} it's fine</Text>
 *   → <Text>Don'                          's fine</Text>   // renderFooter가 사라진다
 * ```
 *
 * 한 줄에 **하나만** 있으면(가장 흔한 모양) 줄바꿈에서 `null`이 돌아와 아무것도 지워지지 않는다 —
 * 위의 한 줄 가두기가 그 자리를 막는 것이고, **짝이 맞는 둘**이 그 가두기를 빠져나가는 유일한
 * 모양이다. ⚠️ **오늘 이 저장소의 실피해는 0건**이다(제품 소스의 인용부호는 전각 `‘ ’`이고
 * ASCII `'`가 JSX 텍스트에 짝으로 선 자리가 0건이다). 그 사실과 표면의 크기는 사각
 * `jsx-apostrophe-string-masking`이 값과 하한으로 진다.
 */
function skipQuotedString(state: MaskState, quoteIndex: number): number | null {
  const { source } = state;
  const quote = source[quoteIndex];
  let index = quoteIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") return null;
    if (character === quote) {
      if (state.maskStrings) blankRange(state, quoteIndex + 1, index);
      return index + 1;
    }
    index += 1;
  }
  return null;
}

/** 템플릿 리터럴 — `${…}` 안은 **코드로 되돌아가서** 훑는다(그 안의 주석은 주석이다). */
function skipTemplateLiteral(state: MaskState, backtickIndex: number): number {
  const { source } = state;
  let index = backtickIndex + 1;
  let segmentStart = index;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      if (state.maskStrings) blankRange(state, segmentStart, index);
      return index + 1;
    }
    if (character === "$" && source[index + 1] === "{") {
      if (state.maskStrings) blankRange(state, segmentStart, index);
      index = scanCodeRegion(state, index + 2, true);
      segmentStart = index;
      continue;
    }
    index += 1;
  }
  if (state.maskStrings) blankRange(state, segmentStart, source.length);
  return source.length;
}

/**
 * 코드 구간을 훑으며 주석(과 선택적으로 문자열)을 지운다.
 *
 * `stopAtBrace`면 짝이 맞는 `}`를 만난 다음 자리를 돌려준다 — 템플릿의 `${…}`가 이 모드로 들어온다.
 */
function scanCodeRegion(state: MaskState, start: number, stopAtBrace: boolean): number {
  const { source } = state;
  let index = start;
  let braceDepth = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    // ⚠️ `://`는 주석이 아니다 — JSX 텍스트에 그냥 적힌 `http://`(따옴표 없는 자식 노드)가 이 자리에
    // 걸리면 마스킹이 **진짜 화면 문구를 지운다**. 이 저장소에 실제로 그런 자리가 있어서 값으로 막는다.
    if (character === "/" && next === "/" && source[index - 1] === ":") {
      index += 2;
      continue;
    }
    if (character === "/" && next === "/") {
      const lineEnd = source.indexOf("\n", index);
      const stop = lineEnd === -1 ? source.length : lineEnd;
      blankRange(state, index, stop);
      index = stop;
      continue;
    }
    if (character === "/" && next === "*") {
      const blockEnd = source.indexOf("*/", index + 2);
      const stop = blockEnd === -1 ? source.length : blockEnd + 2;
      blankRange(state, index, stop);
      index = stop;
      continue;
    }
    if (character === '"' || character === "'") {
      const end = skipQuotedString(state, index);
      index = end === null ? index + 1 : end;
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(state, index);
      continue;
    }
    if (character === "/" && startsRegexLiteral(source, index)) {
      const end = skipRegexLiteral(source, index);
      index = end === null ? index + 1 : end;
      continue;
    }
    if (stopAtBrace) {
      if (character === "{") braceDepth += 1;
      else if (character === "}") {
        if (braceDepth === 0) return index + 1;
        braceDepth -= 1;
      }
    }
    index += 1;
  }
  return source.length;
}

/** 주석만 공백으로 지운 소스(길이·줄 보존) — **그물이 오늘 세는 텍스트**다. */
export function maskComments(source: string): string {
  const state: MaskState = { source, out: source.split(""), maskStrings: false };
  scanCodeRegion(state, 0, false);
  return state.out.join("");
}

/**
 * 주석 **과 문자열 리터럴**을 지운 소스 — ⚠️⚠️ **라운드 90 트랙 C부터 이것이 그물이다.**
 *
 * 라운드 88·89에는 이 함수가 사각 `string-literal-references`의 하한을 재는 자였고, 그물은
 * `maskComments`를 썼다. 그 사각의 재개 조건이 라운드 89에 발동했고(참조가 전부 문자열뿐인 export
 * 0 → 4), 오늘 이 함수가 판정하는 자가 됐다.
 *
 * ⚠️⚠️ **지우는 것은 문자열의 글자뿐이다.** 템플릿의 `${…}` 안은 `skipTemplateLiteral`이
 * `scanCodeRegion`으로 되돌려 **코드로 남긴다** — 그 갈래를 지우면 살아 있는 호출부가 사라져
 * 사문이 **거짓으로** 늘어난다(계약 ⓐ가 합성 소스로 그 갈래를 문다).
 */
export function maskCommentsAndStrings(source: string): string {
  const state: MaskState = { source, out: source.split(""), maskStrings: true };
  scanCodeRegion(state, 0, false);
  return state.out.join("");
}

/** 파일 하나를 여러 번 마스킹하지 않게 붙잡아 둔다(이름 천 개 × 파일 삼백 개라 재사용이 필수다). */
function cachedMask(masker: (source: string) => string): (file: string, source: string) => string {
  const cache = new Map<string, { readonly raw: string; readonly masked: string }>();
  return (file, source) => {
    const cached = cache.get(file);
    if (cached && cached.raw === source) return cached.masked;
    const masked = masker(source);
    cache.set(file, { raw: source, masked });
    return masked;
  };
}

const maskCommentsCached = cachedMask(maskComments);
const maskCommentsAndStringsCached = cachedMask(maskCommentsAndStrings);
const maskNothing = (_file: string, source: string): string => source;

export type CallsiteHit = { readonly file: string; readonly line: number };

function referencesUnderMask(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>,
  mask: (file: string, source: string) => string
): CallsiteHit[] {
  const hits: CallsiteHit[] = [];
  for (const [file, source] of sources) {
    const scanned = mask(file, source);
    for (const match of scanned.matchAll(identifierPattern(item.name))) {
      const line = scanned.slice(0, match.index).split("\n").length;
      if (file === item.file && line === item.line) continue;
      hits.push({ file, line });
    }
  }
  return hits;
}

/**
 * 제품 소스에서 이 이름이 나오는 자리 전수 — **선언 줄 자신은 빼고 · 주석과 문자열은 마스킹하고**.
 *
 * ⚠️ 선언 줄만 빼는 이유: 선언은 참조가 아니지만 같은 파일의 다른 줄은 참조다(결정 ①).
 * ⚠️ 주석을 마스킹하는 이유: *"아무도 부르지 않는데 주석만 이름을 말하고 있는"* export가
 * 이 대장에서 조용히 사라지지 않게 하기 위해서다(라운드 87 리뷰 L-1 · 사각
 * `comment-and-string-references`의 재개 조건이 라운드 88에 발동했다).
 * ⚠️⚠️ **문자열을 마스킹하는 이유(라운드 90 트랙 C)**: *"아무도 부르지 않는데 같은 파일의 표 설명
 * 문자열만 자기 이름을 인용하고 있는"* export가 같은 방식으로 사라지지 않게 하기 위해서다 —
 * 라운드 89가 그런 자리 **넷**을 값으로 적고 재개 조건을 발동시킨 채 넘겼다.
 * ⚠️⚠️ **템플릿의 `${…}` 안은 코드로 남는다** — 그 안을 지우면 살아 있는 호출부가 사라진다.
 */
export function findProductReferences(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>
): CallsiteHit[] {
  return referencesUnderMask(item, sources, maskCommentsAndStringsCached);
}

/** 마스킹 **없이** 세는 라운드 87의 그물 — 재측정 전용이다(판정은 위 마스킹판이 한다). */
export function findRawProductReferences(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>
): CallsiteHit[] {
  return referencesUnderMask(item, sources, maskNothing);
}

/**
 * **주석만** 지우고 세는 라운드 88·89의 그물 — 오늘은 **마스킹 전**을 재는 자다(계약 ⓑ).
 *
 * ⚠️ 이 자를 남겨 두는 이유: 전후 대조가 산문이 되지 않게 하기 위해서다. 이 자로 잰 사문이
 * **40**, 오늘의 그물로 잰 사문이 **44**이고, 그 갈림 넷이 문자열 축이 처음 본 자리다.
 */
export function findCommentMaskedProductReferences(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>
): CallsiteHit[] {
  return referencesUnderMask(item, sources, maskCommentsCached);
}

/**
 * 주석 **과 문자열**을 다 지우고 세는 자 — ⚠️ **라운드 90부터 이것은 그물 자신과 같은 자다.**
 * 이름을 남겨 두는 것은 라운드 88·89의 사각 재측정이 이 이름으로 서 있었기 때문이고, 그 자가
 * 판정하는 자가 됐다는 사실 자체가 이 라운드의 값이다.
 */
export function findCodeOnlyProductReferences(
  item: ExportedFunction,
  sources: ReadonlyMap<string, string>
): CallsiteHit[] {
  return referencesUnderMask(item, sources, maskCommentsAndStringsCached);
}

/** 호출부 파일의 내용을 한 번만 읽어 둔다(모집단 천 개 × 파일 삼백 개라 재사용이 필수다). */
export function readCallsiteSources(baseDir: string = repoRoot): Map<string, string> {
  return new Map(collectCallsiteFiles(baseDir).map((file) => [file, readRepoFile(file, baseDir)]));
}

/**
 * ⚠️ **오탐 표면 — 이 스캐너가 어포스트로피를 여는 따옴표로 볼 수 있는 호출부 파일 전수.**
 *
 * `skipQuotedString`의 머리말이 든 그 사각의 **크기**다(라운드 90 리뷰 M-3). ASCII `'`가 한 글자도
 * 없는 파일에서는 그 오해가 아예 일어날 수 없으므로, 이 수가 표면의 상한이자 사각의 하한이 된다.
 * ⚠️ 이 수가 **피해**는 아니다 — 피해는 아래 `apostropheMaskedCodeSites`가 세고 오늘 0건이다.
 */
export function apostropheBearingCallsiteFiles(baseDir: string = repoRoot): string[] {
  return [...readCallsiteSources(baseDir)]
    .filter(([, source]) => source.includes("'"))
    .map(([file]) => file);
}

/**
 * ⚠️⚠️ **실피해 — 문자열 마스킹이 어포스트로피 짝을 잘못 읽어 *코드를 지운* 자리 전수(오늘 0건).**
 *
 * 두 마스킹의 산출을 겹쳐 본다: 주석만 지운 자에서는 코드였는데 문자열까지 지운 자에서 공백이
 * 된 구간을 찾고, 그 구간을 연 따옴표가 **ASCII `'`** 이며 그 앞이 코드 구분자가 **아닐 때**만
 * 센다(구분자 뒤의 `'`는 진짜 문자열 리터럴이다 — 지워지는 것이 옳다). 지워진 구간에 식별자가
 * 없으면 코드가 아니라 글자였으므로 역시 세지 않는다.
 *
 * ⚠️ **0이 미측정이 아니라 실측이라는 사실이 이 자의 값이다**(`outside-two-apps`류의 0과 다르다).
 * 하루라도 이 수가 0을 넘으면 그날 사문 판정 하나가 **거짓 빨강**일 수 있고, 그때의 답은 대장에
 * 줄을 더하는 것이 아니라 이 스캐너가 JSX 텍스트를 코드와 가르는 것이다.
 */
export function apostropheMaskedCodeSites(baseDir: string = repoRoot): string[] {
  const CODE_DELIMITER = /[=(,:[{&|?+!;<>]/;
  const sites: string[] = [];
  for (const [file, source] of readCallsiteSources(baseDir)) {
    if (!source.includes("'")) continue;
    const commentsOnly = maskComments(source);
    const alsoStrings = maskCommentsAndStrings(source);
    for (let index = 0; index < commentsOnly.length; index += 1) {
      if (commentsOnly[index] === " " || alsoStrings[index] !== " ") continue;
      let open = index - 1;
      while (open >= 0 && alsoStrings[open] === " " && commentsOnly[open] !== " ") open -= 1;
      let end = index;
      while (end < commentsOnly.length && alsoStrings[end] === " " && commentsOnly[end] !== " ") end += 1;
      const erased = commentsOnly.slice(open, end);
      index = end;
      if (commentsOnly[open] !== "'") continue;
      // 지워진 것이 글자뿐이면 이 사각이 아니다 — 이 자가 세는 것은 **코드**가 사라진 자리다.
      if (!/[A-Za-z_$][A-Za-z0-9_$]{2,}/.test(erased)) continue;
      let before = open - 1;
      while (before >= 0 && /\s/.test(commentsOnly[before])) before -= 1;
      // 코드 구분자 뒤의 `'`는 진짜 문자열 리터럴이다(지워지는 것이 이 그물의 축이다).
      if (before < 0 || CODE_DELIMITER.test(commentsOnly[before])) continue;
      sites.push(`${file}:${source.slice(0, open).split("\n").length}`);
    }
  }
  return sites;
}

/**
 * 모집단(축 둘) 중 **호출부 0건**인 것 전수 — 오늘의 **마흔넷**이 여기서 나온다.
 *
 * ⚠️ 이 마흔넷 가운데 스물둘은 결정 ③의 파생 판정이 면제하고(대장에 줄이 없다), 스물둘이 대장에
 * 선다(`ledgerRequiredDeadExports`). **면제된 자리도 여기서는 사라지지 않는다** — 유령 방지(ⓓ)가
 * 그 둘을 함께 대조하려면 전수가 한 자리에 있어야 한다.
 *
 * ⚠️⚠️ **라운드 90 트랙 C: 40 → 44.** 늘어난 넷은 **새 부채가 아니라 세는 자리가 늘어난 것**이고
 * (라운드 88 D·89 C가 세운 형식), 넷 다 `shared-cache-policy.ts`의 표 상수다 — 라운드 89가
 * 이름까지 값으로 적어 두고 넘긴 바로 그 넷이다. 마스킹 **전**의 수는
 * `findDeadExportsBeforeStringMasking`이 진다(계약 ⓑ).
 */
export function findDeadExports(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectPopulation(baseDir).filter((item) => findProductReferences(item, sources).length === 0);
}

/**
 * **문자열 마스킹을 켜기 전**(라운드 88·89의 그물)의 사문 전수 — 오늘 **마흔**이다.
 *
 * ⚠️ 계약 ⓑ의 두 수 중 앞의 하나다. 이 자가 없으면 *"40에서 44가 됐다"* 가 산문이 되고, 산문은
 * 다음 라운드가 다시 재지 못한다. ⚠️ 이 자는 **판정하지 않는다** — 판정은 위 `findDeadExports`다.
 */
export function findDeadExportsBeforeStringMasking(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectPopulation(baseDir).filter(
    (item) => findCommentMaskedProductReferences(item, sources).length === 0
  );
}

/** 축 하나만 본 사문 — 축이 갈릴 때 어느 쪽이 움직였는지 값으로 말한다. */
export function findDeadExportsOfKind(kind: ExportKind, baseDir: string = repoRoot): ExportedFunction[] {
  return findDeadExports(baseDir).filter((item) => item.kind === kind);
}

/**
 * 참조가 **전부 주석뿐**인 모집단 항목 전수 — 마스킹이 없었다면 **조용히 사라졌을** 자리다.
 *
 * ⚠️ 라운드 87에는 이 수가 0이었고(그래서 그때는 마스킹이 없어도 실피해가 없었다), 라운드 88이
 * 아홉의 이유를 소스로 옮기면서 0을 넘었다 — 사각 `comment-and-string-references`가 그 두 값을 진다.
 * 먼저 마스킹판으로 사문을 고르고(열여섯) 그 위에서만 옛 그물을 다시 재므로 전수 훑기는 한 번이다.
 */
export function commentOnlyReferenceExports(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  // ⚠️ **주석 마스킹판 위에서만 센다**(라운드 90 트랙 C의 정정). 오늘의 그물은 문자열까지
  // 지우므로 그 위에서 세면 이 수가 *"주석뿐"* 이 아니라 *"주석이나 문자열뿐"* 이 되고, 두 축의
  // 값이 한 낱말로 뭉개진다. 문자열 축의 갈림은 `stringOnlyReferenceExports`가 따로 진다.
  return findDeadExportsBeforeStringMasking(baseDir).filter(
    (item) => findRawProductReferences(item, sources).length > 0
  );
}

/**
 * 참조가 **전부 문자열 리터럴뿐**인 모집단 항목 전수 — **마스킹 전후가 갈린 자리 전수**다.
 *
 * ⚠️ 라운드 88에는 0건이었고 라운드 89가 **넷**을 값으로 적으며 재개 조건을 발동시켰다.
 * 라운드 90 트랙 C가 그 축을 그물에 넣었으므로, 오늘 이 넷은 *"그물이 못 보는 자리"* 가 아니라
 * **`findDeadExportsBeforeStringMasking`(40)과 `findDeadExports`(44)가 갈린 바로 그 자리**다.
 * ⚠️ 계약 ⓑ가 `44 − 40 === 이 목록의 크기`를 값으로 대조한다.
 */
export function stringOnlyReferenceExports(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectPopulation(baseDir)
    .filter((item) => findProductReferences(item, sources).length === 0)
    .filter((item) => findCommentMaskedProductReferences(item, sources).length > 0);
}

/**
 * 참조가 **하나라도 문자열 리터럴 안에** 있는 모집단 이름 전수 — 오늘은 **새 사각의 크기**다.
 *
 * ⚠️⚠️ **오차의 방향이 이 라운드에 뒤집혔다.** 문자열을 참조로 세던 라운드 88·89에는 이 수가
 * *"사문을 놓치는 쪽"*(거짓 초록)의 하한이었다. 문자열을 지우는 오늘의 그물에서 이 수는
 * *"살아 있는 자리를 사문으로 셀 수 있는 쪽"*(**거짓 빨강**)의 하한이다 — 이름이 오직
 * `registry["legalDocumentUrl"]` 꼴로만 닿는 export가 있으면 오늘의 그물은 그것을 사문으로 센다.
 * ⚠️ 오늘 실피해는 0이다: 이 이름들 가운데 코드 참조가 0건인 넷은 전부 결정 ③이 면제하는 표이고,
 * 나머지는 코드 참조를 함께 갖고 있다. 사각 `string-keyed-dynamic-access`가 그 값과 하한을 진다.
 */
export function namesReferencedInsideStringLiterals(baseDir: string = repoRoot): string[] {
  const sources = readCallsiteSources(baseDir);
  const found = collectPopulation(baseDir)
    .filter(
      (item) =>
        findProductReferences(item, sources).length <
        findCommentMaskedProductReferences(item, sources).length
    )
    .map((item) => item.name);
  return [...new Set(found)].sort();
}

/** `export const` 축의 사문만 — 라운드 89 이전에는 사각을 재는 자였고, 오늘은 모집단의 한쪽이다. */
export function findDeadConstants(baseDir: string = repoRoot): ExportedFunction[] {
  const sources = readCallsiteSources(baseDir);
  return collectExportedConstants(baseDir).filter((item) => findProductReferences(item, sources).length === 0);
}

// ── 결정 ③ 파생 판정 (라운드 89 트랙 C) ──────────────────────────────────────
//
// ⚠️⚠️ **여기 손으로 적은 경로는 하나도 없다.** 아래 두 축은 전부 소스를 읽어서 답을 만든다 —
// import 그래프(축 ⓐ)와 초기화식이 가리키는 실재하는 자리(축 ⓑ). 라운드 88까지 이 자리에 있던
// `CONTRACT_ONLY_DATA_MODULES` 손 목록은 **그 이유 한 줄이 오늘 거짓**이었고(머리말 참고), 그것이
// 이 파생이 대신 서야 하는 이유 전부다.

/** import 지정자 — 정적 `from "…"` · 동적 `import("…")` · `require("…")` 셋 다 한 바늘에 문다. */
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

/** 상대 지정자를 저장소 상대 경로로 푼다(확장자·`index` 붙이기 포함). 절대/패키지 지정자는 null. */
function resolveRelativeSpecifier(fromFile: string, specifier: string, baseDir: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const raw = normalize(join(dirname(fromFile), specifier)).split(sep).join("/");
  for (const candidate of [raw, `${raw}.ts`, `${raw}.tsx`, `${raw}/index.ts`, `${raw}/index.tsx`]) {
    if (existsSync(join(baseDir, candidate))) return candidate;
  }
  return raw;
}

/**
 * 주어진 소스 집합에서 이 모듈을 import하는 파일 전수 — **주석은 마스킹한다.**
 *
 * ⚠️ 지정자가 풀리지 않아도 **파일 이름이 같으면 import로 센다.** 방향이 중요하다: 이 함수의
 * 오차는 *"import하는 사람을 더 많이 찾는"* 쪽이어야 하고(면제를 **덜** 준다), 그 반대는 면제를
 * 근거 없이 주는 쪽이다. 별칭 경로(`@/…`)가 언젠가 들어와도 이 그물은 안전한 쪽으로 틀린다.
 */
export function importersOfModule(
  target: string,
  sources: ReadonlyMap<string, string>,
  baseDir: string = repoRoot
): string[] {
  const basename = target.replace(/^.*\//, "").replace(/\.tsx?$/, "");
  const found: string[] = [];
  for (const [file, source] of sources) {
    if (file === target) continue;
    for (const match of maskComments(source).matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      const resolved = resolveRelativeSpecifier(file, specifier, baseDir);
      if (resolved === target || specifier.replace(/^.*\//, "") === basename) {
        found.push(file);
        break;
      }
    }
  }
  return found.sort();
}

/** 이 모듈이 사는 앱의 뿌리(`app/…`·`src/…`·라우트가 그 아래에서 풀린다). */
function appBaseOf(file: string): string {
  return file.startsWith("apps/admin/") ? "apps/admin" : "apps/mobile";
}

/** 이 자리가 실재하는 소스 파일인가 — 실재하면 **그 파일의 경로**를 돌려준다(근거가 값이 된다). */
function resolveSourceFile(relativePath: string, baseDir: string): string | null {
  for (const candidate of [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}/index.ts`,
    `${relativePath}/index.tsx`
  ]) {
    if (existsSync(join(baseDir, candidate)) && statSync(join(baseDir, candidate)).isFile()) return candidate;
  }
  return null;
}

export type ProductLocator = {
  readonly token: string;
  readonly kind: "source-file" | "route" | "exported-identifier";
  /** 그 자리가 실제로 사는 곳 — 유령 근거를 막는 값이다. */
  readonly at: string;
};

/**
 * 이 문자열이 **제품 소스의 한 자리**를 가리키는가 — 가리키면 어디인지까지 돌려준다.
 *
 * ⚠️ `#조각`은 떼고 본다(`app/reviews/page.tsx#worker-health`처럼 한 화면 안의 여러 자리를
 * 가르는 표기가 이 저장소에 있다). ⚠️ 식별자 축은 **`export`로 선언된 것만** 센다 — 아무 낱말이나
 * 세면 도메인 코드 목록이 표로 둔갑한다.
 */
export function resolveProductLocator(
  token: string,
  ownerFile: string,
  productSources: ReadonlyMap<string, string>,
  baseDir: string = repoRoot
): ProductLocator | null {
  const bare = token.split("#")[0].trim();
  if (bare.length === 0) return null;
  const base = appBaseOf(ownerFile);
  if (/^(app|src)\//.test(bare)) {
    const at = resolveSourceFile(`${base}/${bare}`, baseDir);
    if (at) return { token, kind: "source-file", at };
  }
  if (bare.startsWith("/")) {
    const at = resolveSourceFile(`${base}/app${bare}`, baseDir);
    if (at) return { token, kind: "route", at };
  }
  if (/^[A-Za-z_$][\w$]*$/.test(bare)) {
    const declaration = new RegExp(
      `^export\\s+(?:const|let|function|async\\s+function|class)\\s+${bare}(?![\\w$])`,
      "m"
    );
    for (const [file, source] of productSources) {
      if (file === ownerFile) continue;
      if (declaration.test(maskComments(source))) {
        return { token, kind: "exported-identifier", at: `${file} (export ${bare})` };
      }
    }
  }
  return null;
}

/**
 * 선언의 **초기화식 원문** — `=` 다음부터 깊이 0의 `;`까지(주석은 지우고 문자열은 남긴다).
 *
 * ⚠️ 문자열을 남기는 이유: 축 ⓑ가 읽는 것이 정확히 그 문자열들이다. ⚠️ 주석을 지우는 이유:
 * 표 안의 설명 주석이 자리를 가리키면 **주석 한 줄로 면제를 살 수 있게** 되기 때문이다.
 */
export function initializerText(source: string, declarationLine: number): string {
  const lines = source.split("\n");
  const lineStart = lines.slice(0, declarationLine - 1).join("\n").length + (declarationLine > 1 ? 1 : 0);
  let index = source.indexOf("=", lineStart);
  if (index === -1) return "";
  index += 1;
  let depth = 0;
  const out: string[] = [];
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (character === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === character) break;
        cursor += 1;
      }
      out.push(source.slice(index, cursor + 1));
      index = cursor + 1;
      continue;
    }
    if ("([{".includes(character)) depth += 1;
    if (")]}".includes(character)) depth -= 1;
    if (character === ";" && depth === 0) break;
    out.push(character);
    index += 1;
  }
  return out.join("");
}

/** 초기화식의 **최상위 원소 전수** — 바깥 `[`/`{` 안의 깊이 1 쉼표로 가른다. */
export function topLevelElements(initializer: string): string[] {
  const openIndex = initializer.search(/[[{]/);
  if (openIndex === -1) return [];
  const open = initializer[openIndex];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let index = openIndex;
  let segmentStart = openIndex + 1;
  const parts: string[] = [];
  while (index < initializer.length) {
    const character = initializer[index];
    if (character === '"' || character === "'" || character === "`") {
      let cursor = index + 1;
      while (cursor < initializer.length) {
        if (initializer[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (initializer[cursor] === character) break;
        cursor += 1;
      }
      index = cursor + 1;
      continue;
    }
    if ("([{".includes(character)) {
      depth += 1;
      if (depth === 1 && character === open) segmentStart = index + 1;
    } else if (")]}".includes(character)) {
      depth -= 1;
      if (depth === 0 && character === close) {
        parts.push(initializer.slice(segmentStart, index));
        break;
      }
    } else if (character === "," && depth === 1) {
      parts.push(initializer.slice(segmentStart, index));
      segmentStart = index + 1;
    }
    index += 1;
  }
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * 한 원소가 내미는 후보 낱말 — 맨 앞의 맨몸 키 하나 + 그 안의 문자열 리터럴 전수.
 *
 * ⚠️ **한 글자 토큰은 후보에서 뺀다**(라운드 89 리뷰 L-1). `"/"` 한 글자가 `resolveProductLocator`의
 * 라우트 갈래에 들어가면 `app` + `/` + `/index.tsx` 로 이어져 **`apps/mobile/app//index.tsx`** 를
 * 자리로 내민다 — 경로 가운데 `//`가 그 오매치의 지문이다. 그런 원소 하나가 표를 통째로
 * `locator-table` 축에 태워 **면제를 살 수 있다.** 한 글자로 제품의 자리를 정직하게 가리키는 값은
 * 오늘 저장소에 0건이고(제품 export 이름도 라우트 조각도 두 글자 이상이다), 그래서 이 배제의
 * 비용은 0이다. ⚠️ 오늘 실피해도 0건이었다 — 이 배제는 **일어난 오매치를 되돌리는 것이 아니라
 * 열려 있던 표면을 닫는 것**이고, 그 사실은 사각 `derived-exemptions`가 값으로 진다.
 */
function locatorCandidates(element: string): string[] {
  const found: string[] = [];
  const bareKey = /^([A-Za-z_$][\w$]*)\s*:/.exec(element);
  if (bareKey) found.push(bareKey[1]);
  for (const match of element.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
    found.push(match[1] ?? match[2] ?? "");
  }
  return found.filter((token) => token.trim().length > 1);
}

export type ContractOnlyAxisId = "bundle-excluded" | "locator-table";

export type ContractOnlyAxis = {
  readonly id: ContractOnlyAxisId;
  /** 이 축이 무엇을 소스에서 읽는가 — **빈 문자열일 수 없다.** */
  readonly statement: string;
};

/** 결정 ③의 두 축 — 이름과 문장이 값으로 선다(계약이 둘 다 오늘 산출을 내는지 확인한다). */
export const CONTRACT_ONLY_AXES: readonly ContractOnlyAxis[] = [
  {
    id: "bundle-excluded",
    statement:
      "제품 소스 어느 파일도 이 모듈을 import하지 않고(정적 from · 동적 import(…) · require(…) 전수 · 주석 마스킹) " +
      "계약 파일은 import한다 — 즉 이 모듈은 앱 번들에 실리지 않고 계약만 읽는다. " +
      "⚠️ 머리말에 같은 문장을 복사해 붙여도 화면이 import하는 순간 이 축은 사라진다."
  },
  {
    id: "locator-table",
    statement:
      "이 상수의 최상위 원소 **전수**가 제품 소스의 한 자리를 가리킨다 — 실재하는 소스 파일 경로 · 실재하는 라우트 · " +
      "제품 소스가 export로 선언한 식별자. 그런 값은 제품이 쓰는 값이 아니라 계약이 제품을 재려고 드는 자다. " +
      "⚠️ 원소 하나라도 풀리지 않으면 표가 아니다(도메인 코드 목록은 이 축으로 면제되지 않는다)."
  }
];

export type ContractOnlyProof = {
  readonly axis: ContractOnlyAxisId;
  /** 소스에서 **실제로 찾은** 근거 전수 — 빈 배열일 수 없다. */
  readonly evidence: readonly string[];
  /** 왜 이것이 계약 전용 데이터인가(그 항목에 대한 한 문장). */
  readonly reason: string;
};

/** 파생 판정이 한 번 걷어 둔 소스들 — 항목마다 저장소를 다시 읽지 않게 한다. */
export type ContractOnlyContext = {
  readonly product: ReadonlyMap<string, string>;
  readonly tests: ReadonlyMap<string, string>;
  readonly baseDir: string;
};

export function contractOnlyContext(baseDir: string = repoRoot): ContractOnlyContext {
  return {
    product: readCallsiteSources(baseDir),
    tests: new Map(collectTestFiles(baseDir).map((file) => [file, readRepoFile(file, baseDir)])),
    baseDir
  };
}

/**
 * ⚠️⚠️ **결정 ③의 본체** — 이 항목이 계약 전용 데이터인가, 그리고 **무엇이 그 근거인가**.
 *
 * 축 ⓐ를 먼저 본다(모듈 하나로 끝나는 싼 근거이고, 그래야 갈래가 한 항목에 하나로 정해진다).
 * 어느 축도 서지 않으면 `null` — 그 자리는 **대장에 줄을 얻어야 한다.**
 *
 * ⚠️⚠️ **면제는 새로 들어온 축(`export const`)에만 걸린다.** `export function` 축은 라운드 87·88이
 * 이미 열여섯 줄을 하나씩 판정해 대장에 세워 둔 자리이고, 파생 판정이 그 줄을 걷어 가면 이 트랙이
 * 하는 일이 *"모집단을 넓히는 것"* 이 아니라 *"항목을 지우는 것"* 이 된다. 실제로 축 ⓐ는
 * `offline-aware-screens.ts`의 사문 **함수** 하나(`usesOfflineAwareLoadErrorCopy`)도 면제할 수 있는데,
 * 그 줄이야말로 지우면 안 되는 값이다 — 그 줄의 이유가 *"`export const` 축의 면제 사유가 `export
 * function` 축으로 새어 나온 자리"* 라고 적으며 **오늘 이 축이 들어온 이유를 미리 가리키고 있었다.**
 */
export function contractOnlyDataProof(
  item: ExportedFunction,
  context: ContractOnlyContext
): ContractOnlyProof | null {
  if (item.kind !== "const") return null;
  const { product, tests, baseDir } = context;
  const productImporters = importersOfModule(item.file, product, baseDir);
  const contractImporters = importersOfModule(item.file, tests, baseDir);
  if (productImporters.length === 0 && contractImporters.length > 0) {
    return {
      axis: "bundle-excluded",
      evidence: contractImporters,
      reason:
        `${item.file}를 import하는 제품 소스가 0건이고 계약 파일 ${contractImporters.length}건이 import한다 — ` +
        "이 모듈은 앱 번들에 실리지 않는다(판정은 머리말이 아니라 import 그래프가 했다)."
    };
  }

  const source = readRepoFile(item.file, baseDir);
  const elements = topLevelElements(initializerText(source, item.line));
  if (elements.length === 0) return null;
  const evidence: string[] = [];
  for (const element of elements) {
    const locator = locatorCandidates(element)
      .map((token) => resolveProductLocator(token, item.file, product, baseDir))
      .find((found) => found !== null);
    if (!locator) return null;
    evidence.push(`${locator.token} → ${locator.at}`);
  }
  return {
    axis: "locator-table",
    evidence,
    reason:
      `최상위 원소 ${elements.length}이 전부 제품 소스의 자리를 가리킨다 — ` +
      "이 값은 제품이 쓰는 값이 아니라 계약이 제품을 재려고 드는 자다."
  };
}

export type ContractOnlyExemption = {
  readonly item: ExportedFunction;
  readonly proof: ContractOnlyProof;
};

/** 오늘 파생 판정이 면제한 자리 전수 — **크기가 값이다**(계약 ⓒ). */
export function contractOnlyExemptions(baseDir: string = repoRoot): ContractOnlyExemption[] {
  const context = contractOnlyContext(baseDir);
  const found: ContractOnlyExemption[] = [];
  for (const item of findDeadExports(baseDir)) {
    const proof = contractOnlyDataProof(item, context);
    if (proof) found.push({ item, proof });
  }
  return found;
}

/** 그 면제가 걸친 모듈 전수 — 손 목록이 아니라 **파생의 산출**이다(유령 방지 ⓓ가 쓴다). */
export function contractOnlyDataModules(baseDir: string = repoRoot): string[] {
  return [...new Set(contractOnlyExemptions(baseDir).map((entry) => entry.item.file))].sort();
}

/**
 * **대장에 줄이 있어야 하는 사문 전수** = 사문 − 면제.
 *
 * ⚠️ 대장(`DEAD_EXPORT_LEDGER`)과 양방향으로 대조되는 것이 이 집합이고, 래칫이 무는 것도 이 수다.
 */
export function ledgerRequiredDeadExports(baseDir: string = repoRoot): ExportedFunction[] {
  const context = contractOnlyContext(baseDir);
  return findDeadExports(baseDir).filter((item) => contractOnlyDataProof(item, context) === null);
}

/** 테스트 파일 전수 — *"계약만 초록"* 이라는 말이 참인지 세는 자리. */
export function collectTestFiles(baseDir: string = repoRoot): string[] {
  const files = new Set<string>();
  for (const root of ["apps/mobile", "apps/admin"]) {
    for (const file of walkFiles(join(baseDir, root), [".ts", ".tsx"])) {
      const relativePath = toRepoPath(file, baseDir);
      if (isTestFile(relativePath)) files.add(relativePath);
    }
  }
  return [...files].sort();
}

/** 이 이름을 잡고 있는 테스트 파일 전수(0건이면 그 항목은 사문이 아니라 그냥 죽은 코드다). */
export function findTestReferences(name: string, testSources: ReadonlyMap<string, string>): string[] {
  // ⚠️ `g` 없는 정규식을 새로 만든다 — 전역 정규식은 `lastIndex`를 들고 다녀서 같은 객체를 여러
  // 파일에 대고 `test`하면 **파일마다 다른 답**이 나온다(이 부류 스윕의 조용한 오답 하나).
  const pattern = new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`);
  return [...testSources.entries()]
    .filter(([, source]) => pattern.test(source))
    .map(([file]) => file)
    .sort();
}

// ── 갈래 ⓐ 이름이 고백하는 것 ─────────────────────────────────────────────────

export const NAME_CONFESSION_PATTERNS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
  readonly reason: string;
}[] = [
  {
    label: "reset-prefix",
    pattern: /^_{0,2}reset[A-Z]/,
    reason:
      "`reset…`은 **테스트 사이에 모듈 상태를 되돌리는 손**의 이름이다 — 제품 흐름에는 '되돌린다'는 " +
      "순간이 없다(앱은 한 번 뜨고 계속 산다). 이름 자체가 호출부가 테스트뿐임을 말한다."
  },
  {
    label: "for-tests-suffix",
    pattern: /ForTests$/,
    reason: "`…ForTests`는 관례가 아니라 문장이다 — 이름이 이미 '이유가 소스에 적힌 것'과 같은 일을 한다."
  },
  {
    label: "dunder-prefix",
    pattern: /^__[A-Za-z]/,
    reason:
      "`__`는 이 저장소에서 '제품이 부르지 않는 뒷문'의 표식이다(RN 런타임 전역 `__DEV__`와 같은 결). " +
      "⚠️ 오늘 이 표식을 단 사문은 하나이고 그 하나는 `ForTests`도 함께 달고 있다 — 표식 둘이 " +
      "겹치는 것은 문제가 아니다(고백은 많을수록 좋다)."
  }
];

/** 이 이름이 어떤 표식으로 자기가 테스트 전용이라고 말하는가(0건이면 이름은 아무 말도 하지 않는다). */
export function nameConfessions(name: string): string[] {
  return NAME_CONFESSION_PATTERNS.filter((entry) => entry.pattern.test(name)).map((entry) => entry.label);
}

// ── 갈래 ⓑ 이유가 소스에 있는 것 ──────────────────────────────────────────────

/** 라운드 71 리뷰 S-8이 세운 관례의 첫 문장. */
export const SOURCE_REASON_MARKER = "테스트 전용 export";

/** 같은 관례의 둘째 문장 — **왜 지우지 않는가**까지 적어야 이유다. */
export const SOURCE_REASON_KEEP_MARKER = "지우지 않는다";

/** 선언 줄 위로 몇 줄까지 그 관례를 찾는가(JSDoc 한 덩어리의 길이). */
export const SOURCE_REASON_LOOKBACK = 14;

export type SourceReasonProof = {
  readonly file: string;
  readonly markerLine: number;
  readonly keepLine: number;
  readonly text: string;
};

/**
 * 이 선언 **바로 위 주석 덩어리**에 관례가 실제로 적혀 있는가 — 소스로 확인한다.
 *
 * ⚠️ 줄 번호를 대장에 적지 않고 이렇게 찾는 이유: 줄은 라운드마다 밀리고, 밀린 줄을 못 박은
 * 계약은 **내용이 그대로인데도** 빨개진다(그리고 그때 사람이 하는 일은 수를 고치는 것뿐이라
 * 계약이 아무것도 지키지 못하게 된다).
 */
export function sourceReasonProof(item: ExportedFunction, baseDir: string = repoRoot): SourceReasonProof | null {
  const lines = readRepoFile(item.file, baseDir).split("\n");
  const start = Math.max(0, item.line - 1 - SOURCE_REASON_LOOKBACK);
  const block = lines.slice(start, item.line - 1);
  const markerIndex = block.findIndex((line) => line.includes(SOURCE_REASON_MARKER));
  const keepIndex = block.findIndex((line) => line.includes(SOURCE_REASON_KEEP_MARKER));
  if (markerIndex === -1 || keepIndex === -1) return null;
  return {
    file: item.file,
    markerLine: start + markerIndex + 1,
    keepLine: start + keepIndex + 1,
    text: block.slice(markerIndex).join("\n").trim()
  };
}

// ── 갈래 판정 ─────────────────────────────────────────────────────────────────

export type DeadExportReasonKind = "name-confesses" | "reason-in-source" | "reason-in-ledger";

/**
 * 항목의 갈래는 **손으로 적는 것이 아니라 재는 것**이다 — 대장의 `reasonKind`는 이 함수의
 * 산출과 대조되고, 갈리면 빨개진다(대장이 자기 갈래를 스스로 정하면 그 칸은 값이 아니다).
 *
 * 우선순위: 이름 → 소스 → 대장. ⚠️ 이름이 이미 고백하는 자리에 소스 주석이 함께 있어도 갈래는
 * `name-confesses`다 — 더 싼 근거가 이기는 순서이고, 그래야 갈래가 한 항목에 하나로 정해진다.
 */
export function classifyDeadExport(item: ExportedFunction, baseDir: string = repoRoot): DeadExportReasonKind {
  if (nameConfessions(item.name).length > 0) return "name-confesses";
  if (sourceReasonProof(item, baseDir)) return "reason-in-source";
  return "reason-in-ledger";
}

// ── 대장 ──────────────────────────────────────────────────────────────────────

export type DeadExportEntry = {
  /** `파일:이름` — 모집단 실측과 **집합으로** 대조된다(계약 ⓒ·ⓕ). */
  readonly id: string;
  readonly file: string;
  readonly name: string;
  /** 재어서 정해지는 갈래(위 `classifyDeadExport`와 대조된다). */
  readonly reasonKind: DeadExportReasonKind;
  /**
   * **왜 화면이 부르지 않는가.** 빈 문자열일 수 없다.
   *
   * ⚠️ `name-confesses`·`reason-in-source` 항목도 이 칸을 비워 두지 않는다 — 이름과 주석은
   * *"테스트 전용이다"* 까지만 말하고, *"그래서 오늘 사용자에게 보이는 결함이 있는가"* 는
   * 말하지 않는다. 그 한 문장이 이 대장이 다음 라운드에 주는 값이다.
   */
  readonly reason: string;
};

/**
 * ⚠️ **오늘의 스물둘 전수**(`export function` 16 + `export const` 6 · 모바일 20 · 어드민 2).
 * `MEASURED_ON` 기준 최종 실측이고, 계약이 이 목록을 **면제를 뺀 실측 집합**
 * (`ledgerRequiredDeadExports`)과 **양방향으로** 대조한다 — 새 사문이 생기면 빨개지고(래칫),
 * 항목이 되살아나도 빨개진다(유령 행 금지: 되살아난 줄을 남겨 두면 그 줄이 다음 사문을 가려 준다).
 *
 * ⚠️ **오늘 이 열여섯 중 사용자에게 보이는 결함은 0건이다** — 하나씩 판정했고 그 판정이 각 줄의
 * `reason`이다. 그래서 라운드 87은 **하나도 지우지 않았고**(제품 소스 0건 수정), 라운드 88 트랙 D도
 * 지우지 않았다(제품 소스에 더한 것은 **주석 아홉 덩이**뿐 — 코드는 0줄이다).
 *
 * ⚠️ **라운드 88 뒤에도 이 목록의 수는 열여섯 그대로다.** 그 사실이 두 가지를 함께 증명한다:
 * 트랙 D가 하나도 지우지 않았다는 것과, **주석 마스킹이 새지 않는다**는 것(마스킹이 샜다면 이유를
 * 적은 아홉이 이 목록에서 빠지며 수가 일곱으로 줄었을 것이다 — 옛 그물로 재면 실제로 일곱이다).
 */
export const DEAD_EXPORT_LEDGER: readonly DeadExportEntry[] = [
  {
    id: "apps/mobile/src/analytics/client.ts:getQueuedAnalyticsEventCount",
    file: "apps/mobile/src/analytics/client.ts",
    name: "getQueuedAnalyticsEventCount",
    reasonKind: "reason-in-source",
    reason:
      "메모리 큐의 길이는 **화면에 그려지지 않는다**(사용자에게 '보내지 못한 이벤트 3건'을 말하지 않는 것이 " +
      "이 큐의 설계다 — 분석은 조용히 실패해도 되는 축이다). 이 함수가 여는 것은 상한(MAX_QUEUE_SIZE)에서 " +
      "앞쪽이 잘리는지와 플러시 뒤 비는지를 밖에서 관측하는 창 하나이고, 그 창을 닫으면 두 판정이 " +
      "모듈 내부 변수로 숨는다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/analytics/client.ts:__resetAnalyticsClientForTests",
    file: "apps/mobile/src/analytics/client.ts",
    name: "__resetAnalyticsClientForTests",
    reasonKind: "name-confesses",
    reason:
      "모듈 수준 큐를 테스트 사이에 비우는 손이다. 제품 흐름에는 '앱을 되돌린다'는 순간이 없다 — " +
      "로그아웃 teardown조차 이 함수가 아니라 세션 정리 경로를 지난다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/auth/release-build.ts:isRealUserBuild",
    file: "apps/mobile/src/auth/release-build.ts",
    name: "isRealUserBuild",
    reasonKind: "reason-in-source",
    reason:
      "`isDeveloperBuild()`의 **부정 편의판**이다. 화면은 전부 긍정형으로 묻는다(개발자에게만 하는 말을 " +
      "'참일 때 세운다'가 이 축의 관례이고, 부정형으로 물으면 '실사용자에게만 세우는 것'이 되어 관례가 " +
      "두 방향으로 갈린다). 지우는 판단은 그 관례를 어느 방향으로 고정할지 정한 다음이다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/consent/consent-definitions.ts:hasPendingRequiredConsents",
    file: "apps/mobile/src/consent/consent-definitions.ts",
    name: "hasPendingRequiredConsents",
    reasonKind: "reason-in-source",
    reason:
      "화면은 '남았는가'(불리언)가 아니라 **'무엇이 남았는가'**(`pendingRequiredConsents`)와 " +
      "**'무엇을 보낼 것인가'**(`requiredConsentAcceptances`)를 묻는다 — 목록을 이미 손에 쥐고 있으면 " +
      "길이를 보면 되고, 그래서 술어판이 남았다. 같은 파일의 두 형제는 화면이 부른다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/consent/legal-links.ts:legalDocumentUrl",
    file: "apps/mobile/src/consent/legal-links.ts",
    name: "legalDocumentUrl",
    reasonKind: "reason-in-source",
    reason:
      "화면이 쓰는 복수형 `legalDocumentUrls()`의 **단수 편의판**이다 — 약관·개인정보 두 링크는 언제나 " +
      "같은 자리에 함께 서므로 화면은 한 번에 둘을 읽는다. ⚠️ `settings/support-links.ts:supportLinkUrl`이 " +
      "**같은 모양의 쌍둥이**다(그 파일이 이 파일을 이름으로 가리키며 형식만 가져갔다) — 그래서 이 둘은 " +
      "하나를 지우면 다른 하나도 함께 판정해야 한다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/import/bulk-run.ts:resetImportBulkRuns",
    file: "apps/mobile/src/import/bulk-run.ts",
    name: "resetImportBulkRuns",
    reasonKind: "name-confesses",
    reason:
      "일괄 반영의 진행 상태(모듈 수준 맵)를 테스트 사이에 비우는 손이다. 제품 경로에서는 작업이 " +
      "끝나면서 스스로 정리된다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/import/import-failure-messages.ts:isNamedImportFailure",
    file: "apps/mobile/src/import/import-failure-messages.ts",
    name: "isNamedImportFailure",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **라운드 87에 이유가 소스에 있던 둘 중 하나**(라운드 71 리뷰 S-8 관례). 소스가 '표가 아는 코드와 " +
      "모르는 코드의 경계를 값으로 지켜 둔다'며 **지우지 않는다**고 못 박았다 — 재시도 버튼을 이름 있는 " +
      "실패에서 접는 화면이 생기면 그때 필요한 술어다. ⚠️ **이 형식이 옳은 형식이고, 라운드 88 트랙 D가 " +
      "이 파일과 destructive-flow-messages.ts를 본보기로 삼아 나머지 아홉을 같은 형식으로 옮겼다 " +
      "(둘 → 열하나).**"
  },
  {
    id: "apps/mobile/src/import/preview-rows.ts:canBulkSelectImportRows",
    file: "apps/mobile/src/import/preview-rows.ts",
    name: "canBulkSelectImportRows",
    reasonKind: "reason-in-source",
    reason:
      "화면이 **더 넓은 판정으로 갈아탔다** — `app/import/[importJobId].tsx`가 `canStartImportBulkRun`을 " +
      "부른다(행 선택 가능 여부에 더해 대상 아이·진행 중 여부까지 함께 본다). 좁은 술어가 남은 것이지 " +
      "화면이 판정을 잃은 것이 아니다. ⚠️ **열여섯 중 유일하게 '대체되었다'가 이유인 자리**이고, " +
      "그래서 지우는 판단이 가장 싼 자리이기도 하다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/local-devices.ts:resetLocalDevicesForTests",
    file: "apps/mobile/src/notifications/local-devices.ts",
    name: "resetLocalDevicesForTests",
    reasonKind: "name-confesses",
    reason:
      "로컬 기기 목록 저장소를 테스트 사이에 비우는 손이다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/notification-preferences.store.ts:notificationTypeLabel",
    file: "apps/mobile/src/notifications/notification-preferences.store.ts",
    name: "notificationTypeLabel",
    reasonKind: "reason-in-source",
    reason:
      "화면은 종류 하나를 이름 짓는 대신 **목록(`NOTIFICATION_TYPE_OPTIONS`)을 그대로 돌면서** 스위치를 " +
      "그린다 — 이름은 그 순회 안에서 이미 손에 있다. 소스 주석도 '화면이 목록을 돌지 않고 한 종류만 " +
      "이름 지을 때 쓴다'고 그 조건을 적어 두었지만, **그 조건을 만족하는 화면은 오늘 0건**이다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/notifications/usePushDeviceRegistration.ts:resetPushRegistrationForTests",
    file: "apps/mobile/src/notifications/usePushDeviceRegistration.ts",
    name: "resetPushRegistrationForTests",
    reasonKind: "name-confesses",
    reason:
      "푸시 등록 훅의 모듈 수준 상태를 테스트 사이에 비우는 손이다(로그아웃 teardown 계약도 이 함수가 " +
      "아니라 세션 정리 경로를 잡는다). **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/offline/offline-aware-screens.ts:usesOfflineAwareLoadErrorCopy",
    file: "apps/mobile/src/offline/offline-aware-screens.ts",
    name: "usesOfflineAwareLoadErrorCopy",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **이 모듈은 설계상 화면이 import하지 않는다** — 자기 머리말이 '계약 전용 데이터라 앱 번들에 " +
      "실리지 않는다'고 적어 두었고, 이 술어는 그 대장을 읽는 세 계약 파일이 쓰는 손이다. " +
      "즉 이 한 줄은 **`export const` 축의 면제 사유가 `export function` 축으로 새어 나온 자리**이고, " +
      "그래서 이 대장의 사각(`export-const-axis`)이 왜 값으로 적혀야 하는지를 보여 주는 증거다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/query/query-client-registry.ts:resetAppQueryClientRegistryForTests",
    file: "apps/mobile/src/query/query-client-registry.ts",
    name: "resetAppQueryClientRegistryForTests",
    reasonKind: "name-confesses",
    reason:
      "쿼리 클라이언트 레지스트리를 테스트 사이에 비우는 손이다(세션 만료·로그아웃 teardown 계약 둘이 쓴다). " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/settings/destructive-flow-messages.ts:destructiveFlowFallbackMessage",
    file: "apps/mobile/src/settings/destructive-flow-messages.ts",
    name: "destructiveFlowFallbackMessage",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **라운드 87에 이유가 소스에 있던 둘 중 둘째**(같은 라운드 71 리뷰 S-8 관례). 화면은 `destructiveFlowErrorMessage` " +
      "하나만 부르고, 소스가 '스윕 계약이 흐름별 사용자 문장을 적을 때 쓰는 값이라 **지우지 않는다**'고 " +
      "적어 두었다 — 그 매핑을 테스트로 옮기면 표가 두 벌이 된다."
  },
  {
    id: "apps/mobile/src/settings/support-links.ts:supportLinkUrl",
    file: "apps/mobile/src/settings/support-links.ts",
    name: "supportLinkUrl",
    reasonKind: "reason-in-source",
    reason:
      "화면이 쓰는 복수형 `supportLinkUrls()`의 **단수 편의판**이다(FAQ·문의 두 링크가 한 자리에 함께 선다). " +
      "⚠️ `consent/legal-links.ts:legalDocumentUrl`과 **같은 모양의 쌍둥이**다 — 이 파일이 소스에 " +
      "'형식은 legal-links.ts에서 값이 아니라 형식만 가져왔다'고 적어 두었고(`:19`), 그래서 한 라운드가 " +
      "하나만 지우면 그 관례가 반쪽으로 남는다. " +
      "**오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/admin/src/lib/admin-api.ts:updateContentRevisionDraft",
    file: "apps/admin/src/lib/admin-api.ts",
    name: "updateContentRevisionDraft",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **계약의 문장이 거짓에 가까워진 자리.** `src/content-revisions.test.ts`가 " +
      "*\"exposes the full draft -> review -> publish surface\"* 라며 여덟 이름의 **소스 텍스트 포함**을 " +
      "단언하는데, 그중 이 하나는 **어느 화면도 부르지 않는다** — 어드민 세 화면(items·links·disclosures)은 " +
      "초안을 만들고 곧바로 제출하는 합성 함수 `draftAndSubmitContentRevision` 하나만 쓴다. " +
      "**'있다'는 단언과 '닿는다'는 사실이 갈렸다.** 서버 PATCH 엔드포인트 자체는 살아 있으므로 이 라운드는 " +
      "지우지 않고 **그 갈림을 값으로 적는다.** 오늘 사용자·운영자에게 보이는 결함 0건."
  },

  // ── 라운드 89 트랙 C — `export const` 축이 모집단으로 들어오며 선 여섯 줄 ─────────────────
  //
  // ⚠️⚠️ **이 여섯은 새 부채가 아니라 세는 자리가 늘어난 것이다.** 오늘 이전에도 여섯 다 호출부
  // 0건이었고, 다만 **모집단 밖에 살아서 아무도 세지 않았다.** 스물넷 중 열여덟은 결정 ③의 파생
  // 판정이 면제하고(대장에 줄이 없다 · 근거는 import 그래프와 실재하는 자리), 여기 여섯이 남는다.
  {
    id: "apps/mobile/src/analytics/events.ts:ANALYTICS_CATEGORY_CODES",
    file: "apps/mobile/src/analytics/events.ts",
    name: "ANALYTICS_CATEGORY_CODES",
    reasonKind: "reason-in-source",
    reason:
      "분류 코드 열둘의 **런타임 거울**이다 — 컴파일 시점의 단일 소스는 바로 위 `AnalyticsCategoryCode` 타입이고, " +
      "화면은 그 타입을 통해 코드를 넘기지 목록을 돌지 않는다. 이 배열이 있는 이유는 하나뿐이다: " +
      "`events.test.ts`가 이 열둘을 `packages/contracts/src/analytics.ts`의 같은 이름과 대조해 **두 벌이 갈라지지 " +
      "않게** 붙잡는다. ⚠️ 자리 표 축(결정 ③ ⓑ)으로는 면제되지 않는다 — 원소가 도메인 코드이지 제품 소스의 " +
      "자리가 아니다. 라운드 89 트랙 C가 그 사실을 소스 주석으로 적었다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/expenses/failed-row-prefill.ts:FAILED_ROW_LOCAL_ID_PARAM",
    file: "apps/mobile/src/expenses/failed-row-prefill.ts",
    name: "FAILED_ROW_LOCAL_ID_PARAM",
    reasonKind: "reason-in-ledger",
    reason:
      "⚠️⚠️ **오늘 대장에서 유일하게 '계약만 초록'조차 아닌 자리다.** 제품 소스도, 계약도, 저장소의 어떤 " +
      "파일도 이 이름을 부르지 않는다(같은 파일 머리말의 인용 한 줄이 전부다). 화면과 시트는 같은 값을 " +
      "**리터럴 `failedLocalId`**로 주고받고(`FailedRowPrefillParams`의 키가 그 리터럴이다), 그래서 이 상수는 " +
      "이름만 남은 편의판이다. ⚠️ **소스에 S-8 관례를 달지 않는다** — 그 관례의 문장은 *'테스트 전용 export'*" +
      "인데 테스트조차 부르지 않으므로 그 문장이 **거짓**이 된다. 이유가 대장에만 있는 갈래는 정확히 이런 " +
      "자리를 위해 살아 있었다. 지우는 판단은 URL 파라미터 이름을 리터럴로 둘지 상수로 모을지를 정한 다음이고, " +
      "그 결정은 이 트랙의 것이 아니다(제품 소스 바이트 불변). **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/import/import-failure-messages.ts:IMPORT_FAILURE_KINDS",
    file: "apps/mobile/src/import/import-failure-messages.ts",
    name: "IMPORT_FAILURE_KINDS",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **소스에 S-8 관례가 이미 붙어 있던 둘 중 하나**(라운드 88이 사각 칸에 *'그 관례 넷 중 둘이 오늘 " +
      "모집단 밖에 산다'* 고 적어 둔 그 둘이다 — 오늘 축이 들어오며 둘 다 모집단 안으로 왔고, **주석은 한 " +
      "글자도 고치지 않았다**). 화면은 걸음 이름을 리터럴로 넘기므로 이 목록을 부르지 않고, 도는 것은 " +
      "'네 걸음 전부에서 이렇게 보인다'를 세는 계약뿐이다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/offline/messages.ts:SYNC_STATUS_RETRY_ALL_LABEL",
    file: "apps/mobile/src/offline/messages.ts",
    name: "SYNC_STATUS_RETRY_ALL_LABEL",
    reasonKind: "reason-in-ledger",
    reason:
      "⚠️⚠️ **손 목록이 가리고 있던 그 한 자리다.** 라운드 87~88의 `CONTRACT_ONLY_DATA_MODULES`는 이 모듈의 " +
      "사문 셋을 *'문장이 아니라 무엇을 세는지 말하는 값'* 이라며 통째로 면제했는데, 이 상수는 사용자에게 " +
      "그려지는 문장(`전체 재시도`)이다. 화면이 부르지 않는 이유는 **더 좁은 라벨로 갈아탔기 때문**이다: " +
      "라운드 58 #4 이후 `app/sync-status.tsx`는 일괄 버튼에 대상과 건수를 직접 적는다(*'지출 3건 재시도'*) — " +
      "제외 규칙(권한 거절 · 재시도가 무익한 4xx) 때문에 '전체'가 실제로 전체가 아니어서다. 남은 소비자는 " +
      "그 갈림을 세는 계약 둘이고, 그 둘은 이 상수가 `SYNC_STATUS_RETRY_LABEL`을 그대로 품는지까지 문다. " +
      "⚠️ 이 트랙은 그 파일을 **읽기만 한다**(바이트 불변) — 그래서 이유가 소스가 아니라 여기 산다. " +
      "**오늘 사용자에게 보이는 결함 0건**(화면의 라벨이 더 정확한 쪽이다)."
  },
  {
    id: "apps/mobile/src/offline/sqlite-offline-store.ts:OFFLINE_DB_SCHEMA_VERSION",
    file: "apps/mobile/src/offline/sqlite-offline-store.ts",
    name: "OFFLINE_DB_SCHEMA_VERSION",
    reasonKind: "reason-in-source",
    reason:
      "마이그레이션 목록의 **마지막 번호에서 파생하는 값**이라 제품 경로에는 이 이름을 읽을 자리가 없다 — " +
      "러너는 `OFFLINE_DB_MIGRATIONS`를 직접 돌며 `PRAGMA user_version`과 맞추지 기대 버전을 따로 묻지 않는다. " +
      "부르는 것은 `sqlite-migrations.test.ts` 하나이고, 그 계약이 이 값으로 *'목록과 빌드가 같은 버전을 " +
      "말하는가'* 를 센다. 라운드 89 트랙 C가 그 사실을 소스 주석으로 적었다. **오늘 사용자에게 보이는 결함 0건.**"
  },
  {
    id: "apps/mobile/src/settings/destructive-flow-messages.ts:DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES",
    file: "apps/mobile/src/settings/destructive-flow-messages.ts",
    name: "DESTRUCTIVE_FLOW_ABSENT_TARGET_BRANCHES",
    reasonKind: "reason-in-source",
    reason:
      "⚠️ **소스에 S-8 관례가 이미 붙어 있던 둘 중 둘째**(주석 바이트 불변). 이 표가 담은 것은 사용자 문장이 " +
      "아니라 **문장이 서지 않는 흐름과 그 근거**다 — 화면은 읽을 것이 없고, 서버가 그 경로에 404 도메인 코드를 " +
      "만드는 날 계약이 빨개지며 '그때 사용자가 무엇을 보는가'를 묻는다. ⚠️ 자리 표 축으로 면제되지 않는 이유: " +
      "원소가 흐름 이름과 서버 근거 산문이지 제품 소스의 자리가 아니다. **오늘 사용자에게 보이는 결함 0건.**"
  }
  // ⚠️ 정찰이 열일곱째로 센 `apps/admin/src/lib/audit-log-filters.ts:hasAnyAuditLogFilter`는
  // **오늘 사문이 아니다** — 같은 라운드의 트랙 A가 `apps/admin/src/lib/audit-log-rows.ts`에서
  // 그 술어를 부르며 감사 로그 빈 표의 두 문장(*"아직 기록이 없어요"* / *"조건에 맞는 기록이
  // 없어요"*)을 갈랐다. 되살아난 줄을 대장에 남겨 두면 그 줄이 **다음 사문을 가려 주는 자리**가
  // 되므로(래칫이 하나 헐거워진다) 여기 두지 않고, 그 사실만 이 주석과 머리말에 값으로 남긴다.
];

/**
 * ⚠️ **래칫** — 사문 항목 수가 이 값을 넘지 않는다.
 *
 * 넘는 순간 새 사문이 생긴 것이고, 그때 두 답 중 **하나를 값으로 고르게 된다**: 지우거나(호출부가
 * 없으니 없어도 된다), 이유를 적거나(소스의 S-8 관례든 이 대장의 줄이든). 세 번째 답 — *"조용히
 * 둔다"* — 은 이 값이 막는다.
 *
 * ⚠️ 이 값을 **늘려서** 통과시키는 것은 래칫을 푸는 일이다. 줄이는 것은 언제나 옳다(항목이 실제로
 * 걷혔을 때 이 값과 그 줄을 함께 내린다).
 *
 * ⚠️⚠️ **라운드 89 트랙 C: 16 → 22.** 이 여섯은 **새 부채가 아니라 세는 자리가 늘어난 것**이다
 * (라운드 88 트랙 D가 세운 형식). `export const` 축이 모집단으로 들어오면서 오늘 이전에도 호출부
 * 0건이었던 스물넷이 처음 세어졌고, 그중 열여덟은 결정 ③의 파생 판정이 면제했다. **`export
 * function` 축의 열여섯은 한 줄도 움직이지 않았다** — 지운 export 0건 · 되살린 export 0건이다.
 * ⚠️ 그래서 이 값은 축을 되돌리는 방식으로 내려서는 안 된다: 내리는 유일한 옳은 길은 항목이
 * 실제로 걷히거나 호출부를 얻는 것이다.
 *
 * ⚠️⚠️ **라운드 90 트랙 C: 22 → 22.** 문자열 리터럴 축이 그물에 들어오며 **세는 자리가 넷 늘었지만**
 * (사문 40 → 44) 그 넷이 전부 결정 ③ 축 ⓑ(자리 표)로 면제돼 **대장의 줄은 0이 늘었다.**
 * ⚠️ 값이 그대로인 것과 *"아무 일도 없었다"* 는 다르다 — 그 갈림은 `RATCHET_HISTORY`의 라운드 90
 * 줄과 `findDeadExportsBeforeStringMasking`(40) · `findDeadExports`(44) 두 자가 값으로 진다.
 */
export const DEAD_EXPORT_RATCHET = 22;

/**
 * ⚠️ **래칫의 타입**(계약 ⓔ · 라운드 90 트랙 C) — 래칫은 **값과 타입 양쪽**에 걸린다.
 *
 * `DEAD_EXPORT_RATCHET`은 `number`가 아니라 리터럴 타입 `22`이고, 계약 파일이 못 박은 항목 id
 * 튜플의 `length`와 **타입 수준에서** 맞춰진다. 그래서 새 `export const`가 이유 없이 죽어 대장에
 * 스물셋째 줄이 붙는 날, 값 단언(`vitest`)이 빨개지기 전에 **`tsc --noEmit`가 먼저 빨개진다** —
 * 두 자리 중 한쪽만 고쳐서 통과시키는 길이 막힌다.
 */
export type DeadExportRatchet = typeof DEAD_EXPORT_RATCHET;

/**
 * 래칫이 축을 넓히며 지나온 자리 — **줄어들지 않는다는 사실을 값으로 남긴다.**
 *
 * ⚠️ 이 배열이 없으면 다음 라운드가 *"예전에는 16이었는데 왜 22인가"* 를 산문으로만 만나고, 그때
 * 가장 싼 답은 축을 도로 좁히는 것이다. 무엇이 언제 왜 늘었는지가 값으로 서 있으면 그 답이 막힌다.
 */
export const RATCHET_HISTORY: readonly {
  readonly round: number;
  readonly value: number;
  readonly why: string;
}[] = [
  { round: 87, value: 16, why: "`export function` 축의 사문 열여섯으로 대장이 섰다(트랙 E)." },
  {
    round: 88,
    value: 16,
    why: "아홉의 이유를 소스 주석으로 옮겼다 — 먼저 마스킹, 그다음 주석이라 수는 그대로다(트랙 D)."
  },
  {
    round: 89,
    value: 22,
    why:
      "`export const` 축이 모집단으로 들어왔다(트랙 C). 늘어난 여섯은 새 부채가 아니라 **세는 자리가 " +
      "늘어난 것**이다 — 스물넷 중 열여덟은 결정 ③의 파생 판정이 면제했고, `export function` 축의 " +
      "열여섯은 한 줄도 움직이지 않았다."
  },
  {
    round: 90,
    value: 22,
    why:
      "문자열 리터럴 축이 그물에 들어왔다(트랙 C). 사문이 40 → 44로 늘었지만 **세는 자리가 늘어난 " +
      "것**이고, 늘어난 넷(`shared-cache-policy.ts`의 표 상수)은 전부 결정 ③ 축 ⓑ가 면제해 **대장의 " +
      "줄은 0이 늘었다** — 그래서 값이 22 그대로다. 면제는 18 → 22(자리 표 축 11 → 15), 모듈 수는 " +
      "6 그대로이고, `export function` 축의 열여섯도 한 줄도 움직이지 않았다."
  }
];

// ── 사각을 값으로 (AA-4의 규율을 태어날 때부터) ───────────────────────────────

/**
 * ⚠️⚠️ **라운드 88까지 이 자리에 `CONTRACT_ONLY_DATA_MODULES` 손 목록이 있었다** — 경로 다섯과
 * 이유 다섯을 사람이 적고, 계약은 *"그 다섯이 실재하는가"* 만 물었다.
 *
 * 라운드 89 트랙 C가 그 목록을 **파생 판정**(결정 ③ · `contractOnlyDataProof`)으로 바꿨다.
 * 왜 바꿨는지는 값으로 남긴다: 그 손 목록의 이유 한 줄이 **오늘 거짓이었다.**
 * `offline/messages.ts`의 이유는 *"여기 남은 사문 셋은 문장 자체가 아니라 무엇을 세는지 말하는
 * 값(teardown 대상 목록·스윕용 라벨)"* 이라고 적었는데, 그 셋 중 `SYNC_STATUS_RETRY_ALL_LABEL`은
 * **사용자에게 그려지는 문장**(`전체 재시도`)이다. 파생 판정은 그 상수를 면제하지 않고, 그래서
 * 오늘 그 자리가 **대장의 줄**이 됐다(아래 `DEAD_EXPORT_LEDGER`).
 *
 * ⚠️ 그 목록이 걸치던 다섯 모듈은 지금도 전부 면제 쪽에 있고(`contractOnlyDataModules()`가
 * 파생으로 다시 낸다 · 오늘은 여섯 모듈이다 — `apps/admin/src/lib/load-error-copy.ts`가 같은
 * 성질로 파생된다), **다른 것은 그 판정을 누가 했는가뿐이다.**
 */
export const HAND_LIST_REPLACED_BY_DERIVATION =
  "CONTRACT_ONLY_DATA_MODULES(라운드 87~88의 손 목록 다섯) → contractOnlyDataProof(라운드 89 트랙 C의 파생 판정)";

/** 파생 판정이 면제한 `export const` 사문 전수 — 옛 손 목록이 세던 그 수의 자리다. */
export function deadConstantsInContractOnlyModules(baseDir: string = repoRoot): ExportedFunction[] {
  return contractOnlyExemptions(baseDir)
    .map((entry) => entry.item)
    .filter((item) => item.kind === "const");
}

/**
 * 모집단 이름 가운데 제품 소스 어딘가에 **속성·키 자리**로도 나오는 것 — 이름 훑기의 사각.
 *
 * ⚠️ 이 수가 말하는 것: 그 이름들에 대해서는 *"텍스트가 한 번 나왔다"* 가 **호출의 증거가 아니다**
 * (`api.listItems`도, `{ listItems: … }`도 한 번의 일치다). 오차의 방향은 **사문을 놓치는 쪽**이라
 * 이 대장은 거짓 빨강이 아니라 거짓 초록으로 죽는다 — 그래서 값으로 적어 둔다.
 */
export function namesAlsoUsedAsProperty(baseDir: string = repoRoot): string[] {
  const sources = [...readCallsiteSources(baseDir).values()];
  const found: string[] = [];
  for (const item of collectPopulation(baseDir)) {
    const pattern = new RegExp(`\\.\\s*${item.name}(?![\\w$])|(?<![\\w$])${item.name}\\s*:`);
    if (sources.some((source) => pattern.test(source))) found.push(item.name);
  }
  return [...new Set(found)].sort();
}

/** `.tsx`의 `export function`(컴포넌트·훅) 전수 — 모집단 밖의 축이 얼마나 큰가. */
export function tsxExportFunctionCount(baseDir: string = repoRoot): number {
  let count = 0;
  for (const root of ["apps/mobile/app", "apps/mobile/src", "apps/admin/app", "apps/admin/src"]) {
    for (const file of filesUnder(root, [".tsx"], ["local-backend", "local-fixtures"], baseDir)) {
      for (const line of readRepoFile(file, baseDir).split("\n")) {
        if (/^export\s+(?:default\s+)?(?:async\s+)?function\s/.test(line)) count += 1;
      }
    }
  }
  return count;
}

export type LedgerBlindSpot = {
  readonly id: string;
  /** `MEASURED_ON` 기준 실측값 — **산문이 아니라 값이다.** */
  readonly value: number;
  /**
   * 계약이 다시 재어 대는 **하한**.
   *
   * ⚠️ 하한이지 등호가 아닌 이유: 이 수들은 A~D 트랙이 화면 한 줄만 고쳐도 흔들린다. 계약이 무는
   * 것은 *"적어 둔 사각이 실은 없다"*(유령 사각)이고, 그 판정에 필요한 것은 하한이다. `value`가
   * 오래되면 그것은 다음 라운드가 값을 다시 재라는 신호이지 계약의 실패가 아니다.
   */
  readonly floor: number;
  /** 사각의 문장 — 빈 문자열일 수 없다. */
  readonly statement: string;
  /** 오늘 다시 재는 자(없으면 계약은 문장과 값만 센다). */
  readonly measure?: (baseDir: string) => number;
};

/**
 * ⚠️⚠️ **닫힌 사각** — 재개 조건이 발동해 그물 안으로 들어온 자리.
 *
 * 지우지 않고 여기로 옮기는 이유: 사각 칸에서 그냥 사라지면 다음 라운드가 *"이 축은 왜 세지 않지"*
 * 를 다시 묻고 **다시 세고 나서 어디에도 적지 못한다**(AA-4의 규율이 막으려던 그 자리다).
 * 닫힌 자리는 **무엇이 언제 닫았는지**를 값으로 들고 산다.
 */
export const CLOSED_BLIND_SPOTS: readonly {
  readonly id: string;
  readonly closedInRound: number;
  readonly statement: string;
}[] = [
  {
    id: "export-const-axis",
    closedInRound: 89,
    statement:
      "라운드 87·88의 사각: *'같은 뿌리·같은 조건으로 `export const` 축을 재면 652 중 24가 호출부 0건이다 … " +
      "모집단에 넣지 않았다'*. 그 칸이 적어 둔 재개 조건은 **결정형**이었다: *'계약 전용 데이터 모듈을 뿌리에서 " +
      "가르는 판정이 서는 날 — 그날 이 축이 모집단으로 들어온다'*. ⚠️ **라운드 89 트랙 C가 그 판정을 세웠고" +
      "(결정 ③ · CONTRACT_ONLY_AXES) 축이 들어왔다.** 오늘 그 24는 사각이 아니라 모집단의 산출이다 — " +
      "열여덟은 파생 판정이 면제하고 여섯은 대장의 줄이다."
  },
  {
    id: "contract-only-data-modules",
    closedInRound: 89,
    statement:
      "라운드 87·88의 사각: *'그 스물넷 중 열일곱이 다섯 모듈에 산다'* — 그 열일곱이 `export const` 축을 밖에 " +
      "두는 이유 전체였다. ⚠️ 오늘 그 수는 사각이 아니라 **면제의 크기**이고, 세는 손이 바뀌었다: 손으로 적은 " +
      "모듈 다섯이 아니라 파생 판정이 낸 여섯 모듈·열여덟 자리다(`contractOnlyExemptions`). ⚠️ 그리고 그 " +
      "손 목록의 이유 한 줄은 **거짓이었다** — `SYNC_STATUS_RETRY_ALL_LABEL`은 계약이 읽는 값이 아니라 사용자 " +
      "문장이고, 파생 판정이 그것을 면제에서 꺼내 대장의 줄로 옮겼다."
  },
  {
    id: "string-literal-references",
    closedInRound: 90,
    statement:
      "라운드 88·89의 사각: *'문자열 리터럴은 아직 참조로 센다 — 이름이 문자열 안에 있기만 해도 호출부 1건이다'*. " +
      "그 칸이 적어 둔 재개 조건은 **사건형**이었다: *'참조가 전부 문자열뿐인 export가 0을 넘는 날 — 그날 이 " +
      "그물은 문자열도 마스킹해야 한다'*. 라운드 89 트랙 C가 `export const` 축을 들이며 그 수를 0에서 **넷**으로 " +
      "만들어 조건을 **발동시킨 채 넘겼고**(한 그물에 축 둘을 얹지 않는 규율), ⚠️⚠️ **라운드 90 트랙 C가 그 " +
      "축을 그물에 넣었다.** 실측: 사문 **40 → 44** · 대장의 줄 **22 → 22(+0)** · 면제 **18 → 22** · 모듈 " +
      "**6 그대로** — 늘어난 넷은 `shared-cache-policy.ts`의 `CHILDREN_WRITE_APIS` · `CHILDREN_WRITE_LEDGER` · " +
      "`SHARED_KEY_COVERAGE` · `EXPENSE_WRITE_LEDGER`(라운드 89가 이름까지 값으로 적어 두고 넘긴 그 넷)이고, " +
      "넷 다 **같은 파일 안의 표 설명 문자열**이 자기 이름을 인용해서 살아 있던 자리라 결정 ③ 축 ⓑ가 면제한다" +
      "(라운드 89 C가 *'대장의 줄은 0이 는다'* 고 적은 예상과 실측이 **갈리지 않았다**). " +
      "⚠️⚠️ **닫으면서 반대 방향의 사각 하나가 열렸다** — 문자열을 지우는 그물은 문자열 열쇠로만 닿는 참조를 " +
      "보지 못하고, 그 오차는 **거짓 빨강**이다. 그 자리는 `string-keyed-dynamic-access`가 값과 하한으로 진다: " +
      "닫힌 사각이 다음 사각을 낳았다는 사실까지가 이 줄의 값이다."
  }
];

export const LEDGER_BLIND_SPOTS: readonly LedgerBlindSpot[] = [
  {
    id: "derived-exemptions",
    value: 22,
    floor: 8,
    statement:
      "⚠️ **면제된 스물둘에는 대장의 줄이 없다** — 그 자리를 붙잡고 있는 것은 결정 ③의 파생 판정 하나뿐이다. " +
      "판정이 언젠가 지나치게 넓어지면(예: `importersOfModule`이 새 별칭 경로를 못 읽어 '번들 밖'을 잘못 세면) " +
      "그만큼의 사문이 **소리 없이** 대장 밖으로 나간다. 오차의 방향은 다른 사각들과 같은 **거짓 초록**이다. " +
      "⚠️ 그래서 계약 ⓓ가 면제 수·모듈 수·근거 전수를 사문 전수와 함께 대조하고, 이 줄이 그 수를 값으로 진다. " +
      "⚠️⚠️ **그리고 그 '소리 없이'는 오늘 사실이 아니다 — 등호 핀이 먼저 막는다**(라운드 89 리뷰 L-1): " +
      "계약이 면제 수를 `toBe(22)`, 모듈 수를 `toBe(6)`로 **등호**로 못 박고 있어서, 판정이 넓어져 한 자리라도 " +
      "더 면제하는 순간 **그 등호가 빨개진다**(사문 전수 `toBe(44)`·`면제 + 대장 = 전수`도 같은 걸음에 함께 문다). " +
      "즉 거짓 초록이 흘러가는 길은 *'대장 밖으로 조용히 나간다'* 가 아니라 *'등호를 사람이 손으로 올린다'* 이고, " +
      "그 한 줄의 변경이 곧 신호다. 이 사각이 남아 있는 이유는 그 등호가 **수만 보고 신원은 보지 않기** 때문이다 — " +
      "면제 하나가 빠지고 다른 하나가 들어오면 수는 그대로다. " +
      "⚠️ **오늘 값으로 든 오매치 표면 하나**: 축 ⓑ의 후보 낱말이 `resolveProductLocator`의 라우트 갈래에 들어갈 때 " +
      "**`\"/\"` 한 글자가 라우트로 풀렸다** — `app` + `/` + `/index.tsx`가 이어져 근거 경로에 `//`가 박힌 " +
      "`apps/mobile/app//index.tsx`를 자리로 내민다(그 `//` 오타가 이 오매치의 지문이다). 원소 하나만 그렇게 풀려도 " +
      "표 전체가 `locator-table` 축에 실려 면제를 살 수 있다. ⚠️ **오늘 실피해는 0건**이었다(면제 전수의 근거 " +
      "전수에 `//`를 지닌 자리 0건). 라운드 89 리뷰가 `locatorCandidates`에서 **한 글자 토큰을 배제**해 그 표면을 " +
      "닫았고, **닫은 뒤 다시 재도 면제 열여덟·모듈 여섯 그대로**다(등호 핀 둘 다 초록) — 배제의 비용이 0이라는 " +
      "사실이 그 수로 선다. 두 글자 이상의 슬래시뿐인 토큰(`\"//\"`)은 여전히 같은 갈래로 풀리고, 오늘 그런 원소도 0건이다. " +
      "⚠️⚠️ **라운드 90 트랙 C의 재실측 — 이 문턱이 여유를 다 썼다: 18/40(여유 둘) → 22/44(여유 0).** " +
      "문자열 축이 들어오며 늘어난 사문 넷이 **전부 면제 쪽으로** 떨어져 분자와 분모가 함께 넷씩 늘었고, 그래서 " +
      "면제 수는 오늘 사문 전수의 **정확히 절반**이다 — *넘는* 것은 아니므로 이 트랙은 판정을 좁히지 않는다" +
      "(⚠️ 문턱은 *절반 초과*이지 *절반 도달*이 아니고, 오늘 조건을 넘겨 짚어 판정을 좁히면 그것은 계약이 " +
      "요구하지 않은 손이다). ⚠️ **다음 라운드에는 여유가 없다**: 면제가 하나만 더 늘고 대장이 그대로면 그날 " +
      "이 조건이 발동한다. " +
      "⚠️ 재개 조건(사건형): 면제 수가 사문 전수의 절반을 넘는 날 — 그날 이 판정은 다시 좁혀져야 한다" +
      "(오늘 44 중 22 — **여유 0**).",
    measure: (baseDir) => contractOnlyExemptions(baseDir).length
  },
  {
    id: "export-const-axis-outside-population",
    value: 0,
    floor: 0,
    statement:
      "⚠️ 축이 들어왔지만 **`.tsx`의 `export const`와 `apps/api/**`·`packages/**`의 `export const`는 오늘도 밖이다.** " +
      "값이 0인 것은 측정값이 아니라 **미측정**이고, 그 사실을 0으로 적어 두는 것이 이 줄의 일이다(아래 " +
      "`outside-two-apps`와 같은 모양). ⚠️ 재개 조건(사건형): 그 뿌리 중 하나를 세는 라운드가 오는 날."
  },
  {
    id: "common-name",
    // 두 시점(기능 라운드 1 통합): 226(라운드 89 C) → 229 — 새 기능 모듈의 export function 이름 셋이
    // 속성/키 자리로도 나오며 사각이 함께 자랐다(모집단이 는 것이지 새 병이 아니다 — 아래 77→226과 같은 결).
    // 두 시점(토스 라운드 통합): 229 → 228 — T2 홈 개편이 삼항 `HOME_SECTIONS_COLLAPSE_LABEL : …`을
    // 걷었다. 그 `이름 :` 모양을 이 그물은 객체 키로 읽었으므로(삼항의 `:`를 가르지 못한다 — 이
    // 사각이 말하는 바로 그 오독), 줄어든 것은 사용이 아니라 **오독 표면**이다. 줄어든 쪽도 값이다.
    // 두 시점(라운드 99 F3·F4): 228 → 230 — RECORDS_VIEW_MODE_LIST(달력 착지 비저장 오버라이드)와
    // useAnalyticsConsentStore(teardown 대장 등재)의 이름이 속성/키 자리로도 나오며 표면이 둘
    // 자랐다(git 워크트리 대조 실측 — 모집단이 는 것이지 새 병이 아니다).
    value: 230,
    floor: 20,
    statement:
      "⚠️⚠️ **라운드 89 트랙 C의 재측정 — 모집단이 넓어지며 이 사각도 함께 넓어졌다: 77 → 226.** " +
      "적힌 값(77)과 **넓히기 전 축으로 다시 잰 오늘 값(77)은 정확히 같았다**(정찰 #3의 일곱 자리 대조와도 " +
      "같다) — 늘어난 149는 `export const` 축 652가 모집단에 들어오며 처음 세어진 자리이고, **새 사각이 " +
      "아니라 세는 자리가 늘어난 것**이다. 상수 이름은 함수 이름보다 객체 키 자리에 훨씬 자주 서므로(표의 " +
      "키·설정 객체) 비율이 더 높은 것이 자연스럽고, 그 사실 자체가 이 사각이 왜 하한인지를 말한다. " +
      "아래는 라운드 87~88이 이 자리에 남긴 문장 그대로다. " +
      "이 그물은 **이름의 텍스트**를 훑지 해석된 참조를 보지 않는다. 모집단 1018 이름 중 77은 제품 소스 " +
      "어딘가에 속성 접근(`api.listItems`)이나 객체 키(`listItems:`) 자리로도 나온다 — 그 이름들에 대해서는 " +
      "한 번의 텍스트 일치가 호출의 증거가 아니다. ⚠️ 오차의 방향은 **사문을 놓치는 쪽**이고(거짓 초록), " +
      "그래서 오늘의 열여섯은 하한이지 상한이 아니다. AA-4가 이름 붙인 바로 그 사각이다. " +
      "⚠️ **라운드 87 리뷰 M-2의 정정**: 이 자리에 적혀 있던 수는 76이었는데 `namesAlsoUsedAsProperty()`를 " +
      "돌리면 트랙 E 커밋 시점에도 77이었다 — 코드가 갈린 것이 아니라 **옮겨 적기 오차**였다. " +
      "**라운드 87 리뷰 이후**의 값은 실행값 77이다. ⚠️ **라운드 88 트랙 D의 재측정**: 분자는 오늘도 " +
      "77이고 분모만 1016 → 1018로 움직였다(같은 라운드의 트랙 A가 어드민 `src/lib`에 export를 더하는 중이라 " +
      "이 분모는 **한 라운드 안에서도 흔들린다** — 그래서 계약이 무는 것은 값이 아니라 하한이다). " +
      "⚠️ 이 자리는 **주석 마스킹과 무관하다**: 속성·키 자리로 나오는지는 마스킹 전후가 같은 질문이다. " +
      "⚠️⚠️ **라운드 90 트랙 C의 재실측: 오늘도 226**(문자열 마스킹을 켜기 전과 켠 뒤가 같다 — " +
      "`namesAlsoUsedAsProperty`는 마스킹하지 않은 소스에 대고 `.name`·`name:` 자리를 묻고, 그 질문은 " +
      "그물이 무엇을 지우든 같은 답을 낸다). ⚠️ **그리고 이 사각의 오차 방향은 오늘도 거짓 초록이다** — " +
      "새로 열린 `string-keyed-dynamic-access`만 반대 방향이고, 둘을 한 낱말로 적지 않는다.",
    measure: (baseDir) => namesAlsoUsedAsProperty(baseDir).length
  },
  {
    id: "comment-and-string-references",
    value: 20,
    floor: 5,
    statement:
      "⚠️⚠️ **라운드 89 트랙 C의 재측정: 9 → 20**(함수 축 아홉은 그대로이고 상수 축에서 열하나가 더 나왔다). " +
      "즉 **마스킹이 없었다면 오늘 모집단의 사문 마흔 중 스물이 조용히 사라졌을 것**이다 — 라운드 88이 " +
      "주석 마스킹을 먼저 배우지 않았다면 `export const` 축은 들어오는 날 절반이 새는 채로 들어왔다. " +
      "**순서가 계약이었다는 문장이 축을 넓히며 한 번 더 증명됐다.** 아래는 라운드 88이 남긴 문장 그대로다. " +
      "⚠️ **이 사각의 재개 조건이 라운드 88에 발동했고, 그물이 마스킹을 배웠다.** 라운드 87의 문장은 " +
      "*'`findProductReferences`는 소스를 마스킹 없이 훑는다 … 재개 조건(사건형): 이 재측정이 0을 넘는 날'* " +
      "이었고, 그때의 실측은 **16 → 16 · 참조가 전부 주석뿐인 export 0건**이었다(실피해 0). " +
      "라운드 88 트랙 D가 **아홉의 이유를 소스 주석으로 옮기면서** 그 0이 **9**가 됐다 — 이유 주석은 " +
      "*'화면이 왜 이 이름을 부르지 않는가'* 를 적으므로 그 export의 이름을 부를 수밖에 없기 때문이다. " +
      "**그래서 순서가 계약이었다: 먼저 마스킹, 그다음 주석.** 오늘의 값(`measure`)은 **참조가 전부 " +
      "주석뿐인 export 9건**이고, 그 아홉이 정확히 트랙 D가 이유를 적은 아홉이다. " +
      "⚠️ **마스킹 전후의 갈림**: 같은 소스를 옛 그물(마스킹 없음)로 재면 사문은 **7**이고, 오늘의 " +
      "그물로 재면 **16**이다. 마스킹이 없었다면 아홉이 래칫 아래로 조용히 사라지고 이 대장은 " +
      "**아무것도 지키지 못한 채 초록**이었다 — 라운드 87이 사각 칸에 미리 적어 둔 바로 그 죽는 방식이다. " +
      "⚠️ 마스킹은 **주석까지만**이다: 문자열 리터럴은 여전히 참조로 세고, 그 축은 아래 " +
      "`string-literal-references`가 값과 하한으로 따로 진다. " +
      "— 여기까지가 라운드 88·89의 문장이다. ⚠️⚠️ **라운드 90 트랙 C의 재실측: 오늘도 20이다.** " +
      "그리고 그 마지막 문장은 오늘 낡았다 — 문자열 축이 그물로 들어왔고, 그 사각은 " +
      "`CLOSED_BLIND_SPOTS`로 옮겼다. ⚠️⚠️ **그래서 이 줄의 자는 오늘 `findDeadExports`(문자열까지 " +
      "지우는 그물)가 아니라 `findDeadExportsBeforeStringMasking`(주석만 지우는 자) 위에서 센다** — " +
      "새 그물 위에서 세면 이 수가 *'주석뿐'* 이 아니라 *'주석이나 문자열뿐'* 이 되어 24가 되고, 두 축의 " +
      "값이 한 낱말로 뭉개진다. **주석 축 20 · 문자열 축 4**는 서로 다른 두 수다.",
    measure: (baseDir) => commentOnlyReferenceExports(baseDir).length
  },
  {
    id: "string-keyed-dynamic-access",
    // 두 시점(토스 라운드 통합): 55(라운드 89·90 같은 수) → 56 — T1의 새 훅 useReducedMotion은
    // **파일 이름이 export 이름과 같아** import 경로 문자열("./ui/useReducedMotion")이 그 이름을 담는다.
    // 코드 참조(호출)가 함께 있어 판정이 움직인 자리는 오늘도 넷 그대로다 — 실피해 여전히 0건.
    value: 56,
    floor: 10,
    statement:
      "⚠️⚠️ **라운드 90 트랙 C가 `string-literal-references`를 닫으며 연 자리 — 오차의 방향이 뒤집혔다.** " +
      "라운드 88·89에는 문자열이 참조로 세어졌고, 그래서 그 사각의 오차는 다른 사각들과 같은 **거짓 초록**" +
      "(*사문을 놓치는 쪽*)이었다. 오늘의 그물은 문자열의 글자를 지우므로, 이름에 **오직 문자열로만** 닿는 " +
      "자리(`registry[\"legalDocumentUrl\"]` 꼴의 동적 접근 · 문자열 열쇠 표 · 배럴의 문자열 재export)는 " +
      "참조로 세어지지 않는다 — 즉 **살아 있는 export가 사문으로 세어질 수 있다(거짓 빨강)**. " +
      "⚠️ 이 대장이 지금껏 낸 적 없는 방향이라 값으로 못 박아 둔다: 사각의 크기가 아니라 **오차의 방향이** " +
      "이 줄의 새로움이다. " +
      "⚠️ **오늘 실피해는 0건이다.** 참조가 문자열 안에도 있는 모집단 이름은 **55**이고(라운드 89의 55와 " +
      "같은 자 · 같은 수 — 분모가 바뀌지 않았다), 그중 **코드 참조가 0건이라 새로 사문이 된 것은 넷**이며, " +
      "그 넷은 전부 `shared-cache-policy.ts`의 표 상수라 결정 ③ 축 ⓑ(자리 표)가 이미 면제한다. 나머지 " +
      "쉰하나는 코드 참조를 함께 갖고 있어 판정이 움직이지 않았다. **그래서 55는 상한이 아니라 하한**이다 — " +
      "이 수가 말하는 것은 *'그 이름들에 대해서는 문자열 한 번이 이제 호출의 증거가 아니다'* 뿐이다. " +
      "⚠️⚠️ **템플릿 `${…}` 안은 이 사각에 들어오지 않는다** — 마스킹이 그 안을 코드로 남기므로 " +
      "`` `${legalDocumentUrl(kind)}` `` 은 오늘도 호출부 1건이다. 그 갈래는 저장소에 그 모양이 있느냐와 " +
      "무관하게 **합성 소스로** 계약에 박혀 있다(계약 ⓐ). 지우는 쪽으로 되돌리는 순간 살아 있는 호출부가 " +
      "사문으로 세어지고, 계약이 그 자리에서 빨개진다. " +
      "⚠️ 재개 조건(사건형): 문자열 열쇠로만 닿는 export가 **대장의 줄을 요구하는 날** — 즉 이 사각이 낸 " +
      "거짓 빨강이 처음 하나 서는 날(오늘 0건). 그날 이 그물은 문자열 안의 이름을 **한 번 더** 갈라야 한다" +
      "(따옴표만으로는 열쇠와 문장을 가르지 못한다). " +
      "⚠️⚠️ **거짓 빨강의 문이 이 자리 하나가 아니다**(라운드 90 리뷰 M-3): 이 줄이 세는 것은 *참조를 못 " +
      "보는* 쪽이고, **스캐너가 문자열의 경계를 잘못 잡아 코드를 지우는** 쪽은 아래 " +
      "`jsx-apostrophe-string-masking`이 표면 **105**·실피해 **0건**으로 따로 진다 — 방향이 같다고 한 줄로 " +
      "묶으면 둘 중 하나가 고쳐졌을 때 나머지 하나가 소리 없이 그 줄에 얹혀 산다.",
    measure: (baseDir) => namesReferencedInsideStringLiterals(baseDir).length
  },
  {
    id: "jsx-apostrophe-string-masking",
    // 두 시점(토스 라운드 통합): 105 → 106(호출부 분모도 328 → 330) — T1의 use-transient-notice.ts가
    // 주석에 ASCII '(more.tsx's)를 지닌 채 호출부 모집단에 들어와 표면이 한 파일 자랐다.
    // 실피해는 오늘도 0건이다(apostropheMaskedCodeSites() 실측 — 아래 문장의 그 0과 같은 자).
    // 두 시점(라운드 99 F2): 106 → 107 — pending-status.ts가 아이 경계 수리의 주석에 ASCII '를
    // 지닌 채 표면에 들어왔다(수정 전 0 → 후 1, git 대조 실측). 실피해 0은 그대로다.
    value: 107,
    floor: 60,
    statement:
      "⚠️⚠️ **같은 거짓 빨강의 둘째 문 — 이번엔 참조가 아니라 *스캐너*가 낸다**(라운드 90 리뷰 M-3). " +
      "위 `string-keyed-dynamic-access`는 *문자열로만 닿는 참조를 못 본다*는 사각이고, 이 줄은 " +
      "**문자열의 경계를 잘못 잡아 코드를 지워 버릴 수 있다**는 사각이다 — 둘 다 방향이 거짓 빨강이지만 " +
      "원인이 다르므로 한 낱말로 적지 않는다. " +
      "⚠️ **기전**: `skipQuotedString`은 ASCII `'`를 여는 따옴표로 읽는데, JSX 텍스트의 어포스트로피는 " +
      "코드가 아니라 글자다. 한 줄에 **짝으로** 서면 그 사이가 통째로 공백이 되고, 지워진 곳에 살아 있는 " +
      "호출부가 있었다면 그 export가 **사문으로 세어진다**. 합성 소스로 재현된다: " +
      "`<Text>Don't stop {renderFooter()} it's fine</Text>` → `renderFooter`가 사라진다. " +
      "한 줄에 하나만 있으면 줄바꿈에서 `null`이 돌아와 아무것도 지워지지 않는다(한 줄 가두기) — " +
      "**짝이 맞는 둘**이 그 가두기를 빠져나가는 유일한 모양이다. " +
      "⚠️⚠️ **오늘 실피해는 0건이다**(`apostropheMaskedCodeSites()` — 미측정의 0이 아니라 **실측의 0**이다). " +
      "제품 소스의 인용부호가 전각 `‘ ’`이고 ASCII `'`가 JSX 텍스트에 짝으로 선 자리가 오늘 없기 때문이다. " +
      "⚠️ **아래 `measure`가 세는 것은 피해가 아니라 표면**이다 — 호출부 319 가운데 ASCII `'`를 한 글자라도 " +
      "지닌 파일 **105**. 그 파일들에서만 이 오해가 일어날 수 있으므로 105가 사각의 크기이고, 0은 그 표면 " +
      "위에서 오늘 아무 일도 일어나지 않았다는 실측이다. " +
      "⚠️ 재개 조건(사건형): `apostropheMaskedCodeSites()`가 처음 0을 넘는 날 — 그날의 답은 대장에 줄을 " +
      "더하는 것이 아니라 **이 스캐너가 JSX 텍스트를 코드와 가르는 것**이다(따옴표만으로는 글자와 리터럴을 " +
      "가르지 못한다 · 위 사각의 재개 조건과 같은 모양의 문장이고 손도 같은 파일 안이다).",
    measure: (baseDir) => apostropheBearingCallsiteFiles(baseDir).length
  },
  {
    id: "tsx-components",
    // 두 시점(토스 라운드 통합): 141(라운드 88~90 세 라운드 같은 수) → 143 — T1·T6이 ui.tsx에
    // export function 둘(SheetMountTransition · LoadErrorCard)을 더했다. 모집단 밖 축이 함께 자란
    // 것이지 새 병이 아니고, 재개 조건(JSX 사용을 참조로 세는 판정)은 오늘도 열지 않는다.
    // 두 시점(토스 리뷰 M): 143 → 144 — 홈 히어로가 사적 사본(HomeHeroAmount) 대신 공용
    // AmountCountUpText를 소비하도록 ui.tsx의 그 함수가 export로 열렸다(소비자 실재 —
    // app/(tabs)/index.tsx 히어로, 핀은 home-section-priority가 진다). 같은 성격의 성장이다.
    // 두 시점(라운드 99 F1): 144 → 145 — step-ui.tsx가 IDEMPOTENCY_KEY_CONFLICT의 재시도 무익
    // 판정(isOnboardingSaveIdempotencyConflict)을 export function으로 열었다(소비자 실재 —
    // 온보딩 저장 카드의 403 갈래 합류). 같은 성격의 성장이다.
    value: 145,
    floor: 80,
    statement:
      "`.tsx`의 `export function`(컴포넌트·훅) 141은 모집단 밖이다 — JSX 사용(`<Foo />`)은 이 그물의 이름 " +
      "훑기가 호출과 다르게 읽고, 화면 파일의 default export는 라우터가 경로로 부르므로 텍스트 호출부가 " +
      "애초에 없다. ⚠️ 재개 조건(결정형 · 손은 안): JSX 사용을 참조로 세는 판정이 서는 날. " +
      "⚠️ **라운드 89 트랙 C의 재실측: 오늘도 141**(적힌 값과 같다 — 이 축은 `export const`를 들이는 것과 " +
      "무관하게 움직이지 않았다). ⚠️ **이 트랙은 이 재개 조건을 열지 않는다** — 같은 파일에 축 둘을 " +
      "얹지 않는 규율이고, 오늘 얹은 축은 `export const` 하나다(정찰 #3의 배정 그대로). " +
      "⚠️⚠️ **라운드 90 트랙 C의 재실측: 오늘도 141**(세 라운드째 같은 수다 — 문자열 마스킹은 `.tsx`의 " +
      "`export function`을 세는 일과 무관하고, 그 무관함이 이 재실측의 값이다). ⚠️ **오늘도 이 재개 조건은 " +
      "열지 않는다** — 같은 규율이고, 오늘 얹은 축은 문자열 리터럴 하나다(정찰 #3 트랙 C의 금지 조항 그대로).",
    measure: (baseDir) => tsxExportFunctionCount(baseDir)
  },
  {
    id: "outside-two-apps",
    value: 0,
    floor: 0,
    statement:
      "`apps/api/**`와 `packages/**`는 오늘 모집단에도 호출부에도 없다. AA-1의 질문이 '순수 판정 모듈'을 " +
      "물었고 그 층이 두 앱에 있기 때문이지, 서버에 사문이 없기 때문이 아니다 — **재어 보지 않았다.** " +
      "⚠️ 재개 조건(사건형): 서버 축을 세는 라운드가 오는 날. 값이 0인 것은 측정값이 아니라 **미측정**이고, " +
      "그 사실을 0으로 적어 두는 것이 이 줄의 일이다."
  }
];

// ── 실패 메시지 ───────────────────────────────────────────────────────────────

/** 사람을 그 파일로 보내는 한 줄(수만 던지는 실패 메시지는 사람에게 이유를 다시 찾게 한다). */
export function describeDeadExport(item: ExportedFunction): string {
  return `${item.file}:${item.line} ${item.name}()`;
}

/** 새 사문이 생겼을 때 사람이 고를 두 답을 적어 준다. */
export function deadExportHint(item: ExportedFunction): string {
  return (
    `${describeDeadExport(item)} — 제품 소스 어디에서도 부르지 않아요(테스트만 부릅니다).\n` +
    "  두 답 중 하나를 값으로 고르세요:\n" +
    "   ① 지운다 — 호출부가 없으니 없어도 됩니다(테스트도 함께 걷습니다).\n" +
    "   ② 이유를 적는다 — 소스 주석에 '⚠ **테스트 전용 export** … **지우지 않는다**'(라운드 71 리뷰 S-8 관례)를\n" +
    "      달거나, 이름을 `…ForTests`로 바꾸거나, dead-export-ledger.ts의 DEAD_EXPORT_LEDGER에 줄을 더하세요.\n" +
    (item.kind === "const"
      ? "   ⚠️ `export const`라면 먼저 결정 ③을 보세요 — 이 값이 **계약이 제품을 재려고 드는 자**(제품 소스의\n" +
        "      자리를 가리키는 표)이거나 그 모듈이 **앱 번들에 실리지 않으면** 파생 판정이 자동으로 면제하고\n" +
        "      대장의 줄이 필요 없습니다. 면제는 손으로 적는 것이 아니라 소스에서 파생합니다.\n"
      : "") +
    "  ⚠️ 라운드 90부터 그물은 **문자열 리터럴도 마스킹합니다** — 이 이름에 오직 문자열로만 닿고 있다면\n" +
    "     (`registry[\"이름\"]` 꼴) 그것은 사문이 아니라 **이 그물이 못 보는 참조**입니다. 그때의 답은\n" +
    "     대장에 줄을 더하는 것이 아니라 그 자리를 코드 참조로 바꾸는 것이고, 그 사각은\n" +
    "     `string-keyed-dynamic-access`가 값으로 지고 있습니다(⚠️ 템플릿 `${…}` 안은 코드로 셉니다).\n" +
    "  ⚠️ 대장에 줄을 더했다면 DEAD_EXPORT_RATCHET도 함께 올라갑니다 — 그 값은 늘리지 않는 것이 원칙입니다."
  );
}
