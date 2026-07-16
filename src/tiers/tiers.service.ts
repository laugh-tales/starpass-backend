import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { TierAnalyticsDto } from './tier-analytics.dto';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

const UNLOCK_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class TiersService {
  constructor(
    private prisma: PrismaService,
    @Optional() private config?: ConfigService,
    @Optional() private notificationsGateway?: NotificationsGateway,
  ) {}

  /**
   * Get all prices for a tier
   * @param tierId The unique identifier of the tier.
   * @returns A list of tier prices.
   * @throws {NotFoundException} If the tier is not found.
   */
  async getTierPrices(tierId: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    return this.prisma.tierPrice.findMany({
      where: { tierId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create multiple tiers for a creator in a single transaction.
   *
   * @param creatorAddress The creator's Stellar public key.
   * @param dtos Tier creation payloads.
   * @param callerAddress The authenticated caller's Stellar address.
   * @returns The created tier records.
   * @throws {ForbiddenException} If the caller is not the creator owner.
   * @throws {NotFoundException} If the creator is not found.
   */
  async bulkCreate(creatorAddress: string, dtos: CreateTierDto[], callerAddress: string) {
    if (creatorAddress !== callerAddress) {
      throw new ForbiddenException('You can only create tiers for your own profile');
    }

    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    const createdTiers = await this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.tier.create({
          data: {
            tenantId: creator.tenantId,
            onChainId: dto.onChainId,
            creatorId: creator.id,
            name: dto.name,
            description: dto.description,
            priceUsdc: dto.priceUsdc,
            durationDays: dto.durationDays,
            trialDays: dto.trialDays ?? 0,
            maxSupply: dto.maxSupply ?? 0,
            active: dto.active ?? true,
            syncedAt: new Date(),
          },
        }),
      ),
    );

    // Emit new_tier event for each created tier
    if (this.notificationsGateway) {
      for (const tier of createdTiers) {
        this.notificationsGateway.emitNewTierEvent(creatorAddress, tier).catch((err) => {
          console.error(`Error emitting new_tier event: ${err.message}`);
        });
      }
    }

    return createdTiers;
  }

  /**
   * Get all active tiers for a creator
   *
   * @param stellarAddress The Stellar public key of the creator.
   * @returns A list of active tiers for the given creator.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByCreator(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.prisma.tier.findMany({
      where: { creatorId: creator.id, active: true },
      orderBy: { onChainId: 'asc' },
    });
  }

  /**
   * Get a single tier by on-chain ID and creator address
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @param onChainId The on-chain ID of the tier.
   * @returns The tier record.
   * @throws {NotFoundException} If either the creator or the tier is not found.
   */
  async findOne(stellarAddress: string, onChainId: number) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const tier = await this.prisma.tier.findUnique({
      where: { creatorId_onChainId: { creatorId: creator.id, onChainId } },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    return tier;
  }

  /**
   * Upsert a tier from on-chain event data (called by indexer)
   * 
   * @param data The event data containing tier details from the blockchain.
   * @returns The upserted tier record, or null if the creator is not found.
   */
  async upsertFromChain(data: {
    onChainId: number;
    creatorAddress: string;
    name: string;
    priceUsdc: string;
    durationSeconds: number;
    maxSupply: number;
    minted: number;
    active: boolean;
  }) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: data.creatorAddress },
    });

    if (!creator) return null;

    const durationDays = Math.floor(data.durationSeconds / 86400);

    const tier = await this.prisma.tier.upsert({
      where: {
        creatorId_onChainId: {
          creatorId: creator.id,
          onChainId: data.onChainId,
        },
      },
      update: {
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
      create: {
        tenantId: creator.tenantId,
        onChainId: data.onChainId,
        creatorId: creator.id,
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
    });

    // Emit new_tier event for newly created tiers (not updates)
    if (this.notificationsGateway && data.active) {
      this.notificationsGateway.emitNewTierEvent(data.creatorAddress, tier).catch((err) => {
        console.error(`Error emitting new_tier event: ${err.message}`);
      });
    }

    return tier;
  }

  /**
   * List tiers with optional creator filter and pagination.
   *
   * @param page Page number (1-based).
   * @param limit Maximum records per page.
   * @param creatorId Optional internal creator UUID filter.
   * @returns Paginated tier list with total count.
   */
  async findAll(page: number, limit: number, creatorId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (creatorId) where.creatorId = creatorId;

    const [data, total] = await Promise.all([
      this.prisma.tier.findMany({ where, skip, take: limit, orderBy: { onChainId: 'asc' } }),
      this.prisma.tier.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * List tiers for a creator by Stellar address with pagination.
   *
   * @param creatorAddress The creator's Stellar public key.
   * @param page Page number (1-based).
   * @param limit Maximum records per page.
   * @returns Paginated tier list with total count.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByCreatorAddressPaginated(creatorAddress: string, page: number, limit: number) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.findAll(page, limit, creator.id);
  }

  private getPeriodDays(period: string) {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        throw new BadRequestException('Invalid period. Accepted values are 7d, 30d, 90d.');
    }
  }

  private normalizeDateToDay(date: Date) {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private addDays(date: Date, days: number) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  private buildPurchasesByDay(
    purchases: Array<{ purchasedAt: Date }>,
    startDate: Date,
    periodDays: number,
  ) {
    const purchasesByDay: Array<{ date: string; count: number }> = [];

    for (let dayIndex = 0; dayIndex < periodDays; dayIndex += 1) {
      const dayStart = this.addDays(startDate, dayIndex);
      const dayEnd = this.addDays(dayStart, 1);
      const date = dayStart.toISOString().slice(0, 10);

      const count = purchases.filter(
        (purchase) => purchase.purchasedAt >= dayStart && purchase.purchasedAt < dayEnd,
      ).length;

      purchasesByDay.push({ date, count });
    }

    return purchasesByDay;
  }

  /**
   * Get purchase analytics for a tier over a time period.
   *
   * @param tierId Internal tier UUID.
   * @param ownerUserId The authenticated creator's user ID.
   * @param period Analytics window (`7d`, `30d`, or `90d`).
   * @returns Purchase counts, revenue, active passes, and daily breakdown.
   * @throws {NotFoundException} If the tier is not found.
   * @throws {ForbiddenException} If the caller is not the tier owner.
   * @throws {BadRequestException} If the period is invalid.
   */
  async getAnalytics(tierId: string, ownerUserId: string, period = '30d'): Promise<TierAnalyticsDto> {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
      include: { creator: true },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    if (tier.creator.userId !== ownerUserId) {
      throw new ForbiddenException('You are not authorized to access this tier analytics');
    }

    const periodDays = this.getPeriodDays(period);
    const now = new Date();
    const endDate = this.normalizeDateToDay(now);
    const startDate = this.addDays(endDate, -periodDays + 1);
    const price = Number(tier.priceUsdc);

    const [purchasesInPeriod, activePasses] = await Promise.all([
      this.prisma.pass.findMany({
        where: {
          tierId,
          purchasedAt: { gte: startDate, lte: now },
        },
        select: { purchasedAt: true },
      }),
      this.prisma.pass.count({
        where: {
          tierId,
          active: true,
          expiresAt: { gt: now },
        },
      }),
    ]);

    const totalPurchases = purchasesInPeriod.length;
    const totalRevenue = Number((totalPurchases * price).toFixed(2));
    const purchasesByDay = this.buildPurchasesByDay(purchasesInPeriod, startDate, periodDays);

    return {
      totalPurchases,
      totalRevenue,
      activePasses,
      purchasesByDay,
    };
  }

  // ── Content unlock ────────────────────────────────────────────────────────

  private sign(payload: string): string {
    const secret = this.config?.get<string>('CONTENT_URL_SECRET') ?? process.env.CONTENT_URL_SECRET!;
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Issue a signed temporary content URL for a verified pass holder.
   *
   * @param tierId Internal tier UUID.
   * @param fanAddress The fan's Stellar public key.
   * @returns Signed unlock token and expiry timestamp.
   * @throws {NotFoundException} If the tier is not found.
   * @throws {ForbiddenException} If the fan has no valid pass for the tier.
   */
  async unlockContent(tierId: string, fanAddress: string): Promise<{ token: string; expiresAt: string }> {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');

    const fan = await this.prisma.fan.findUnique({ where: { stellarAddress: fanAddress } });
    const hasPass = fan
      ? !!(await this.prisma.pass.findFirst({
          where: { fanId: fan.id, tierId, active: true, expiresAt: { gt: new Date() } },
        }))
      : false;

    if (!hasPass) throw new ForbiddenException('No valid pass for this tier');

    const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
    const payload = `${tierId}:${fanAddress}:${expiresAt}`;
    const sig = this.sign(payload);
    // token = base64(payload):sig
    const token = `${Buffer.from(payload).toString('base64url')}.${sig}`;

    return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  /**
   * Verify a previously issued content unlock token.
   *
   * @param tierId Internal tier UUID the token was issued for.
   * @param token The signed unlock token.
   * @returns Validation result and fan address when valid.
   */
  verifyContentToken(tierId: string, token: string): { valid: boolean; fanAddress?: string } {
    try {
      const [encodedPayload, sig] = token.split('.');
      if (!encodedPayload || !sig) return { valid: false };

      const payload = Buffer.from(encodedPayload, 'base64url').toString();
      const [payloadTierId, fanAddress, expiresAtStr] = payload.split(':');

      if (payloadTierId !== tierId) return { valid: false };

      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return { valid: false };

      const expectedSig = this.sign(payload);
      if (expectedSig !== sig) return { valid: false };

      return { valid: true, fanAddress };
    } catch {
      return { valid: false };
    }
  }
}
