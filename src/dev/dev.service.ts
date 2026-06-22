import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class DevService {
  constructor(private readonly configService: ConfigService) {}

  async fundWallet(address: string) {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }

    const friendbotUrl = new URL(
      this.configService.get('STELLAR_FRIENDBOT_URL') || 'https://friendbot.stellar.org',
    );
    friendbotUrl.searchParams.set('addr', address);

    const response = await fetch(friendbotUrl, { method: 'GET' });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ServiceUnavailableException({
        message: 'Friendbot funding failed',
        details: data,
      });
    }

    return data;
  }
}
