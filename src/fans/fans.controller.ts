import { Controller, Get, Post, Delete, Param, HttpCode, HttpStatus, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FansService } from './fans.service';
import { StrKey } from '@stellar/stellar-sdk';

@ApiTags('fans')
@Controller({ path: 'fans', version: '1' })
export class FansController {
  constructor(private fansService: FansService) { }

  private validateStellarAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new BadRequestException('Invalid Stellar address format');
    }
    try {
      StrKey.decodeEd25519PublicKey(address);
    } catch (error) {
      throw new BadRequestException('Invalid Stellar address format');
    }
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get fan profile by Stellar address' })
  @ApiResponse({ status: 200, description: 'Return fan profile' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  @ApiResponse({ status: 400, description: 'Invalid Stellar address format' })
  findOne(@Param('address') address: string) {
    this.validateStellarAddress(address);
    return this.fansService.findByAddress(address);
  }

  @Get(':address/subscriptions')
  @ApiOperation({ summary: 'Get active subscriptions for a fan grouped by creator' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default 20, max 50)' })
  @ApiResponse({ status: 200, description: 'Return list of active subscriptions grouped by creator' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getSubscriptions(
    @Param('address') address: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.fansService.getSubscriptions(address, +page, +limit);
  }

  @Get(':address/deletion-status')
  @ApiOperation({ summary: 'Check deletion status for a fan account' })
  @ApiResponse({ status: 200, description: 'Return deletion status' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getDeletionStatus(@Param('address') address: string) {
    return this.fansService.getDeletionStatus(address);
  }

  @Post(':address/data-export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request data export (GDPR)' })
  @ApiResponse({ status: 200, description: 'Data export compiled successfully' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  @ApiResponse({ status: 429, description: 'Rate limited. 1 export per 24 hours.' })
  async requestDataExport(@Param('address') address: string) {
    return this.fansService.requestDataExport(address);
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
