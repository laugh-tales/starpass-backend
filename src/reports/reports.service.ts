import { Injectable, NotFoundException, TooManyRequestsException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ReportsService {
  private reportRateLimit = new Map<string, number[]>();

  constructor(private prisma: PrismaService) {}

  async submitReport(
    reporterId: string,
    targetType: 'creator' | 'tier',
    targetId: string,
    reason: string,
  ) {
    const today = new Date().toDateString();
    const key = `${reporterId}:${today}`;
    const existing = this.reportRateLimit.get(key) ?? [];

    if (existing.length >= 5) {
      throw new TooManyRequestsException('Maximum 5 reports per day reached');
    }

    this.reportRateLimit.set(key, [...existing, Date.now()]);

    return this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason },
    });
  }

  async listReports(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async resolveReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.report.update({ where: { id }, data: { status } });
  }
}
