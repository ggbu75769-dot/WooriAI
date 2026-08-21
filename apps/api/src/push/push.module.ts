import { Global, Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { FcmSenderService } from "./fcm-sender.service";
import { FcmTokenService } from "./fcm-token.service";
import { PushConfigService } from "./push-config.service";
import { PushDispatchService } from "./push-dispatch.service";
import { PushHealthController } from "./push-health.controller";
import { FetchPushHttpClient, PUSH_HTTP_CLIENT } from "./push-http.client";

/**
 * PUSH-113: FCM 푸시 발송 스캐폴드.
 *
 * PUSH_ENABLED=1 이고 FCM_SERVICE_ACCOUNT_PATH가 유효한 서비스 계정 JSON을
 * 가리킬 때만 실제 발송한다. 아니면 모듈은 정상 로드되되 모든 발송 경로가
 * no-op이고 부팅 시 1회 안내 로그만 남는다 (push-config.service.ts).
 *
 * @Global(): 알림 생성 지점(finance/expenses.service.ts)이 FinanceModule에
 * PushModule을 import하지 않고 @Optional() 주입만으로 최소 침습 훅을 걸 수
 * 있게 한다 — PrismaModule과 같은 선례.
 */
@Global()
@Module({
  imports: [DevicesModule],
  controllers: [PushHealthController],
  providers: [
    PushConfigService,
    { provide: PUSH_HTTP_CLIENT, useClass: FetchPushHttpClient },
    FcmTokenService,
    FcmSenderService,
    PushDispatchService
  ],
  exports: [PushDispatchService, FcmSenderService]
})
export class PushModule {}
