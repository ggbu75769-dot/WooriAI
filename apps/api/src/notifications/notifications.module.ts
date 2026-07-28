import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationDeliveryService } from "../jobs/notification-delivery.service";
import { NOTIFICATION_PROVIDER_ADAPTER, createNotificationProviderAdapter } from "./notification-provider.adapter";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_PROVIDER_ADAPTER, useFactory: createNotificationProviderAdapter },
    NotificationsService,
    NotificationDeliveryService
  ],
  exports: [NotificationDeliveryService]
})
export class NotificationsModule {}
