import { Body, Controller, Get, Param, ParseIntPipe, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TiersService } from './tiers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('tiers')
@Controller('tiers')
export class TiersController {
  constructor(private tiersService: TiersService) {}

  @Get('creator/:address')
  @ApiOperation({ summary: 'Get all active tiers for a creator' })
  @ApiResponse({ status: 200, description: 'Return active tiers for the creator, sorted by sortOrder' })
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

  @Patch('creator/:address/order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder tiers for a creator (creator only)' })
  @ApiResponse({ status: 200, description: 'Updated tiers in new order' })
  @ApiResponse({ status: 400, description: 'Tier does not belong to this creator' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  reorderTiers(
    @Param('address') address: string,
    @Body() body: { tierIds: string[] },
    @Request() req: any,
  ) {
    return this.tiersService.reorderTiers(req.user.address, body.tierIds);
  }
}
