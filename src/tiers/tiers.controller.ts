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

  @Post(':id/waitlist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join waitlist for a sold-out tier' })
  @ApiResponse({ status: 201, description: 'Waitlist entry created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  @ApiResponse({ status: 409, description: 'Already on waitlist or tier not sold out' })
  joinWaitlist(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.joinWaitlist(id, req.user.address);
  }

  @Get(':id/waitlist/position')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check your position on the waitlist for a tier' })
  @ApiResponse({ status: 200, description: 'Returns { position, joinedAt, notified }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not on the waitlist or tier not found' })
  getWaitlistPosition(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.getWaitlistPosition(id, req.user.address);
  }
}
