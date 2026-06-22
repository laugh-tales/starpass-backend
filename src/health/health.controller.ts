import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';

@ApiTags('health')
@Controller('health')
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
  @ApiOperation({ summary: 'Deep health check — includes DB latency and slow query count' })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unhealthy' })
  async getDeepHealth() {
    let databaseStatus = 'up';
    let dbLatencyMs: number | null = null;
    let stellarStatus = 'up';
    let hasError = false;

    try {
      dbLatencyMs = await this.prisma.measureQueryLatency();
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
        database: {
          status: databaseStatus,
          latencyMs: dbLatencyMs,
          slowQueryCount: this.prisma.getSlowQueryCount(),
        },
        stellar: { status: stellarStatus },
      },
    };

    if (hasError) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
