import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class FansService {
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

  async scheduleDeletion(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({ where: { stellarAddress } });
    if (!fan) throw new NotFoundException('Fan not found');
    if (fan.deletionScheduledAt) {
      throw new BadRequestException(`Account deletion already scheduled for ${fan.deletionScheduledAt.toISOString()}`);
    }

    const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.fan.update({
        where: { id: fan.id },
        data: { deletionScheduledAt: deletionDate, displayName: '[deletion pending]' },
      }),
      this.prisma.pass.updateMany({
        where: { fanId: fan.id, active: true },
        data: { active: false },
      }),
    ]);

    return {
      message: 'Account deletion scheduled',
      deletionDate: deletionDate.toISOString(),
      note: 'Personal data will be anonymized and transaction records retained for compliance. Cancel by contacting support within 30 days.',
    };
  }
}
