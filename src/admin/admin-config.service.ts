import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { UpdateFeeDto } from './dto/update-fee.dto';

const CONFIG_SINGLETON_ID = 'singleton';
const DEFAULT_FEE_BPS = 250; // 2.5%

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  /**
   * Retrieve the current platform fee configuration.
   * Creates the singleton record with the default fee if it doesn't exist yet.
   *
   * @returns The current PlatformConfig record.
   */
  async getFeeConfig() {
    return this.prisma.platformConfig.upsert({
      where: { id: CONFIG_SINGLETON_ID },
      update: {},
      create: { id: CONFIG_SINGLETON_ID, feeBps: DEFAULT_FEE_BPS },
    });
  }

  /**
   * Update the platform fee and emit a fee_updated event to Soroban.
   *
   * @param dto - DTO containing the new feeBps value (0–1000).
   * @param updatedBy - Stellar address of the admin performing the update.
   * @returns The updated PlatformConfig record.
   */
  async updateFee(dto: UpdateFeeDto, updatedBy: string) {
    const config = await this.prisma.platformConfig.upsert({
      where: { id: CONFIG_SINGLETON_ID },
      update: { feeBps: dto.feeBps, updatedBy },
      create: { id: CONFIG_SINGLETON_ID, feeBps: dto.feeBps, updatedBy },
    });

    // Emit the fee change event to the Soroban contract (best-effort)
    this.stellar.emitFeeUpdatedEvent(dto.feeBps).catch((err: Error) => {
      this.logger.error(`Failed to emit fee_updated event to Soroban: ${err.message}`);
    });

    this.logger.log(`Platform fee updated to ${dto.feeBps} bps by ${updatedBy}`);

    return config;
  }

  /**
   * Get the current fee in basis points for use in pass purchase calculations.
   * Falls back to the default if no config row exists.
   *
   * @returns The fee in basis points as a number.
   */
  async getCurrentFeeBps(): Promise<number> {
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: CONFIG_SINGLETON_ID },
    });
    return config?.feeBps ?? DEFAULT_FEE_BPS;
  }
}
