import { Module, OnApplicationShutdown, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { createHash } from 'crypto';

export const QUEUE_NAMES = {
  WEBHOOKS: 'webhooks',
  EMAILS: 'emails',
  PASS_RENEWALS: 'pass-renewals',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const QUEUE_PROVIDER_TOKEN = 'BULLMQ_QUEUES';
export const WORKER_PROVIDER_TOKEN = 'BULLMQ_WORKERS';

@Global()
@Module({
  controllers: [QueueController],
  providers: [
    QueueService,
    {
      provide: QUEUE_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const connection = {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        };
        const queues = new Map<QueueName, Queue>();
        Object.values(QUEUE_NAMES).forEach((name) => {
          queues.set(name, new Queue(name, { connection }));
        });
        return queues;
      },
      inject: [ConfigService],
    },
    {
      provide: WORKER_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const connection = {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        };
        const workers = new Map<QueueName, Worker>();
        
        Object.values(QUEUE_NAMES).forEach((name) => {
          const deadQueue = new Queue(`${name}:dead`, { connection });
          
          const worker = new Worker(
            name,
            async (job) => {
              console.log(`Processing job ${job.id} in queue ${name}`);
            },
            {
              connection,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000,
              },
            },
          );

          worker.on('failed', async (job, err) => {
            console.error(`Job ${job?.id} failed in queue ${name}:`, err);
            if (job) {
              await deadQueue.add(`${name}:dead`, job.data, {
                jobId: job.id,
                failedReason: err.message,
              });
            }
          });

          workers.set(name, worker);
        });
        return workers;
      },
      inject: [ConfigService],
    },
  ],
  exports: [QueueService, QUEUE_PROVIDER_TOKEN],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(QUEUE_PROVIDER_TOKEN) private queues: Map<QueueName, Queue>,
    @Inject(WORKER_PROVIDER_TOKEN) private workers: Map<QueueName, Worker>,
  ) {}

  async onApplicationShutdown() {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  static generateJobId(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
