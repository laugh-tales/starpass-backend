import { Module } from '@nestjs/common';
import { CreatorMembersController } from './creator-members.controller';
import { CreatorMembersService } from './creator-members.service';

@Module({
  controllers: [CreatorMembersController],
  providers: [CreatorMembersService],
})
export class CreatorMembersModule {}
