import { ValidateBy, type ValidationArguments, type ValidationOptions } from "class-validator";

/**
 * 라운드 109 — **표시 문자열(사용자·운영자가 정하는 이름)의 공통 정규화·가드**.
 *
 * 왜 이 모듈이 생겼나(두 시점):
 * 종전(그때는 참): 이름 접기 규칙은 `finance/dto/custom-categories.dto.ts`의 비공개 함수
 * `normalizeCustomCategoryName` 한 자리에만 있었고, 어드민 유입 지점
 * (`admin/dto/admin-categories.dto.ts`)은 `.trim()`만 했다. 두 자리가 같은 컬럼
 * (`categories.name varchar(50)`)에 쓰면서 규칙이 갈려 있었고, 어드민 쪽이 더 약했다.
 * → 이제: 접기 규칙의 구현이 이 파일 **한 벌**이고 두 DTO가 그것을 부른다. 규칙을 넓히려면
 * 여기 한 자리만 고치면 되고, 한쪽만 고쳐 갈라지는 사고가 구조적으로 불가능해진다.
 *
 * 모듈 이름이 `category-name`이 아니라 `display-name`인 이유: 같은 병이 태명·품목명·판매처·
 * 메모에도 있고(라운드 109 조사표), 그 자리들이 옮겨올 때 **이 파일을 부르면 되지 두 번째 벌을
 * 만들 필요가 없게** 하기 위해서다. 오늘 부르는 곳은 분류 이름 두 자리뿐이다.
 */

/**
 * 접기 대상 = JS 정규식 `\s`가 아는 공백류. 실측(라운드 109)으로 이 집합은 다음 16종이다:
 * TAB(U+0009) LF(U+000A) VT(U+000B) FF(U+000C) CR(U+000D) SP(U+0020) NBSP(U+00A0)
 * OGHAM SP(U+1680) U+2000~U+200A(EN QUAD…HAIR SP) LS(U+2028) PS(U+2029) NNBSP(U+202F)
 * MMSP(U+205F) IDEO SP(U+3000) ZWNBSP/BOM(U+FEFF).
 *
 * **접기는 조용해도 안전하다**: 사람이 의도한 이름("산후 도우미")이 그대로 남고, 화면·비교 키·
 * DB 색인식(`lower(btrim(name))`)이 같은 값을 본다. 그래서 이 부류만 말없이 접는다.
 */
function foldWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/**
 * 표시 이름의 정규화 — `trim` + 내부 연속 공백 1칸 접기. **저장되는 값이 이 형태다.**
 *
 * `unknown`을 받고 문자열이 아니면 그대로 돌려주는 모양은 class-transformer의 `@Transform`
 * 계약이다(문자열이 아닌 입력의 판정은 `@IsString`이 한다 — 여기서 형을 바꾸면 그 오류 메시지가
 * 사라진다).
 */
export function normalizeDisplayName(value: unknown): unknown {
  return typeof value === "string" ? foldWhitespace(value) : value;
}

/**
 * 위와 같은 규칙의 **문자열 전용** 창구. 비교 키(`duplicateKey`)처럼 이미 문자열인 값을 다루는
 * 호출부가 정규식을 다시 적지 않게 한다(같은 규칙의 두 번째 벌을 막는 것이 이 모듈의 목적이다).
 */
export function foldDisplayName(value: string): string {
  return foldWhitespace(value);
}

/**
 * 접기 뒤에도 남는 **위험 문자**의 집합.
 *
 * 위 `\s` 16종이 걸러 준 뒤 남는 것 중 다음 세 부류는 접어서는 안 되고 **거절해야** 한다 —
 * 지우면 운영자가 자기가 붙여넣은 것이 사라진 줄 모르고, 거절하면 왜 안 되는지 알 수 있다.
 *
 *  * `\p{Cf}` 서식 제어 — 여기에 **양방향 제어문자**(RLO U+202E, LRO U+202D, LRE/RLE/PDF
 *    U+202A~U+202C, LRM/RLM U+200E·U+200F, 격리 U+2066~U+2069)가 들어 있다. 이 한 글자가
 *    뒤따르는 문장 전체의 표시 순서를 뒤집어 **금액 숫자를 사실과 다르게 보이게** 만들 수 있다
 *    (허위 데이터 표시 금지의 직격이다). 같은 부류의 폭 0 문자(ZWSP U+200B · ZWNJ U+200C ·
 *    ZWJ U+200D · WJ U+2060 · SOFT HYPHEN U+00AD)도 여기 든다 — ZWSP만으로 이루어진 이름은
 *    `@MinLength(1)`을 통과해 화면에 "…에는 에 가장 많이 썼어요"를 만든다.
 *  * `\p{Cc}` C0/C1 제어 — 접힌 5종(TAB·LF·VT·FF·CR)을 뺀 나머지, 특히 **NEL(U+0085)**.
 *    JS `\s`가 NEL을 모르는데(실측) iOS CoreText는 문단 구분자로 취급해 **실제로 줄이 갈린다**.
 *    NUL(U+0000)도 여기서 걸린다.
 *  * `\p{Cs}` 짝 없는 서로게이트 — 정상 이모지(짝 지어진 서로게이트 쌍)는 하나의 코드포인트라
 *    이 집합에 들지 않는다. 짝이 깨진 값만 걸리고, 그 값은 PostgreSQL이 유효한 UTF-8로 받지
 *    못해 500이 된다.
 *
 * 판단의 값: ZWJ(U+200D)를 막으면 이모지 결합 시퀀스(👨‍👩‍👧)를 이름에 쓸 수 없다. 그럼에도
 * 거절하는 쪽을 고른 이유는 지우는 쪽의 대가가 더 크기 때문이다 — 지우면 그 이름은 사용자가
 * 적은 것과 다른 글자가 되고(👨👩👧), 그 사실을 아무도 통보받지 못한다.
 */
