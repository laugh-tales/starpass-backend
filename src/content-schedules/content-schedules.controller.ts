import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContentSchedulesService } from './content-schedules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('content-schedules')
@Controller('creators/:address/schedule')
export class ContentSchedulesController {
  constructor(private contentSchedulesService: ContentSchedulesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule content for a tier (creator only)' })
  @ApiResponse({ status: 201, description: 'Content scheduled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Tier not owned by creator' })
  @ApiResponse({ status: 404, description: 'Creator or tier not found' })
  create(
    @Param('address') address: string,
    @Body() body: { tierId: string; contentUrl: string; title: string; availableAt: string },
    @Request() req: any,
  ) {
    if (req.user.address !== address) {
      throw new Error('Forbidden');
    }
    return this.contentSchedulesService.create(address, body.tierId, {
      contentUrl: body.contentUrl,
      title: body.title,
      availableAt: new Date(body.availableAt),
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List scheduled content for a creator' })
  @ApiResponse({ status: 200, description: 'List of scheduled content items' })
  findByCreator(@Param('address') address: string) {
    return this.contentSchedulesService.findByCreator(address);
  }
}
