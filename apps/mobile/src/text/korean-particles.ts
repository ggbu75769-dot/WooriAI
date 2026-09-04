/**
 * 라운드 93 트랙 B — **사용자가 지은 이름 뒤의 조사를 값에서 고른다.**
 *
 * 한국어의 을/를 · 과/와 같은 조사는 **앞 낱말의 받침 유무**로 갈린다. 이름을 사용자가 직접
 * 치는 자리에서 조사를 리터럴로 못 박으면, 받침이 반대인 이름이 들어온 날 문장이 깨진다:
 *
 *   "지훈를 추가했어요"      (`app/settings/children.tsx` — 받침 있는 별명)
 *   "김가네과 함께해요"      (`app/family/accept/[token].tsx` — 받침 없는 가구 이름)
 *
 * 둘 다 **사람이 앱에서 가장 먼저 만드는 문장**이다(온보딩 직후의 아이 추가 · 초대 수락 착지).
 *
 * ## 판정 — 한글 음절 하나의 받침은 코드로 갈린다
 *
 * 한글 음절은 유니코드에서 `0xAC00`부터 초성19 × 중성21 × 종성28로 **정렬되어** 늘어서 있다.
 * 그래서 `(코드 − 0xAC00) % 28`이 0이면 받침이 없고, 아니면 있다. 표를 들 필요가 없다.
 *
 * ## ⚠️ 이 파일은 이 저장소의 **두 번째** 답이 아니라, 이미 고른 답을 옮겨 온 것이다
 *
 * `src/home/baby-counter.ts:83-107`이 홈 카운터에서 같은 물음에 이미 답했고(`hasFinalConsonant` ·
 * `objectParticle` · `withParticle` **셋**), 이 파일은 **그 셋과 한 글자도 다르지 않은 규칙**을
 * 쓴다. 왜 import하지 않고 옮겨 적었는가 — 그쪽은 홈 카운터의 문구 모듈이고(태명·출산 예정일 ·
 * 일수 계산이 같은 파일에 있다), 화면 문구 전반이 기대는 자리는 도메인 밖의 순수 텍스트 모듈이어야
 * 하기 때문이다. ⚠️ **그리고 두 벌이 갈리는 날을 계약이 먼저 본다** —
 * `src/korean-particle-guard.test.ts`가 같은 표를 두 모듈에 나란히 먹여 **답이 같은지**를 문다.
 * (그쪽 셋을 이 파일로 갈아 끼우는 일은 이 트랙의 축이 아니다 — 그 파일은 이 라운드에서 읽기만 한다.)
 *
 * ## ⚠️⚠️ 한글이 아닌 끝에서의 답 — **받침 없는 형**(를 · 와)이고, 문법이 아니라 관례다
 *
 * 이름이 라틴 문자("Ben") · 숫자("둘째2") · 이모지로 끝나면 위 계산이 서지 않는다. 그때 이 모듈은
 * **받침 없는 형**으로 떨어진다. 근거는 저장소가 이미 고른 답이다 — `baby-counter.ts:87-89`가
 * *"한글 음절이 아니면(영문/숫자/이모지 태명) null — 호출부는 받침 없는 형태(를/와)를 기본으로
 * 쓴다"* 고 적었고, **두 시점**으로 그 답을 지는 손이 갈렸다: ⚠️ **라운드 93 트랙 B 시점 셋**
 * (`hasFinalConsonant` · `objectParticle` · `withParticle`) → **오늘 넷** — 라운드 94 트랙 A가
 * `nameWithHonorificSuffix`를 같은 관례 위에 세웠다(짝 문서의 `#171`이 이미 *넷*으로 적는다).
 * ⚠️ **머리말의 이 수는 등호가 아니다** — 세는 자는 계약 쪽이고(`export const` 0건 · 함수 하한 넷),
 * 여기 적힌 것은 *오늘 몇이 그 답을 지는가*라는 사실이다.
 *
 * ⚠️ **정찰은 *"종전 조사를 그대로 둔다"* 를 제안했지만 그 문장은 규칙이 되지 못한다** — 종전 조사가
 * 아이 화면에서는 "를"(받침 없는 형)이고 가구 화면에서는 "과"(받침 있는 형)이라, 그대로 두면 한글이
 * 아닌 이름 하나가 두 화면에서 서로 다른 갈래로 떨어진다. 저장소의 답은 한 갈래다.
 *
 * ⚠️ **이 답은 옳음이 아니라 안전이다.** 숫자로 끝나는 이름은 실제로는 읽는 소리를 따라 갈린다
 * ("둘째2"는 *이*로 읽혀 받침이 없고, "둘째3"은 *삼*으로 읽혀 받침이 있다). 소리를 모르는 자리에서
 * 어느 한쪽을 지어내는 것보다, **어느 이름에도 덜 어색한 쪽**으로 늘 떨어지는 편이 낫다.
 * (재개 조건은 계약이 사건형으로 진다: 숫자·라틴으로 끝나는 이름이 실제로 보고되는 날.)
 */

