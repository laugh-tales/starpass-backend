import { Controller, Delete, Get, Param, Request, UseGuards } from '@nestjs/common';
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

  @Delete(':address/account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule account deletion (GDPR) — soft-delete with 30-day cooling off period' })
  @ApiResponse({ status: 200, description: 'Deletion scheduled; active passes cancelled; data anonymized in 30 days' })
  @ApiResponse({ status: 400, description: 'Deletion already scheduled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  scheduleDeletion(@Param('address') address: string) {
    return this.fansService.scheduleDeletion(address);
  }
}
