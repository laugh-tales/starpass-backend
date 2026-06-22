import { Controller, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FansService } from './fans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('fans')
@Controller({ path: 'fans', version: '1' })
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

  @Get(':address/deletion-status')
  @ApiOperation({ summary: 'Check deletion status for a fan account' })
  @ApiResponse({ status: 200, description: 'Return deletion status' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getDeletionStatus(@Param('address') address: string) {
    return this.fansService.getDeletionStatus(address);
  }

  @Delete(':address/account')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request account deletion (GDPR)',
    description: 'Initiates a 30-day cooling off period for account deletion. Active passes are cancelled immediately. Personal data will be anonymized. Transaction records are retained for financial compliance.',
  })
  @ApiResponse({
    status: 202,
    description:
      'Deletion request accepted. 30-day cooling off period started. Use GET /fans/:address/deletion-status to check status.',
  })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  @ApiResponse({ status: 409, description: 'Deletion already requested for this account' })
  async requestAccountDeletion(@Param('address') address: string) {
    return this.fansService.requestDeletion(address);
  }
}
