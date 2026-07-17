import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AuthModule } from './auth/auth.module';
import { CreatorsModule } from './creators/creators.module';
import { CategoriesModule } from './categories/categories.module';
import { FansModule } from './fans/fans.module';
import { TiersModule } from './tiers/tiers.module';
import { PassesModule } from './passes/passes.module';
import { IndexerModule } from './indexer/indexer.module';
import { StellarModule } from './stellar/stellar.module';
import { DevModule } from './dev/dev.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { GraphqlAppModule } from './graphql/graphql.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'auth-login',
        ttl: 60000,
        limit: 10,
      },
      {
        name: 'auth-nonce',
        ttl: 60000,
        limit: 20,
      },
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    CreatorsModule,
    CategoriesModule,
    FansModule,
    TiersModule,
    PassesModule,
    IndexerModule,
    StellarModule,
    DevModule,
    WebhooksModule,
    NotificationsModule,
    AdminModule,
    GraphqlAppModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .exclude('health', 'health/(.*)')
      .forRoutes('*');
  }
}

