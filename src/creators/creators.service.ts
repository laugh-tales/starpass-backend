import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Logger, Optional, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

const ACTIVATION_BATCH_SIZE = 100;
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { CreatorAnalyticsDto } from './creator-analytics.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private notifications?: NotificationsService,
    @Optional() @Inject(CACHE_MANAGER) private cacheManager?: any,
  ) {}

  /**
   * List featured creators ordered by featured rank.
   *
   * @returns Featured creator records.
   */
  async findFeatured(tenantId?: string) {
    return this.prisma.creator.findMany({
      where: { 
        featured: true,
        ...(tenantId && { tenantId }),
      },
      orderBy: { featuredOrder: 'asc' },
    });
  }

  /**
   * List creators with optional category filter and pagination.
   *
   * @param page Page number (1-based).
   * @param limit Maximum records per page.
   * @param category Optional category slug filter.
   * @returns Paginated creator list with total count.
   */
  async findAll(page: number, limit: number, category?: string, tenantId?: string) {
    const skip = (page - 1) * limit;
    const categorySlug = category ? slugify(category) : undefined;
    const where = {
      ...(categorySlug && { categories: { some: { slug: categorySlug } } }),
      ...(tenantId && { tenantId }),
    };
    const [creators, total] = await Promise.all([
      this.prisma.creator.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { categories: true },
      }),
      this.prisma.creator.count({ where }),
    ]);
    return { data: creators, total, page, limit };
  }

  /**
   * Get a creator profile by Stellar address.
   *
   * @param stellarAddress The creator's Stellar public key.
   * @returns The creator record with categories.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByAddress(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
      include: { categories: true },
    });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  /**
   * Register the authenticated user as a creator.
   *
   * @param userId The authenticated user's internal ID.
   * @param dto Creator profile fields.
   * @param stellarAddress The creator's Stellar public key.
   * @returns The newly created creator record.
   */
  async register(userId: string, dto: CreateCreatorDto, stellarAddress: string, tenantId?: string) {
    // Get tenantId from user if not provided
    if (!tenantId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });
      if (!user) throw new NotFoundException('User not found');
      tenantId = user.tenantId;
    }

    // Check tenant limits
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxCreators: true },
    });

    if (tenant) {
      const creatorCount = await this.prisma.creator.count({
        where: { tenantId },
      });

      if (creatorCount >= tenant.maxCreators) {
        throw new BadRequestException('Maximum number of creators reached for this tenant');
      }
    }

    return this.prisma.creator.create({
      data: {
        stellarAddress,
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        tenantId,
        registeredAt: new Date(),
        user: { connect: { id: userId } },
      },
    });
  }

  /**
   * Update a creator profile.
   *
   * @param stellarAddress The creator's Stellar public key.
   * @param dto Fields to update.
   * @returns The updated creator record.
   * @throws {NotFoundException} If the creator is not found.
   */
  async update(stellarAddress: string, dto: UpdateCreatorDto) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    const updated = await this.prisma.creator.update({ where: { id: creator.id }, data: dto });
    try { await this.cacheManager.del(`creator:${stellarAddress}`); } catch {}
    return updated;
  }

  /**
   * Replace a creator's category assignments.
   *
   * @param ownerUserId The authenticated creator's user ID.
   * @param categories Category slugs to assign.
   * @returns The updated creator with categories.
   * @throws {NotFoundException} If the creator is not found.
   * @throws {BadRequestException} If any category slug is invalid.
   */
  async updateCategories(ownerUserId: string, categories: string[]) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const normalizedCategories = Array.from(
      new Set(categories.map((category) => slugify(category)).filter(Boolean)),
    );

    if (normalizedCategories.length > 0) {
      const existingCategories = await this.prisma.category.findMany({
        where: { slug: { in: normalizedCategories } },
        select: { slug: true },
      });

      if (existingCategories.length !== normalizedCategories.length) {
        throw new BadRequestException('One or more categories are invalid');
      }
    }

    return this.prisma.creator.update({
      where: { id: creator.id },
      data: {
        categories: {
          set: normalizedCategories.map((slug) => ({ slug })),
        },
      },
      include: { categories: true },
    });
  }

  /**
   * Get total earnings summary for a creator.
   *
   * @param stellarAddress The creator's Stellar public key.
   * @returns Earnings total and pass count.
   * @throws {NotFoundException} If the creator is not found.
   */
  async getEarnings(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    const passes = await this.prisma.pass.findMany({
      where: { creatorId: creator.id },
      include: { tier: true },
    });
    const total = passes.reduce((sum, p) => sum + Number(p.tier.priceUsdc), 0);
    return { stellarAddress, totalEarnings: total, passCount: passes.length };
  }

  /**
   * Get paginated earnings history for a creator.
   *
   * @param ownerUserId The authenticated creator's user ID.
   * @param options Date range and pagination options.
   * @returns Paginated earnings records.
   * @throws {NotFoundException} If the creator is not found.
   */
  async getEarningsHistory(
    ownerUserId: string,
    options: { from?: string; to?: string; page?: number; limit?: number },
  ) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const { from, to, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = { creatorId: creator.id };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.earningsRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { fan: true, tier: true },
      }),
      this.prisma.earningsRecord.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Record an earnings entry for a pass purchase.
   *
   * @param creatorId Internal creator UUID.
   * @param fanId Internal fan UUID.
   * @param tierId Internal tier UUID.
   * @param amount Gross purchase amount.
   * @returns The created earnings record.
   */
  async recordEarning(creatorId: string, fanId: string, tierId: string, amount: number) {
    const fee = 0;
    const netAmount = amount - fee;

    return this.prisma.earningsRecord.create({
      data: {
        creatorId,
        fanId,
        tierId,
        amount,
        fee,
        netAmount,
      },
    });
  }

  /**
   * Get revenue analytics summary for a creator.
   *
   * @param ownerUserId The authenticated creator's user ID.
   * @returns Total revenue, pass count, pending balance, and top tiers.
   * @throws {NotFoundException} If the creator is not found.
   */
  async getRevenue(ownerUserId: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const passes = await this.prisma.pass.findMany({
      where: { creatorId: creator.id },
      include: { tier: true },
    });

    const revenueByTier = new Map<string, { id: string; name: string; revenue: number }>();
    let totalRevenue = 0;

    for (const pass of passes) {
      const price = Number(pass.tier.priceUsdc);
      totalRevenue += price;

      const tierSummary = revenueByTier.get(pass.tier.id);
      if (tierSummary) {
        tierSummary.revenue += price;
      } else {
        revenueByTier.set(pass.tier.id, {
          id: pass.tier.id,
          name: pass.tier.name,
          revenue: price,
        });
      }
    }

    const topTiers = Array.from(revenueByTier.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((tier) => ({
        id: tier.id,
        name: tier.name,
        revenue: Number(tier.revenue.toFixed(2)),
      }));

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalPasses: passes.length,
      pendingBalance: Number(creator.totalEarned ?? 0),
      topTiers,
    };
  }

  private static analyticsCache = new Map<string, { expiresAt: number; value: CreatorAnalyticsDto }>();
  private static readonly CACHE_TTL_SECONDS = 3600;

  private buildAnalyticsCacheKey(creatorId: string, period: string) {
    return `creator:analytics:id:${creatorId}:period:${period}`;
  }

  private getPeriodDays(period: string) {
    switch (period) {
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        throw new BadRequestException('Invalid period. Accepted values are 30d, 90d, 1y.');
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

  /**
   * Get subscription analytics for a creator over a time period.
   *
   * @param ownerUserId The authenticated creator's user ID.
   * @param period Analytics window (`30d`, `90d`, or `1y`).
   * @returns Subscriber growth, churn, average pass duration, and retention metrics.
   * @throws {NotFoundException} If the creator is not found.
   * @throws {BadRequestException} If the period is invalid.
   */
  async getAnalytics(ownerUserId: string, period = '30d') {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const periodDays = this.getPeriodDays(period);
    const cacheKey = this.buildAnalyticsCacheKey(ownerUserId, period);
    const cached = CreatorsService.analyticsCache.get(cacheKey);
    const now = new Date();

    if (cached && cached.expiresAt > now.getTime()) {
      return cached.value;
    }

    const endDate = this.normalizeDateToDay(now);
    const startDate = this.addDays(endDate, -periodDays + 1);

    const passes = await this.prisma.pass.findMany({
      where: {
        creatorId: creator.id,
        OR: [
          { purchasedAt: { gte: startDate } },
          { expiresAt: { gte: startDate } },
        ],
      },
      select: {
        id: true,
        purchasedAt: true,
        expiresAt: true,
      },
    });

    const subscriberGrowth = this.buildSubscriberGrowth(passes, startDate, endDate, periodDays);
    const churnRate = this.calculateChurnRate(passes, startDate, endDate);
    const avgPassDuration = this.calculateAveragePassDuration(passes, endDate);
    const retentionRate = this.calculateRetentionRate(passes, startDate, endDate);

    const analytics: CreatorAnalyticsDto = {
      subscriberGrowth,
      churnRate,
      avgPassDuration,
      retentionRate,
    };

    CreatorsService.analyticsCache.set(cacheKey, {
      expiresAt: now.getTime() + CreatorsService.CACHE_TTL_SECONDS * 1000,
      value: analytics,
    });

    return analytics;
  }

  private buildSubscriberGrowth(
    passes: Array<{ id: string; purchasedAt: Date; expiresAt: Date }>,
    startDate: Date,
    endDate: Date,
    periodDays: number,
  ) {
    const growth: Array<{ date: string; count: number }> = [];
    const daily = periodDays <= 90;
    const bucketCount = daily ? periodDays : Math.ceil(periodDays / 7);

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const bucketStart = this.addDays(startDate, daily ? bucketIndex : bucketIndex * 7);
      const bucketEnd = daily
        ? this.addDays(bucketStart, 1)
        : this.addDays(bucketStart, 7);

      const count = passes.filter((pass) => {
        return pass.purchasedAt <= bucketEnd && pass.expiresAt > bucketStart;
      }).length;

      growth.push({ date: bucketStart.toISOString().slice(0, 10), count });
    }

    return growth;
  }

  private calculateChurnRate(
    passes: Array<{ purchasedAt: Date; expiresAt: Date }>,
    startDate: Date,
    endDate: Date,
  ) {
    const churned = passes.filter(
      (pass) =>
        pass.purchasedAt <= startDate &&
        pass.expiresAt > startDate &&
        pass.expiresAt <= endDate,
    ).length;
    const activeAtStart = passes.filter(
      (pass) => pass.purchasedAt <= startDate && pass.expiresAt > startDate,
    ).length;

    if (!activeAtStart) return 0;
    return Number(((churned / activeAtStart) * 100).toFixed(1));
  }

  private calculateAveragePassDuration(
    passes: Array<{ purchasedAt: Date; expiresAt: Date }>,
    now: Date,
  ) {
    const durations = passes.map((pass) => {
      const end = pass.expiresAt > now ? now : pass.expiresAt;
      const diffMs = end.getTime() - pass.purchasedAt.getTime();
      return diffMs > 0 ? diffMs / (1000 * 60 * 60 * 24) : 0;
    });

    if (!durations.length) return 0;
    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return Number(average.toFixed(1));
  }

  /**
   * Block a fan from purchasing passes from this creator.
   *
   * @param creatorId The authenticated creator's user ID.
   * @param blockedAddress The fan's Stellar public key to block.
   * @returns The block record.
   * @throws {NotFoundException} If the creator is not found.
   */
  async blockFan(creatorId: string, blockedAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    return this.prisma.block.upsert({
      where: { creatorId_blockedAddress: { creatorId: creator.id, blockedAddress } },
      update: {},
      create: { creatorId: creator.id, blockedAddress },
    });
  }

  /**
   * Add a team member to a creator account.
   *
   * @param creatorId Internal creator UUID.
   * @param callerAddress Stellar address of the caller.
   * @param newMemberAddress Stellar address of the new member.
   * @param role Member role (`OWNER` or `EDITOR`).
   * @returns The created member record.
   * @throws {NotFoundException} If the creator is not found.
   * @throws {ForbiddenException} If the caller is not authorized.
   * @throws {ConflictException} If the member already exists.
   */
  async addMember(creatorId: string, callerAddress: string, newMemberAddress: string, role: 'OWNER' | 'EDITOR') {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    if (callerAddress !== creator.stellarAddress) {
      const callerMember = await this.prisma.creatorMember.findFirst({ where: { creatorId, address: callerAddress } });
      if (!callerMember || callerMember.role !== 'OWNER') throw new ForbiddenException('Not authorized to add members');
    }

    const existing = await this.prisma.creatorMember.findUnique({ where: { creatorId_address: { creatorId, address: newMemberAddress } } });
    if (existing) throw new ConflictException('Member already exists');

    return this.prisma.creatorMember.create({ data: { creatorId, address: newMemberAddress, role } });
  }

  /**
   * Remove a team member from a creator account.
   *
   * @param creatorId Internal creator UUID.
   * @param callerAddress Stellar address of the caller.
   * @param memberAddress Stellar address of the member to remove.
   * @returns A confirmation message.
   * @throws {NotFoundException} If the creator or member is not found.
   * @throws {ForbiddenException} If the caller is not authorized.
   */
  async removeMember(creatorId: string, callerAddress: string, memberAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    if (callerAddress !== creator.stellarAddress) {
      const callerMember = await this.prisma.creatorMember.findFirst({ where: { creatorId, address: callerAddress } });
      if (!callerMember || callerMember.role !== 'OWNER') throw new ForbiddenException('Not authorized to remove members');
    }

    const member = await this.prisma.creatorMember.findUnique({ where: { creatorId_address: { creatorId, address: memberAddress } } });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.creatorMember.delete({ where: { creatorId_address: { creatorId, address: memberAddress } } });
    return { message: 'Member removed' };
  }

  /**
   * Check whether an address is the creator owner or a team member.
   *
   * @param creatorId Internal creator UUID.
   * @param address Stellar address to check.
   * @returns True if the address is the owner or a member.
   */
  async isMemberOrOwner(creatorId: string, address: string): Promise<boolean> {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) return false;
    if (creator.stellarAddress === address) return true;
    const member = await this.prisma.creatorMember.findFirst({ where: { creatorId, address } });
    return !!member;
  }

  /**
   * Unblock a fan for this creator.
   *
   * @param creatorId The authenticated creator's user ID.
   * @param blockedAddress The fan's Stellar public key to unblock.
   * @returns A confirmation message.
   * @throws {NotFoundException} If the creator is not found.
   */
  async unblockFan(creatorId: string, blockedAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    await this.prisma.block.deleteMany({ where: { creatorId: creator.id, blockedAddress } });
    return { message: 'Fan unblocked' };
  }

  /**
   * Check whether a fan is blocked by a creator.
   *
   * @param creatorId Internal creator UUID.
   * @param blockedAddress The fan's Stellar public key.
   * @returns True if the fan is blocked.
   */
  async isBlocked(creatorId: string, blockedAddress: string): Promise<boolean> {
    const count = await this.prisma.block.count({ where: { creatorId, blockedAddress } });
    return count > 0;
  }

  private calculateRetentionRate(
    passes: Array<{ purchasedAt: Date; expiresAt: Date }>,
    startDate: Date,
    endDate: Date,
  ) {
    const activeAtStart = passes.filter(
      (pass) => pass.purchasedAt <= startDate && pass.expiresAt > startDate,
    ).length;
    const activeAtEnd = passes.filter(
      (pass) => pass.purchasedAt <= endDate && pass.expiresAt > endDate,
    ).length;

    if (!activeAtStart) return 0;
    return Number(((activeAtEnd / activeAtStart) * 100).toFixed(1));
  }

  /**
   * Record a payout for a creator after a successful withdrawal.
   *
   * @param creatorId - Internal creator UUID.
   * @param amount - Payout amount in USDC.
   * @param txHash - On-chain transaction hash.
   * @param status - Payout status (defaults to COMPLETED).
   * @returns The created Payout record.
   * @throws {NotFoundException} If the creator is not found.
   */
  async recordPayout(
    creatorId: string,
    amount: string,
    txHash?: string | null,
    status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'COMPLETED',
  ) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.payout.create({
      data: {
        creatorId,
        amount,
        txHash: txHash ?? null,
        status,
      },
    });
  }

  /**
   * Schedule tier content to become available at a future time.
   *
   * @param ownerUserId The authenticated creator's user ID.
   * @param dto Tier ID, content URL, and availability timestamp.
   * @returns The created content schedule record.
   * @throws {NotFoundException} If the creator or tier is not found.
   * @throws {BadRequestException} If `availableAt` is invalid.
   */
  async createContentSchedule(ownerUserId: string, dto: { tierId: string; contentUrl: string; availableAt: string }) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const tier = await this.prisma.tier.findUnique({ where: { id: dto.tierId } });
    if (!tier || tier.creatorId !== creator.id) throw new NotFoundException('Tier not found');

    const availableAt = new Date(dto.availableAt);
    if (isNaN(availableAt.getTime())) throw new BadRequestException('Invalid availableAt');

    return this.prisma.contentSchedule.create({
      data: {
        creatorId: creator.id,
        tierId: tier.id,
        contentUrl: dto.contentUrl,
        availableAt,
      },
    });
  }

  /**
   * Activate due content schedules and notify pass holders.
   * Idempotent: only activates schedules where `active` is false.
   *
   * @returns IDs of schedules activated in this run.
   */
  async activateDueContent() {
    const now = new Date();

    const due = await this.prisma.contentSchedule.findMany({
      where: { active: false, availableAt: { lte: now } },
      orderBy: { availableAt: 'asc' },
      take: ACTIVATION_BATCH_SIZE,
    });

    if (due.length === 0) return [];

    const activated: string[] = [];

    for (const schedule of due) {
      try {
        // Update schedule to active if still inactive (idempotent)
        const updated = await this.prisma.contentSchedule.updateMany({
          where: { id: schedule.id, active: false },
          data: { active: true },
        });

        if (updated.count === 0) continue; // another worker already activated

        // Find active, unexpired passes for the tier
        const passes = await this.prisma.pass.findMany({
          where: { tierId: schedule.tierId, active: true, expiresAt: { gt: now } },
          select: { fanId: true },
        });

        const fanIds = passes.map((p) => p.fanId);

        if (fanIds.length > 0 && this.notifications) {
          const title = 'New content available';
          const body = `Content is now available for your pass: ${schedule.contentUrl}`;
          await this.notifications.bulkCreateForFans(fanIds, title, body, { contentUrl: schedule.contentUrl, tierId: schedule.tierId });
        }

        activated.push(schedule.id);
      } catch (err) {
        this.logger.error(`Failed to activate schedule ${schedule.id}: ${err.message ?? err}`);
      }
    }

    return activated;
  }

  /**
   * Return paginated payout history for a creator.
   * Only the creator themselves may access this data (enforced at controller layer).
   *
   * @param ownerUserId - JWT subject (user ID) of the authenticated creator.
   * @param dto - Pagination options.
   * @returns Paginated list of payouts plus total count.
   * @throws {NotFoundException} If the creator record is not found for the given user.
   * @throws {ForbiddenException} If the requester is not the creator owner.
   */
  async getPayouts(ownerUserId: string, requestUserId: string, dto: ListPayoutsDto) {
    if (ownerUserId !== requestUserId) {
      throw new ForbiddenException('You are not authorized to access this creator payout history');
    }

    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where: { creatorId: creator.id } }),
    ]);

    return { data, total, page, limit };
  }

  async createApiKey(ownerUserId: string, name: string, permissions: string[]) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const rawKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        key: hashedKey,
        creatorId: creator.id,
        permissions,
      },
    });

    return { id: apiKey.id, name: apiKey.name, key: rawKey, permissions: apiKey.permissions };
  }

  async deleteApiKey(ownerUserId: string, keyId: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: ownerUserId } });
    if (!creator) throw new NotFoundException('Creator not found');

    await this.prisma.apiKey.deleteMany({
      where: { id: keyId, creatorId: creator.id },
    });

    return { message: 'API key deleted' };
  }

  async validateApiKey(rawKey: string) {
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({ where: { key: hashedKey } });
    if (!apiKey) return null;

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return apiKey;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const creator = await this.prisma.creator.findUnique({ where: { userId } });
    if (!creator) throw new NotFoundException('Creator not found');

    // For now, we'll just use a placeholder URL. In a real implementation, you would upload the file
    // to a storage service (S3, IPFS, etc.) and use that URL.
    const avatarUrl = `/uploads/avatars/${creator.id}-${Date.now()}${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;

    const updatedCreator = await this.prisma.creator.update({
      where: { userId },
      data: { avatarUrl },
    });

    try {
      await this.cacheManager?.del(`creator:${creator.stellarAddress}`);
    } catch {}

    return updatedCreator;
  }
}
