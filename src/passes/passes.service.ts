import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ListPassesDto } from './dto/list-passes.dto';
import { EmailService } from '../notifications/email.service';
import { AdminConfigService } from '../admin/admin-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class PassesService {
  private readonly logger = new Logger(PassesService.name);

  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
    private emailService: EmailService,
    private adminConfigService: AdminConfigService,
    private metricsService: MetricsService,
    private stellarService: StellarService,
    @Optional() private notificationsGateway?: NotificationsGateway,
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
   * Mint a pass for a fan on a tier, applying a free trial when eligible.
   *
   * @param tierOnChainId The on-chain ID of the tier to mint a pass for.
   * @param fanAddress The Stellar public key of the fan.
   * @param options Optional mint options (transaction client, on-chain ID, purchase time, tx hash).
   * @returns The created pass record.
   * @throws {BadRequestException} If the tier is not found or inactive.
   * @throws {ForbiddenException} If the fan is blocked or has already used a trial on this tier.
   */
  async mintPass(
    tierOnChainId: number,
    fanAddress: string,
    options?: {
      tx?: any;
      onChainId?: bigint;
      purchasedAt?: Date;
      txHash?: string | null;
      chainExpiresAt?: Date;
    },
  ) {
    const db = options?.tx ?? this.prisma;

    const tier = await db.tier.findFirst({
      where: { onChainId: tierOnChainId, active: true },
      include: { creator: true },
    });

    if (!tier) {
      throw new BadRequestException('Tier not found or inactive');
    }

    const block = await db.block.findFirst({
      where: {
        creatorId: tier.creatorId,
        blockedAddress: fanAddress,
      },
    });

    if (block) {
      throw new ForbiddenException('Fan is blocked by this creator');
    }

    const fan = await db.fan.upsert({
      where: { stellarAddress: fanAddress },
      update: {},
      create: {
        stellarAddress: fanAddress,
        tenantId: tier.tenantId,
        user: {
          connectOrCreate: {
            where: { stellarAddress: fanAddress },
            create: { stellarAddress: fanAddress, tenantId: tier.tenantId },
          },
        },
      },
    });

    const priorPasses = await db.pass.findMany({
      where: { fanId: fan.id, tierId: tier.id },
    });

    if (priorPasses.some((p) => p.trialUsed)) {
      throw new ForbiddenException('Trial already used for this tier');
    }

    const isFirstTime = priorPasses.length === 0;
    const isTrial = isFirstTime && tier.trialDays > 0;
    const purchasedAt = options?.purchasedAt ?? new Date();
    const expiresAt = isTrial
      ? new Date(purchasedAt.getTime() + tier.trialDays * 24 * 60 * 60 * 1000)
      : options?.chainExpiresAt ??
        new Date(purchasedAt.getTime() + tier.durationDays * 24 * 60 * 60 * 1000);

    const onChainId =
      options?.onChainId ?? BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000000));

    const pass = await db.pass.create({
      data: {
        tenantId: tier.tenantId,
        onChainId,
        tierId: tier.id,
        creatorId: tier.creatorId,
        fanId: fan.id,
        purchasedAt,
        expiresAt,
        txHash: options?.txHash,
        trialUsed: isTrial,
        syncedAt: new Date(),
      },
      include: {
        tier: true,
        creator: true,
      },
    });

    if (!isTrial) {
      const amount = Number(tier.priceUsdc);
      const fee = 0;
      const netAmount = amount - fee;

      if (this.metricsService) {
        this.metricsService.incActivePasses(tier.creator.stellarAddress);
        this.metricsService.incRevenue(tier.creator.stellarAddress, amount);
      }

      await db.earningsRecord.create({
        data: {
          tenantId: tier.tenantId,
          creatorId: tier.creatorId,
          fanId: fan.id,
          tierId: tier.id,
          amount,
          fee,
          netAmount,
        },
      });

      this.webhooksService.deliverPassPurchaseWebhook(tier.creatorId, pass).catch((err) => {
        this.logger.error(`Error triggering webhook: ${err.message}`);
      });

      if (tier.creator.email) {
        this.emailService
          .sendPassPurchaseEmail(
            tier.creator.email,
            fanAddress,
            tier.name,
            tier.priceUsdc.toString(),
          )
          .catch((err) => {
            this.logger.error(`Error triggering email: ${err.message}`);
          });
      }
    }

    return pass;
  }

  /**
   * Batch-deactivate passes that have expired.
   *
   * @returns The number of passes deactivated.
   */
  async deactivateExpiredPasses(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.pass.updateMany({
      where: {
        active: true,
        expiresAt: { lt: now },
      },
      data: { active: false },
    });
    return result.count;
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

    const block = await this.prisma.block.findFirst({
      where: {
        creatorId: creator.id,
        blockedAddress: data.fanAddress,
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
        tenantId: tier.tenantId,
        user: {
          connectOrCreate: {
            where: { stellarAddress: data.fanAddress },
            create: { stellarAddress: data.fanAddress, tenantId: tier.tenantId },
          },
        },
      },
    });

    if (!existingPass) {
      const priorPasses = await this.prisma.pass.findMany({
        where: { fanId: fan.id, tierId: tier.id },
      });

      if (priorPasses.some((p) => p.trialUsed)) {
        throw new ForbiddenException('Trial already used for this tier');
      }

      const isFirstTime = priorPasses.length === 0;
      const isTrial = isFirstTime && tier.trialDays > 0;
      const expiresAt = isTrial
        ? new Date(data.purchasedAt.getTime() + tier.trialDays * 24 * 60 * 60 * 1000)
        : data.expiresAt;

      const pass = await this.prisma.pass.create({
        data: {
          tenantId: tier.tenantId,
          onChainId: data.onChainId,
          tierId: tier.id,
          creatorId: creator.id,
          fanId: fan.id,
          purchasedAt: data.purchasedAt,
          expiresAt,
          txHash: data.txHash,
          trialUsed: isTrial,
          syncedAt: new Date(),
        },
      });

      if (!isTrial) {
        const amount = Number(tier.priceUsdc);
        const fee = 0;
        const netAmount = amount - fee;

        if (this.metricsService) {
          this.metricsService.incActivePasses(creator.stellarAddress);
          this.metricsService.incRevenue(creator.stellarAddress, amount);
        }

        this.prisma.earningsRecord.create({
          data: {
            tenantId: tier.tenantId,
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

        this.webhooksService.deliverPassPurchaseWebhook(creator.id, pass).catch((err) => {
          this.logger.error(`Error triggering webhook: ${err.message}`);
        });

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

    const pass = await this.prisma.pass.update({
      where: { onChainId: data.onChainId },
      data: {
        expiresAt: data.expiresAt,
        txHash: data.txHash ?? undefined,
        syncedAt: new Date(),
      },
    });

    return pass;
  }

  /**
   * Get NFT-style metadata for a pass
   *
   * @param passId The pass record id.
   * @returns NFT-compatible metadata { name, description, image, attributes: [{ trait_type, value }] }
   * @throws {NotFoundException} If the pass is not found.
   */
  async getMetadata(passId: string) {
    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      include: { tier: true, creator: true },
    });

    if (!pass) {
      throw new NotFoundException('Pass not found');
    }

    const now = new Date();
    const isActive = pass.active && pass.expiresAt > now;
    const status = isActive ? 'active' : 'expired';

    return {
      name: `${pass.creator.displayName} - ${pass.tier.name} Pass`,
      description: `A StarPass for ${pass.tier.name} tier from ${pass.creator.displayName}`,
      image: pass.creator.avatarUrl ?? '',
      attributes: [
        { trait_type: 'Tier Name', value: pass.tier.name },
        { trait_type: 'Creator', value: pass.creator.displayName },
        { trait_type: 'Purchased At', value: pass.purchasedAt.toISOString() },
        { trait_type: 'Expires At', value: pass.expiresAt.toISOString() },
        { trait_type: 'Status', value: status },
      ],
    };
  }

  /**
   * Get a pass by its internal ID.
   *
   * @param id The pass record id.
   * @returns The pass with tier, creator, and fan relations, or null if not found.
   */
  async findById(id: string) {
    return this.prisma.pass.findUnique({ where: { id }, include: { tier: true, creator: true, fan: true } });
  }

  /**
   * Find all passes with filtering and pagination.
   *
   * @param filters Query filters for fan, tier, active status, expiry, and pagination.
   * @returns Paginated pass list with total count.
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

  /**
   * Purchase a pass for another wallet. The sender is recorded as the payer
   * while the recipient fan owns the created pass.
   */
  async giftPass(
    tierId: string,
    senderAddress: string,
    recipientAddress: string,
  ) {
    const normalizedSender = senderAddress.trim().toUpperCase();
    const normalizedRecipient = recipientAddress.trim().toUpperCase();

    if (normalizedSender === normalizedRecipient) {
      throw new BadRequestException('You cannot gift a pass to yourself');
    }

    const tier = await this.prisma.tier.findFirst({
      where: { id: tierId, active: true },
      include: { creator: true },
    });

    if (!tier) {
      throw new BadRequestException('Invalid or inactive tier');
    }

    const recipientBlock = await this.prisma.block.findFirst({
      where: {
        creatorId: tier.creatorId,
        blockedAddress: normalizedRecipient,
      },
    });

    if (recipientBlock) {
      throw new ForbiddenException('Recipient is blocked by this creator');
    }

    const purchasedAt = new Date();
    const expiresAt = new Date(
      purchasedAt.getTime() + tier.durationDays * 24 * 60 * 60 * 1000,
    );

    const pass = await this.prisma.$transaction(async (tx) => {
      const sender = await tx.fan.upsert({
        where: { stellarAddress: normalizedSender },
        update: {},
        create: {
          stellarAddress: normalizedSender,
          user: {
            connectOrCreate: {
              where: { stellarAddress: normalizedSender },
              create: { stellarAddress: normalizedSender },
            },
          },
        },
      });
      const recipient = await tx.fan.upsert({
        where: { stellarAddress: normalizedRecipient },
        update: {},
        create: {
          stellarAddress: normalizedRecipient,
          user: {
            connectOrCreate: {
              where: { stellarAddress: normalizedRecipient },
              create: { stellarAddress: normalizedRecipient },
            },
          },
        },
      });

      const createdPass = await tx.pass.create({
        data: {
          onChainId:
            BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000000)),
          tierId: tier.id,
          creatorId: tier.creatorId,
          fanId: recipient.id,
          purchasedAt,
          expiresAt,
          syncedAt: purchasedAt,
          metadata: { giftedBy: normalizedSender },
        },
        include: {
          tier: true,
          creator: true,
          fan: true,
        },
      });

      const amount = Number(tier.priceUsdc);
      await tx.earningsRecord.create({
        data: {
          creatorId: tier.creatorId,
          fanId: sender.id,
          tierId: tier.id,
          amount,
          fee: 0,
          netAmount: amount,
        },
      });

      return createdPass;
    });

    this.metricsService?.incActivePasses(tier.creator.stellarAddress);
    this.metricsService?.incRevenue(
      tier.creator.stellarAddress,
      Number(tier.priceUsdc),
    );

    this.webhooksService
      .deliverPassPurchaseWebhook(tier.creatorId, pass)
      .catch((error) =>
        this.logger.error(`Error triggering gift webhook: ${error.message}`),
      );

    if (tier.creator.email) {
      this.emailService
        .sendPassPurchaseEmail(
          tier.creator.email,
          normalizedRecipient,
          tier.name,
          tier.priceUsdc.toString(),
        )
        .catch((error) =>
          this.logger.error(
            `Error triggering creator gift email: ${error.message}`,
          ),
        );
    }

    if (pass.fan.email) {
      this.emailService
        .sendPassGiftEmail(
          pass.fan.email,
          tier.name,
          normalizedSender,
        )
        .catch((error) =>
          this.logger.error(
            `Error triggering recipient gift email: ${error.message}`,
          ),
        );
    }

    return {
      ...pass,
      onChainId: pass.onChainId.toString(),
    };
  }

  /**
   * Purchase multiple passes in a single atomic transaction
   *
   * @param tierIds Array of tier IDs to purchase passes for (max 5).
   * @param fanAddress The Stellar public key of the fan making the purchase.
   * @returns Array of created passes.
   * @throws {BadRequestException} If any tier IDs are invalid or inactive.
   * @throws {ForbiddenException} If the fan is blocked or has already used a trial on a tier.
   */
  async purchaseBundle(tierIds: number[], fanAddress: string) {
    // Validate all tiers exist and are active
    const tiers = await this.prisma.tier.findMany({
      where: {
        onChainId: { in: tierIds },
        active: true,
      },
      include: { creator: true },
    });

    if (tiers.length !== tierIds.length) {
      const foundIds = tiers.map((t) => t.onChainId);
      const invalidIds = tierIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Invalid or inactive tier IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Group tiers by creator to check for blocks
    const creators = new Map<string, typeof tiers[0]['creator']>();
    for (const tier of tiers) {
      if (!creators.has(tier.creatorId)) {
        creators.set(tier.creatorId, tier.creator);
      }
    }

    // Check if fan is blocked by any creator
    const blocks = await this.prisma.block.findMany({
      where: {
        blockedAddress: fanAddress,
        creatorId: { in: Array.from(creators.keys()) },
      },
    });

    if (blocks.length > 0) {
      throw new ForbiddenException('Fan is blocked by one or more creators');
    }

    // Upsert fan
    const fan = await this.prisma.fan.upsert({
      where: { stellarAddress: fanAddress },
      update: {},
      create: {
        stellarAddress: fanAddress,
        user: {
          connectOrCreate: {
            where: { stellarAddress: fanAddress },
            create: { stellarAddress: fanAddress },
          },
        },
      },
    });

    const now = new Date();
    const purchasedAt = now;

    // Create all passes atomically using Prisma transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const createdPasses: any[] = [];

      for (const tier of tiers) {
        const priorPasses = await tx.pass.findMany({
          where: { fanId: fan.id, tierId: tier.id },
        });

        if (priorPasses.some((p) => p.trialUsed)) {
          throw new ForbiddenException('Trial already used for this tier');
        }

        const isFirstTime = priorPasses.length === 0;
        const isTrial = isFirstTime && tier.trialDays > 0;
        const expiresAt = isTrial
          ? new Date(purchasedAt.getTime() + tier.trialDays * 24 * 60 * 60 * 1000)
          : new Date(purchasedAt.getTime() + tier.durationDays * 24 * 60 * 60 * 1000);

        const onChainId = BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000000));

        const pass = await tx.pass.create({
          data: {
            onChainId,
            tierId: tier.id,
            creatorId: tier.creatorId,
            fanId: fan.id,
            purchasedAt,
            expiresAt,
            trialUsed: isTrial,
            syncedAt: now,
          },
          include: {
            tier: true,
            creator: true,
          },
        });

        createdPasses.push(pass);

        if (!isTrial) {
          const amount = Number(tier.priceUsdc);
          const fee = 0;
          const netAmount = amount - fee;

          await tx.earningsRecord.create({
            data: {
              creatorId: tier.creatorId,
              fanId: fan.id,
              tierId: tier.id,
              amount,
              fee,
              netAmount,
            },
          });
        }
      }

      return createdPasses;
    });

    // Emit bundle_purchased event via webhooks and emails (fire and forget)
    this.emitBundlePurchasedEvent(result, fanAddress);

    return result;
  }

  /**
   * Emit bundle_purchased event via webhooks and emails
   */
  private emitBundlePurchasedEvent(passes: any[], fanAddress: string) {
    // Group passes by creator for webhook/email delivery
    const byCreator = new Map<string, any[]>();
    for (const pass of passes) {
      const creatorId = pass.creatorId;
      if (!byCreator.has(creatorId)) {
        byCreator.set(creatorId, []);
      }
      byCreator.get(creatorId)!.push(pass);
    }

    // Deliver webhooks and emails for each creator
    for (const [creatorId, creatorPasses] of byCreator) {
      const creator = creatorPasses[0].creator;

      // Deliver webhook
      this.webhooksService
        .deliverBundlePurchaseWebhook(creatorId, creatorPasses, fanAddress)
        .catch((err) => {
          this.logger.error(`Error triggering bundle webhook: ${err.message}`);
        });

      // Send email notification
      if (creator.email) {
        const tierNames = creatorPasses.map((p) => p.tier.name).join(', ');
        const totalPrice = creatorPasses
          .reduce((sum, p) => sum + Number(p.tier.priceUsdc), 0)
          .toFixed(2);

        this.emailService
          .sendBundlePurchaseEmail(
            creator.email,
            fanAddress,
            tierNames,
            totalPrice,
            creatorPasses.length,
          )
          .catch((err) => {
            this.logger.error(`Error triggering bundle email: ${err.message}`);
          });
      }
    }
  }

  /**
   * Check for passes expiring in less than 48 hours and emit notifications
   * This should be called periodically (e.g., via a scheduled job)
   */
  async checkAndNotifyExpiringPasses() {
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find passes that will expire in the next 48 hours
    const expiringPasses = await this.prisma.pass.findMany({
      where: {
        active: true,
        expiresAt: {
          gt: now,
          lte: fortyEightHoursFromNow,
        },
      },
      include: {
        fan: true,
        tier: true,
        creator: true,
      },
    });

    // Emit pass_expiring_soon event for each expiring pass
    if (this.notificationsGateway) {
      for (const pass of expiringPasses) {
        this.notificationsGateway
          .emitPassExpiringSoonEvent(pass.fan.stellarAddress, {
            id: pass.id,
            tierName: pass.tier.name,
            creatorName: pass.creator.displayName,
            expiresAt: pass.expiresAt,
          })
          .catch((err) => {
            this.logger.error(`Error emitting pass_expiring_soon event: ${err.message}`);
          });
      }
    }

    return expiringPasses.length;
  }

  async toggleAutoRenew(passId: string, fanAddress: string, enable: boolean) {
    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      include: { fan: true },
    });

    if (!pass) {
      throw new NotFoundException('Pass not found');
    }

    if (pass.fan.stellarAddress !== fanAddress) {
      throw new ForbiddenException('Only the pass owner can toggle auto-renew');
    }

    return this.prisma.pass.update({
      where: { id: passId },
      data: { autoRenew: enable },
    });
  }

  async processExpiredPassesForAutoRenew() {
    const now = new Date();
    const expiredPasses = await this.prisma.pass.findMany({
      where: {
        active: true,
        expiresAt: { lte: now },
        autoRenew: true,
        supersededBy: null,
      },
      include: { tier: true, fan: true, creator: true },
    });

    for (const pass of expiredPasses) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // First mark the pass as inactive
          await tx.pass.update({
            where: { id: pass.id },
            data: { active: false },
          });

          // Create renewal attempt
          const renewalAttempt = await tx.renewalAttempt.create({
            data: {
              passId: pass.id,
              status: 'PENDING',
            },
          });

          // Trigger renewal via Stellar/Soroban
          const txHash = await this.stellarService.renewPass(pass.onChainId, pass.tier.onChainId);

          // Mint new pass
          const newPass = await this.mintPass(
            pass.tier.onChainId,
            pass.fan.stellarAddress,
            {
              tx,
              txHash,
            }
          );

          // Update old pass
          await tx.pass.update({
            where: { id: pass.id },
            data: { supersededBy: newPass.id },
          });

          // Update renewal attempt
          await tx.renewalAttempt.update({
            where: { id: renewalAttempt.id },
            data: { status: 'SUCCESS', txHash },
          });

          this.logger.log(`Successfully renewed pass ${pass.id} -> ${newPass.id}`);
        });
      } catch (error) {
        this.logger.error(`Failed to renew pass ${pass.id}: ${error.message}`);

        // Mark renewal attempt as failed
        await this.prisma.renewalAttempt.create({
          data: {
            passId: pass.id,
            status: 'FAILED',
            error: error.message,
          },
        });

        // Disable auto-renew
        await this.prisma.pass.update({
          where: { id: pass.id },
          data: { autoRenew: false },
        });

        // Notify fan
        if (this.notificationsGateway) {
          this.notificationsGateway.emitPassRenewalFailedEvent(
            pass.fan.stellarAddress,
            {
              passId: pass.id,
              tierName: pass.tier.name,
              creatorName: pass.creator.displayName,
              error: error.message,
            }
          ).catch((err) => {
            this.logger.error(`Error emitting renewal failed event: ${err.message}`);
          });
        }

        if (pass.fan.email) {
          this.emailService.sendPassRenewalFailedEmail(
            pass.fan.email,
            pass.tier.name,
            pass.creator.displayName,
            error.message
          ).catch((err) => {
            this.logger.error(`Error sending renewal failed email: ${err.message}`);
          });
        }
      }
    }

    return expiredPasses.length;
  }

  async changeTier(passId: string, newTierId: string, fanAddress: string) {
    const now = new Date();

    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      include: { tier: true, fan: true },
    });

    if (!pass) {
      throw new NotFoundException('Pass not found');
    }

    if (pass.fan.stellarAddress !== fanAddress) {
      throw new ForbiddenException('Only the pass owner can change tiers');
    }

    if (!pass.active || pass.expiresAt < now) {
      throw new BadRequestException('Pass is not active or is expired');
    }

    if (pass.tierId === newTierId) {
      throw new BadRequestException('New tier must differ from current tier');
    }

    const newTier = await this.prisma.tier.findUnique({
      where: { id: newTierId },
    });

    if (!newTier || !newTier.active) {
      throw new BadRequestException('New tier not found or inactive');
    }

    if (newTier.creatorId !== pass.creatorId) {
      throw new BadRequestException('New tier must belong to the same creator');
    }

    // Calculate remaining time
    const totalDurationMs = pass.tier.durationDays * 24 * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - pass.purchasedAt.getTime();
    const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
    const remainingRatio = remainingMs / totalDurationMs;

    // Calculate remaining value
    const oldPrice = Number(pass.tier.priceUsdc);
    const newPrice = Number(newTier.priceUsdc);
    const remainingValue = oldPrice * remainingRatio;

    // Calculate new duration (based on remaining value and new tier price)
    const newDurationDays = newPrice > 0 
      ? (remainingValue / newPrice) * newTier.durationDays 
      : newTier.durationDays;

    // Ensure minimum 1 day
    const finalDurationDays = Math.max(1, Math.floor(newDurationDays));

    // Determine if upgrade or downgrade
    const isUpgrade = newPrice > oldPrice;
    const priceDifference = newPrice - remainingValue;

    const result = await this.prisma.$transaction(async (tx) => {
      // Mark old pass as superseded and inactive
      const updatedOldPass = await tx.pass.update({
        where: { id: passId },
        data: {
          active: false,
          supersededBy: passId, // temporary, will be updated with new pass id
        },
      });

      // Create new pass
      const newPass = await tx.pass.create({
        data: {
          onChainId: BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000000)),
          tierId: newTierId,
          creatorId: pass.creatorId,
          fanId: pass.fanId,
          purchasedAt: now,
          expiresAt: new Date(now.getTime() + finalDurationDays * 24 * 60 * 60 * 1000),
          txHash: pass.txHash,
          trialUsed: pass.trialUsed,
          autoRenew: pass.autoRenew,
          syncedAt: now,
        },
        include: { tier: true, creator: true, fan: true },
      });

      // Update old pass's supersededBy with new pass id
      await tx.pass.update({
        where: { id: passId },
        data: { supersededBy: newPass.id },
      });

      return { oldPass: updatedOldPass, newPass, isUpgrade, priceDifference, remainingValue };
    });

    // Emit events
    if (result.isUpgrade) {
      this.webhooksService.deliverPassPurchaseWebhook(result.newPass.creatorId, {
        event: 'pass.tier_upgraded',
        oldPass: result.oldPass,
        newPass: result.newPass,
        priceDifference: result.priceDifference,
        remainingValue: result.remainingValue,
      }).catch(() => {});
    } else {
      this.webhooksService.deliverPassPurchaseWebhook(result.newPass.creatorId, {
        event: 'pass.tier_downgraded',
        oldPass: result.oldPass,
        newPass: result.newPass,
        priceDifference: result.priceDifference,
        remainingValue: result.remainingValue,
      }).catch(() => {});
    }

    this.webhooksService.deliverPassPurchaseWebhook(result.newPass.creatorId, {
      event: 'pass.superseded',
      oldPass: result.oldPass,
      newPass: result.newPass,
    }).catch(() => {});

    return result.newPass;
  }
}
