import { Controller, Get, Inject } from "@nestjs/common";
import { FcmSenderService } from "./fcm-sender.service";
import { FcmTokenService } from "./fcm-token.service";
import { PushConfigService } from "./push-config.service";

/**
 * PUSH-113 관측성: GET /health/push — GET /health/worker(INF-007)와 같은
 * 무인증·항상 200 스타일. 본문은 숫자·불리언만 노출한다: 활성 여부, 이 프로세스의
 * 발송 성공/실패/무효 토큰 카운트, access token 캐시 보유 여부. 경로·토큰·오류
 * 문자열 등은 절대 싣지 않는다 (자세한 원인은 서버 로그에만).
 *
 * health/ 모듈 파일을 건드리지 않으려고 push 모듈이 같은 "health" prefix에
 * 자기 라우트를 하나 얹는 형태다 (Nest는 컨트롤러별 prefix를 병합한다).
 */
@Controller("health")
export class PushHealthController {
  constructor(
    @Inject(PushConfigService) private readonly config: PushConfigService,
    @Inject(FcmTokenService) private readonly tokens: FcmTokenService,
    @Inject(FcmSenderService) private readonly sender: FcmSenderService
  ) {}

  @Get("push")
  push() {
    return {
      enabled: this.config.isEnabled(),
      tokenCached: this.tokens.hasCachedToken(),
      ...this.sender.countersSnapshot()
    };
  }
}
