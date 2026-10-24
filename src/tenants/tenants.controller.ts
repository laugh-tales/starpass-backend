import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 409, description: 'Tenant slug or domain already exists' })
  @ApiBearerAuth()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants (admin only)' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  @ApiBearerAuth()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get tenant by slug' })
  @ApiResponse({ status: 200, description: 'Tenant found' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  @Get('config/:slug')
  @ApiOperation({ summary: 'Get tenant frontend configuration' })
  @ApiResponse({ status: 200, description: 'Tenant configuration' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getFrontendConfig(@Param('slug') slug: string) {
    return this.tenantsService.getFrontendConfig(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID (admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant found' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiBearerAuth()
  findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get tenant statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant statistics' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiBearerAuth()
  getStats(@Param('id') id: string) {
    return this.tenantsService.getStats(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tenant (admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant (soft delete, admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
