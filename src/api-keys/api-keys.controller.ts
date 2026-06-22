import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('api-keys')
@Controller('creators/:address/api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new API key for third-party integrations' })
  @ApiResponse({ status: 201, description: 'Key generated — returned once, store it securely' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  generate(
    @Param('address') address: string,
    @Body() body: { name: string; permissions: string[] },
    @Request() req: any,
  ) {
    return this.apiKeysService.generate(req.user.address, body.name, body.permissions ?? []);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys for a creator (no plain keys returned)' })
  @ApiResponse({ status: 200, description: 'List of keys without secrets' })
  list(@Param('address') address: string, @Request() req: any) {
    return this.apiKeysService.list(req.user.address);
  }

  @Delete(':keyId')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'Key revoked' })
  @ApiResponse({ status: 403, description: 'Key does not belong to this creator' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  revoke(
    @Param('address') address: string,
    @Param('keyId') keyId: string,
    @Request() req: any,
  ) {
    return this.apiKeysService.revoke(req.user.address, keyId);
  }
}
