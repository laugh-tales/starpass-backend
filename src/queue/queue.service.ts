import { Injectable, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QueueName, QUEUE_NAMES, QUEUE_PROVIDER_TOKEN, QueueModule } from './queue.module';

@Injectable()
export class QueueService {
  private connection = {
    host: this.configService.get<string>('REDIS_HOST', 'localhost'),
    port: this.configService.get<number>('REDIS_PORT', 6379),
  };

  constructor(
    @Inject(QUEUE_PROVIDER_TOKEN) private queues: Map<QueueName, Queue>,
    private configService: ConfigService,
  ) {}

  async enqueueJob(name: QueueName, data: any): Promise<void> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    const jobId = QueueModule.generateJobId(data);
    await queue.add(name, data, {
      jobId,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    });
  }

  async getQueueStats(name: QueueName) {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const deadQueue = new Queue(`${name}:dead`, { connection: this.connection });
    const deadCount = await deadQueue.getWaitingCount();
    await deadQueue.close();

    return {
      name,
      waiting,
      active,
      completed,
      failed,
      dead: deadCount,
    };
  }

  async getAllQueueStats() {
    return Promise.all(Object.values(QUEUE_NAMES).map((name) => this.getQueueStats(name)));
  }

  async retryDeadJobs(name: QueueName) {
    const deadQueue = new Queue(`${name}:dead`, { connection: this.connection });
    const jobs = await deadQueue.getJobs(['waiting']);
    
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    
    for (const job of jobs) {
      await queue.add(name, job.data, { jobId: job.id });
      await job.remove();
    }
    await deadQueue.close();
  }

  async flushDeadJobs(name: QueueName) {
    const deadQueue = new Queue(`${name}:dead`, { connection: this.connection });
    await deadQueue.obliterate({ force: true });
    await deadQueue.close();
  }
}
