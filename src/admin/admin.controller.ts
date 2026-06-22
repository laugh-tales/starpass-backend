import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminApiKeyGuard } from './admin-api-key.guard';

@ApiTags('admin')
@ApiSecurity('x-admin-api-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide stats (admin only)' })
  @ApiResponse({ status: 200, description: 'Platform stats' })
  @ApiResponse({ status: 403, description: 'Invalid or missing admin API key' })
  getStats() {
    return this.adminService.getStats();
  }
}