const UNSAFE_DISPLAY_NAME_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}]/u;

/**
 * 정규화된 이름에 남은 첫 위험 문자를 `"U+202E"` 표기로 돌려준다(없으면 null).
 * 오류 문구가 **어느 글자인지**를 말할 수 있게 코드포인트를 함께 낸다 — 보이지 않는 글자라
 * "이름을 확인해 주세요"만으로는 운영자가 무엇을 지워야 할지 알 수 없다.
 */
export function unsafeDisplayNameCodePoint(value: string): string | null {
  const match = UNSAFE_DISPLAY_NAME_PATTERN.exec(value);
  if (!match) return null;
  const codePoint = match[0].codePointAt(0) ?? 0;
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * PostgreSQL `varchar(n)`가 세는 단위 = **코드포인트**(실측: 하트+VS16 26쌍 = 52코드포인트가
 * `varchar(50)`에서 22001로 거절된다).
 *
 * 두 시점 — 종전(그때는 참): 길이는 `@MaxLength(50)` 하나가 봤다. 그 검사는 class-validator가
 * `validator/isLength`로 하는데, 그 함수는 `str.length`(UTF-16 단위)에서 서로게이트 쌍과
 * **변형 선택자(U+FE0F/U+FE0E)** 를 빼고 센다. 그래서 "❤️"×26은 그 검사에 26으로 보이고
 * (통과) PostgreSQL에는 52로 보인다 — 실측 결과가 **500 INTERNAL_SERVER_ERROR**(Prisma P2000)
 * 였다. 저장소 전체에 P2000을 400으로 옮기는 핸들러가 없다는 사실은 `admin/dto/admin.dto.ts`와
 * `auth/kakao/kakao-auth.service.ts`가 이미 적어 둔 그대로다.
 * → 이제: 컬럼이 세는 것과 **같은 단위**로 한 번 더 센다. `@MaxLength`는 그대로 두었다 —
 * 흔한 초과(한글 51자)의 오류 문구가 바뀌지 않게 하기 위해서다. 이 검사는 그것보다 좁게,
 * 두 계수가 갈리는 경우에만 추가로 걸린다.
 */
export function displayNameCodePointLength(value: string): number {
  return [...value].length;
}

const IS_SAFE_DISPLAY_NAME = "isSafeDisplayName";
const MAX_STORED_CODE_POINTS = "maxStoredCodePoints";

/**
 * 접기 뒤에도 남은 보이지 않는 문자를 400 `VALIDATION_ERROR`로 거절한다
 * (`details.fields[].constraints.isSafeDisplayName` — 저장소의 검증 실패 봉투 그대로다).
 *
 * `@Transform(normalizeDisplayName)`과 **함께** 써야 뜻이 선다: 접기가 먼저 지나야 공백류
 * 16종이 이 검사에 오지 않는다(class-transformer의 변환이 class-validator보다 앞선다).
 */
export function IsSafeDisplayName(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: IS_SAFE_DISPLAY_NAME,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value !== "string" || unsafeDisplayNameCodePoint(value) === null,
        defaultMessage: (args?: ValidationArguments): string => {
          const codePoint =
            typeof args?.value === "string" ? unsafeDisplayNameCodePoint(args.value) : null;
          // DNC-018 관찰형 해요체 — 무엇을 보았는지 말하고, 다음 한 걸음을 안내한다.
          return `이름에 화면에 보이지 않는 문자가 있어요(${codePoint ?? "제어문자"}). 그 문자를 지우고 다시 저장해 주세요.`;
        }
      }
    },
    validationOptions
  );
}

/**
 * 저장 컬럼과 **같은 단위**(코드포인트)로 길이를 센다. `@MaxLength`가 놓치는 갈래(변형 선택자가
 * 섞인 이모지 이름)에서 500 대신 400을 낸다 — 위 `displayNameCodePointLength` 주석의 실측.
 */
export function MaxStoredCodePoints(max: number, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: MAX_STORED_CODE_POINTS,
      constraints: [max],
      validator: {
        validate: (value: unknown, args?: ValidationArguments): boolean =>
          typeof value !== "string" || displayNameCodePointLength(value) <= (args?.constraints[0] as number),
        defaultMessage: (args?: ValidationArguments): string => {
          const limit = args?.constraints[0] as number;
          const actual = typeof args?.value === "string" ? displayNameCodePointLength(args.value) : 0;
          return `이름은 ${limit}자까지 저장할 수 있어요(지금 ${actual}자예요).`;
        }
      }
    },
    validationOptions
  );
}
