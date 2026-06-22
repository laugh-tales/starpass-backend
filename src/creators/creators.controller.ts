import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Delete, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RegisterWebhookDto } from '../webhooks/dto/register-webhook.dto';
import { CreatorAnalyticsDto } from './creator-analytics.dto';

@ApiTags('creators')
@Controller('creators')
export class CreatorsController {
  constructor(
    private creatorsService: CreatorsService,
    private webhooksService: WebhooksService,
  ) {}

  @Get('featured')
  @ApiOperation({ summary: 'Get featured creators in display order' })
  @ApiResponse({ status: 200, description: 'Return featured creators ordered by featuredOrder' })
  getFeatured() {
    return this.creatorsService.getFeatured();
  }

  @Post(':id/feature')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'Feature a creator (admin only, requires X-Admin-Api-Key header)' })
  @ApiResponse({ status: 201, description: 'Creator featured' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  setFeatured(@Param('id') id: string, @Body() body: { order: number }) {
    return this.creatorsService.setFeatured(id, body.order ?? 0);
  }

  @Delete(':id/feature')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'Unfeature a creator (admin only)' })
  @ApiResponse({ status: 200, description: 'Creator unfeatured' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  unsetFeatured(@Param('id') id: string) {
    return this.creatorsService.unsetFeatured(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all creators' })
  @ApiResponse({ status: 200, description: 'Return paginated list of creators' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    if (+limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }
    return this.creatorsService.findAll(+page, +limit);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get creator by Stellar address' })
  @ApiResponse({ status: 200, description: 'Return creator profile' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  findOne(@Param('address') address: string) {
    return this.creatorsService.findByAddress(address);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as a creator' })
  @ApiResponse({ status: 201, description: 'Creator successfully registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  register(@Request() req: any, @Body() dto: CreateCreatorDto) {
    return this.creatorsService.register(req.user.sub, dto, req.user.address);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update creator profile' })
  @ApiResponse({ status: 200, description: 'Creator profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator profile not found' })
  update(@Request() req: any, @Body() dto: UpdateCreatorDto) {
    return this.creatorsService.update(req.user.address, dto);
  }

  @Get(':address/earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get creator earnings summary' })
  @ApiResponse({ status: 200, description: 'Return creator earnings summary' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  getEarnings(@Param('address') address: string) {
    return this.creatorsService.getEarnings(address);
  }

  @Get(':id/revenue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get creator revenue analytics' })
  @ApiResponse({ status: 200, description: 'Return creator revenue analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  getRevenue(@Param('id') id: string, @Request() req: any) {
    if (req.user?.sub !== id) {
      throw new ForbiddenException('You are not authorized to access this creator revenue summary');
    }

    return this.creatorsService.getRevenue(id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get creator subscription analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['30d', '90d', '1y'] })
  @ApiResponse({ status: 200, type: CreatorAnalyticsDto, description: 'Return creator subscription analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  getAnalytics(@Param('id') id: string, @Query('period') period = '30d', @Request() req: any) {
    if (req.user?.sub !== id) {
      throw new ForbiddenException('You are not authorized to access this creator analytics summary');
    }

    return this.creatorsService.getAnalytics(id, period);
  }

  @Post(':id/webhooks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a webhook URL' })
  @ApiResponse({ status: 201, description: 'Webhook successfully registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  registerWebhook(
    @Param('id') id: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    return this.webhooksService.register(id, dto.url, dto.secret);
  }

  @Delete(':id/webhooks/:webhookId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook successfully removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  removeWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.remove(id, webhookId);
  }
}
