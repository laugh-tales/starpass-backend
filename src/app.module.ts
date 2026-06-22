import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CreatorsModule } from './creators/creators.module';
import { FansModule } from './fans/fans.module';
import { TiersModule } from './tiers/tiers.module';
import { PassesModule } from './passes/passes.module';
import { IndexerModule } from './indexer/indexer.module';
import { StellarModule } from './stellar/stellar.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CategoriesModule,
    CreatorsModule,
    FansModule,
    TiersModule,
    PassesModule,
    IndexerModule,
    StellarModule,
    WebhooksModule,
    NotificationsModule,
  ],
})
export class AppModule {}
