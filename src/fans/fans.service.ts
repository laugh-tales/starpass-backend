import { Injectable, NotFoundException, TooManyRequestsException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class FansService {
  private exportRateLimit = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  /**
   * Find a fan by their Stellar address along with their active passes.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The fan record including their active passes, tiers, and creators.
   * @throws {NotFoundException} If the fan is not found.
   */
  async findByAddress(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
      include: {
        passes: {
          where: { active: true, expiresAt: { gt: new Date() } },
          include: { tier: true, creator: true },
        },
      },
    });

    if (!fan) throw new NotFoundException('Fan not found');
    return fan;
  }

  /**
   * Get all active subscriptions (passes) for a fan.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns A list of active passes with their associated creator and tier details.
   * @throws {NotFoundException} If the fan is not found.
   */
  async getSubscriptions(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    const now = new Date();
    return this.prisma.pass.findMany({
      where: { fanId: fan.id, active: true, expiresAt: { gt: now } },
      include: { creator: true, tier: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async exportData(stellarAddress: string) {
    const lastExport = this.exportRateLimit.get(stellarAddress);
    if (lastExport && Date.now() - lastExport < 24 * 60 * 60 * 1000) {
      const nextAllowed = new Date(lastExport + 24 * 60 * 60 * 1000).toISOString();
      throw new TooManyRequestsException(`Data export allowed once per 24 hours. Next allowed at ${nextAllowed}`);
    }

    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
      include: {
        passes: {
          include: { tier: { select: { name: true, durationDays: true, priceUsdc: true } }, creator: { select: { displayName: true, stellarAddress: true } } },
          orderBy: { purchasedAt: 'desc' },
        },
      },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    this.exportRateLimit.set(stellarAddress, Date.now());

    const now = new Date();
    const activity = fan.passes.flatMap((p) => {
      const events = [{ type: 'pass_purchased', tierId: p.tierId, tierName: p.tier.name, creator: p.creator.displayName, at: p.purchasedAt.toISOString() }];
      if (p.expiresAt <= now) {
        events.push({ type: 'pass_expired', tierId: p.tierId, tierName: p.tier.name, creator: p.creator.displayName, at: p.expiresAt.toISOString() });
      }
      return events;
    }).sort((a, b) => b.at.localeCompare(a.at));

    return {
      exportedAt: now.toISOString(),
      profile: {
        stellarAddress: fan.stellarAddress,
        displayName: fan.displayName,
        createdAt: fan.createdAt.toISOString(),
      },
      passes: fan.passes.map((p) => ({
        id: p.id,
        tier: p.tier.name,
        creator: p.creator.displayName,
        purchasedAt: p.purchasedAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        active: p.active && p.expiresAt > now,
      })),
      activity,
    };
  }
}
