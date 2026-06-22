import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an abuse report (max 5 per fan per day)' })
  @ApiResponse({ status: 201, description: 'Report submitted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Daily report limit reached' })
  submitReport(
    @Body() body: { targetType: 'creator' | 'tier'; targetId: string; reason: string },
    @Request() req: any,
  ) {
    return this.reportsService.submitReport(req.user.sub, body.targetType, body.targetId, body.reason);
  }

  @Get('admin')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'List all reports (admin only, requires X-Admin-Api-Key)' })
  @ApiResponse({ status: 200, description: 'Paginated list of reports' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  listReports(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.reportsService.listReports(+page, +limit, status);
  }

  @Patch('admin/:id')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'Resolve or dismiss a report (admin only)' })
  @ApiResponse({ status: 200, description: 'Report updated' })
  @ApiResponse({ status: 401, description: 'Invalid admin key' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  resolveReport(
    @Param('id') id: string,
    @Body() body: { status: 'RESOLVED' | 'DISMISSED' },
  ) {
    return this.reportsService.resolveReport(id, body.status);
  }
}
