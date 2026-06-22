import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminConfigService } from './admin-config.service';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  @Get('fee')
  @ApiOperation({ summary: 'Get current platform fee configuration (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns current fee configuration' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  getFee() {
    return this.adminConfigService.getFeeConfig();
  }

  @Patch('fee')
  @ApiOperation({ summary: 'Update platform fee percentage (admin only)' })
  @ApiResponse({ status: 200, description: 'Fee updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid fee value — must be 0–1000 bps' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  updateFee(@Body() dto: UpdateFeeDto, @Request() req: any) {
    return this.adminConfigService.updateFee(dto, req.user.address);
  }
}
