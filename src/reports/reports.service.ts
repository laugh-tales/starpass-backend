import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportStatus, ReportTargetType } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async submitReport(userId: string, dto: CreateReportDto) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const count = await this.prisma.report.count({
      where: {
        reporterId: userId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (count >= 5) {
      throw new BadRequestException('Maximum 5 reports per day allowed');
    }

    if (dto.targetType === ReportTargetType.CREATOR) {
      const creator = await this.prisma.creator.findUnique({
        where: { id: dto.targetId },
      });
      if (!creator) {
        throw new NotFoundException('Creator not found');
      }
    } else if (dto.targetType === ReportTargetType.TIER) {
      const tier = await this.prisma.tier.findUnique({
        where: { id: dto.targetId },
      });
      if (!tier) {
        throw new NotFoundException('Tier not found');
      }
    }

    return this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { reporter: true },
      }),
      this.prisma.report.count(),
    ]);
    return { data: reports, total, page, limit };
  }

  async updateStatus(id: string, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return this.prisma.report.update({
      where: { id },
      data: { status },
    });
  }
}
