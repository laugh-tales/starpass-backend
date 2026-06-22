import { Module, forwardRef } from '@nestjs/common';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [AuthModule, WebhooksModule, NotificationsModule, forwardRef(() => TiersModule)],
  controllers: [PassesController],
  providers: [PassesService],
  exports: [PassesService],
})
export class PassesModule {}
