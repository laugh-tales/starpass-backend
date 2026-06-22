import { Injectable, Logger } from '@nestjs/common';
import { ContentSchedulesService } from './content-schedules.service';

@Injectable()
export class ContentSchedulesScheduler {
  private readonly logger = new Logger(ContentSchedulesScheduler.name);

  constructor(private contentSchedulesService: ContentSchedulesService) {}

  onModuleInit() {
    setInterval(() => this.activateDue(), 15 * 60 * 1000);
  }

  private async activateDue() {
    try {
      const result = await this.contentSchedulesService.activateDue();
      if (result.count > 0) {
        this.logger.log(`Activated ${result.count} scheduled content item(s)`);
      }
    } catch (err) {
      this.logger.error('Failed to activate scheduled content', err);
    }
  }
}
