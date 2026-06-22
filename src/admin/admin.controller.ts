import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide dashboard statistics (X-Admin-Api-Key required)' })
  @ApiResponse({ status: 200, description: 'Platform stats: creators, fans, passes, revenue, active passes, new users today' })
  @ApiResponse({ status: 401, description: 'Invalid admin API key' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}
