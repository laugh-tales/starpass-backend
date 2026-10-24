import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { QueueModule, QUEUE_NAMES, QUEUE_PROVIDER_TOKEN } from './queue.module';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

describe('QueueService', () => {
  let service: QueueService;
  let queues: Map<string, Queue>;

  beforeEach(async () => {
    const mockQueues = new Map();
    Object.values(QUEUE_NAMES).forEach((name) => {
      mockQueues.set(name, {
        add: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
      } as any);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: QUEUE_PROVIDER_TOKEN,
          useValue: mockQueues,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    queues = module.get<Map<string, Queue>>(QUEUE_PROVIDER_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue a job', async () => {
    const queue = queues.get(QUEUE_NAMES.WEBHOOKS)!;
    await service.enqueueJob(QUEUE_NAMES.WEBHOOKS, { test: 'data' });
    expect(queue.add).toHaveBeenCalled();
  });

  it('should generate same jobId for same data', () => {
    const data = { test: 'data' };
    const id1 = QueueModule.generateJobId(data);
    const id2 = QueueModule.generateJobId(data);
    expect(id1).toEqual(id2);
  });
});
