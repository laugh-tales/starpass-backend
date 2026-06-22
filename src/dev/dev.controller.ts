import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private config: ConfigService) {}

  @Post('fund-wallet')
  @ApiOperation({ summary: 'Fund a Stellar testnet wallet via Friendbot (development only)' })
  @ApiResponse({ status: 201, description: 'Funding transaction details from Friendbot' })
  @ApiResponse({ status: 400, description: 'Missing address' })
  @ApiResponse({ status: 404, description: 'Not available in production' })
  async fundWallet(@Body() body: { address: string }) {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    if (env === 'production') {
      throw new NotFoundException('This endpoint is not available in production');
    }

    if (!body.address) {
      throw new NotFoundException('address is required');
    }

    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(body.address)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new NotFoundException(`Friendbot error: ${text}`);
    }

    return res.json();
  }
}