/** 한글 음절 블록. `가`(0xAC00) ~ `힣`(0xD7A3) — 그 밖은 이 판정의 모집단이 아니다. */
const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;

/** 종성(받침)의 가짓수 — 없음 1 + 있음 27. 한글 음절이 이 주기로 늘어서 있다. */
const FINAL_CONSONANT_COUNT = 28;

/** 종성 인덱스 8 = ㄹ. `(으)로`만 이 받침에서 예외로 갈린다(아래 `directionParticle`). */
const RIEUL_FINAL_CONSONANT_INDEX = 8;

/**
 * 마지막 글자에 받침이 있는가.
 *
 * `true` 있음 · `false` 없음 · **`null` 판정이 서지 않음**(빈 문자열이거나, 마지막 글자가 한글
 * 음절이 아닌 경우 — 라틴·숫자·이모지·문장부호). 아래 조사 함수들은 `null`을 **받침 없는 쪽**으로
 * 떨어뜨린다(머리말의 관례).
 *
 * ⚠️ 세 갈래를 `boolean`으로 뭉개지 않는 이유: *받침이 없다*와 *물을 수 없다*는 다른 사실이고,
 * 호출부가 그 둘을 갈라 다르게 말하기로 하는 날 이 자리가 이미 갈려 있어야 한다.
 *
 * ⚠️⚠️ **판정 전에 `NFC`로 맞춘다(라운드 94 리뷰 M-6) — 한 자리 수리다.** 같은 "지훈"이라도
 * 자모가 분해된 꼴(`NFD`: `ᄌ ᅵ ᄒ ᅮ ᆫ`)로 들어오면 마지막 글자가 한글 **음절**이 아니라 **자모**라
 * 위 계산의 모집단 밖으로 떨어져 `null`이 됐다 — 즉 받침 있는 이름이 조용히 *받침 없는 형*으로
 * 갈렸다("지훈**를**" · "지훈네"). ⚠️ **이 한 줄이 세 export를 함께 고친다**: `objectParticle` ·
 * `withParticle` · `nameWithHonorificSuffix`가 전부 이 판정 하나를 지나므로, 갈래를 호출부마다
 * 막지 않고 **판정이 서는 그 자리**에서 막는다.
 * ⚠️ **NFD가 실제로 들어오는 길**: iOS/macOS 파일·클립보드 경로와 일부 IME가 분해형을 내고,
 * 계약(`packages/contracts/src/schemas.ts:83`의 `nickname: z.string().min(1)`)은 정규화를 요구하지
 * 않는다 — 화면이 무엇을 하든 **API로 직행한 값이 그대로 이 함수에 닿는다.**
 * ⚠️⚠️ **두 시점 — 저장소의 옛 답(`src/home/baby-counter.ts`)은 오늘 이 한 줄만큼 갈렸다.**
 * 라운드 93 트랙 B 시점에는 두 벌이 *한 글자도 다르지 않았고*, 오늘 이쪽만 `NFC`를 건다(그쪽은
 * 이 라운드에서도 읽기만 하는 파일이다). 그 갈림은 `src/korean-particle-guard.test.ts`가 **값과
 * *다시 등호가 되는 날*로** 진다 — 숨기지 않고 적는다.
 */
export function hasFinalConsonant(word: string): boolean | null {
  const lastChar = word.normalize("NFC").trim().slice(-1);
  if (!lastChar) return null;
  const code = lastChar.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return null;
  return (code - HANGUL_SYLLABLE_START) % FINAL_CONSONANT_COUNT !== 0;
}

