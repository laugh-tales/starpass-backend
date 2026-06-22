import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FansService } from './fans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('fans')
@Controller('fans')
export class FansController {
  constructor(private fansService: FansService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get fan profile by Stellar address' })
  @ApiResponse({ status: 200, description: 'Return fan profile' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  findOne(@Param('address') address: string) {
    return this.fansService.findByAddress(address);
  }

  @Get(':address/subscriptions')
  @ApiOperation({ summary: 'Get active subscriptions for a fan' })
  @ApiResponse({ status: 200, description: 'Return list of active subscriptions' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getSubscriptions(@Param('address') address: string) {
    return this.fansService.getSubscriptions(address);
  }

  @Post(':address/data-export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export all fan data (GDPR) — rate limited to once per 24 hours' })
  @ApiResponse({ status: 201, description: 'JSON export of all fan data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  @ApiResponse({ status: 429, description: 'Export already requested in the last 24 hours' })
  exportData(@Param('address') address: string) {
    return this.fansService.exportData(address);
  }
}
