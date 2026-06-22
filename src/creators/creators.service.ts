import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { CreatorAnalyticsDto } from './creator-analytics.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';

@Injectable()
export class CreatorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = categorySlug
      ? { categories: { some: { category: { slug: categorySlug } } } }
      : undefined;
    const [creators, total] = await Promise.all([
      this.prisma.creator.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { categories: { include: { category: true } } },
      }),
      this.prisma.creator.count({ where }),
    ]);
    return { data: creators, total, page, limit };
  }

  async findByAddress(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  async register(userId: string, dto: CreateCreatorDto, stellarAddress: string) {
    return this.prisma.creator.create({
      data: {
        stellarAddress,
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        twitterUrl: dto.twitterUrl,
        instagramUrl: dto.instagramUrl,
        websiteUrl: dto.websiteUrl,
        registeredAt: new Date(),
        user: { connect: { id: userId } },
      },
    });
  }

  async update(stellarAddress: string, dto: UpdateCreatorDto) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    return this.prisma.creator.update({ where: { id: creator.id }, data: dto });
  }

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

  async blockFan(creatorId: string, fanAddress: string, reason?: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    return this.prisma.block.upsert({
      where: { creatorId_fanAddress: { creatorId: creator.id, fanAddress } },
      update: { reason },
      create: { creatorId: creator.id, fanAddress, reason },
    });
  }

  async unblockFan(creatorId: string, fanAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { userId: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    await this.prisma.block.deleteMany({ where: { creatorId: creator.id, fanAddress } });
    return { message: 'Fan unblocked' };
  }

  async isBlocked(creatorId: string, fanAddress: string): Promise<boolean> {
    const count = await this.prisma.block.count({ where: { creatorId, fanAddress } });
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
}
