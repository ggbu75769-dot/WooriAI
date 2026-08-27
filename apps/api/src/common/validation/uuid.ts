// R24-M2: 커서·경로 파라미터로 들어온 문자열을 `@db.Uuid` 컬럼과 비교하기 전에
// 형식을 확인하기 위한 공용 패턴. Prisma는 UUID가 아닌 값을 uuid 컬럼 술어에
// 넣으면 드라이버 단에서 던지고(`Inconsistent column data: Error creating UUID`),
// 그 예외는 GlobalExceptionFilter에서 **500**으로 나간다 — 사용자 입력이 원인인데
// 서버 오류로 보이는 셈이다. 그래서 "구조는 맞지만 id가 UUID가 아닌" 커서는
// 각 커서 디코더가 이 패턴으로 먼저 걸러 400(손상된 커서)으로 돌린다.
//
// 정규식 한 벌만 두는 이유: 커서가 두 곳(지출 목록 keyset, 델타 동기화 keyset)에
// 있고 둘 다 같은 `expenses.id`(@db.Uuid)를 담는다 — 검증이 갈라지면 한쪽만
// 500으로 남는다. (`packages/contracts`의 `uuidSchema`는 zod 스키마라 HTTP DTO
// 계약용이고, 서버 내부 문자열 검사에 zod를 끌어오지 않기 위해 별도로 둔다.)

/**
 * 표준 8-4-4-4-12 16진 UUID(대소문자 무관). 버전/변형 비트는 강제하지 않는다 —
 * Postgres `uuid` 타입이 받아들이는 값의 범위와 맞추는 것이 목적이고, 여기서
 * 걸러야 하는 것은 "UUID가 아예 아닌 값"이기 때문이다.
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
