import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SLOW_QUERY_THRESHOLD_MS = 1000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private slowQueryCount = 0;

  constructor() {
    super({
      log: [{ emit: 'event', level: 'query' }],
    });

    (this as any).$on('query', (event: { duration: number; query: string }) => {
      if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
        this.slowQueryCount += 1;
        this.logger.warn(`Slow query detected (${event.duration}ms): ${event.query.slice(0, 200)}`);
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  getSlowQueryCount() {
    return this.slowQueryCount;
  }

  async measureQueryLatency(): Promise<number> {
    const start = Date.now();
    await this.$queryRaw`SELECT 1`;
    return Date.now() - start;
  }
}
