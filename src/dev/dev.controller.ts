import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevService } from './dev.service';
import { FundWalletDto } from './dto/fund-wallet.dto';

@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Post('fund-wallet')
  @ApiOperation({ summary: 'Fund a Stellar testnet wallet with Friendbot' })
  fundWallet(@Body() dto: FundWalletDto) {
    return this.devService.fundWallet(dto.address);
  }
}
