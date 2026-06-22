import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private stellarService: StellarService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready to receive requests' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      throw new ServiceUnavailableException('Database is unreachable');
    }
  }

  @Get('deep')
  @ApiOperation({ summary: 'Deep health check for all dependencies' })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unhealthy' })
  async getDeepHealth() {
    let databaseStatus = 'up';
    let stellarStatus = 'up';
    let hasError = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'down';
      hasError = true;
    }

    try {
      await this.stellarService.getLatestLedger();
    } catch (error) {
      stellarStatus = 'down';
      hasError = true;
    }

    const response = {
      status: hasError ? 'error' : 'ok',
      dependencies: {
        database: databaseStatus,
        stellar: stellarStatus,
      },
    };

    if (hasError) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
