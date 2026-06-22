import { Module } from '@nestjs/common';
import { ContentSchedulesController } from './content-schedules.controller';
import { ContentSchedulesService } from './content-schedules.service';
import { ContentSchedulesScheduler } from './content-schedules.scheduler';

@Module({
  controllers: [ContentSchedulesController],
  providers: [ContentSchedulesService, ContentSchedulesScheduler],
})
export class ContentSchedulesModule {}
