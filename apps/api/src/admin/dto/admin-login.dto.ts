import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  /**
   * 라운드 110 트랙 3 — **여기에 `@MaxLength`를 두지 않는다. 재서 내린 결론이다.**
   *
   * 제기된 우려: `ADMIN_PASSWORD_MAX_LENGTH = 128`(admin-change-password.dto.ts)이 **변경
   * DTO에만** 있어, 로그인은 임의 길이 입력을 scrypt로 흘려보낸다 — 해시 비용 DoS.
   *
   * 실측(이 저장소의 `verifyAdminPassword`를 길이별로 **번갈아** 부르며 7회씩, 중앙값):
   *   12자 49.72ms · 64자 49.85ms · **128자 50.26ms · 129자 51.35ms** · 1,024자 50.86ms ·
   *   100,000자 50.52ms · **1,048,000자 58.71ms**
   * 즉 상한이 실제로 가르는 자리(128 ↔ 129)의 차이는 **약 1ms이고 실행 간 산포 안**이다
   * (그 두 길이의 min/max 구간이 서로 겹친다). 도달 가능한 **최댓값**까지 늘려도 +8.5ms(+17%)다.
   * 이유는 파라미터에 있다: scrypt의 비용은 `N·r` 메모리 혼합(≈50ms)이 거의 전부이고, 입력
   * 길이는 그 앞의 HMAC-SHA256 한 번에만 실린다 — **길이에 비례해 늘어나는 부분이 아니다.**
   *
   * 그리고 입력은 이미 묶여 있다:
   *  · **본문 1MB**(bootstrap.ts `BODY_SIZE_LIMIT`) — 넘으면 413 `PAYLOAD_TOO_LARGE`이고
   *    `test/security-middleware.e2e.test.ts`가 그 값을 문다. 위 1,048,000자가 그 상한이다.
   *  · **시도 횟수 셋**: `auth:<ip>` 30회/분(common/security/rate-limit.middleware.ts) ·
   *    `(이메일,IP)` 5회/15분 · `이메일` 25회/15분(admin-auth.service.ts).
   * 한 IP가 예산을 전부 1MB 비밀번호로 태워도 scrypt가 더 먹는 CPU는 분당 약 0.27초
   * (30 × 8.5ms)다. 그 요청의 실제 비용은 scrypt가 아니라 1MB 업로드·파싱이고, 그쪽 상한은
   * 이미 서 있다.
   *
   * **그래서 결함이 아니다 — 고치지 않는다.** 다음 라운드가 이 자리를 다시 열지 않도록 근거를
   * 값으로 남긴다. ⚠️ 이 판단을 뒤집는 조건은 하나다: **scrypt 파라미터가 바뀌어** `N·r`이
   * 작아지면(= 길이 몫의 비중이 커지면) 위 수를 다시 재야 한다.
   *
   * ⚠️ 참고로, 상한을 **더한다고 해서** 로그인 오라클이 생기지는 않는다: 길이 초과 400은
   * 공격자 자신의 입력 길이만 보고 갈리며 서버 상태도 비밀값도 읽지 않아, 계정 존재 여부에
   * 대해 아무것도 말하지 않는다(이 파일이 아니라 `AdminAuthService`가 그 축을 진다 —
   * 더미 해시 · 존재하지 않는 이메일에도 세는 계정 버킷). 즉 더하지 않는 이유는 오라클이
   * 아니라 **얻는 것이 없다는 실측**이다.
   */
  @IsString()
  @IsNotEmpty()
  password!: string;
}
