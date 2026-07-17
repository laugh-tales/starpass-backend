import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { QueueService } from './queue.service';
import { QueueName } from './queue.module';

@ApiTags('admin')
@Controller('admin/queues')
@UseGuards(AdminGuard)
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Get()
  @ApiOperation({ summary: 'Get queue statistics' })
  async getQueues() {
    return this.queueService.getAllQueueStats();
  }

  @Post(':name/dead/retry')
  @ApiOperation({ summary: 'Retry all dead letter jobs for a queue' })
  async retryDeadJobs(@Param('name') name: string) {
    await this.queueService.retryDeadJobs(name as QueueName);
    return { message: 'Dead jobs retried' };
  }

  @Post(':name/dead/flush')
  @ApiOperation({ summary: 'Discard all dead letter jobs for a queue' })
  async flushDeadJobs(@Param('name') name: string) {
    await this.queueService.flushDeadJobs(name as QueueName);
    return { message: 'Dead jobs flushed' };
  }
}
