import { Controller, Get, Post, Param, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TiersService } from './tiers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('tiers')
@Controller('tiers')
export class TiersController {
  constructor(private tiersService: TiersService) {}

  @Get('creator/:address')
  @ApiOperation({ summary: 'Get all active tiers for a creator' })
  @ApiResponse({ status: 200, description: 'Return active tiers for the creator' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  findByCreator(@Param('address') address: string) {
    return this.tiersService.findByCreator(address);
  }

  @Get('creator/:address/:onChainId')
  @ApiOperation({ summary: 'Get a specific tier by on-chain ID' })
  @ApiResponse({ status: 200, description: 'Return tier profile' })
  @ApiResponse({ status: 404, description: 'Creator or tier not found' })
  findOne(
    @Param('address') address: string,
    @Param('onChainId', ParseIntPipe) onChainId: number,
  ) {
    return this.tiersService.findOne(address, onChainId);
  }

  @Post(':id/content/unlock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a signed temporary URL for gated content (valid 15 minutes, requires active pass)' })
  @ApiResponse({ status: 201, description: 'Returns { token, expiresAt }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No active pass for this tier' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  unlockContent(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.unlockContent(id, req.user.address);
  }

  @Get(':id/content/verify')
  @ApiOperation({ summary: 'Verify a content unlock token' })
  @ApiResponse({ status: 200, description: 'Returns { valid: boolean, reason? }' })
  verifyContentToken(@Param('id') id: string, @Query('token') token: string) {
    return this.tiersService.verifyContentToken(id, token);
  }
}
