import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlatformConfigService } from './platform-config.service';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';

@ApiTags('admin')
@Controller({ path: 'admin/config', version: '1' })
export class PlatformConfigController {
  constructor(private platformConfigService: PlatformConfigService) {}

  @Get('fee')
  @ApiOperation({ summary: 'Get current platform fee configuration' })
  @ApiResponse({ status: 200, description: 'Returns { feeBps, updatedAt, updatedBy }' })
  getConfig() {
    return this.platformConfigService.getConfig();
  }

  @Patch('fee')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'Update platform fee in basis points (0–1000 = 0–10%) — admin only' })
  @ApiResponse({ status: 200, description: 'Updated config' })
  @ApiResponse({ status: 400, description: 'feeBps out of range' })
  @ApiResponse({ status: 401, description: 'Invalid admin API key' })
  updateFee(@Body() body: { feeBps: number; updatedBy?: string }) {
    return this.platformConfigService.updateFee(body.feeBps, body.updatedBy ?? 'admin');
  }
}
