import { Module, forwardRef } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PassesModule } from '../passes/passes.module';

@Module({
  imports: [AuthModule, NotificationsModule, forwardRef(() => PassesModule)],
  controllers: [TiersController],
  providers: [TiersService],
  exports: [TiersService],
})
export class TiersModule {}
