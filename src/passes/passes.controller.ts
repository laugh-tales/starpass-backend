import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PassesService } from './passes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ListPassesDto } from './dto/list-passes.dto';

@ApiTags('passes')
@Controller({ path: 'passes', version: '1' })
export class PassesController {
  constructor(private passesService: PassesService) {}

  @Get('check/:fanAddress/tier/:tierId')
  @ApiOperation({ summary: 'Check if a fan has a valid pass for a tier' })
  @ApiResponse({ status: 200, description: 'Return verification result ({ valid: boolean })' })
  hasValidPass(
    @Param('fanAddress') fanAddress: string,
    @Param('tierId') tierId: string,
  ) {
    return this.passesService.hasValidPass(fanAddress, tierId).then((valid) => ({ valid }));
  }

  @Get('check/:fanAddress/creator/:creatorAddress')
  @ApiOperation({ summary: 'Check if a fan has any valid pass from a creator' })
  @ApiResponse({ status: 200, description: 'Return verification result ({ valid: boolean })' })
  hasAnyValidPass(
    @Param('fanAddress') fanAddress: string,
    @Param('creatorAddress') creatorAddress: string,
  ) {
    return this.passesService
      .hasAnyValidPass(fanAddress, creatorAddress)
      .then((valid) => ({ valid }));
  }

  @Get('fan/:address')
  @ApiOperation({ summary: 'Get all passes for a fan' })
  @ApiResponse({ status: 200, description: 'Return list of passes for the fan' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  findByFan(
    @Param('address') address: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.passesService.findByFan(address, activeOnly === 'true');
  }

  @Get('creator/:address/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pass count for a creator' })
  @ApiResponse({ status: 200, description: 'Return pass count summary ({ total: number, active: number })' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  getCreatorPassCount(@Param('address') address: string) {
    return this.passesService.getCreatorPassCount(address);
  }

  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a receipt for a pass purchase' })
  @ApiResponse({ status: 200, description: 'Return pass purchase receipt details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the pass owner can view this receipt' })
  @ApiResponse({ status: 404, description: 'Pass not found' })
  getReceipt(@Param('id') id: string, @Request() req: any) {
    return this.passesService.getReceipt(id, req.user.address);
  }

  @Get()
  @ApiOperation({ summary: 'List all passes with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated list of passes' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  findAll(@Query() query: ListPassesDto) {
    return this.passesService.findAll(query);
  }
}
