import { Module } from '@nestjs/common';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [AuthModule, WebhooksModule, NotificationsModule, StellarModule],
  controllers: [PassesController],
  providers: [PassesService],
  exports: [PassesService],
})
export class PassesModule {}
