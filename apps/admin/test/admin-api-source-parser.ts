/**
 * GAP-079 트랙 E(#5) ⓑ — **`admin-api.ts`를 소스로 읽는 파서 한 벌.**
 *
 * 이 워크스페이스에는 `src/lib/admin-api.ts`를 **문자열로 읽어 함수 단위로 세는** 계약이 둘
 * 있었고, 둘 다 같은 분할(`\nexport (?:async )?function `)을 손으로 적고 있었다.
 *  · `src/lib/admin-api.test.ts` — *"`request()`가 쓰기 메서드를 싣는 자리"* 를 세는 함수 표.
 *  · `src/admin-write-role-gate.test.ts` — *"역할 게이트가 지켜야 할 쓰기 함수"* 전수.
 *
 * 라운드 78 트랙 D는 두 트랙이 같은 파일을 열지 않도록 **사본 하나를 허용**하고 추출을 다음
 * 라운드의 결정으로 미뤘다. 이 파일이 그 추출이고, **순서가 이 트랙의 본체다** —
 * 합치기 전에 `admin-api.test.ts`의 교차 단언이 *"두 단위가 오늘 같은 답을 낸다"* 를 먼저
 * 못 박았다(차집합이 한 방향으로 `draftAndSubmitContentRevision` 하나 · 반대는 0건).
 *
 * ## ⚠️ 이 모듈의 규율 셋
 *
 * ⓐ **단위는 인자다. 어느 쪽도 기본값이 아니다.** 기본값이 곧 *"한쪽의 단위가 조용히 다른
 *    쪽을 덮는다"* 의 입구다(라운드 78 S-4가 이름 붙인 그 모양) — 부르는 자리가 자기 단위를
 *    **말하지 않고는** 이 파서를 쓸 수 없다.
 * ⓑ **두 단위의 차이를 코드가 적는다.** 역할 게이트 쪽은 쓰기 함수를 부르는 **한 겹 합성**을
 *    승계하고(`draftAndSubmitContentRevision` = create + submit), 함수 표 쪽은 그 합성 함수를
 *    쓰기 0건으로 읽는다. 두 값이 다른 것은 결함이 아니라 단위의 차이다.
 * ⓒ ⚠️ **문서에 적히지 않았던 두 번째 차이도 여기 값으로 있다** — 함수 표 쪽은 선언의 끝
 *    (`ADMIN_API_DECLARATION_END_PATTERN`)까지만 보고, 역할 게이트 쪽은 **다음
 *    `export function` 전까지의 청크 전체**(꼬리 포함)를 본다. 그래서 `chunk`와 `declaration`을
 *    **둘 다** 내주고, 꼬리에 쓰기 메서드가 서는 자리가 0건이라는 사실은 `admin-api.test.ts`의
 *    계약 ⓓ가 단언으로 진다(오늘 참이라 조용한 가정을 소리 나게 한다).
 *
 * ⚠️ **왜 `src/`가 아니라 여기인가.** 이 파서는 **테스트 전용**이다. `src/lib/`에 두면 어드민
 * 런타임 번들에 죽은 코드가 실리고, `src/`·`app/` 아래에 두면 이 워크스페이스의 소스 스윕
 * (미러 스크레이프 · 역할 게이트 · 조회/쓰기 실패 문구)이 **화면 소스로 읽는다**. 두 뿌리
 * 밖이라 어느 스윕도 이 파일을 걷지 않고, `.test.ts`가 아니라 슬라이스 가드 대장의 스윕에도
 * 들지 않는다.
 */

/**
 * 두 호출부의 **단위**. ⚠️ 기본값이 없다(위 규율 ⓐ) — 부르는 자리가 반드시 고른다.
 *
 * · `"request-write-site"` — `request()`가 쓰기 메서드를 싣는 자리. **선언 안**만 본다.
 *   합성 함수는 자기 몸에 쓰기 메서드가 없으므로 **쓰기 0건**이다.
 * · `"role-gate-write-function"` — 역할 게이트가 지켜야 할 쓰기 함수. 쓰기 함수를 부르는
 *   **한 겹 합성**을 승계하고, 청크 전체(꼬리 포함)를 본다.
 */
export type AdminApiWriteUnit = "request-write-site" | "role-gate-write-function";

/** 두 단위 전수(부르는 자리가 이 목록 밖의 값을 넘기면 파서가 **던진다** — 조용히 비지 않는다). */
export const ADMIN_API_WRITE_UNITS: readonly AdminApiWriteUnit[] = [
  "request-write-site",
  "role-gate-write-function"
];

/** `export function` / `export async function` 하나가 시작하는 자리. */
export const ADMIN_API_EXPORTED_FUNCTION_SPLIT = /\nexport (?:async )?function /;

/**
 * 함수 선언의 끝 — **줄 첫 칸의 `}` 뒤가 줄바꿈인 자리**.
 * ⚠️ `\n}`만으로는 부족하다: `createContentRevision`의 인라인 인자 타입이 `\n})`로 닫혀
 * 시그니처 한가운데를 끝으로 읽고 그 함수의 쓰기 한 자리를 **조용히 잃는다**(실측으로 만난 값).
 */
export const ADMIN_API_DECLARATION_END_PATTERN = /\n\}(?=\r?\n|$)/;

