import { ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ListPassesDto } from './dto/list-passes.dto';
import { EmailService } from '../notifications/email.service';
import { TiersService } from '../tiers/tiers.service';

@Injectable()
export class PassesService {
  private readonly logger = new Logger(PassesService.name);

  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
    private emailService: EmailService,
    private tiersService: TiersService,
  ) {}

  /**
   * Check if a fan has a valid pass for a specific tier
   * This is the core access-gating function
   * 
   * @param fanAddress The Stellar public key of the fan.
   * @param tierId The unique identifier of the tier.
   * @returns True if the fan has an active pass for the tier, otherwise false.
   */
  async hasValidPass(fanAddress: string, tierId: string): Promise<boolean> {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });

    if (!fan) return false;

    const now = new Date();
    const pass = await this.prisma.pass.findFirst({
      where: {
        fanId: fan.id,
        tierId,
        active: true,
        expiresAt: { gt: now },
      },
    });

    return !!pass;
  }

  /**
   * Check if a fan has any valid pass from a creator
   * 
   * @param fanAddress The Stellar public key of the fan.
   * @param creatorAddress The Stellar public key of the creator.
   * @returns True if the fan has at least one active pass from the creator, otherwise false.
   */
  async hasAnyValidPass(fanAddress: string, creatorAddress: string): Promise<boolean> {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });

    if (!fan || !creator) return false;

    const now = new Date();
    const pass = await this.prisma.pass.findFirst({
      where: {
        fanId: fan.id,
        creatorId: creator.id,
        active: true,
        expiresAt: { gt: now },
      },
    });

    return !!pass;
  }

  /**
   * Get all passes for a fan
   * 
   * @param fanAddress The Stellar public key of the fan.
   * @param activeOnly If true, returns only active, non-expired passes. Defaults to false.
   * @returns A list of passes belonging to the fan.
   * @throws {NotFoundException} If the fan is not found.
   */
  async findByFan(fanAddress: string, activeOnly = false) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });

    if (!fan) {
      throw new NotFoundException('Fan not found');
    }

    const now = new Date();
    return this.prisma.pass.findMany({
      where: {
        fanId: fan.id,
        ...(activeOnly ? { active: true, expiresAt: { gt: now } } : {}),
      },
      include: { tier: true, creator: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  /**
   * Get pass count for a creator
   * 
   * @param creatorAddress The Stellar public key of the creator.
   * @returns An object containing the total and active pass counts.
   * @throws {NotFoundException} If the creator is not found.
   */
  async getCreatorPassCount(creatorAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const now = new Date();
    const [total, active] = await Promise.all([
      this.prisma.pass.count({ where: { creatorId: creator.id } }),
      this.prisma.pass.count({
        where: { creatorId: creator.id, active: true, expiresAt: { gt: now } },
      }),
    ]);

    return { total, active };
  }

  /**
   * Get a receipt for a pass purchase.
   *
   * @param passId The pass record id.
   * @param ownerAddress The authenticated fan's Stellar public key.
   * @returns A receipt containing pass, tier, creator, purchase, amount, and transaction details.
   * @throws {NotFoundException} If the pass is not found.
   * @throws {ForbiddenException} If the authenticated fan does not own the pass.
   */
  async getReceipt(passId: string, ownerAddress: string) {
    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      include: {
        tier: true,
        creator: true,
        fan: true,
      },
    });

    if (!pass) {
      throw new NotFoundException('Pass not found');
    }

    if (pass.fan.stellarAddress !== ownerAddress) {
      throw new ForbiddenException('Only the pass owner can view this receipt');
    }

    const feeBps = await this.adminConfigService.getCurrentFeeBps();
    const priceUsdc = parseFloat(pass.tier.priceUsdc.toString());
    const feeAmount = parseFloat(((priceUsdc * feeBps) / 10000).toFixed(6));
    const creatorAmount = parseFloat((priceUsdc - feeAmount).toFixed(6));

    return {
      pass: {
        id: pass.id,
        onChainId: pass.onChainId.toString(),
        active: pass.active,
        expiresAt: pass.expiresAt,
      },
      tier: pass.tier,
      creator: pass.creator,
      purchasedAt: pass.purchasedAt,
      amount: pass.tier.priceUsdc.toString(),
      feeBps,
      feeAmount: feeAmount.toString(),
      creatorAmount: creatorAmount.toString(),
      txHash: pass.txHash ?? null,
    };
  }

  /**
   * Upsert a pass from on-chain event data (called by indexer)
   * 
   * @param data The event data containing pass details from the blockchain.
   * @returns The upserted pass record, or null if the creator or tier is not found.
   */
  async upsertFromChain(data: {
    onChainId: bigint;
    tierOnChainId: number;
    creatorAddress: string;
    fanAddress: string;
    purchasedAt: Date;
    expiresAt: Date;
    txHash?: string | null;
  }) {
    const [creator, tier] = await Promise.all([
      this.prisma.creator.findUnique({ where: { stellarAddress: data.creatorAddress } }),
      this.prisma.tier.findFirst({
        where: {
          onChainId: data.tierOnChainId,
          creator: { stellarAddress: data.creatorAddress },
        },
      }),
    ]);

    if (!creator || !tier) return null;

    const block = await this.prisma.block.findUnique({
      where: {
        creatorId_fanAddress: {
          creatorId: creator.id,
          fanAddress: data.fanAddress,
        },
      },
    });

    if (block) {
      throw new ForbiddenException('Fan is blocked by this creator');
    }

    // Check if the pass already exists
    const existingPass = await this.prisma.pass.findUnique({
      where: { onChainId: data.onChainId },
    });

    // Upsert fan
    const fan = await this.prisma.fan.upsert({
      where: { stellarAddress: data.fanAddress },
      update: {},
      create: {
        stellarAddress: data.fanAddress,
        user: {
          connectOrCreate: {
            where: { stellarAddress: data.fanAddress },
            create: { stellarAddress: data.fanAddress },
          },
        },
      },
    });

    const pass = await this.prisma.pass.upsert({
      where: { onChainId: data.onChainId },
      update: {
        expiresAt: data.expiresAt,
        txHash: data.txHash ?? undefined,
        syncedAt: new Date(),
      },
      create: {
        onChainId: data.onChainId,
        tierId: tier.id,
        creatorId: creator.id,
        fanId: fan.id,
        purchasedAt: data.purchasedAt,
        expiresAt: data.expiresAt,
        txHash: data.txHash,
        syncedAt: new Date(),
      },
    });

    if (!existingPass) {
      const amount = Number(tier.priceUsdc);
      const fee = 0;
      const netAmount = amount - fee;
      this.prisma.earningsRecord.create({
        data: {
          creatorId: creator.id,
          fanId: fan.id,
          tierId: tier.id,
          amount,
          fee,
          netAmount,
        },
      }).catch((err) => {
        this.logger.error(`Error recording earnings: ${err.message}`);
      });

      // Trigger webhook delivery asynchronously without blocking
      this.webhooksService.deliverPassPurchaseWebhook(creator.id, pass).catch((err) => {
        this.logger.error(`Error triggering webhook: ${err.message}`);
      });

      // Send email notification to creator
      if (creator.email) {
        this.emailService.sendPassPurchaseEmail(
          creator.email,
          data.fanAddress,
          tier.name,
          tier.priceUsdc.toString()
        ).catch((err) => {
          this.logger.error(`Error triggering email: ${err.message}`);
        });
      }
    }

    return pass;
  }

  /**
   * Find all passes with filtering and pagination
   */
  async findAll(filters: ListPassesDto) {
    const { fan, tier_id, active, expired, page = 1, limit = 20 } = filters;
    const now = new Date();

    const where: any = {};

    if (fan) {
      where.fan = {
        stellarAddress: fan,
      };
    }

    if (tier_id) {
      where.tierId = tier_id;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (expired !== undefined) {
      where.expiresAt = expired ? { lte: now } : { gt: now };
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [data, total] = await Promise.all([
      this.prisma.pass.findMany({
        where,
        skip,
        take,
        include: {
          tier: true,
          creator: true,
          fan: true,
        },
        orderBy: {
          purchasedAt: 'desc',
        },
      }),
      this.prisma.pass.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
