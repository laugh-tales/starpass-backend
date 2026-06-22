import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [
      totalCreators,
      totalFans,
      totalPasses,
      activePasses,
      newUsersToday,
      allPasses,
    ] = await Promise.all([
      this.prisma.creator.count(),
      this.prisma.fan.count(),
      this.prisma.pass.count(),
      this.prisma.pass.count({ where: { active: true, expiresAt: { gt: now } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.pass.findMany({ include: { tier: true } }),
    ]);

    const totalRevenue = allPasses.reduce((sum, p) => sum + Number(p.tier.priceUsdc), 0);

    return {
      totalCreators,
      totalFans,
      totalPasses,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      activePasses,
      newUsersToday,
    };
  }
}
