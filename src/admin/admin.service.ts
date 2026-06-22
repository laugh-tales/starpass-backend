import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCreators,
      totalFans,
      totalPasses,
      activePasses,
      newUsersToday,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.creator.count(),
      this.prisma.fan.count(),
      this.prisma.pass.count(),
      this.prisma.pass.count({ where: { active: true, expiresAt: { gt: new Date() } } }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.creator.aggregate({ _sum: { totalEarned: true } }),
    ]);

    return {
      totalCreators,
      totalFans,
      totalPasses,
      activePasses,
      newUsersToday,
      totalRevenue: revenueAgg._sum.totalEarned?.toFixed(2) ?? '0.00',
    };
  }
}