/**
 * 상태를 바꾸는 메서드 리터럴 — **매번 새 정규식**을 돌려준다.
 * ⚠️ 전역 플래그가 붙은 정규식을 모듈 상수로 나눠 쓰면 `test()`/`exec()`가 `lastIndex`를 물고
 * 다음 호출이 **앞을 건너뛴다**. 세는 자리(`String.match`)는 안전하지만, 그 하나를 위해 상태를
 * 나눠 갖지 않는다.
 */
export function adminApiWriteMethodPattern(): RegExp {
  return /method: "(?:POST|PUT|PATCH|DELETE)"/g;
}

/** 그 리터럴이 몇 번 서는가. */
export function countAdminApiWriteMethods(text: string): number {
  return (text.match(adminApiWriteMethodPattern()) ?? []).length;
}

/** `admin-api.ts`가 내보내는 함수 하나 — 청크·선언·꼬리를 **셋 다** 든다(위 규율 ⓒ). */
export type AdminApiFunctionChunk = {
  readonly name: string;
  /** 이름부터 **다음 `export function` 전까지**. 선언 뒤의 꼬리를 포함한다. */
  readonly chunk: string;
  /** 그중 **선언의 끝까지**. 끝을 못 찾으면 청크 전체다. */
  readonly declaration: string;
  /** 선언 끝 뒤의 꼬리(파일 상수·주석·타입 선언). 끝을 못 찾으면 빈 문자열. */
  readonly tail: string;
};

/**
 * `admin-api.ts`가 내보내는 함수 전수(손 목록이 아니라 **파생**이다).
 *
 * 이름을 읽지 못하는 청크는 건너뛴다 — 분할이 잡은 자리가 함수가 아니라는 뜻이고,
 * 그 자리를 이름 없이 표에 올리면 두 단위가 서로 다른 것을 세게 된다.
 */
export function adminApiFunctionChunks(source: string): AdminApiFunctionChunk[] {
  const chunks: AdminApiFunctionChunk[] = [];
  for (const chunk of source.split(ADMIN_API_EXPORTED_FUNCTION_SPLIT).slice(1)) {
    const name = /^([A-Za-z0-9_]+)/.exec(chunk)?.[1];
    if (!name) continue;
    const end = ADMIN_API_DECLARATION_END_PATTERN.exec(chunk);
    chunks.push({
      name,
      chunk,
      declaration: end ? chunk.slice(0, end.index + 2) : chunk,
      tail: end ? chunk.slice(end.index + 2) : ""
    });
  }
  return chunks;
}

/**
 * 고른 단위로 읽은 **쓰기 함수 이름 전수**(정렬).
 *
 * ⚠️ `unit`에 기본값이 없다(규율 ⓐ). 목록 밖의 값이 오면 빈 배열이 아니라 **예외**다 —
 * 조용히 0건을 돌려주면 그것을 세는 계약이 *"쓰기 함수가 없다"* 로 읽고 영원히 초록이 된다.
 */
export function adminApiWriteFunctionNames(source: string, unit: AdminApiWriteUnit): string[] {
  if (!ADMIN_API_WRITE_UNITS.includes(unit)) {
    throw new Error(`알 수 없는 단위입니다: ${String(unit)} (${ADMIN_API_WRITE_UNITS.join(" · ")} 중 하나)`);
  }
  const chunks = adminApiFunctionChunks(source);

  if (unit === "request-write-site") {
    // 선언 안만 본다 — 꼬리의 리터럴도, 다른 쓰기 함수를 부르는 합성도 세지 않는다.
    return chunks
      .filter((fn) => countAdminApiWriteMethods(fn.declaration) > 0)
      .map((fn) => fn.name)
      .sort();
  }

  // 상태를 바꾸는 메서드를 실어 보내는 함수와, 그것을 부르는 한 겹 합성 함수
  // (`draftAndSubmitContentRevision` = create + submit)가 전부다.
  //
  // ⚠️ 라운드 79 리뷰(P-3) — **승계는 정확히 한 겹이다. 고정점이 아니다.**
  // 아래 둘째 루프는 **한 번만** 돈다: 그때 이미 `writes`에 있던 이름을 부르는 함수만 오른다.
  // 합성을 부르는 합성(두 겹)은 오늘 0건이고, 생기는 날 이 파서는 그것을 **세지 않는다** —
  // 그 사실을 값으로 적어 두는 이유는 두 겹이 조용히 빠지는 것보다 계약이 그때 답을 다시
  // 정하는 것이 낫기 때문이다(고정점으로 바꾸면 "한 겹"이라는 오늘의 단위가 소리 없이 넓어진다).
  // 두 겹이 실재하는지는 `admin-api.test.ts`의 교차 단언이 함께 센다.
  const writes = new Set<string>();
  for (const fn of chunks) {
    if (countAdminApiWriteMethods(fn.chunk) > 0) writes.add(fn.name);
  }
  const directWrites = [...writes];
  for (const fn of chunks) {
    if (writes.has(fn.name)) continue;
    // 승계의 근거는 **직접 쓰기 함수**뿐이다(방금 승계된 이름은 근거가 되지 않는다) —
    // 루프 도중 자라는 집합을 다시 읽으면 순서에 따라 두 겹이 우연히 섞여 들어온다.
    if (directWrites.some((write) => new RegExp(`\\b${write}\\(`).test(fn.chunk))) writes.add(fn.name);
  }
  return [...writes].sort();
}