/**
 * 목적격 조사 — 받침 있으면 `을`, 없거나 판정이 서지 않으면 `를`.
 *
 * 쓰는 자리: `app/settings/children.tsx`의 아이 추가 토스트·낭독("지훈을 추가했어요.").
 */
export function objectParticle(word: string): string {
  return hasFinalConsonant(word) === true ? "을" : "를";
}

/**
 * 공동격 조사 — 받침 있으면 `과`, 없거나 판정이 서지 않으면 `와`.
 *
 * 쓰는 자리: `app/family/accept/[token].tsx`의 참여 착지 문장("김가네와 함께해요.").
 */
export function withParticle(word: string): string {
  return hasFinalConsonant(word) === true ? "과" : "와";
}

/**
 * 라운드 96 T5 — 주격 조사. 받침 있으면 `이`, 없거나 판정이 서지 않으면 `가`.
 *
 * 쓰는 자리: `src/notifications/generators.ts`의 단계 전환 알림 제목("『다온이』가 36개월에
 * 들어섰어요."). ⚠️ **두 시점**: 그 자리는 두 형태를 함께 적는 꼴(`이(가)`)이었다 — 스윕 사각
 * `both-forms-written-is-outside-this-needle`이 *묻지 않기로 한 답*이라 값으로 세어 두던 자리이고,
 * 오늘 값에서 고르는 꼴(꼴 B)로 들어왔다. 위 두 함수와 같은 관례(같은 판정 하나를 지난다).
 */
export function subjectParticle(word: string): string {
  return hasFinalConsonant(word) === true ? "이" : "가";
}

/**
 * 종성(받침) 인덱스 — `0` 없음 · `8` ㄹ · **`null` 판정이 서지 않음**(한글 음절이 아닌 끝).
 * `hasFinalConsonant`과 같은 자리에서 같은 규칙(`NFC` → 꼬리 글자 → 주기 28)을 보되, `(으)로`가
 * 필요로 하는 것은 유무가 아니라 **어느 받침인가**라 인덱스째 낸다(아래 `directionParticle` 전용).
 */
function finalConsonantIndexOf(word: string): number | null {
  const lastChar = word.normalize("NFC").trim().slice(-1);
  if (!lastChar) return null;
  const code = lastChar.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return null;
  return (code - HANGUL_SYLLABLE_START) % FINAL_CONSONANT_COUNT;
}

/**
 * 라운드 96 T5 — 방향·자격 조사 `(으)로`. 받침 있으면 `으로`, 없거나 판정이 서지 않으면 `로`.
 *
 * ⚠️ **이 쌍만 규칙이 하나 더 있다: 받침이 ㄹ이면 `로`다**("서울로" · "첫돌로") — 스윕 계약
 * (`src/korean-particle-guard.test.ts`의 `expectedParticle`)이 이미 자로 들고 있던 그 예외를
 * 규칙 모듈로 옮겨 온다(두 자리가 서로 다른 답을 낼 수 없게 계약이 나란히 잰다).
 *
 * 쓰는 자리: 아이 전환 문구 넷 — `src/children/child-switch.ts`의 안내·낭독 라벨 둘,
 * `src/children/child-deletion.ts`·`src/children/household-join.ts`의 전환 토스트.
 * ⚠️ **두 시점**: 넷 다 두 형태를 함께 적는 꼴(`(으)로`)이었다(위 `subjectParticle`과 같은 이관).
 */
export function directionParticle(word: string): string {
  const finalIndex = finalConsonantIndexOf(word);
  if (finalIndex === null || finalIndex === 0) return "로";
  return finalIndex === RIEUL_FINAL_CONSONANT_INDEX ? "로" : "으로";
}

