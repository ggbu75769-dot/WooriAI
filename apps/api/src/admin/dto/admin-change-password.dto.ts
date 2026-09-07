import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

/**
 * ADM-007: 관리자 비밀번호 최소 길이. 기존에 별도 비밀번호 정책 상수가 없어
 * (로그인 DTO는 IsNotEmpty만 검사) 여기서 처음 정의한다 — 임시 비밀번호
 * (base64url 24자, admin-users.controller.ts)보다 충분히 짧은 하한이면서
 * 트리비얼한 비밀번호는 걸러낸다.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

/**
 * scrypt 입력을 상식적인 범위로 묶는 상한.
 *
 * ⚠️ 두 시점(라운드 110 트랙 3) — 종전에 이 줄이 든 근거는 *"해시 비용 DoS 방지"* 였다.
 * 그때 그 문장은 재어 본 적이 없었고, 이제 재 보니 **그 근거로는 서지 않는다**: 이 저장소의
 * scrypt 파라미터(N=16384·r=8·p=1)에서 검증 시간은 128자 50.26ms · 129자 51.35ms ·
 * 1,048,000자(본문 1MB 상한이 허용하는 최댓값) 58.71ms로, 길이가 8천 배 늘어도 +17%다
 * (측정 방법과 전체 수는 `admin-login.dto.ts`의 `password` 주석). → 이제 이 값이 남는 근거는
 * 비용이 아니라 **정책**이다: 저장되는 비밀번호의 길이를 상식적인 범위로 묶고, `MinLength`와
 * 짝을 이루어 "이 계정의 비밀번호는 10~128자"라는 한 문장을 만든다. 값은 바꾸지 않는다.
 */
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export class AdminChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(ADMIN_PASSWORD_MIN_LENGTH)
  @MaxLength(ADMIN_PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