/**
 * 라운드 94 트랙 A — **호칭 접미사 `-네`**. 조사가 아니지만 **받침에서 갈리는 것은 똑같다.**
 *
 *   "지훈" → "지훈**이**네"   (받침 있음 — 사이에 `이`가 든다)
 *   "서아" → "서아네"         (받침 없음 — 바로 붙는다)
 *   "Ben"  → "Ben네"          (판정이 서지 않음 → **받침 없는 형** · 머리말의 그 관례)
 *
 * 쓰는 자리: `app/(tabs)/more.tsx`의 가구 카드 — **보이는 줄 하나와 낭독 라벨 두 갈래**가
 * 전부 이 한 함수를 지난다(그전까지 셋 다 `${nickname}네`를 리터럴로 적었다).
 *
 * ⚠️ **왜 조사 함수들처럼 접미사 *조각*만 내지 않고 이름째 내는가.** `을/를`은 앞말과 띄지 않고
 * 이어 붙는 한 글자라 `${name}${objectParticle(name)}` 꼴이 읽히지만, `-네`는 받침이 있을 때
 * **글자가 하나 늘어난다**(`이네`). 조각을 내면 호출부가 `${name}${honorific(name)}`을 적어야
 * 하는데, 그 꼴은 "이름 뒤에 접미사가 붙는다"가 아니라 "이름 뒤에 조사가 붙는다"로 읽혀
 * 이 파일이 이미 세운 규율과 헷갈린다. **한 자리에서 한 값이 나오는 편이 화면에서 안전하다.**
 *
 * ⚠️⚠️ **꼬리 공백을 걷고 `NFC`로 맞춘 이름 위에 접미사를 붙인다(라운드 94 리뷰 M-6).**
 * ⚠️ **두 시점 — 그리고 이것은 *조사 함수 둘과 같은 규율*이 아니었다.** 트랙 A 시점의 이 자리는
 * *"`name`을 `trim()`하지 않는다 — 조사 함수 둘과 같은 규율이다"* 라고 적었는데, 그 두 자리는
 * 같지 않다: 조사 함수는 **한 글자를 따로 내므로** 호출부가 `${name}${objectParticle(name)}`을
 * 적었을 때 이상함이 남는 곳이 **호출부**이지만(`"지훈 을"`), 접미사 함수는 **이름째 내므로**
 * 함수 자신이 깨진 값을 냈다 — 꼬리 공백에서 `"지훈 이네"`(공백을 사이에 낀 채 `이`가 붙는다).
 * 오늘은 함수 안에서 꼬리 공백을 걷고 붙이므로 그 값이 **`"지훈이네"`** 다.
 * ⚠️ **앞 공백은 그대로 지난다** — 걷는 것은 접미사가 붙는 *꼬리* 하나이고, 나머지는 여전히
 * 호출부가 준 그대로다(값을 조용히 더 고치지 않는다).
 * ⚠️⚠️ **왜 화면이 아니라 이 함수가 지는가.** 모바일은 보내기 전에 이름을 `trim()`하지만,
 * 계약(`packages/contracts/src/schemas.ts:83`·`:100`의 `z.string().min(1)`)에는 `.trim()`도
 * 정규화도 없다 — **API로 직행한 이름은 꼬리 공백과 분해형(NFD)을 그대로 지닌 채** 이 함수를 지나
 * 화면(가구 카드)과 낭독 라벨에 나간다. 그래서 이 갈래는 화면의 실수가 아니라 **함수의 계약**이다.
 *
 * ⚠️⚠️ **이 규칙은 관례이지 문법이 아니다.** 이미 `네`로 끝나는 이름("김가네")에 또 붙는
 * 갈래("김가네네")를 이 함수는 막지 않는다 — **오늘의 바이트가 하는 일과 정확히 같게** 두고,
 * 그 갈래는 `src/korean-particle-guard.test.ts`의 사각이 값으로 진다(고칠지 말지는 그날의 판단).
 */
export function nameWithHonorificSuffix(name: string): string {
  // ⚠️ 접미사가 붙는 **꼬리**만 다듬는다 — `NFC`로 맞추고 뒤쪽 공백을 걷는다(위 두 시점).
  const tidied = name.normalize("NFC").replace(/\s+$/, "");
  // ⚠️ 사이에 드는 `이`를 **따로 세운다** — `${name}이네`로 한 번에 적으면 그 꼴이 조사 스윕의
  // 바늘에 `${값}이`(주격 조사)로 걸려, 이 파일이 *갈리는데 고정으로 적은 자리*로 잘못 읽힌다.
  const linker = hasFinalConsonant(tidied) === true ? "이" : "";
  return `${tidied}${linker}네`;
}
